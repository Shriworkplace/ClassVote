const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },
    enrollmentNo: {
        type: String,
        unique: true,
        sparse: true,
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

module.exports = mongoose.model('Voter', voterSchema);

