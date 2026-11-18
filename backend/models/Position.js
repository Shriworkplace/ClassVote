const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema({
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
    }
});

positionSchema.index({ electionId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Position', positionSchema);
