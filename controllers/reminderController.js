const Reminder = require('../models/reminderModel');
const reminderHandler = require('../handlers/reminderHandler');

exports.getReminder = reminderHandler.getOne(Reminder);
exports.updateReminder = reminderHandler.updateOne(Reminder);

exports.updateTime = async (req, res) => {
    try {
        const updatedReminder = await Reminder.findByIdAndUpdate(
            req.params.id,
            { startDate: req.body.startDate }
        );

        res.status(200).json({ status: 'success', data: updatedReminder });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Convenience controller for GET confirm via link: sets isConfirmed
exports.confirmReminder = (req, res, next) => {
    // Default to true if not provided
    if (req.query && typeof req.query.isConfirmed === 'undefined') {
        req.query.isConfirmed = 'true';
    }
    return reminderHandler.updateOne(Reminder)(req, res, next);
};
