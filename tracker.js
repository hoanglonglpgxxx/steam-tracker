const mongoose = require('mongoose');
const { steamHandler } = require('./platforms/steam');
const { initScheduledJobs } = require('./actions/cronJobs');
const discordHandler = require('./platforms/discord');
const { debugLog } = require('./utils/helper');
const app = require('./app');
const fs = require('fs');

require('dotenv').config();
const STATE_FILE = './last_change.json';

const DB = process.env.DATABASE ? process.env.DATABASE.replace(
    '<PASSWORD>',
    encodeURIComponent(process.env.DATABASE_PASSWORD || '')
) : null;

let lastChangeNumber = 0;

// Load trạng thái cũ
if (fs.existsSync(STATE_FILE)) {
    try { lastChangeNumber = JSON.parse(fs.readFileSync(STATE_FILE)).changeNumber || 0; } catch (e) { }
}


if (DB) {
    try {
        mongoose.connect(DB, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            retryWrites: true,
        });
        debugLog('DB connected');

        initScheduledJobs();
    } catch (err) {
        console.error('DB connection error:', err);
        process.exit(1);
    }
} else {
    debugLog('No DATABASE configuration found, skipping database connection');
}

try {
    steamHandler(lastChangeNumber);
} catch (err) {
    console.error('Cant connect to discord', err);
}
try {
    discordHandler(lastChangeNumber);
} catch (err) {
    console.error('Cant connect to discord', err);
}

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
    console.log(`server running on port ${port}`);
});
