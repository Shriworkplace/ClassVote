const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
    return toTrimmedString(value).toLowerCase();
}

function isValidEmail(value) {
    return typeof value === 'string' && value.length <= 254 && EMAIL_REGEX.test(value);
}

function isNonEmptyString(value, maxLength = 120) {
    if (typeof value !== 'string') {
        return false;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength;
}

function isValidObjectId(value) {
    return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function isValidHttpUrl(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }

    try {
        const url = new URL(value.trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function splitCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];

        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    values.push(current);
    return values;
}

function parseRosterCsv(buffer) {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '').trim();
    if (!text) {
        return [];
    }

    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
        return [];
    }

    const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
    const nameIndex = headers.findIndex((header) => header.includes('name'));
    const emailIndex = headers.findIndex((header) => header.includes('email'));

    if (nameIndex === -1 || emailIndex === -1) {
        return [];
    }

    const voters = [];
    for (let index = 1; index < lines.length; index += 1) {
        const columns = splitCsvLine(lines[index]);
        const name = toTrimmedString(columns[nameIndex]);
        const email = normalizeEmail(columns[emailIndex]);

        if (isNonEmptyString(name, 120) && isValidEmail(email)) {
            voters.push({ name, email });
        }
    }

    return voters;
}

module.exports = {
    isNonEmptyString,
    isValidEmail,
    isValidHttpUrl,
    isValidObjectId,
    normalizeEmail,
    parseRosterCsv,
    toTrimmedString,
};