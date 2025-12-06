const { trusted } = require('mongoose');
const nodemailer = require('nodemailer');
let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: trusted,
    auth: {
        user: 'long.ezmar.010@gmail.com',
        pass: 'Rea17233H7NV5Wb'
    }
});

let mailOptions = {
    from: '"Sender Name" <long.ezmar.010@gmail.com>',
    to: 'hoanglonglpgxxx@gmail.com',
    subject: 'Test Email from Node.js',
    text: 'This is a plain text email.',
    html: '<b>This is an HTML email.</b>'
};

export default { transporter, mailOptions };