const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const Election = require('../models/Election');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const EligibleVoter = require('../models/EligibleVoter');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');
const { requireAuth } = require('../middleware/authMiddleware');
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
    max: 40,
    standardHeaders: true,
    legacyHeaders: false
});

const voteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
});

const kioskVoteLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
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

async function resolveElection(req, res, next) {
    try {
        const slug = toTrimmedString(req.params.slug).toLowerCase();
        if (!slug) {
            return res.status(400).json({ error: 'Election code is required.' });
        }
        const election = await Election.findOne({ slug });
        if (!election) {
            return res.status(404).json({ error: `Election "${slug}" was not found. Double-check the link or code.` });
        }
        req.election = election;
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
}

async function getElectionTallies(electionId) {
    const positions = await Position.find({ electionId }).lean();
    const results = [];

    for (const pos of positions) {
        const candidates = await Candidate.find({ electionId, positionId: pos._id }).lean();
        const candidateResults = [];
        let totalVotesForPos = 0;

        for (const cand of candidates) {
            const count = await Vote.countDocuments({ electionId, candidateId: cand._id });
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

module.exports = function (io) {
    // GET /api/e/:slug — Public election metadata
    router.get('/:slug', resolveElection, async (req, res) => {
        const el = req.election;
        res.json({
            _id: el._id,
            title: el.title,
            description: el.description,
            organization: el.organization,
            slug: el.slug,
            accessMode: el.accessMode,
            votingOpen: el.votingOpen,
            isCurrentlyOpen: el.isCurrentlyOpen(),
            resultsPublished: el.resultsPublished,
            scheduledStartTime: el.scheduledStartTime,
            scheduledCloseTime: el.scheduledCloseTime,
            expectedVoters: el.expectedVoters || 0
        });
    });

    // GET /api/e/:slug/summary — Lightweight public summary for embed widgets and SEO cards
    router.get('/:slug/summary', resolveElection, async (req, res) => {
        try {
            const el = req.election;
            const [totalVotes, totalPositions, totalCandidates] = await Promise.all([
                Voter.countDocuments({ electionId: el._id }),
                Position.countDocuments({ electionId: el._id }),
                Candidate.countDocuments({ electionId: el._id }),
            ]);

            res.json({
                election: {
                    _id: el._id,
                    title: el.title,
                    description: el.description,
                    organization: el.organization,
                    slug: el.slug,
                    status: el.status,
                    accessMode: el.accessMode,
                    isCurrentlyOpen: el.isCurrentlyOpen(),
                    resultsPublished: el.resultsPublished,
                },
                totalVotes,
                totalPositions,
                totalCandidates
            });
        } catch (err) {
            console.error('Error fetching election summary:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/e/:slug/verify — Verify voter eligibility before ballot access
    router.post('/:slug/verify', resolveElection, verifyLimiter, async (req, res) => {
        try {
            const el = req.election;

            if (el.accessMode === 'kiosk_only') {
                return res.status(403).json({
                    error: 'This election is configured for In-Person Polling Booth (Kiosk) voting only.'
                });
            }

            if (!el.isCurrentlyOpen()) {
                return res.status(403).json({ error: 'Voting for this election is currently closed.' });
            }

            const { cleanName, lookupEmail, lookupEnNo } = extractVoterCredentials(req.body);

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Full Name is required.' });
            }
            if (!lookupEmail && !lookupEnNo) {
                return res.status(400).json({
                    error: 'Please enter either your Email Address or Enrollment / ID Number.'
                });
            }
            if (lookupEmail && !isValidEmail(lookupEmail)) {
                return res.status(400).json({ error: 'Please enter a valid email address.' });
            }
            if (lookupEnNo && !isValidEnrollmentNo(lookupEnNo)) {
                return res.status(400).json({ error: 'Please enter a valid Enrollment / ID Number.' });
            }

            let officialName = cleanName;
            let officialEmail = lookupEmail || '';
            let officialEnNo = lookupEnNo || '';

            if (el.accessMode === 'roster') {
                const orConditions = [];
                if (lookupEmail) orConditions.push({ email: lookupEmail });
                if (lookupEnNo) orConditions.push({ enrollmentNo: lookupEnNo });

                const eligible = await EligibleVoter.findOne({
                    electionId: el._id,
                    $or: orConditions
                }).lean();

                if (!eligible) {
                    return res.status(403).json({
                        error: 'You are not on the eligible voters roster for this election. Contact the organizer.'
                    });
                }

                if (!areNamesMatching(cleanName, eligible.name)) {
                    return res.status(400).json({
                        error: `The name typed ("${cleanName}") does not match the official registered name. Please type your name exactly as registered.`
                    });
                }

                officialName = eligible.name;
                officialEmail = eligible.email || '';
                officialEnNo = eligible.enrollmentNo || '';
            }

            // Duplicate check scoped strictly to this election
            const alreadyConds = [];
            if (officialEmail) alreadyConds.push({ email: officialEmail });
            if (officialEnNo) alreadyConds.push({ enrollmentNo: officialEnNo });

            if (alreadyConds.length > 0) {
                const alreadyVoted = await Voter.findOne({
                    electionId: el._id,
                    $or: alreadyConds
                }).lean();
                if (alreadyVoted) {
                    return res.status(403).json({
                        error: 'You have already cast your ballot in this election.'
                    });
                }
            }

            res.json({
                success: true,
                message: 'Verified',
                voter: {
                    name: officialName,
                    email: officialEmail,
                    enrollmentNo: officialEnNo
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/e/:slug/positions — Ballot positions & candidates
    router.get('/:slug/positions', resolveElection, async (req, res) => {
        try {
            const positions = await Position.find({ electionId: req.election._id }).lean();
            for (const pos of positions) {
                pos.candidates = await Candidate.find({
                    electionId: req.election._id,
                    positionId: pos._id
                }).lean();
            }
            res.json(positions);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/e/:slug/vote — Submit completed online ballot
    router.post('/:slug/vote', resolveElection, voteLimiter, async (req, res) => {
        try {
            const el = req.election;
            if (el.accessMode === 'kiosk_only') {
                return res.status(403).json({ error: 'Online voting is disabled for this kiosk-only election.' });
            }
            if (!el.isCurrentlyOpen()) {
                return res.status(403).json({ error: 'Voting is currently closed.' });
            }

            const { cleanName, lookupEmail, lookupEnNo } = extractVoterCredentials(req.body);
            const { selections } = req.body ?? {};

            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Name is required' });
            }
            if (!lookupEmail && !lookupEnNo) {
                return res.status(400).json({ error: 'Email or Enrollment / ID Number is required' });
            }
            if (lookupEmail && !isValidEmail(lookupEmail)) {
                return res.status(400).json({ error: 'Valid email is required' });
            }
            if (lookupEnNo && !isValidEnrollmentNo(lookupEnNo)) {
                return res.status(400).json({ error: 'Valid Enrollment / ID Number is required' });
            }
            if (!Array.isArray(selections) || selections.length === 0) {
                return res.status(400).json({ error: 'Invalid ballot selections' });
            }

            const positions = await Position.find({ electionId: el._id }).lean();
            if (positions.length === 0) {
                return res.status(400).json({ error: 'No positions are configured yet' });
            }
            if (selections.length !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position' });
            }

            const candidateLookup = new Map();
            for (const position of positions) {
                const candidates = await Candidate.find({ electionId: el._id, positionId: position._id }).lean();
                candidateLookup.set(String(position._id), new Set(candidates.map((c) => String(c._id))));
            }

            const normalizedSelections = new Map();
            for (const selection of selections) {
                const positionId = selection?.positionId;
                const candidateId = selection?.candidateId;
                if (!isValidObjectId(positionId) || !isValidObjectId(candidateId)) {
                    return res.status(400).json({ error: 'Each selection must contain valid positionId and candidateId' });
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

            let officialName = cleanName;
            let officialEmail = lookupEmail || null;
            let officialEnNo = lookupEnNo || null;

            if (el.accessMode === 'roster') {
                const orConditions = [];
                if (lookupEmail) orConditions.push({ email: lookupEmail });
                if (lookupEnNo) orConditions.push({ enrollmentNo: lookupEnNo });

                const eligible = await EligibleVoter.findOne({
                    electionId: el._id,
                    $or: orConditions
                }).lean();

                if (!eligible) {
                    return res.status(403).json({ error: 'You are not on the eligible voters roster.' });
                }
                if (!areNamesMatching(cleanName, eligible.name)) {
                    return res.status(400).json({
                        error: `The name typed ("${cleanName}") does not match the official roster record.`
                    });
                }

                officialName = eligible.name;
                officialEmail = eligible.email || null;
                officialEnNo = eligible.enrollmentNo || null;
            }

            const alreadyConds = [];
            if (officialEmail) alreadyConds.push({ email: officialEmail });
            if (officialEnNo) alreadyConds.push({ enrollmentNo: officialEnNo });

            if (alreadyConds.length > 0) {
                const existingVoter = await Voter.findOne({
                    electionId: el._id,
                    $or: alreadyConds
                }).lean();
                if (existingVoter) {
                    return res.status(403).json({ error: 'You have already cast your ballot in this election.' });
                }
            }

            const voterDoc = {
                electionId: el._id,
                name: officialName,
                channel: req.body?.channel === 'manual_kiosk' ? 'manual_kiosk' : 'online'
            };
            if (officialEmail) voterDoc.email = officialEmail;
            if (officialEnNo) voterDoc.enrollmentNo = officialEnNo;

            await new Voter(voterDoc).save();

            const votesToInsert = [...normalizedSelections.entries()].map(([positionId, candidateId]) => ({
                electionId: el._id,
                positionId: new mongoose.Types.ObjectId(positionId),
                candidateId: new mongoose.Types.ObjectId(candidateId)
            }));
            await Vote.insertMany(votesToInsert);

            io.to(`election:${String(el._id)}`).emit('results-updated');
            res.json({ success: true, message: 'Your votes have been recorded.' });
        } catch (err) {
            if (err.code === 11000) {
                return res.status(403).json({ error: 'Duplicate vote detected.' });
            }
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/e/:slug/kiosk-vote — In-Person Booth anonymous vote (requires signed-in election organizer)
    router.post('/:slug/kiosk-vote', requireAuth, resolveElection, kioskVoteLimiter, async (req, res) => {
        try {
            const el = req.election;
            if (String(el.ownerId) !== String(req.user.userId)) {
                return res.status(403).json({
                    error: 'Only the election organizer can submit ballots from Kiosk Booth mode.'
                });
            }
            if (!el.isCurrentlyOpen()) {
                return res.status(403).json({ error: 'Voting is currently closed.' });
            }

            let { selections } = req.body ?? {};
            if (selections && typeof selections === 'object' && !Array.isArray(selections)) {
                selections = Object.entries(selections).map(([positionId, candidateId]) => ({
                    positionId,
                    candidateId
                }));
            }

            if (!Array.isArray(selections) || selections.length === 0) {
                return res.status(400).json({ error: 'Please make your candidate selections.' });
            }

            const positions = await Position.find({ electionId: el._id }).lean();
            if (positions.length === 0) {
                return res.status(400).json({ error: 'No election positions are configured yet.' });
            }
            if (selections.length !== positions.length) {
                return res.status(400).json({ error: 'Please select one candidate for every position.' });
            }

            const candidateLookup = new Map();
            for (const position of positions) {
                const candidates = await Candidate.find({ electionId: el._id, positionId: position._id }).lean();
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

            const kioskCount = await Voter.countDocuments({ electionId: el._id, channel: 'manual_kiosk' });
            await new Voter({
                electionId: el._id,
                name: `In-Person Booth Voter #${kioskCount + 1}`,
                channel: 'manual_kiosk'
            }).save();

            const votesToInsert = [...normalizedSelections.entries()].map(([positionId, candidateId]) => ({
                electionId: el._id,
                positionId: new mongoose.Types.ObjectId(positionId),
                candidateId: new mongoose.Types.ObjectId(candidateId)
            }));
            await Vote.insertMany(votesToInsert);

            io.to(`election:${String(el._id)}`).emit('results-updated');
            res.json({ success: true, message: 'In-person ballot recorded successfully.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error while recording kiosk ballot' });
        }
    });

    // GET /api/e/:slug/results — Public tallies (only when published)
    router.get('/:slug/results', resolveElection, async (req, res) => {
        try {
            const el = req.election;
            if (!el.resultsPublished) {
                return res.status(403).json({
                    error: 'Results for this election have not been published yet.',
                    election: {
                        _id: el._id,
                        title: el.title,
                        organization: el.organization,
                        slug: el.slug
                    }
                });
            }

            const results = await getElectionTallies(el._id);
            res.json({
                election: {
                    _id: el._id,
                    title: el.title,
                    description: el.description,
                    organization: el.organization,
                    slug: el.slug
                },
                results
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    return router;
};
