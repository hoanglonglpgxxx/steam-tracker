const Reminder = require('../models/reminderModel');

async function getInTimeReminders() {
    const VN_OFFSET = 7 * 60 * 60 * 1000;

    const now = new Date();

    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);

    const vnTime = new Date(utcNow + VN_OFFSET);

    vnTime.setHours(0, 0, 0, 0);

    const startMs = vnTime.getTime() - VN_OFFSET;
    const endMs = startMs + (24 * 60 * 60 * 1000);

    console.log(`Querying VN Day: ${vnTime.toLocaleDateString()}`);
    console.log(`Range (Timestamp): ${startMs} - ${endMs}`);

    const reminders = await Reminder.find({
        startDate: {
            $gte: startMs,
            $lt: endMs
        },
        isConfirmed: false
    });

    return reminders;
};

async function getSendableReminder() {
    const reminders = await Reminder.find({
        isConfirmed: false
    });

    return reminders;
};

async function getReminderById(id) {
    const reminder = await Reminder.findById(id);

    return reminder;
}

module.exports = {
    getInTimeReminders,
    getSendableReminder,
    getReminderById
};