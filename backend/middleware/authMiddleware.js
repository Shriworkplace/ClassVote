const jwt = require('jsonwebtoken');
const { getAuth, clerkClient } = require('@clerk/express');
const Election = require('../models/Election');
const User = require('../models/User');
const { isValidObjectId } = require('../utils/validation');

async function requireAuth(req, res, next) {
    try {
        // 1. Check Clerk Authentication (from Bearer header, session cookie, or req.auth)
        try {
            const clerkAuth = getAuth(req);
            if (clerkAuth && clerkAuth.userId) {
                let user = await User.findOne({ clerkId: clerkAuth.userId });
                if (!user) {
                    try {
                        const clerkUser = await clerkClient.users.getUser(clerkAuth.userId);
                        const primaryEmail = clerkUser.emailAddresses?.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
                                             clerkUser.emailAddresses?.[0]?.emailAddress;

                        const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
                                         clerkUser.username ||
                                         primaryEmail?.split('@')[0] ||
                                         'Organizer';

                        if (primaryEmail) {
                            user = await User.findOne({ email: primaryEmail.toLowerCase() });
                            if (user) {
                                user.clerkId = clerkAuth.userId;
                                user.authProvider = 'clerk';
                                await user.save();
                            }
                        }

                        if (!user && primaryEmail) {
                            user = await User.create({
                                clerkId: clerkAuth.userId,
                                authProvider: 'clerk',
                                email: primaryEmail.toLowerCase(),
                                name: fullName,
                                organization: ''
                            });
                        }
                    } catch (err) {
                        console.error('Clerk user sync error:', err.message);
                    }
                }

                if (user) {
                    req.user = {
                        userId: String(user._id),
                        email: user.email,
                        name: user.name,
                        clerkId: clerkAuth.userId
                    };
                    return next();
                }
            }
        } catch (clerkErr) {
            // Not a Clerk request, continue to local cookie check
        }

        // 2. Check Local HTTP-Only JWT Cookie
        const token = req.cookies?.auth_token;
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded?.userId) {
                    req.user = {
                        userId: decoded.userId,
                        email: decoded.email,
                        name: decoded.name
                    };
                    return next();
                }
            } catch {
                // Token invalid or expired
            }
        }

        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    } catch (err) {
        console.error('requireAuth error:', err);
        return res.status(500).json({ error: 'Authentication error' });
    }
}

async function requireElectionOwner(req, res, next) {
    try {
        const { electionId } = req.params;
        if (!isValidObjectId(electionId)) {
            return res.status(400).json({ error: 'Invalid election ID' });
        }

        const election = await Election.findById(electionId);
        if (!election) {
            return res.status(404).json({ error: 'Election not found' });
        }

        if (String(election.ownerId) !== String(req.user.userId)) {
            return res.status(403).json({ error: 'You do not have permission to manage this election' });
        }

        req.election = election;
        next();
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
}

module.exports = {
    requireAuth,
    requireElectionOwner,
};
