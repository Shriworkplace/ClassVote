const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const Position = require('../models/Position');
const Candidate = require('../models/Candidate');
const Settings = require('../models/Settings');
const EligibleVoter = require('../models/EligibleVoter');
const Vote = require('../models/Vote');
const Voter = require('../models/Voter');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const photoUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadsDir),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

const {
    adminCookieOptions,
    adminCookieClearOptions,
} = require('../config/security');
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

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter(req, file, callback) {
        const name = (file.originalname || '').toLowerCase();
        const allowedMimeTypes = new Set(['text/csv', 'application/csv', 'text/plain']);
        if (name.endsWith('.csv') || allowedMimeTypes.has(file.mimetype)) {
            return callback(null, true);
        }

        return callback(new Error('Only CSV roster files are allowed'));
    },
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
});

const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_PASSWORD || !JWT_SECRET) {
    throw new Error('ADMIN_PASSWORD and JWT_SECRET must be set before starting the server');
}

function passwordMatches(plainTextPassword) {
    const passwordBuffer = Buffer.from(plainTextPassword);
    const adminPasswords = ADMIN_PASSWORD.split(',').map(p => p.trim());

    for (const adminPass of adminPasswords) {
        const adminBuffer = Buffer.from(adminPass);
        if (passwordBuffer.length === adminBuffer.length && crypto.timingSafeEqual(passwordBuffer, adminBuffer)) {
            return true;
        }
    }
    return false;
}

