const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { authCookieOptions, authCookieClearOptions } = require('../config/security');
const { requireAuth } = require('../middleware/authMiddleware');
const { isNonEmptyString, isValidEmail, normalizeEmail, toTrimmedString } = require('../utils/validation');
const {
    generateSecret,
    generateTotp,
    verifyTotp,
    generateOtpAuthUrl,
    generateBackupCodes,
    hashBackupCode,
    verifyBackupCode
} = require('../utils/totp');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.' }
});

const twoFactorLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Please try again later.' }
});

function serializeUser(user) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        organization: user.organization || '',
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
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

        // Check if Two-Factor Authentication is enabled on this organizer account
        if (user.twoFactorEnabled && user.twoFactorSecret) {
            const twoFactorToken = jwt.sign(
                { userId: String(user._id), purpose: '2fa_login' },
                process.env.JWT_SECRET,
                { expiresIn: '5m' }
            );

            // Obfuscate email for UI hint
            const [localPart, domain] = user.email.split('@');
            const maskedLocal = localPart.length <= 2
                ? localPart[0] + '***'
                : localPart[0] + '***' + localPart[localPart.length - 1];
            const maskedEmail = `${maskedLocal}@${domain}`;

            return res.json({
                success: true,
                requires2FA: true,
                twoFactorToken,
                maskedEmail
            });
        }

        issueAuthCookie(res, user);
        res.json({ success: true, user: serializeUser(user) });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during sign in.' });
    }
});

// POST /api/auth/login-2fa — Verify 6-digit TOTP code or recovery backup code
router.post('/login-2fa', twoFactorLimiter, async (req, res) => {
    try {
        const { twoFactorToken, code } = req.body || {};
        const cleanCode = toTrimmedString(code);

        if (!twoFactorToken || !cleanCode) {
            return res.status(400).json({ error: 'Two-factor session token and authentication code are required.' });
        }

        let decoded;
        try {
            decoded = jwt.verify(twoFactorToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ error: 'Two-factor login session expired. Please sign in with your password again.' });
        }

        if (decoded?.purpose !== '2fa_login' || !decoded?.userId) {
            return res.status(401).json({ error: 'Invalid two-factor session.' });
        }

        const user = await User.findById(decoded.userId);
        if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
            return res.status(401).json({ error: 'Two-factor authentication is not active on this account.' });
        }

        let isVerified = false;
        let isBackupCodeUsed = false;

        // 1. Check TOTP 6-digit code
        const numericCode = cleanCode.replace(/\s+/g, '');
        if (numericCode.length === 6 && /^\d{6}$/.test(numericCode)) {
            isVerified = verifyTotp(user.twoFactorSecret, numericCode);
        }

        // 2. If not TOTP, check if candidate matches an unused backup code
        if (!isVerified && user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
            for (const backup of user.twoFactorBackupCodes) {
                if (!backup.used && verifyBackupCode(cleanCode, backup.codeHash)) {
                    isVerified = true;
                    isBackupCodeUsed = true;
                    backup.used = true;
                    backup.usedAt = new Date();
                    await user.save();
                    break;
                }
            }
        }

        if (!isVerified) {
            return res.status(401).json({ error: 'Invalid authentication code. Please check your authenticator app or backup code.' });
        }

        issueAuthCookie(res, user);
        res.json({
            success: true,
            user: serializeUser(user),
            usedBackupCode: isBackupCodeUsed
        });
    } catch (err) {
        console.error('2FA Login error:', err);
        res.status(500).json({ error: 'Server error during two-factor verification.' });
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

// POST /api/auth/2fa/setup — Initiate 2FA setup by generating a pending secret and otpauth URI
router.post('/2fa/setup', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const secret = generateSecret();
        user.twoFactorPendingSecret = secret;
        await user.save();

        const otpauthUrl = generateOtpAuthUrl({
            issuer: 'ClassVote',
            account: user.email,
            secret
        });

        res.json({
            success: true,
            secret,
            otpauthUrl
        });
    } catch (err) {
        console.error('2FA setup error:', err);
        res.status(500).json({ error: 'Failed to initiate two-factor setup.' });
    }
});

