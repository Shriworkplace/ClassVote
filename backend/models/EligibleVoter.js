const mongoose = require('mongoose');

const eligibleVoterSchema = new mongoose.Schema({
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
    }
});

eligibleVoterSchema.index(
    { electionId: 1, email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);
eligibleVoterSchema.index(
    { electionId: 1, enrollmentNo: 1 },
    { unique: true, partialFilterExpression: { enrollmentNo: { $type: 'string' } } }
);

module.exports = mongoose.model('EligibleVoter', eligibleVoterSchema);
