const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        default: null,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        lowercase: true,
        trim: true
    },
    enrollmentNo: {
        type: String,
        uppercase: true,
        trim: true
    },
    votedAt: {
        type: Date,
        default: Date.now
    },
    channel: {
        type: String,
        enum: ['online', 'manual_kiosk', 'offline_sync'],
        default: 'online'
    }
});

voterSchema.index(
    { electionId: 1, email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
voterSchema.index(
    { electionId: 1, enrollmentNo: 1 },
    { unique: true, partialFilterExpression: { enrollmentNo: { $type: 'string' } } }
);

module.exports = mongoose.model('Voter', voterSchema);
