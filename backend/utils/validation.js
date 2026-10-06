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

function normalizeName(value) {
    return toTrimmedString(value)
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function areNamesMatching(typedName, officialName) {
    const t = normalizeName(typedName);
    const o = normalizeName(officialName);
    return t.length > 0 && o.length > 0 && t === o;
}

function normalizeEnrollmentNo(value) {
    return toTrimmedString(value)
        .toUpperCase()
        .replace(/\s+/g, '');
}

function isValidEnrollmentNo(value) {
    if (typeof value !== 'string') {
        return false;
    }
    const normalized = normalizeEnrollmentNo(value);
    return normalized.length >= 1 && normalized.length <= 60 && /^[A-Z0-9\-_./]+$/.test(normalized);
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
    const enrollmentIndex = headers.findIndex((header) => 
        header.includes('enroll') || 
        header.includes('en no') || 
        header.includes('en_no') || 
        header.includes('enno') || 
        header.includes('en. no') || 
        header.includes('en.no') || 
        header.includes('roll') || 
        header.includes('reg') || 
        header.includes('student id') ||
        header === 'id' ||
        header === 'en'
    );

    // Name is required, and at least one of Email or Enrollment No header must exist
    if (nameIndex === -1 || (emailIndex === -1 && enrollmentIndex === -1)) {
        return [];
    }

    const voters = [];
    for (let index = 1; index < lines.length; index += 1) {
        const columns = splitCsvLine(lines[index]);
        const name = toTrimmedString(columns[nameIndex]);
        const email = emailIndex !== -1 ? normalizeEmail(columns[emailIndex]) : '';
        const enrollmentNo = enrollmentIndex !== -1 ? normalizeEnrollmentNo(columns[enrollmentIndex]) : '';

        const hasValidEmail = isValidEmail(email);
        const hasValidEnNo = isValidEnrollmentNo(enrollmentNo);

        if (isNonEmptyString(name, 120) && (hasValidEmail || hasValidEnNo)) {
            const voterRecord = { name };
            if (hasValidEmail) voterRecord.email = email;
            if (hasValidEnNo) voterRecord.enrollmentNo = enrollmentNo;
            voters.push(voterRecord);
        }
    }

    return voters;
}

module.exports = {
    areNamesMatching,
    isNonEmptyString,
    isValidEmail,
    isValidEnrollmentNo,
    isValidHttpUrl,
    isValidObjectId,
    normalizeEmail,
    normalizeEnrollmentNo,
    normalizeName,
    parseRosterCsv,
    toTrimmedString,
};