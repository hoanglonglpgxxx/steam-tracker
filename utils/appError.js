const MyLogger = require('../loggers/mylogger.log');

/**
 * @class AppError
 * @description Create a new class AppError that extends the Error class, replace Error class for all folders
 * @param {string} message - The error message.
 * @param {number} statusCode - The error status code.
 * @returns {object} - An instance of the AppError class.
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        //Log the error with winston
        MyLogger.logger.error(`${this.statusCode} - ${this.message}`);
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;