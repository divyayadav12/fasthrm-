import nodemailer from 'nodemailer';

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  try {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"Fast HRM" <${user || 'no-reply@fasthrm.com'}>`;

    if (!user || !pass) {
      console.warn(`[Email Service] SMTP credentials not configured (SMTP_USER/SMTP_PASS missing). Email to ${options.to} was not sent.`);
      return false;
    }

    const transporter = nodemailer.createTransport(
      host === 'smtp.gmail.com' || user.endsWith('@gmail.com')
        ? {
            service: 'gmail',
            auth: { user, pass },
          }
        : {
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
          }
    );

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    });

    console.log(`[Email Service] Successfully sent OTP email to ${options.to}`);
    return true;
  } catch (error) {
    console.error('[Email Service] Error sending email:', error);
    return false;
  }
};
