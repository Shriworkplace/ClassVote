const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const Election = require('../models/Election');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const EligibleVoter = require('../models/EligibleVoter');
const Voter = require('../models/Voter');
const Vote = require('../models/Vote');
const { requireAuth, requireElectionOwner } = require('../middleware/authMiddleware');
const {
    isNonEmptyString,
    isValidEmail,
    isValidEnrollmentNo,
    isValidHttpUrl,
    isValidObjectId,
    normalizeEmail,
    normalizeEnrollmentNo,
    parseRosterCsv,
    toTrimmedString,
} = require('../utils/validation');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGE_MIMES = new Map([
    ['image/jpeg', '.jpg'],
    ['image/png', '.png'],
    ['image/webp', '.webp'],
]);

const photoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const ext = ALLOWED_IMAGE_MIMES.get(file.mimetype) || '.jpg';
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    }
});

const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter(req, file, callback) {
        const name = (file.originalname || '').toLowerCase();
        const allowedMimeTypes = new Set(['text/csv', 'application/csv', 'text/plain']);
        if (name.endsWith('.csv') || allowedMimeTypes.has(file.mimetype)) {
            return callback(null, true);
        }
        return callback(new Error('Only CSV files are allowed'));
    }
});

const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
});

function sanitizeSlug(input) {
    return toTrimmedString(input)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

async function generateUniqueSlug(preferredSlug, fallbackTitle) {
    let base = sanitizeSlug(preferredSlug) || sanitizeSlug(fallbackTitle) || 'election';
    if (base.length < 3) {
        base = `${base}-${crypto.randomBytes(2).toString('hex')}`;
    }

    let candidateSlug = base;
    let exists = await Election.findOne({ slug: candidateSlug }).lean();
    let tries = 0;
    while (exists && tries < 6) {
        const suffix = crypto.randomBytes(2).toString('hex');
        candidateSlug = `${base.slice(0, 54)}-${suffix}`;
        exists = await Election.findOne({ slug: candidateSlug }).lean();
        tries += 1;
    }
    return candidateSlug;
}

function parseOptionalDate(value) {
    if (value === null || value === '' || value === undefined) {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed;
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
                votes: count,
                editHistory: cand.editHistory || []
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
    const emitToElection = (electionId, event) => {
        io.to(`election:${String(electionId)}`).emit(event);
    };

    // Protect all routes in this router
    router.use(requireAuth);

    // GET /api/elections — List organizer's elections with summary stats
    router.get('/', async (req, res) => {
        try {
            const elections = await Election.find({ ownerId: req.user.userId })
                .sort({ createdAt: -1 });

            const enriched = await Promise.all(
                elections.map(async (el) => {
                    const [positionsCount, candidatesCount, votersCount, rosterCount] = await Promise.all([
                        Position.countDocuments({ electionId: el._id }),
                        Candidate.countDocuments({ electionId: el._id }),
                        Voter.countDocuments({ electionId: el._id }),
                        EligibleVoter.countDocuments({ electionId: el._id })
                    ]);

                    return {
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
                        expectedVoters: el.expectedVoters,
                        createdAt: el.createdAt,
                        stats: {
                            positionsCount,
                            candidatesCount,
                            votersCount,
                            rosterCount
                        }
                    };
                })
            );

            res.json(enriched);
        } catch (err) {
            console.error('List elections error:', err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections — Create a new election
    router.post('/', writeLimiter, async (req, res) => {
        try {
            const title = toTrimmedString(req.body?.title);
            const description = toTrimmedString(req.body?.description);
            const organization = toTrimmedString(req.body?.organization);
            const requestedSlug = toTrimmedString(req.body?.slug);
            const accessMode = ['roster', 'open', 'kiosk_only'].includes(req.body?.accessMode)
                ? req.body.accessMode
                : 'roster';
            const expectedVoters = Number.isFinite(Number(req.body?.expectedVoters))
                ? Math.max(0, Math.floor(Number(req.body.expectedVoters)))
                : 0;

            if (!isNonEmptyString(title, 150)) {
                return res.status(400).json({ error: 'Election title is required (max 150 characters).' });
            }
            if (description.length > 500) {
                return res.status(400).json({ error: 'Description must be 500 characters or fewer.' });
            }

            if (requestedSlug) {
                const cleanRequested = sanitizeSlug(requestedSlug);
                if (cleanRequested.length < 3) {
                    return res.status(400).json({ error: 'Custom election code must be at least 3 alphanumeric characters.' });
                }
                const existing = await Election.findOne({ slug: cleanRequested }).lean();
                if (existing) {
                    return res.status(409).json({ error: `Election code "${cleanRequested}" is already taken. Try another one.` });
                }
            }

            const slug = requestedSlug
                ? sanitizeSlug(requestedSlug)
                : await generateUniqueSlug('', title);

            const election = new Election({
                ownerId: req.user.userId,
                title,
                description,
                organization,
                slug,
                accessMode,
                expectedVoters
            });
            await election.save();

            res.status(201).json(election);
        } catch (err) {
            if (err.code === 11000) {
                return res.status(409).json({ error: 'Election code already exists. Please choose another.' });
            }
            console.error('Create election error:', err);
            res.status(500).json({ error: 'Server error while creating election.' });
        }
    });

    // GET /api/elections/:electionId — Election metadata + full state
    router.get('/:electionId', requireElectionOwner, async (req, res) => {
        try {
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
                expectedVoters: el.expectedVoters,
                createdAt: el.createdAt
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // PUT /api/elections/:electionId — Update election metadata & settings
    router.put('/:electionId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const el = req.election;
            const {
                title,
                description,
                organization,
                accessMode,
                votingOpen,
                resultsPublished,
                scheduledStartTime,
                scheduledCloseTime,
                expectedVoters
            } = req.body ?? {};

            if (title !== undefined) {
                const cleanTitle = toTrimmedString(title);
                if (!isNonEmptyString(cleanTitle, 150)) {
                    return res.status(400).json({ error: 'Election title cannot be empty.' });
                }
                el.title = cleanTitle;
            }
            if (description !== undefined) {
                const cleanDesc = toTrimmedString(description);
                if (cleanDesc.length > 500) {
                    return res.status(400).json({ error: 'Description max 500 characters.' });
                }
                el.description = cleanDesc;
            }
            if (organization !== undefined) {
                el.organization = toTrimmedString(organization).slice(0, 120);
            }
            if (accessMode !== undefined) {
                if (!['roster', 'open', 'kiosk_only'].includes(accessMode)) {
                    return res.status(400).json({ error: 'Invalid access mode.' });
                }
                el.accessMode = accessMode;
            }
            if (votingOpen !== undefined) {
                el.votingOpen = Boolean(votingOpen);
            }
            if (resultsPublished !== undefined) {
                el.resultsPublished = Boolean(resultsPublished);
            }
            if (expectedVoters !== undefined) {
                el.expectedVoters = Math.max(0, Math.floor(Number(expectedVoters) || 0));
            }

            if (scheduledStartTime !== undefined) {
                const parsedStart = parseOptionalDate(scheduledStartTime);
                if (parsedStart === undefined) {
                    return res.status(400).json({ error: 'Invalid scheduledStartTime' });
                }
                el.scheduledStartTime = parsedStart;
            }
            if (scheduledCloseTime !== undefined) {
                const parsedClose = parseOptionalDate(scheduledCloseTime);
                if (parsedClose === undefined) {
                    return res.status(400).json({ error: 'Invalid scheduledCloseTime' });
                }
                el.scheduledCloseTime = parsedClose;
            }
            if (el.scheduledStartTime && el.scheduledCloseTime && el.scheduledStartTime >= el.scheduledCloseTime) {
                return res.status(400).json({ error: 'scheduledCloseTime must be after scheduledStartTime' });
            }

            await el.save();
            emitToElection(el._id, 'status-updated');
            emitToElection(el._id, 'results-updated');

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
                expectedVoters: el.expectedVoters,
                createdAt: el.createdAt
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // DELETE /api/elections/:electionId — Delete election + all scoped data
    router.delete('/:electionId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const electionId = req.election._id;
            await Promise.all([
                Vote.deleteMany({ electionId }),
                Voter.deleteMany({ electionId }),
                EligibleVoter.deleteMany({ electionId }),
                Candidate.deleteMany({ electionId }),
                Position.deleteMany({ electionId }),
                Election.findByIdAndDelete(electionId)
            ]);
            emitToElection(electionId, 'results-updated');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/elections/:electionId/results
    router.get('/:electionId/results', requireElectionOwner, async (req, res) => {
        try {
            const results = await getElectionTallies(req.election._id);
            res.json(results);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections/:electionId/positions
    router.post('/:electionId/positions', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const name = toTrimmedString(req.body?.name);
            if (!isNonEmptyString(name, 120)) {
                return res.status(400).json({ error: 'Position name is required' });
            }

            const existingPositions = await Position.find({ electionId: req.election._id }).lean();
            if (existingPositions.some((p) => toTrimmedString(p.name).toLowerCase() === name.toLowerCase())) {
                return res.status(400).json({ error: 'A position with this name already exists in this election.' });
            }

            const newPos = new Position({ electionId: req.election._id, name });
            await newPos.save();
            emitToElection(req.election._id, 'positions-updated');
            emitToElection(req.election._id, 'results-updated');
            res.status(201).json(newPos);
        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({ error: 'Position already exists in this election.' });
            }
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // DELETE /api/elections/:electionId/positions/:posId
    router.delete('/:electionId/positions/:posId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { posId } = req.params;
            if (!isValidObjectId(posId)) {
                return res.status(400).json({ error: 'Invalid position ID' });
            }
            const pos = await Position.findOne({ _id: posId, electionId: req.election._id });
            if (!pos) {
                return res.status(404).json({ error: 'Position not found in this election' });
            }
            await Promise.all([
                Position.findByIdAndDelete(posId),
                Candidate.deleteMany({ electionId: req.election._id, positionId: posId }),
                Vote.deleteMany({ electionId: req.election._id, positionId: posId })
            ]);
            emitToElection(req.election._id, 'positions-updated');
            emitToElection(req.election._id, 'results-updated');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections/:electionId/upload-photo
    router.post('/:electionId/upload-photo', requireElectionOwner, writeLimiter, photoUpload.single('photo'), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        res.json({ photoUrl: `/uploads/${req.file.filename}` });
    });

    // POST /api/elections/:electionId/candidates
    router.post('/:electionId/candidates', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { positionId, name, photoUrl } = req.body ?? {};
            if (!isValidObjectId(positionId)) {
                return res.status(400).json({ error: 'Valid positionId is required' });
            }
            const cleanName = toTrimmedString(name);
            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Candidate name is required' });
            }

            const isLocalUrl = typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/');
            if (photoUrl !== undefined && photoUrl !== '' && !isLocalUrl && !isValidHttpUrl(photoUrl)) {
                return res.status(400).json({ error: 'photoUrl must be a valid http/https URL or local upload path' });
            }

            const position = await Position.findOne({ _id: positionId, electionId: req.election._id }).lean();
            if (!position) {
                return res.status(404).json({ error: 'Position not found in this election' });
            }

            const newCand = new Candidate({
                electionId: req.election._id,
                positionId,
                name: cleanName,
                photoUrl: photoUrl || ''
            });
            await newCand.save();
            emitToElection(req.election._id, 'positions-updated');
            emitToElection(req.election._id, 'results-updated');
            res.status(201).json(newCand);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // PUT /api/elections/:electionId/candidates/:candId
    router.put('/:electionId/candidates/:candId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { candId } = req.params;
            const { name } = req.body ?? {};
            if (!isValidObjectId(candId)) {
                return res.status(400).json({ error: 'Invalid candidate ID' });
            }
            const trimmedName = toTrimmedString(name);
            if (!isNonEmptyString(trimmedName, 120)) {
                return res.status(400).json({ error: 'Candidate name is required (max 120 characters)' });
            }

            const candidate = await Candidate.findOne({ _id: candId, electionId: req.election._id });
            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found in this election' });
            }

            const existingCandidates = await Candidate.find({
                electionId: req.election._id,
                positionId: candidate.positionId
            }).lean();

            const hasDuplicate = existingCandidates.some(
                (c) =>
                    String(c._id) !== String(candidate._id) &&
                    toTrimmedString(c.name).toLowerCase() === trimmedName.toLowerCase()
            );
            if (hasDuplicate) {
                return res.status(400).json({ error: 'Another candidate with this name already exists for this position' });
            }

            if (candidate.name !== trimmedName) {
                candidate.editHistory = candidate.editHistory || [];
                candidate.editHistory.push({
                    previousName: candidate.name,
                    newName: trimmedName,
                    editedAt: new Date()
                });
                candidate.name = trimmedName;
                await candidate.save();
                emitToElection(req.election._id, 'positions-updated');
                emitToElection(req.election._id, 'results-updated');
            }

            res.json(candidate);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // DELETE /api/elections/:electionId/candidates/:candId
    router.delete('/:electionId/candidates/:candId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { candId } = req.params;
            if (!isValidObjectId(candId)) {
                return res.status(400).json({ error: 'Invalid candidate ID' });
            }
            const candidate = await Candidate.findOne({ _id: candId, electionId: req.election._id });
            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found in this election' });
            }
            await Promise.all([
                Candidate.findByIdAndDelete(candId),
                Vote.deleteMany({ electionId: req.election._id, candidateId: candId })
            ]);
            emitToElection(req.election._id, 'positions-updated');
            emitToElection(req.election._id, 'results-updated');
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/elections/:electionId/roster
    router.get('/:electionId/roster', requireElectionOwner, async (req, res) => {
        try {
            const roster = await EligibleVoter.find({ electionId: req.election._id })
                .sort({ name: 1 })
                .lean();
            res.json(roster);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections/:electionId/roster — Bulk add via JSON array
    router.post('/:electionId/roster', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { voters } = req.body ?? {};
            if (!Array.isArray(voters) || voters.length === 0) {
                return res.status(400).json({ error: 'Invalid voter list format' });
            }
            if (voters.length > 5000) {
                return res.status(400).json({ error: 'Roster upload is limited to 5,000 entries per request' });
            }

            const docs = [];
            for (const v of voters) {
                const name = toTrimmedString(v?.name);
                const email = normalizeEmail(v?.email);
                const enrollmentNo = normalizeEnrollmentNo(v?.enrollmentNo || v?.enNo || v?.rollNo || v?.roll);
                const hasEmail = isValidEmail(email);
                const hasEnNo = isValidEnrollmentNo(enrollmentNo);

                if (isNonEmptyString(name, 120) && (hasEmail || hasEnNo)) {
                    const doc = { electionId: req.election._id, name };
                    if (hasEmail) doc.email = email;
                    if (hasEnNo) doc.enrollmentNo = enrollmentNo;
                    docs.push(doc);
                }
            }

            if (docs.length === 0) {
                return res.status(400).json({ error: 'No valid voters found. Each entry needs Name and Email or Enrollment No.' });
            }

            try {
                await EligibleVoter.insertMany(docs, { ordered: false });
            } catch (bulkErr) {
                if (bulkErr.code !== 11000 && !bulkErr.writeErrors) {
                    throw bulkErr;
                }
            }

            res.json({ success: true, count: docs.length, message: `Added/updated ${docs.length} eligible voter(s).` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections/:electionId/upload-roster — CSV upload
    router.post('/:electionId/upload-roster', requireElectionOwner, writeLimiter, csvUpload.single('file'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No CSV file uploaded' });
            }
            const parsed = parseRosterCsv(req.file.buffer);
            if (parsed.length === 0) {
                return res.status(400).json({ error: 'No valid voters found in CSV. Ensure headers include Name and Email or Enrollment No.' });
            }

            const docs = parsed.map((item) => ({
                electionId: req.election._id,
                ...item
            }));

            try {
                await EligibleVoter.insertMany(docs, { ordered: false });
            } catch (bulkErr) {
                if (bulkErr.code !== 11000 && !bulkErr.writeErrors) {
                    throw bulkErr;
                }
            }

            res.json({ success: true, count: docs.length, message: `Imported ${docs.length} voters from CSV.` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error while processing CSV' });
        }
    });

    // DELETE /api/elections/:electionId/roster/:voterId
    router.delete('/:electionId/roster/:voterId', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { voterId } = req.params;
            if (!isValidObjectId(voterId)) {
                return res.status(400).json({ error: 'Invalid voter ID' });
            }
            await EligibleVoter.findOneAndDelete({ _id: voterId, electionId: req.election._id });
            res.json({ success: true });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // GET /api/elections/:electionId/votes-log
    router.get('/:electionId/votes-log', requireElectionOwner, async (req, res) => {
        try {
            const voters = await Voter.find({ electionId: req.election._id })
                .sort({ votedAt: -1 })
                .lean();
            res.json(
                voters.map((v) => ({
                    _id: v._id,
                    voterName: v.name,
                    voterEnrollmentNo: v.enrollmentNo || '-',
                    voterEmail: v.email || '-',
                    channel: v.channel || 'online',
                    votedAt: v.votedAt
                }))
            );
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    // POST /api/elections/:electionId/sync-offline-votes
    router.post('/:electionId/sync-offline-votes', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const { ballots } = req.body ?? {};
            if (!Array.isArray(ballots) || ballots.length === 0) {
                return res.status(400).json({ error: 'No offline ballots provided for sync.' });
            }

            const electionId = req.election._id;
            const positions = await Position.find({ electionId }).lean();
            const candidateLookup = new Map();
            for (const pos of positions) {
                const cands = await Candidate.find({ electionId, positionId: pos._id }).lean();
                candidateLookup.set(String(pos._id), new Set(cands.map((c) => String(c._id))));
            }

            let syncedCount = 0;
            let skippedCount = 0;

            for (const ballot of ballots) {
                const rawSelections = ballot?.selections;
                const selectionEntries = Array.isArray(rawSelections)
                    ? rawSelections.map((s) => [String(s.positionId), String(s.candidateId)])
                    : rawSelections && typeof rawSelections === 'object'
                        ? Object.entries(rawSelections)
                        : [];

                const validVotes = [];
                for (const [posId, candId] of selectionEntries) {
                    const validCands = candidateLookup.get(posId);
                    if (validCands && validCands.has(candId)) {
                        validVotes.push({
                            electionId,
                            positionId: new mongoose.Types.ObjectId(posId),
                            candidateId: new mongoose.Types.ObjectId(candId),
                            votedAt: ballot.timestamp ? new Date(ballot.timestamp) : new Date()
                        });
                    }
                }

                if (validVotes.length === 0) {
                    skippedCount += 1;
                    continue;
                }

                const isKiosk = Boolean(ballot.isKiosk || ballot.channel === 'manual_kiosk');
                if (isKiosk) {
                    const count = await Voter.countDocuments({ electionId, channel: 'manual_kiosk' });
                    await new Voter({
                        electionId,
                        name: `In-Person Booth Voter #${count + 1}`,
                        channel: 'manual_kiosk',
                        votedAt: ballot.timestamp ? new Date(ballot.timestamp) : new Date()
                    }).save();
                    await Vote.insertMany(validVotes);
                    syncedCount += 1;
                } else {
                    const email = normalizeEmail(ballot?.voter?.email);
                    const enNo = normalizeEnrollmentNo(ballot?.voter?.enrollmentNo);
                    const orConds = [];
                    if (isValidEmail(email)) orConds.push({ email });
                    if (isValidEnrollmentNo(enNo)) orConds.push({ enrollmentNo: enNo });

                    if (orConds.length > 0) {
                        const already = await Voter.findOne({ electionId, $or: orConds }).lean();
                        if (already) {
                            skippedCount += 1;
                            continue;
                        }
                    }

                    const voterDoc = {
                        electionId,
                        name: toTrimmedString(ballot?.voter?.name) || 'Offline Voter',
                        channel: 'offline_sync',
                        votedAt: ballot.timestamp ? new Date(ballot.timestamp) : new Date()
                    };
                    if (isValidEmail(email)) voterDoc.email = email;
                    if (isValidEnrollmentNo(enNo)) voterDoc.enrollmentNo = enNo;

                    await new Voter(voterDoc).save();
                    await Vote.insertMany(validVotes);
                    syncedCount += 1;
                }
            }

            if (syncedCount > 0) {
                emitToElection(electionId, 'results-updated');
            }

            res.json({
                success: true,
                syncedCount,
                skippedCount,
                message: `Synced ${syncedCount} offline ballot(s)${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}.`
            });
        } catch (err) {
            console.error('Offline sync error:', err);
            res.status(500).json({ error: 'Server error during offline sync' });
        }
    });

    // DELETE /api/elections/:electionId/votes — Reset cast ballots (keeps positions, candidates, roster)
    router.delete('/:electionId/votes', requireElectionOwner, writeLimiter, async (req, res) => {
        try {
            const electionId = req.election._id;
            await Promise.all([
                Vote.deleteMany({ electionId }),
                Voter.deleteMany({ electionId })
            ]);
            emitToElection(electionId, 'results-updated');
            res.json({ success: true, message: 'All cast ballots have been reset.' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });

    return router;
};
