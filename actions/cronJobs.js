const cron = require('node-cron');


module.exports = function scheduleTask(task) {
    cron.schedule('* * * * *', () => {
        task();
    });
};
