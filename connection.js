const mongoose = require('mongoose');

const DB = process.env.DATABASE ? process.env.DATABASE.replace(
    '<PASSWORD>',
    encodeURIComponent(process.env.DATABASE_PASSWORD || '')
) : null;
if (DB) {
    try {
        await mongoose.connect(DB, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            retryWrites: true,
        });
        console.log('DB connected');
    } catch (err) {
        console.error('DB connection error:', err);
        process.exit(1);
    }
} else {
    console.log('No DATABASE configuration found, skipping database connection');
}
export default DB;
