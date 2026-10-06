const mongoose = require('mongoose');

// Anonymous Secret Ballot: votes are decoupled from voter identity to protect voter privacy
const voteSchema = new mongoose.Schema({
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        required: true,
        index: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true,
        index: true
    },
    votedAt: {
        type: Date,
        default: Date.now
    }
});

// Index for fast tallying
voteSchema.index({ positionId: 1, candidateId: 1 });

module.exports = mongoose.model('Vote', voteSchema);
