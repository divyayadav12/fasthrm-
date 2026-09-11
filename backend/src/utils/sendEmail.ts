import nodemailer from 'nodemailer';

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  try {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER || 'divyayadav141203@gmail.com';
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || 'nhvdndiomfuwotyl';
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"Fast HRM" <${user}>`;

    if (!user || !pass) {
      console.warn(`[Email Service] SMTP credentials missing. Email to ${options.to} was not sent.`);
      return false;
    }

    const cleanPass = pass.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport(
      host === 'smtp.gmail.com' || user.endsWith('@gmail.com')
        ? {
            service: 'gmail',
            auth: { user: user.trim(), pass: cleanPass },
            tls: { rejectUnauthorized: false },
          }
        : {
            host,
            port,
            secure: port === 465,
            auth: { user: user.trim(), pass: cleanPass },
            tls: { rejectUnauthorized: false },
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
  } catch (error: any) {
    console.error('[Email Service] Error sending email:', error);
    throw error;
  }
};