module.exports = function(io) {

    // Admin login
    router.post('/login', loginLimiter, (req, res) => {
        const { password } = req.body ?? {};
        if (typeof password !== 'string' || !password.trim()) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (passwordMatches(password)) {
            const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
            res.cookie('admin_token', token, adminCookieOptions());
            res.json({ success: true });
        } else {
            res.status(401).json({ error: 'Invalid password' });
        }
    });

    router.post('/logout', (req, res) => {
        res.clearCookie('admin_token', adminCookieClearOptions());
        res.json({ success: true });
    });

    // Middleware to protect admin routes
    const verifyAdmin = (req, res, next) => {
        const token = req.cookies.admin_token;
        if (!token) return res.status(401).json({ error: 'Access denied' });
        try {
            jwt.verify(token, JWT_SECRET);
            next();
        } catch (err) {
            res.status(401).json({ error: 'Invalid token' });
        }
    };

    router.use(verifyAdmin);

    // Get live results (always accessible to admin)
    router.get('/results', async (req, res) => {
        try {
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
            res.json(results);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Manage settings
    router.post('/settings', writeLimiter, async (req, res) => {
        try {
            const { votingOpen, resultsPublished, scheduledStartTime, scheduledCloseTime, expectedVoters } = req.body ?? {};
            let settings = await Settings.findOne();
            if (!settings) {
                settings = new Settings({});
            }

            if (votingOpen !== undefined) {
                if (typeof votingOpen !== 'boolean') {
                    return res.status(400).json({ error: 'votingOpen must be a boolean' });
                }

                settings.votingOpen = votingOpen;
            }

            if (resultsPublished !== undefined) {
                if (typeof resultsPublished !== 'boolean') {
                    return res.status(400).json({ error: 'resultsPublished must be a boolean' });
                }

                settings.resultsPublished = resultsPublished;
            }

            if (scheduledStartTime !== undefined) {
                settings.scheduledStartTime = scheduledStartTime ? new Date(scheduledStartTime) : null;
            }

            if (scheduledCloseTime !== undefined) {
                settings.scheduledCloseTime = scheduledCloseTime ? new Date(scheduledCloseTime) : null;
            }

            if (expectedVoters !== undefined) {
                const parsed = parseInt(expectedVoters, 10);
                settings.expectedVoters = isNaN(parsed) ? 0 : Math.max(0, parsed);
            }
            
            await settings.save();
            
            io.emit('results-updated');
            
            res.json(settings);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Get Roster
    router.get('/roster', async (req, res) => {
        try {
            const roster = await EligibleVoter.find().sort({ name: 1 }).lean();
            res.json(roster);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Manage Roster (append/update existing from form or list)
    router.post('/roster', writeLimiter, async (req, res) => {
        try {
            let voters = req.body?.voters;

            // Support single voter payload from form as well: { name, email, enrollmentNo }
            if (!voters) {
                if (req.body?.name) {
                    voters = [req.body];
                } else if (Array.isArray(req.body)) {
                    voters = req.body;
                }
            }

            if (!Array.isArray(voters) || voters.length === 0) {
                return res.status(400).json({ error: 'Please provide voter details (Name, and Email or Enrollment Number)' });
            }

            const validVoters = [];
            const seenEmails = new Set();
            const seenEnrollments = new Set();

            for (const voter of voters) {
                const name = toTrimmedString(voter?.name);
                const rawEmail = voter?.email;
                const email = rawEmail ? normalizeEmail(rawEmail) : undefined;
                const rawEnNo = voter?.enrollmentNo || voter?.enNo || voter?.enrollment_no || voter?.rollNo || voter?.roll_no || voter?.roll || voter?.id;
                const enrollmentNo = rawEnNo ? normalizeEnrollmentNo(rawEnNo) : undefined;

                const hasValidEmail = email && isValidEmail(email);
                const hasValidEnNo = enrollmentNo && isValidEnrollmentNo(enrollmentNo);

                if (!isNonEmptyString(name, 120)) {
                    return res.status(400).json({
                        error: 'Voter name is required (up to 120 characters).'
                    });
                }

                if (!hasValidEmail && !hasValidEnNo) {
                    return res.status(400).json({
                        error: `Voter "${name}" must have an Enrollment Number / Roll Number (or College Email).`
                    });
                }

                if (rawEmail && !hasValidEmail) {
                    return res.status(400).json({
                        error: `Invalid email address provided for voter "${name}".`
                    });
                }

                if (rawEnNo && !hasValidEnNo) {
                    return res.status(400).json({
                        error: `Invalid Enrollment / Roll Number for voter "${name}". Must be 1-60 characters (letters, numbers, hyphens).`
                    });
                }

                if ((email && seenEmails.has(email)) || (enrollmentNo && seenEnrollments.has(enrollmentNo))) {
                    continue;
                }

                if (email) seenEmails.add(email);
                if (enrollmentNo) seenEnrollments.add(enrollmentNo);

                validVoters.push({
                    name,
                    ...(hasValidEmail ? { email } : {}),
                    ...(hasValidEnNo ? { enrollmentNo } : {})
                });
            }

            const bulkOps = validVoters.map(v => ({
                updateOne: {
                    filter: v.enrollmentNo ? { enrollmentNo: v.enrollmentNo } : { email: v.email },
                    update: { $set: v },
                    upsert: true
                }
            }));
            
            if (bulkOps.length > 0) {
                await EligibleVoter.bulkWrite(bulkOps, { ordered: false });
            }
            
            res.json({ success: true, count: validVoters.length });
        } catch (err) {
            console.error(err);
            if (err.code === 11000 || (err.writeErrors && err.writeErrors.some(e => e.code === 11000))) {
                return res.status(400).json({
                    error: 'A voter with this email or enrollment number already exists in the roster.'
                });
            }
            res.status(500).json({ error: 'Server error while saving voter to roster' });
        }
    });

    // Upload Roster via CSV (appends to existing)
    router.post('/upload-roster', writeLimiter, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const validVoters = parseRosterCsv(req.file.buffer);

            if (validVoters.length === 0) {
                return res.status(400).json({
                    error: 'No valid voters found in file. Ensure the CSV has "Name", and "Enrollment No" ("En No" or "Roll No") column.'
                });
            }

            const bulkOps = validVoters.map(v => ({
                updateOne: {
                    filter: v.enrollmentNo ? { enrollmentNo: v.enrollmentNo } : { email: v.email },
                    update: { $set: v },
                    upsert: true
                }
            }));
            
            if (bulkOps.length > 0) {
                await EligibleVoter.bulkWrite(bulkOps, { ordered: false });
            }
            
            res.json({ success: true, count: validVoters.length });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Error parsing file' });
        }
    });

    // Add Position
    router.post('/positions', writeLimiter, async (req, res) => {
        try {
            const { name } = req.body ?? {};
            if (!isNonEmptyString(name, 120)) {
                return res.status(400).json({ error: 'Position name is required' });
            }

            const newPos = new Position({ name });
            await newPos.save();
            res.json(newPos);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Upload candidate photo
    router.post('/upload-photo', writeLimiter, photoUpload.single('photo'), (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }
            res.json({ url: `/uploads/${req.file.filename}` });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Add Candidate
    router.post('/candidates', writeLimiter, async (req, res) => {
        try {
            const { positionId, name, photoUrl } = req.body ?? {};

            if (!isValidObjectId(positionId)) {
                return res.status(400).json({ error: 'Valid positionId is required' });
            }

            if (!isNonEmptyString(name, 120)) {
                return res.status(400).json({ error: 'Candidate name is required' });
            }

            const isLocalUrl = typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/');
            if (photoUrl !== undefined && photoUrl !== '' && !isLocalUrl && !isValidHttpUrl(photoUrl)) {
                return res.status(400).json({ error: 'photoUrl must be a valid http or https URL or a local upload path' });
            }

            const position = await Position.findById(positionId).lean();
            if (!position) {
                return res.status(404).json({ error: 'Position not found' });
            }

            const newCand = new Candidate({ positionId, name, photoUrl });
            await newCand.save();
            res.json(newCand);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Get Voter Turnout Log (Anonymous Secret Ballot: Shows WHO voted, but strictly NOT WHO voted for WHOM)
    router.get('/votes-log', async (req, res) => {
        try {
            const voters = await Voter.find().sort({ votedAt: -1 }).lean();
            
            const formattedLogs = voters.map(v => ({
                _id: v._id,
                voterName: v.name,
                voterEnrollmentNo: v.enrollmentNo || '-',
                voterEmail: v.email || '-',
                channel: v.channel || 'online',
                votedAt: v.votedAt
            }));
            
            res.json(formattedLogs);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // In-Person / Manual Kiosk Vote Recording (Admin Protected)
    router.post('/manual-vote', writeLimiter, async (req, res) => {
        try {
            const { name, email, enrollmentNo, selections, channel = 'manual_kiosk' } = req.body ?? {};

            const cleanName = toTrimmedString(name);
            const rawEmail = email ? normalizeEmail(email) : '';
            const rawEnNo = enrollmentNo ? normalizeEnrollmentNo(enrollmentNo) : '';

            if (!cleanName || (!rawEmail && !rawEnNo)) {
                return res.status(400).json({ error: 'Student Name and at least Email or Enrollment No are required.' });
            }

            // Check eligibility in EligibleVoter roster
            const orConditions = [];
            if (rawEmail) orConditions.push({ email: rawEmail });
            if (rawEnNo) orConditions.push({ enrollmentNo: rawEnNo });

            const eligible = await EligibleVoter.findOne({ $or: orConditions }).lean();
            if (!eligible) {
                return res.status(403).json({ error: 'Student is not on the eligible college voters roster.' });
            }

            // Check if already voted
            const alreadyVotedConditions = [];
            if (eligible.email) alreadyVotedConditions.push({ email: eligible.email });
            if (eligible.enrollmentNo) alreadyVotedConditions.push({ enrollmentNo: eligible.enrollmentNo });

            const existingVoter = await Voter.findOne({ $or: alreadyVotedConditions }).lean();
            if (existingVoter) {
                return res.status(403).json({ error: `Student "${eligible.name}" has already cast their ballot in this election.` });
            }

            // Record attendance in Voter (locks out duplicate voting)
            const newVoter = new Voter({
                name: eligible.name,
                email: eligible.email,
                enrollmentNo: eligible.enrollmentNo,
                channel
            });
            await newVoter.save();

            // Insert anonymous votes
            if (selections && typeof selections === 'object') {
                const votesToInsert = Object.entries(selections)
                    .filter(([posId, candId]) => isValidObjectId(posId) && isValidObjectId(candId))
                    .map(([positionId, candidateId]) => ({
                        positionId,
                        candidateId
                    }));

                if (votesToInsert.length > 0) {
                    await Vote.insertMany(votesToInsert);
                }
            }

            io.emit('results-updated');
            res.json({ success: true, message: `In-person ballot recorded for ${eligible.name}.` });
        } catch (err) {
            console.error(err);
            if (err.code === 11000) {
                return res.status(403).json({ error: 'This student has already voted.' });
            }
            res.status(500).json({ error: 'Server error while recording manual ballot' });
        }
    });

    // Sync Offline Ballots (Batch upload from offline vault when connectivity returns)
    router.post('/sync-offline-votes', writeLimiter, async (req, res) => {
        try {
            const { ballots } = req.body ?? {};
            if (!Array.isArray(ballots) || ballots.length === 0) {
                return res.status(400).json({ error: 'No offline ballots provided for sync.' });
            }

            let syncedCount = 0;
            let skippedCount = 0;

            for (const ballot of ballots) {
                const { voter, selections, timestamp } = ballot;
                const cleanName = toTrimmedString(voter?.name);
                const rawEmail = voter?.email ? normalizeEmail(voter.email) : '';
                const rawEnNo = voter?.enrollmentNo ? normalizeEnrollmentNo(voter.enrollmentNo) : '';

                // Handle in-person kiosk booth ballot (no name/email)
                if (ballot.isKiosk || ballot.channel === 'manual_kiosk' || voter?.channel === 'manual_kiosk' || (!cleanName && !rawEmail && !rawEnNo)) {
                    try {
                        const totalKiosk = await Voter.countDocuments({ channel: 'manual_kiosk' });
                        const newVoter = new Voter({
                            name: `In-Person Booth Voter #${totalKiosk + 1}`,
                            channel: 'manual_kiosk',
                            votedAt: timestamp ? new Date(timestamp) : new Date()
                        });
                        await newVoter.save();

                        const entries = Array.isArray(selections)
                            ? selections.map(s => [s.positionId, s.candidateId])
                            : (selections && typeof selections === 'object' ? Object.entries(selections) : []);

                        const votesToInsert = entries
                            .filter(([posId, candId]) => isValidObjectId(posId) && isValidObjectId(candId))
                            .map(([positionId, candidateId]) => ({
                                positionId,
                                candidateId,
                                votedAt: timestamp ? new Date(timestamp) : new Date()
                            }));

                        if (votesToInsert.length > 0) {
                            await Vote.insertMany(votesToInsert);
                        }
                        syncedCount += 1;
                    } catch {
                        skippedCount += 1;
                    }
                    continue;
                }

                if (!cleanName || (!rawEmail && !rawEnNo)) {
                    skippedCount += 1;
                    continue;
                }

                // Check eligibility
                const orConditions = [];
                if (rawEmail) orConditions.push({ email: rawEmail });
                if (rawEnNo) orConditions.push({ enrollmentNo: rawEnNo });

                const eligible = await EligibleVoter.findOne({ $or: orConditions }).lean();
                if (!eligible) {
                    skippedCount += 1;
                    continue;
                }

                // Check if already voted
                const alreadyVotedConditions = [];
                if (eligible.email) alreadyVotedConditions.push({ email: eligible.email });
                if (eligible.enrollmentNo) alreadyVotedConditions.push({ enrollmentNo: eligible.enrollmentNo });

                const existingVoter = await Voter.findOne({ $or: alreadyVotedConditions }).lean();
                if (existingVoter) {
                    skippedCount += 1;
                    continue;
                }

                try {
                    // Record attendance
                    const newVoter = new Voter({
                        name: eligible.name,
                        email: eligible.email,
                        enrollmentNo: eligible.enrollmentNo,
                        channel: 'offline_sync',
                        votedAt: timestamp ? new Date(timestamp) : new Date()
                    });
                    await newVoter.save();

                    // Insert anonymous votes
                    if (selections && typeof selections === 'object') {
                        const votesToInsert = Object.entries(selections)
                            .filter(([posId, candId]) => isValidObjectId(posId) && isValidObjectId(candId))
                            .map(([positionId, candidateId]) => ({
                                positionId,
                                candidateId,
                                votedAt: timestamp ? new Date(timestamp) : new Date()
                            }));

                        if (votesToInsert.length > 0) {
                            await Vote.insertMany(votesToInsert);
                        }
                    }
                    syncedCount += 1;
                } catch {
                    skippedCount += 1;
                }
            }

            if (syncedCount > 0) {
                io.emit('results-updated');
            }

            res.json({
                success: true,
                syncedCount,
                skippedCount,
                message: `Synced ${syncedCount} offline ballots (${skippedCount} duplicates skipped).`
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error while syncing offline ballots' });
        }
    });

    // Delete an individual vote
    router.delete('/votes/:id', writeLimiter, async (req, res) => {
        try {
            const { id } = req.params;
            if (!isValidObjectId(id)) {
                return res.status(400).json({ error: 'Invalid vote ID' });
            }
            const deletedVote = await Vote.findByIdAndDelete(id);
            if (!deletedVote) {
                return res.status(404).json({ error: 'Vote not found' });
            }
            io.emit('results-updated');
            res.json({ success: true, message: 'Vote deleted successfully.' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Reset all votes
    router.delete('/votes', writeLimiter, async (req, res) => {
        try {
            await Vote.deleteMany({});
            await Voter.deleteMany({});
            io.emit('results-updated');
            res.json({ success: true, message: 'All casted votes have been cleared.' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Reset entire election session (wipe everything)
    router.delete('/election', writeLimiter, async (req, res) => {
        try {
            await Vote.deleteMany({});
            await Voter.deleteMany({});
            await Candidate.deleteMany({});
            await Position.deleteMany({});
            await Settings.updateMany({}, { 
                $set: { 
                    votingOpen: false, 
                    resultsPublished: false,
                    scheduledStartTime: null,
                    scheduledCloseTime: null
                } 
            });
            io.emit('results-updated');
            res.json({ success: true, message: 'The entire election session has been wiped.' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Delete a position
    router.delete('/positions/:id', writeLimiter, async (req, res) => {
        try {
            const { id } = req.params;
            if (!isValidObjectId(id)) {
                return res.status(400).json({ error: 'Invalid position ID' });
            }
            await Position.findByIdAndDelete(id);
            await Candidate.deleteMany({ positionId: id });
            await Vote.deleteMany({ positionId: id });
            io.emit('results-updated');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Delete a candidate
    router.delete('/candidates/:id', writeLimiter, async (req, res) => {
        try {
            const { id } = req.params;
            if (!isValidObjectId(id)) {
                return res.status(400).json({ error: 'Invalid candidate ID' });
            }
            await Candidate.findByIdAndDelete(id);
            await Vote.deleteMany({ candidateId: id });
            io.emit('results-updated');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Delete an eligible voter
    router.delete('/roster/:id', writeLimiter, async (req, res) => {
        try {
            const { id } = req.params;
            if (!isValidObjectId(id)) {
                return res.status(400).json({ error: 'Invalid voter ID' });
            }
            await EligibleVoter.findByIdAndDelete(id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    return router;
};
