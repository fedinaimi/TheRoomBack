const nodemailer = require("nodemailer");
require("dotenv").config(); // Ensure environment variables are loaded

module.exports = async (email, subject, htmlContent) => {
    try {
        const transporter = nodemailer.createTransport({
            host: "ssl0.ovh.net", // OVH SMTP server (correct host)
            port: 587, // SSL port
            secure: false, // Use SSL (true for port 465, false for 587)
            auth: {
                user: process.env.EMAIL_USER, // OVH email
                pass: process.env.EMAIL_PASS, // OVH password or app password
            },
            tls: {
                rejectUnauthorized: false, // Bypass SSL certificate validation issues
            },
        });

        const info = await transporter.sendMail({
            from: `"Theroom" <${process.env.EMAIL_USER}>`, // Must match authenticated email
            to: email,
            subject: subject,
            html: htmlContent,
        });

        console.log("✅ Email sent successfully:", info.messageId);
    } catch (error) {
        console.error("❌ Email not sent:", error.message);
    }
};