const mongoose = require('mongoose');
const slugify = require('slugify');

const reminderSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: [true, 'Tour must have a name'],
        unique: true,
    },
    description: {
        type: String,
        trim: true,
    },
    slug: String,
    createdAt: {
        type: Date,
        default: Date.now,
        select: false
    },
    startDate: Number,
    isSent: {
        type: Boolean,
        default: false
    },
}, {
    toJSON: {
        virtuals: true
    },
    toObject: {
        virtuals: true
    },
});

reminderSchema.index({ slug: 1 });

reminderSchema.pre('save', function (next) {
    if (this.name) {
        this.slug = slugify(this.name, { lower: true });
    }
});

const Reminder = mongoose.model('Reminder', reminderSchema);
module.exports = Reminder;