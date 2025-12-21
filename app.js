
const express = require('express');
const app = express();

const cors = require('cors');
const rateLimit = require('express-rate-limit');

const reminderRouter = require('./routes/reminderRoutes');

app.set('trust proxy', 1);

// Parse JSON bodies for API routes
app.use(express.json());
// Parse URL-encoded bodies (e.g., form submissions with application/x-www-form-urlencoded)
app.use(express.urlencoded({ extended: true }));


app.use(cors({
    // origin: 'https://example.com', // Allow only this domain to access the resources
    // methods: ['GET', 'POST'], // Allow only these methods
    // allowedHeaders: ['Content-Type', 'Authorization'], // Allow only these headers
    // credentials: true, // Allow cookies
}));

// Preflight handling is covered by the global CORS middleware above.
// If needed for specific routes, enable OPTIONS per-route instead of wildcard.

const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000, //1 hour
    message: 'Too many requests, please try again in an hour'
});

app.use('/api', limiter);//apply for all APIs

app.use('/api/v1/reminder', reminderRouter); //method : Mounting Router


const path = require('path');
app.use(express.static(path.join(__dirname, 'client/build')));

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

router.patch('/:id/updateTime', reminderController.updateTime);

module.exports = app;