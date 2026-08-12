const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Position',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    photoUrl: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Candidate', candidateSchema);
