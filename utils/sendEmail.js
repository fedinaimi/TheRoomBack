const nodemailer = require("nodemailer");

module.exports = async (email, subject, htmlContent) => {
    try {
        const transporter = nodemailer.createTransport({
            type: "SMTP",
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            }
        });
        await transporter.sendMail({
            from: 'Theroom <noreply@Theroom>',
            to: email,
            subject: subject,
            html: htmlContent, 
        });
    } catch (error) {
        console.log("Email not sent");
        console.log(error);
    }
};
