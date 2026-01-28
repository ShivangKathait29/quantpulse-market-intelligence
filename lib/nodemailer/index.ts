import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"QuantPulse" <test@localhost>`,
        to: email,
        subject: `Welcome to QuantPulse - your stock market toolkit is ready!`,
        text: 'Thanks for joining QuantPulse',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
): Promise<void> => {
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent);

    const mailOptions = {
        from: `"QuantPulse News" <test@localhost>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from QuantPulse`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> => {
    const mailOptions = {
        from: `"QuantPulse Alerts" <test@localhost>`,
        to,
        subject,
        html,
    };

    await transporter.sendMail(mailOptions);
};