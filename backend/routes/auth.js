const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { authCookieOptions, authCookieClearOptions } = require('../config/security');
const { requireAuth } = require('../middleware/authMiddleware');
const { isNonEmptyString, isValidEmail, normalizeEmail, toTrimmedString } = require('../utils/validation');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.' }
});

function serializeUser(user) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        organization: user.organization || '',
        createdAt: user.createdAt
    };
}

function issueAuthCookie(res, user) {
    const token = jwt.sign(
        { userId: String(user._id), email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.cookie('auth_token', token, authCookieOptions());
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
    try {
        const cleanName = toTrimmedString(req.body?.name);
        const cleanEmail = normalizeEmail(req.body?.email);
        const cleanOrg = toTrimmedString(req.body?.organization);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!isNonEmptyString(cleanName, 120)) {
            return res.status(400).json({ error: 'Full name is required (max 120 characters).' });
        }
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }
        if (password.length < 8 || password.length > 128) {
            return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
        }
        if (cleanOrg.length > 120) {
            return res.status(400).json({ error: 'Organization name must be 120 characters or fewer.' });
        }

        const existing = await User.findOne({ email: cleanEmail }).lean();
        if (existing) {
            return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
        }

        const passwordHash = await hashPassword(password);
        const user = new User({
            name: cleanName,
            email: cleanEmail,
            organization: cleanOrg,
            passwordHash
        });
        await user.save();

        issueAuthCookie(res, user);
        res.status(201).json({ success: true, user: serializeUser(user) });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
    try {
        const cleanEmail = normalizeEmail(req.body?.email);
        const password = typeof req.body?.password === 'string' ? req.body.password : '';

        if (!isValidEmail(cleanEmail) || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        issueAuthCookie(res, user);
        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during sign in.' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token', authCookieClearOptions());
    res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).lean();
        if (!user) {
            res.clearCookie('auth_token', authCookieClearOptions());
            return res.status(401).json({ error: 'Account no longer exists.' });
        }
        res.json({ user: serializeUser(user) });
    } catch (err) {
        console.error('Auth me error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (req.body?.name !== undefined) {
            const cleanName = toTrimmedString(req.body.name);
            if (!isNonEmptyString(cleanName, 120)) {
                return res.status(400).json({ error: 'Name is required (max 120 characters).' });
            }
            user.name = cleanName;
        }

        if (req.body?.organization !== undefined) {
            const cleanOrg = toTrimmedString(req.body.organization);
            if (cleanOrg.length > 120) {
                return res.status(400).json({ error: 'Organization must be 120 characters or fewer.' });
            }
            user.organization = cleanOrg;
        }

        if (req.body?.newPassword) {
            const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
            const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required to set a new password.' });
            }
            const valid = await verifyPassword(currentPassword, user.passwordHash);
            if (!valid) {
                return res.status(401).json({ error: 'Current password is incorrect.' });
            }
            if (newPassword.length < 8 || newPassword.length > 128) {
                return res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
            }
            user.passwordHash = await hashPassword(newPassword);
        }

        await user.save();
        issueAuthCookie(res, user);
        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Server error while updating profile.' });
    }
});

module.exports = router;
