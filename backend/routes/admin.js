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
    isValidHttpUrl,
    isValidObjectId,
    normalizeEmail,
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
    const adminBuffer = Buffer.from(ADMIN_PASSWORD);

    if (passwordBuffer.length !== adminBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(passwordBuffer, adminBuffer);
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
            const { votingOpen, resultsPublished } = req.body ?? {};
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
            
            await settings.save();
            
            if (resultsPublished) {
                 io.emit('results-updated');
            }
            
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

    // Manage Roster (append/update existing)
    router.post('/roster', writeLimiter, async (req, res) => {
        try {
            const { voters } = req.body ?? {}; // Array of { name, email }
            if (!Array.isArray(voters)) {
                return res.status(400).json({ error: 'Invalid data format' });
            }

            const validVoters = [];
            const seenEmails = new Set();

            for (const voter of voters) {
                const name = toTrimmedString(voter?.name);
                const email = normalizeEmail(voter?.email);

                if (!isNonEmptyString(name, 120) || !isValidEmail(email)) {
                    return res.status(400).json({ error: 'Every voter must have a valid name and email' });
                }

                if (seenEmails.has(email)) {
                    continue;
                }

                seenEmails.add(email);
                validVoters.push({ name, email });
            }

            const bulkOps = validVoters.map(v => ({
                updateOne: {
                    filter: { email: v.email },
                    update: { $set: { name: v.name } },
                    upsert: true
                }
            }));
            
            if (bulkOps.length > 0) {
                await EligibleVoter.bulkWrite(bulkOps);
            }
            
            res.json({ success: true, count: validVoters.length });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Upload Roster via CSV (appends to existing)
    router.post('/upload-roster', writeLimiter, upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

            const validVoters = parseRosterCsv(req.file.buffer);

            if (validVoters.length === 0) {
                return res.status(400).json({ error: 'No valid voters found in file. Ensure the CSV has Name and Email columns.' });
            }

            const bulkOps = validVoters.map(v => ({
                updateOne: {
                    filter: { email: v.email },
                    update: { $set: { name: v.name } },
                    upsert: true
                }
            }));
            
            if (bulkOps.length > 0) {
                await EligibleVoter.bulkWrite(bulkOps);
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

    // Get all vote logs (detailed)
    router.get('/votes-log', async (req, res) => {
        try {
            const votes = await Vote.find()
                .populate('voterId', 'name email')
                .populate('positionId', 'name')
                .populate('candidateId', 'name')
                .sort({ votedAt: -1 })
                .lean();
            
            // Format for frontend
            const formattedLogs = votes.map(v => ({
                _id: v._id,
                voterName: v.voterId?.name || 'Unknown',
                voterEmail: v.voterId?.email || 'Unknown',
                positionName: v.positionId?.name || 'Unknown',
                candidateName: v.candidateId?.name || 'Unknown',
                votedAt: v.votedAt
            }));
            
            res.json(formattedLogs);
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
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
