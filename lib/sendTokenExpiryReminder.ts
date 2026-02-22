import nodemailer from 'nodemailer';

export async function sendTokenExpiryReminder(email: string, daysToExpiry: number) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.NOTIFY_EMAIL_USER,
      pass: process.env.NOTIFY_EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.NOTIFY_EMAIL_USER,
    to: email,
    subject: 'Facebook Page Access Token Expiry Reminder',
    html: `<p>Your Facebook Page access token expires in <b>${daysToExpiry} day${daysToExpiry !== 1 ? 's' : ''}</b> (April 23, 2026).<br>Please refresh it soon to avoid dashboard/API disruptions.</p>`,
  };

  await transporter.sendMail(mailOptions);
}
