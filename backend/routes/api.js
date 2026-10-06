const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const Settings = require('../models/Settings');
const EligibleVoter = require('../models/EligibleVoter');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');
const rateLimit = require('express-rate-limit');
const {
    areNamesMatching,
    isNonEmptyString,
    isValidEmail,
    isValidEnrollmentNo,
    isValidObjectId,
    normalizeEmail,
    normalizeEnrollmentNo,
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

const kioskVoteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

function extractVoterCredentials(body) {
    const { name, email, enrollmentNo, enNo, rollNo, roll_no, roll, identifier } = body ?? {};
    const cleanName = toTrimmedString(name);

    const rawEmail = toTrimmedString(email);
    const rawEnNo = toTrimmedString(enrollmentNo || enNo || rollNo || roll_no || roll);
    const rawIdentifier = toTrimmedString(identifier);

    let lookupEmail = rawEmail ? normalizeEmail(rawEmail) : null;
    let lookupEnNo = rawEnNo ? normalizeEnrollmentNo(rawEnNo) : null;

    if (rawIdentifier) {
        if (rawIdentifier.includes('@')) {
            lookupEmail = normalizeEmail(rawIdentifier);
        } else {
            lookupEnNo = normalizeEnrollmentNo(rawIdentifier);
        }
    }

    return { cleanName, lookupEmail, lookupEnNo };
}

module.exports = function(io) {
    
    // Check if voter is eligible (email OR enrollment number)
    router.post('/verify', verifyLimiter, async (req, res) => {
        try {
            const { cleanName, lookupEmail, lookupEnNo } = extractVoterCredentials(req.body);

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Full Name is compulsory and required.' });
            }

            if (!lookupEmail && !lookupEnNo) {
                return res.status(400).json({
                    error: 'Please enter either your College Email or Enrollment Number (En no.).'
                });
            }

            if (lookupEmail && !isValidEmail(lookupEmail)) {
                return res.status(400).json({ error: 'Please enter a valid college email address.' });
            }

            if (lookupEnNo && !isValidEnrollmentNo(lookupEnNo)) {
                return res.status(400).json({ error: 'Please enter a valid Enrollment Number (En no.).' });
            }

            // Find matching voter by Email OR Enrollment Number
            const orConditions = [];
            if (lookupEmail) orConditions.push({ email: lookupEmail });
            if (lookupEnNo) orConditions.push({ enrollmentNo: lookupEnNo });

            const voter = await EligibleVoter.findOne({ $or: orConditions }).lean();

            if (!voter) {
                return res.status(403).json({
                    error: 'You are not on the eligible college voters roster. Contact the administrator.'
                });
            }

            // Compulsory Name Matching check: Typed name must match the official registered roster name
            if (!areNamesMatching(cleanName, voter.name)) {
                return res.status(400).json({
                    error: `The name typed ("${cleanName}") does not match the official registered name for this student in college records. Please type your name exactly as registered.`
                });
            }

            // Check if this student has already voted (by official email or official enrollmentNo)
            const alreadyVotedConditions = [];
            if (voter.email) alreadyVotedConditions.push({ email: voter.email });
            if (voter.enrollmentNo) alreadyVotedConditions.push({ enrollmentNo: voter.enrollmentNo });

            if (alreadyVotedConditions.length > 0) {
                const alreadyVoted = await Voter.findOne({ $or: alreadyVotedConditions }).lean();
                if (alreadyVoted) {
                    return res.status(403).json({
                        error: 'This student has already cast their ballot in this election.'
                    });
                }
            }

            res.json({
                success: true,
                message: 'Verified',
                voter: {
                    name: voter.name,
                    email: voter.email || '',
                    enrollmentNo: voter.enrollmentNo || ''
                }
            });
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
            const { cleanName, lookupEmail, lookupEnNo } = extractVoterCredentials(req.body);
            const { selections } = req.body ?? {};

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Name is required' });
            }

            if (!lookupEmail && !lookupEnNo) {
                return res.status(400).json({ error: 'College Email or Enrollment Number (En no.) is required' });
            }

            if (lookupEmail && !isValidEmail(lookupEmail)) {
                return res.status(400).json({ error: 'Valid college email is required' });
            }

            if (lookupEnNo && !isValidEnrollmentNo(lookupEnNo)) {
                return res.status(400).json({ error: 'Valid Enrollment Number (En no.) is required' });
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

            // Check eligibility (email OR enrollmentNo)
            const orConditions = [];
            if (lookupEmail) orConditions.push({ email: lookupEmail });
            if (lookupEnNo) orConditions.push({ enrollmentNo: lookupEnNo });

            const eligible = await EligibleVoter.findOne({ $or: orConditions }).lean();

            if (!eligible) {
                return res.status(403).json({ error: 'You are not on the eligible college voters roster.' });
            }

            // Compulsory name matching check
            if (!areNamesMatching(cleanName, eligible.name)) {
                return res.status(400).json({
                    error: `The name typed ("${cleanName}") does not match the official college roster record for this student.`
                });
            }

            // Check if already voted (by official email or official enrollmentNo)
            const alreadyVotedConditions = [];
            if (eligible.email) alreadyVotedConditions.push({ email: eligible.email });
            if (eligible.enrollmentNo) alreadyVotedConditions.push({ enrollmentNo: eligible.enrollmentNo });

            if (alreadyVotedConditions.length > 0) {
                const existingVoter = await Voter.findOne({ $or: alreadyVotedConditions }).lean();
                if (existingVoter) {
                    return res.status(403).json({ error: 'This student has already cast their ballot.' });
                }
            }

            // Record voter attendance to prevent duplicate voting (Secret Ballot principle)
            const channel = req.body?.channel === 'manual_kiosk' ? 'manual_kiosk' : 'online';
            const newVoter = new Voter({
                name: eligible.name,
                email: eligible.email,
                enrollmentNo: eligible.enrollmentNo,
                channel
            });
            await newVoter.save();

            // Insert anonymous ballot selections decoupled from voter identity
            const votesToInsert = [...normalizedSelections.entries()].map(([positionId, candidateId]) => ({
                positionId: new mongoose.Types.ObjectId(positionId),
                candidateId: new mongoose.Types.ObjectId(candidateId)
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

    // In-Person Kiosk Vote (Anonymous Polling Booth - No voter name or email required)
    router.post('/kiosk-vote', kioskVoteLimiter, async (req, res) => {
        try {
            let { selections } = req.body ?? {};

            // Normalize selections from object format { posId: candId } to array if needed
            if (selections && typeof selections === 'object' && !Array.isArray(selections)) {
                selections = Object.entries(selections).map(([positionId, candidateId]) => ({
                    positionId,
                    candidateId
                }));
            }

            if (!Array.isArray(selections) || selections.length === 0) {
                return res.status(400).json({ error: 'Please make your candidate selections.' });
            }

            const positions = await Position.find().lean();
            if (positions.length === 0) {
                return res.status(400).json({ error: 'No election positions are configured yet.' });
            }

            if (selections.length !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position.' });
            }

            const candidateLookup = new Map();
            for (const position of positions) {
                const candidates = await Candidate.find({ positionId: position._id }).lean();
                candidateLookup.set(String(position._id), new Set(candidates.map((c) => String(c._id))));
            }

            const normalizedSelections = new Map();
            for (const selection of selections) {
                const positionId = selection?.positionId;
                const candidateId = selection?.candidateId;

                if (!isValidObjectId(positionId) || !isValidObjectId(candidateId)) {
                    return res.status(400).json({ error: 'Invalid candidate selection detected.' });
                }

                if (normalizedSelections.has(positionId)) {
                    return res.status(400).json({ error: 'Duplicate candidate selections are not allowed.' });
                }

                const validCandidates = candidateLookup.get(positionId);
                if (!validCandidates || !validCandidates.has(candidateId)) {
                    return res.status(400).json({ error: 'Invalid candidate selected for a position.' });
                }

                normalizedSelections.set(positionId, candidateId);
            }

            if (normalizedSelections.size !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position.' });
            }

            // Check if voting is open
            const settings = await Settings.findOne();
            if (settings) {
                const now = new Date();
                let isOpen = settings.votingOpen;
                
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

            // Count turnout in Voter attendance log (Anonymous in-person voter count)
            const kioskCount = await Voter.countDocuments({ channel: 'manual_kiosk' });
            const newVoter = new Voter({
                name: `In-Person Booth Voter #${kioskCount + 1}`,
                channel: 'manual_kiosk'
            });
            await newVoter.save();

            // Insert anonymous ballot selections
            const votesToInsert = [...normalizedSelections.entries()].map(([positionId, candidateId]) => ({
                positionId: new mongoose.Types.ObjectId(positionId),
                candidateId: new mongoose.Types.ObjectId(candidateId)
            }));

            await Vote.insertMany(votesToInsert);

            // Broadcast results update for real-time live standings
            io.emit('results-updated');

            res.json({ success: true, message: 'In-person ballot recorded successfully.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error while recording kiosk ballot' });
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
                scheduledCloseTime: settings.scheduledCloseTime,
                expectedVoters: settings.expectedVoters || 0
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
