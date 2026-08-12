const express = require('express');
const router = express.Router();
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const Settings = require('../models/Settings');
const EligibleVoter = require('../models/EligibleVoter');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');
const rateLimit = require('express-rate-limit');
const {
    isNonEmptyString,
    isValidEmail,
    isValidObjectId,
    normalizeEmail,
    toTrimmedString,
} = require('../utils/validation');

const verifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

const voteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = function(io) {
    
    // Check if voter is eligible
    router.post('/verify', verifyLimiter, async (req, res) => {
        try {
            const { name, email } = req.body ?? {};
            const cleanName = toTrimmedString(name);
            const cleanEmail = normalizeEmail(email);

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!isValidEmail(cleanEmail)) {
                return res.status(400).json({ error: 'Email is required and must be valid' });
            }

            const voter = await EligibleVoter.findOne({ email: cleanEmail }).lean();
            if (!voter) {
                return res.status(403).json({ error: 'You are not on the eligible voters list. Contact the admin.' });
            }
            res.json({ success: true, message: 'Verified' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Get all positions and their candidates
    router.get('/positions', async (req, res) => {
        try {
            const positions = await Position.find().lean();
            for (let pos of positions) {
                pos.candidates = await Candidate.find({ positionId: pos._id }).lean();
            }
            res.json(positions);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Submit votes
    router.post('/vote', voteLimiter, async (req, res) => {
        try {
            const { name, email, selections } = req.body ?? {};
            const cleanName = toTrimmedString(name);
            const cleanEmail = normalizeEmail(email);

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!isValidEmail(cleanEmail)) {
                return res.status(400).json({ error: 'Valid email is required' });
            }

            if (!Array.isArray(selections) || selections.length === 0) {
                return res.status(400).json({ error: 'Invalid input' });
            }

            const positions = await Position.find().lean();
            if (positions.length === 0) {
                return res.status(400).json({ error: 'No positions are configured yet' });
            }

            if (selections.length !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position' });
            }

            const candidateLookup = new Map();
            for (const position of positions) {
                const candidates = await Candidate.find({ positionId: position._id }).lean();
                candidateLookup.set(String(position._id), new Set(candidates.map((candidate) => String(candidate._id))));
            }

            const normalizedSelections = new Map();
            for (const selection of selections) {
                const positionId = selection?.positionId;
                const candidateId = selection?.candidateId;

                if (!isValidObjectId(positionId) || !isValidObjectId(candidateId)) {
                    return res.status(400).json({ error: 'Each selection must contain valid positionId and candidateId values' });
                }

                if (normalizedSelections.has(positionId)) {
                    return res.status(400).json({ error: 'Duplicate selections for the same position are not allowed' });
                }

                const validCandidates = candidateLookup.get(positionId);
                if (!validCandidates || !validCandidates.has(candidateId)) {
                    return res.status(400).json({ error: 'Invalid candidate selected for a position' });
                }

                normalizedSelections.set(positionId, candidateId);
            }

            if (normalizedSelections.size !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position' });
            }

            const settings = await Settings.findOne();
            if (settings) {
                const now = new Date();
                let isOpen = settings.votingOpen;
                
                // If schedule is set, override manual toggle
                if (settings.scheduledStartTime && settings.scheduledCloseTime) {
                    isOpen = (now >= settings.scheduledStartTime && now <= settings.scheduledCloseTime);
                } else if (settings.scheduledStartTime) {
                    isOpen = (now >= settings.scheduledStartTime);
                } else if (settings.scheduledCloseTime) {
                    isOpen = (now <= settings.scheduledCloseTime);
                }

                if (!isOpen) {
                    return res.status(403).json({ error: 'Voting is currently closed.' });
                }
            }

            // Check eligibility again
            const eligible = await EligibleVoter.findOne({ email: cleanEmail }).lean();
            if (!eligible) {
                return res.status(403).json({ error: 'Not eligible to vote.' });
            }

            // Check if already voted
            const existingVoter = await Voter.findOne({ email: cleanEmail }).lean();
            if (existingVoter) {
                return res.status(403).json({ error: 'This email has already been used to vote.' });
            }

            // Record the voter using the official roster name
            const newVoter = new Voter({ name: eligible.name, email: cleanEmail });
            await newVoter.save();

            // Insert all votes
            const votesToInsert = [...normalizedSelections.entries()].map(([positionId, candidateId]) => ({
                voterId: newVoter._id,
                positionId,
                candidateId
            }));

            await Vote.insertMany(votesToInsert);

            // Broadcast results update for live viewing (Admin and Public)
            io.emit('results-updated');

            res.json({ success: true, message: 'Your votes have been recorded.' });
        } catch (err) {
            console.error(err);
            if (err.code === 11000) {
                 return res.status(403).json({ error: 'Duplicate vote detected.' });
            }
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Get live results (only if published)
    router.get('/results', async (req, res) => {
        try {
            const settings = await Settings.findOne();
            if (!settings || !settings.resultsPublished) {
                return res.status(403).json({ error: 'Results are not yet published.' });
            }
            
            const results = await getVoteTallies();
            res.json(results);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Get current election status
    router.get('/status', async (req, res) => {
        try {
            let settings = await Settings.findOne();
            if (!settings) {
                settings = new Settings({ votingOpen: false, resultsPublished: false });
                await settings.save();
            }
            res.json({ 
                votingOpen: settings.votingOpen, 
                resultsPublished: settings.resultsPublished,
                scheduledStartTime: settings.scheduledStartTime,
                scheduledCloseTime: settings.scheduledCloseTime
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Helper to calculate tallies
    async function getVoteTallies() {
        const positions = await Position.find().lean();
        const results = [];

        for (let pos of positions) {
            const candidates = await Candidate.find({ positionId: pos._id }).lean();
            const candidateResults = [];
            let totalVotesForPos = 0;

            for (let cand of candidates) {
                const count = await Vote.countDocuments({ candidateId: cand._id });
                candidateResults.push({
                    candidateId: cand._id,
                    name: cand.name,
                    photoUrl: cand.photoUrl,
                    votes: count
                });
                totalVotesForPos += count;
            }
            
            results.push({
                positionId: pos._id,
                name: pos.name,
                totalVotes: totalVotesForPos,
                candidates: candidateResults
            });
        }
        return results;
    }

    return router;
};
