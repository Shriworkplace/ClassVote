require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const setupSocket = require('./socket');
const {
    corsOptions,
    ensureRequiredEnv,
} = require('./config/security');

const app = express();
const server = http.createServer(app);
const io = setupSocket(server);

ensureRequiredEnv();
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions()));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '512kb' }));
app.use(mongoSanitize());
app.use(cookieParser());

const { clerkMiddleware } = require('@clerk/express');
app.use(clerkMiddleware());

// Serve static files from the React app if SERVE_FRONTEND is set to true
if (process.env.SERVE_FRONTEND === 'true') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// Serve uploaded candidate photos statically with strict non-executable headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; sandbox");
    }
}));


const Position = require('./models/Position');
const EligibleVoter = require('./models/EligibleVoter');
const Voter = require('./models/Voter');

async function migrateLegacyIndexes() {
    const drops = [
        { model: Position, indexName: 'name_1' },
        { model: EligibleVoter, indexName: 'email_1' },
        { model: EligibleVoter, indexName: 'enrollmentNo_1' },
        { model: Voter, indexName: 'email_1' },
        { model: Voter, indexName: 'enrollmentNo_1' },
    ];
    for (const { model, indexName } of drops) {
        try {
            await model.collection.dropIndex(indexName);
            console.log(`Dropped legacy global index ${indexName} on ${model.collection.name}`);
        } catch {
            // Index does not exist or already migrated
        }
    }
    try {
        await Promise.all([
            Position.syncIndexes(),
            EligibleVoter.syncIndexes(),
            Voter.syncIndexes()
        ]);
    } catch (err) {
        console.warn('Index sync warning:', err.message);
    }
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/classvote';
mongoose.connect(MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');
        await migrateLegacyIndexes();
    })
    .catch(err => console.error('MongoDB connection error:', err));


const authRoutes = require('./routes/auth');
const electionRoutes = require('./routes/elections')(io);
const publicElectionRoutes = require('./routes/publicElection')(io);
const { seoRouter, handleElectionSocialCard } = require('./routes/seo');

// Health check endpoint for uptime monitoring (fast, no database)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Mount SEO routes: /robots.txt and /sitemap.xml
app.use('/', seoRouter);

app.use('/api/auth', authRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/e', publicElectionRoutes);

// Catch-all route to serve the React app for any unknown paths (handles React Router)
if (process.env.SERVE_FRONTEND === 'true') {
    app.use(handleElectionSocialCard);
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
} else {
    app.use((req, res) => {
        res.send('API is running. If you are looking for the frontend, it is hosted separately.');
    });
}

// Keep-alive ping to prevent Render free-tier from sleeping
if (process.env.RENDER_EXTERNAL_URL) {
    console.log('Keep-alive ping scheduled every 14 minutes for:', process.env.RENDER_EXTERNAL_URL);
    setInterval(() => {
        https.get(`${process.env.RENDER_EXTERNAL_URL}/health`).on('error', (err) => {
            console.error('Keep-alive ping failed:', err.message);
        });
    }, 14 * 60 * 1000); // 14 minutes
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
