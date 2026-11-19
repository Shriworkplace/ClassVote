const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    clerkId: {
        type: String,
        sparse: true,
        unique: true,
        trim: true
    },
    authProvider: {
        type: String,
        default: 'local' // 'clerk' | 'local'
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        maxlength: 254
    },
    organization: {
        type: String,
        default: '',
        trim: true,
        maxlength: 120
    },
    passwordHash: {
        type: String,
        default: null
    },
    // Two-Factor Authentication
    twoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        default: null
    },
    twoFactorPendingSecret: {
        type: String,
        default: null
    },
    twoFactorBackupCodes: [{
        codeHash: { type: String, required: true },
        used: { type: Boolean, default: false },
        usedAt: { type: Date, default: null }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
