const cron = require('node-cron');
const { getInTimeReminders, getNotSentReminders, getReminderById } = require('./getData');
const { transporter, mailOptions } = require('./sendMail');


function sendMail(text) {
    mailOptions.subject = 'Reminderrrrrr !!!!!';
    mailOptions.text = text;
    mailOptions.html = 'Reminderrrrrr !!!!!';
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            debugLog('Error sending email:', error);
        } else {
            debugLog('Email sent:', info.response);
        }
    });
}

const scheduledJobs = {};

// 1. Hàm core: Lên lịch cho 1 task cụ thể
const scheduleOneTask = (reminder) => {
    const now = new Date();
    const startTime = new Date(reminder.startDate);

    // Case A: Nếu thời gian đã trôi qua rồi mà chưa gửi -> Gửi bù ngay lập tức!
    if (startTime <= now) {
        console.log(`[MISSED] Task ${reminder.name} was missed. Sending now...`);
        executeTask(reminder);
        return;
    }
    // Case B: Thời gian ở tương lai -> Lên lịch
    console.log(`reminder, [SCHEDULE] Task ${reminder.name} scheduled at ${startTime}`);

    // node-cron hỗ trợ truyền Date object trực tiếp để chạy 1 lần
    const task = cron.schedule(startTime, () => {
        executeTask(reminder);
    });

    // Lưu vào map để quản lý (nếu cần cancel sau này)
    scheduledJobs[reminder._id] = task;
};

// 2. Hàm thực thi gửi mail và update DB
const executeTask = async (reminder) => {
    try {
        // Double check DB xem đã gửi chưa (tránh race condition)
        const currentDoc = await getReminderById(reminder._id);
        if (!currentDoc || currentDoc.isSent) return;

        // Gửi mail
        await sendMail(`Reminder: ${reminder.name}`);
        console.log(`[SENT] Email sent for ${reminder.name}`);

        // Update DB
        currentDoc.isSent = true;
        await currentDoc.save();

        // Xóa khỏi RAM manager
        if (scheduledJobs[reminder._id]) {
            scheduledJobs[reminder._id].stop(); // Stop cron
            delete scheduledJobs[reminder._id];
        }

    } catch (error) {
        console.error('Error executing task:', error);
    }
};

const initScheduledJobs = async () => {
    console.log('--- System Restarting: Reloading tasks from DB ---');

    // Lấy tất cả các task chưa gửi (isSent: false)
    // Không cần filter ngày, cứ chưa gửi là lấy lên để check
    const pendingReminders = await getNotSentReminders();
    console.log(pendingReminders);
    pendingReminders.forEach(reminder => {
        scheduleOneTask(reminder);
    });

    console.log(`--- Reloaded ${pendingReminders.length} tasks into RAM ---`);
};

module.exports = {
    scheduleOneTask,
    initScheduledJobs
};
