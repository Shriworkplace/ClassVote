require('dotenv').config();
const mongoose = require('mongoose');

async function dropDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB. Dropping database...');
        await mongoose.connection.db.dropDatabase();
        console.log('Database dropped successfully.');
    } catch (err) {
        console.error('Error dropping database:', err);
    } finally {
        await mongoose.disconnect();
    }
}

dropDB();
