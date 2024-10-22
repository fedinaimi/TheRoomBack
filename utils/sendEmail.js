const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

module.exports = async (email, subject, firstName, emailData, password) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'mail.elepzia.tn', 
            port: 465, 
            secure: true, 
            auth: {
                user: process.env.EMAIL_USER || 'hackiniteam@elepzia.tn', 
                pass: process.env.EMAIL_PASS || 'Hackini2024',
            }
        });

        // Correctly read the HTML file
        const htmlContent = fs.readFileSync(path.join(__dirname, '../public/email_templates/account_creation.html'), 'utf-8')
            .replace('{{firstName}}', firstName)
            .replace('{{email}}', emailData)
            .replace('{{password}}', password);

        await transporter.sendMail({
            from: 'Hackini <hackiniteam@elepzia.tn>',
            to: email,
            subject: subject,
            html: htmlContent, // Use the HTML content with embedded values
            attachments: [
                {
                    filename: 'elepzia.png',
                    path: path.join(__dirname, 'elepzia.png'), // Attach the image
                    cid: 'elepziaLogo' // Set cid to match the src in the HTML
                }
            ]
        });

        console.log("Email sent successfully!");
    } catch (error) {
        console.log("Email not sent");
        console.log(error);
    }
};
