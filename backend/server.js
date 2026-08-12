require('dotenv').config();
const express = require('express');
const http = require('http');
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
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
// app.use(mongoSanitize());
app.use(cookieParser());

// Serve static files from the React app if in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// Serve uploaded photos statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/classvote';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));


const apiRoutes = require('./routes/api')(io);
const adminRoutes = require('./routes/admin')(io);

app.use('/api/admin', adminRoutes);
app.use('/api', apiRoutes);


// Catch-all route to serve the React app for any unknown paths (handles React Router)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
} else {
    app.use((req, res) => {
        res.send('Running in development mode. Please use the Vite development server (port 5173) for the frontend.');
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
