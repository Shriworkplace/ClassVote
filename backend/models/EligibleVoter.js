const mongoose = require('mongoose');

const eligibleVoterSchema = new mongoose.Schema({
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
    }
});

module.exports = mongoose.model('EligibleVoter', eligibleVoterSchema);

