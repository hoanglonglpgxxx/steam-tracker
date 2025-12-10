const Reminder = require('../models/reminderModel');
const mongoose = require('mongoose');

const startOfDay = new Date();
startOfDay.setHours(0, 0, 0, 0);
console.log(startOfDay);
const startOfTomorrow = new Date(startOfDay);
startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

const startMs = startOfDay.getTime();
const endMs = startOfTomorrow.getTime();

module.exports = async function getData() {
    const reminders = await Reminder.find({
        startDate: {
            $gte: startMs,
            $lt: endMs
        }
    });
    return reminders;
};
