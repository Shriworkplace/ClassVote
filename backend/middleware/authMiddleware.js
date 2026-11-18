const jwt = require('jsonwebtoken');
const Election = require('../models/Election');
const { isValidObjectId } = require('../utils/validation');

function requireAuth(req, res, next) {
    const token = req.cookies?.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded?.userId) {
            return res.status(401).json({ error: 'Invalid session. Please sign in again.' });
        }
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            name: decoded.name
        };
        next();
    } catch {
        return res.status(401).json({ error: 'Session expired. Please sign in again.' });
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
