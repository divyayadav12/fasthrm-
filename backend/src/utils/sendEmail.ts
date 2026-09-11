import nodemailer from 'nodemailer';

export const sendEmail = async (options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> => {
  try {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      console.log(`[Email Service] SMTP not configured. Simulating email to ${options.to}:`);
      console.log(`[Email Service] Subject: ${options.subject}`);
      console.log(`[Email Service] Body: ${options.text}`);
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM || `"Fast HRM" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    });

    return true;
  } catch (error) {
    console.error('[Email Service] Error sending email:', error);
    return false;
  }
};
