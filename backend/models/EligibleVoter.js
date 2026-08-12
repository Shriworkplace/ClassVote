const mongoose = require('mongoose');

const eligibleVoterSchema = new mongoose.Schema({
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
    }
});

module.exports = mongoose.model('EligibleVoter', eligibleVoterSchema);
