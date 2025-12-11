require('dotenv').config();
const { trusted } = require('mongoose');
const nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: trusted,
    auth: {
        user: process.env.SENDER_EMAIL,
        pass: process.env.SENDER_PASSWORD,
    }
});

let mailOptions = {
    from: '"Task Handler" <long.ezmar.010@gmail.com>',
    to: 'hoanglonglpgxxx@gmail.com',
    subject: 'Test Email from Node.js',
    text: 'This is a plain text email.',
    html: '<b>This is an HTML email.</b>'
};

module.exports = { transporter, mailOptions };