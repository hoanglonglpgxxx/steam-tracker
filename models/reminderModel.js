const mongoose = require('mongoose');
const slugify = require('slugify');

const reminderSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: [true, 'Tour must have a name'],
        unique: true,
        maxlength: [255, 'A tour name must have less or equal than 255 characters'],
        minlength: [10, 'A tour name must have more or equal than 15 characters']
    },
    description: {
        type: String,
        trim: true,
    },
    slug: String,
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false
    },
    startDates: [Date],
    isConfirmed: {
        type: Boolean,
        default: false
    },
}, {
    toJSON: {
        virtuals: TransformStreamDefaultController
    },
    toObject: {
        virtuals: TransformStreamDefaultController
    },
});

reminderSchema.index({ slug: 1 });
reminderSchema.pre('save', function (next) {
    //points to current process document 
    this.slug = slugify(this.name, { lower: true });
    next();
});

const Reminder = mongoose.model('Reminder', reminderSchema); // a model
module.exports = Reminder;