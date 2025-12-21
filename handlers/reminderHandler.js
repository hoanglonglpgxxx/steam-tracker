const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getOne = (Model, popOpts) => catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);

    if (popOpts) query = query.populate(popOpts);

    const doc = await query;

    if (!doc) {
        return next(new AppError(`No document founded with ID ${req.params.id}`, 404));
    }
    //có thể thay bằng query này : Tour.findOne({_id: req.params.id})
    res.status(200).json({
        status: 'success',
        data: {
            data: doc
        }
    });
});


exports.updateOne = Model => catchAsync(async (req, res, next) => {
    // Allow updates via JSON body; optionally merge whitelisted query params
    const allowedFields = ['isConfirmed', 'isSent', 'name', 'description', 'startDate'];
    const data = { ...req.body };
    for (const key of allowedFields) {
        if (req.query && Object.prototype.hasOwnProperty.call(req.query, key)) {
            // Convert boolean-like strings to actual booleans
            const val = req.query[key];
            if (val === 'true') data[key] = true;
            else if (val === 'false') data[key] = false;
            else data[key] = val;
        }
    }

    const doc = await Model.findByIdAndUpdate(req.params.id, data, {
        new: true,
        runValidators: true
    });

    if (!doc) {
        return next(new AppError(`No document founded with ID ${req.params.id}`, 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            data: doc
        }
    });
});
