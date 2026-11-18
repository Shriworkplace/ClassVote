const mongoose = require('mongoose');

const electionSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 150
    },
    description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500
    },
    organization: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 80
    },
    accessMode: {
        type: String,
        enum: ['roster', 'open', 'kiosk_only'],
        default: 'roster'
    },
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
    },
    expectedVoters: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

electionSchema.methods.isCurrentlyOpen = function isCurrentlyOpen() {
    const now = new Date();
    if (this.scheduledStartTime && this.scheduledCloseTime) {
        return now >= this.scheduledStartTime && now <= this.scheduledCloseTime;
    }
    if (this.scheduledStartTime) {
        return now >= this.scheduledStartTime;
    }
    if (this.scheduledCloseTime) {
        return now <= this.scheduledCloseTime;
    }
    return Boolean(this.votingOpen);
};

module.exports = mongoose.model('Election', electionSchema);