// POST /api/auth/2fa/verify-enable — Confirm 6-digit TOTP code and activate 2FA
router.post('/2fa/verify-enable', requireAuth, twoFactorLimiter, async (req, res) => {
    try {
        const code = toTrimmedString(req.body?.code);
        if (!code) {
            return res.status(400).json({ error: 'Verification code is required.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !user.twoFactorPendingSecret) {
            return res.status(400).json({ error: 'No pending 2FA setup found. Please start 2FA setup again.' });
        }

        const isValid = verifyTotp(user.twoFactorPendingSecret, code);
        if (!isValid) {
            return res.status(400).json({ error: 'Invalid verification code. Please ensure the time on your authenticator device is synced.' });
        }

        // Activate 2FA
        user.twoFactorSecret = user.twoFactorPendingSecret;
        user.twoFactorPendingSecret = null;
        user.twoFactorEnabled = true;

        // Generate 8 recovery backup codes
        const rawBackupCodes = generateBackupCodes(8);
        user.twoFactorBackupCodes = rawBackupCodes.map(c => ({
            codeHash: hashBackupCode(c),
            used: false,
            usedAt: null
        }));

        await user.save();

        res.json({
            success: true,
            message: 'Two-factor authentication successfully enabled!',
            backupCodes: rawBackupCodes,
            user: serializeUser(user)
        });
    } catch (err) {
        console.error('2FA verify-enable error:', err);
        res.status(500).json({ error: 'Server error while enabling two-factor authentication.' });
    }
});

// GET /api/auth/2fa/status — Check 2FA status and remaining backup code count
router.get('/2fa/status', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const remainingBackups = user.twoFactorBackupCodes
            ? user.twoFactorBackupCodes.filter(b => !b.used).length
            : 0;

        res.json({
            twoFactorEnabled: Boolean(user.twoFactorEnabled),
            backupCodesRemaining: remainingBackups,
            backupCodesTotal: user.twoFactorBackupCodes ? user.twoFactorBackupCodes.length : 0
        });
    } catch (err) {
        console.error('2FA status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/2fa/disable — Disable 2FA with password and authenticator confirmation
router.post('/2fa/disable', requireAuth, twoFactorLimiter, async (req, res) => {
    try {
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const code = toTrimmedString(req.body?.code);

        if (!password || !code) {
            return res.status(400).json({ error: 'Password and current 2FA code are required to disable two-factor authentication.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !user.twoFactorEnabled) {
            return res.status(400).json({ error: 'Two-factor authentication is not enabled.' });
        }

        const passwordValid = await verifyPassword(password, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        let codeValid = verifyTotp(user.twoFactorSecret, code);
        if (!codeValid && user.twoFactorBackupCodes) {
            for (const backup of user.twoFactorBackupCodes) {
                if (!backup.used && verifyBackupCode(code, backup.codeHash)) {
                    codeValid = true;
                    break;
                }
            }
        }

        if (!codeValid) {
            return res.status(401).json({ error: 'Invalid 2FA code or backup code.' });
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = null;
        user.twoFactorPendingSecret = null;
        user.twoFactorBackupCodes = [];
        await user.save();

        res.json({
            success: true,
            message: 'Two-factor authentication has been disabled.',
            user: serializeUser(user)
        });
    } catch (err) {
        console.error('2FA disable error:', err);
        res.status(500).json({ error: 'Server error while disabling two-factor authentication.' });
    }
});

// POST /api/auth/2fa/regenerate-backup-codes — Regenerate 8 new recovery codes
router.post('/2fa/regenerate-backup-codes', requireAuth, twoFactorLimiter, async (req, res) => {
    try {
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        const code = toTrimmedString(req.body?.code);

        if (!password || !code) {
            return res.status(400).json({ error: 'Password and current 2FA code are required to regenerate backup codes.' });
        }

        const user = await User.findById(req.user.userId);
        if (!user || !user.twoFactorEnabled) {
            return res.status(400).json({ error: 'Two-factor authentication is not active.' });
        }

        const passwordValid = await verifyPassword(password, user.passwordHash);
        if (!passwordValid) {
            return res.status(401).json({ error: 'Incorrect password.' });
        }

        const codeValid = verifyTotp(user.twoFactorSecret, code);
        if (!codeValid) {
            return res.status(401).json({ error: 'Invalid 6-digit authenticator code.' });
        }

        const rawBackupCodes = generateBackupCodes(8);
        user.twoFactorBackupCodes = rawBackupCodes.map(c => ({
            codeHash: hashBackupCode(c),
            used: false,
            usedAt: null
        }));
        await user.save();

        res.json({
            success: true,
            backupCodes: rawBackupCodes
        });
    } catch (err) {
        console.error('Regenerate backup codes error:', err);
        res.status(500).json({ error: 'Server error while regenerating backup codes.' });
    }
});

module.exports = router;
