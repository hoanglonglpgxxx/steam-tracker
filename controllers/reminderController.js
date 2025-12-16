const Reminder = require('../models/reminderModel');
const reminderHandler = require('../handlers/reminderHandler');

exports.getReminder = reminderHandler.getOne(Reminder);
exports.updateReminder = reminderHandler.updateOne(Reminder);

// Convenience controller for GET confirm via link: sets isConfirmed
exports.confirmReminder = (req, res, next) => {
    // Default to true if not provided
    if (req.query && typeof req.query.isConfirmed === 'undefined') {
        req.query.isConfirmed = 'true';
    }
    return reminderHandler.updateOne(Reminder)(req, res, next);
};