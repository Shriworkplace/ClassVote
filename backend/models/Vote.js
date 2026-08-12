const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    voterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voter',
        required: true
    },
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        required: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    votedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound unique index: one vote per voter per position
voteSchema.index({ voterId: 1, positionId: 1 }, { unique: true });

module.exports = mongoose.model('Vote', voteSchema);
