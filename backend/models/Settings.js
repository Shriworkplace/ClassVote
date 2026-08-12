const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    votingOpen: {
        type: Boolean,
        default: false
    },
    resultsPublished: {
        type: Boolean,
        default: false
    },
    scheduledStartTime: {
        type: Date,
        default: null
    },
    scheduledCloseTime: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model('Settings', settingsSchema);
