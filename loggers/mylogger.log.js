const winston = require('winston');
// const {format, createLogger, transports} = winston;
require('winston-daily-rotate-file');

const { combine, timestamp } = winston.format;

class MyLogger {
    constructor() {
        const formatPrint = winston.format.printf(
            ({ level, message, context, requestId, metadata }) => `${timestamp} - [${level}] - ${context} - ${requestId} - ${message} - ${metadata ? JSON.stringify(metadata) : ''}`
        );

        this.logger = winston.createLogger({
            format: combine(
                winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss.SSS A'
                }),
                formatPrint
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.DailyRotateFile({
                    level: 'info',
                    dirname: 'src/logs',
                    filename: 'application-%DATE%.info.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true, //k đặt thì tệp log bị xóa luôn, đặt true thì zip để backup trước khi xóa
                    maxSize: '2m',
                    maxFiles: '1d', //xóa file log cũ sau 1 ngày
                    format: winston.format.combine(
                        timestamp({
                            format: 'YYYY-MM-DD HH:mm:ss.SSS A'
                        }),
                        formatPrint
                    ),
                }),
                new winston.transports.DailyRotateFile({
                    level: 'error',
                    dirname: 'src/logs',
                    filename: 'application-%DATE%.error.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '2m',
                    maxFiles: '1d',
                    format: winston.format.combine(
                        timestamp({
                            format: 'YYYY-MM-DD HH:mm:ss.SSS A'
                        }),
                        formatPrint
                    ),
                })
            ]
        });
    }

    log(message, params) {
        const logObject = {
            message,
            params
        };
        this.logger.info(logObject);
    }

    error(message, params) {
        const logObject = {
            message,
            params
        };
        this.logger.info(logObject);
    }
}
module.exports = new MyLogger();