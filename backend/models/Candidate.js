const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    electionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Election',
        default: null,
        index: true
    },
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    photoUrl: {
        type: String,
        default: ''
    },
    editHistory: [
        {
            previousName: { type: String, required: true },
            newName: { type: String, required: true },
            editedAt: { type: Date, default: Date.now }
        }
    ]
});

module.exports = mongoose.model('Candidate', candidateSchema);
