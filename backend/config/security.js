const adminCookieBaseOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
};

function getAllowedOrigins() {
    const origins = new Set([
        process.env.FRONTEND_ORIGIN,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:4173',
        'http://127.0.0.1:4173',
    ].filter(Boolean));

    return [...origins];
}

function corsOptions() {
    const allowedOrigins = getAllowedOrigins();

    return {
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    };
}

function socketCorsOptions() {
    return {
        origin: getAllowedOrigins(),
        credentials: true,
    };
}

function adminCookieOptions() {
    return {
        ...adminCookieBaseOptions,
        maxAge: 12 * 60 * 60 * 1000,
    };
}

function adminCookieClearOptions() {
    return {
        ...adminCookieBaseOptions,
    };
}

function ensureRequiredEnv() {
    const required = ['ADMIN_PASSWORD', 'JWT_SECRET'];
    const missing = required.filter((name) => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }
}

module.exports = {
    adminCookieOptions,
    adminCookieClearOptions,
    corsOptions,
    ensureRequiredEnv,
    socketCorsOptions,
};