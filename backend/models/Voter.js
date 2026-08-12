const mongoose = require('mongoose');

const voterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    votedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Voter', voterSchema);
