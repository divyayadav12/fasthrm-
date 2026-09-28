import nodemailer from 'nodemailer';

export const sendEmail = async (options: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}): Promise<boolean> => {
  const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
  const hasAttachments = options.attachments && options.attachments.length > 0;

  // 1. If NO attachments, try Google Apps Script Web App first
  if (!hasAttachments) {
    const scriptUrl =
      process.env.GMAIL_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbySSRoh5lgjv5ieQFFJ-_3IH4RJ0NNAcmUyotN2iB5xfnGqjxd_EEVH5eLcgITmWJvdNg/exec';

    if (scriptUrl) {
      try {
        const getUrl = `${scriptUrl}?to=${encodeURIComponent(recipients)}&subject=${encodeURIComponent(options.subject)}&html=${encodeURIComponent(options.html || options.text)}`;
        const response = await fetch(getUrl, {
          method: 'GET',
          redirect: 'follow',
        });
        console.log(`[Email Service - WebApp] Dispatched email to ${recipients}, Status: ${response.status}`);
        if (response.ok || response.status === 200 || response.status === 302) {
          return true;
        }
      } catch (scriptError: any) {
        console.warn('[Email Service - WebApp Error]:', scriptError?.message);
      }
    }
  }

  // 2. Nodemailer SMTP (Handles attachments, direct delivery)
  try {
    const user = process.env.SMTP_USER || process.env.EMAIL_USER || 'divyayadav141203@gmail.com';
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || 'nhvdndiomfuwotyl';
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = Number(process.env.SMTP_PORT) || 465;
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"FAST HRM - Work Reports" <${user}>`;

    if (!user || !pass) {
      console.warn(`[Email Service] SMTP credentials missing. Email to ${recipients} was not sent.`);
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
      to: recipients,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
      attachments: options.attachments,
    });

    console.log(`[Email Service - SMTP] Successfully sent email to ${recipients}`);
    return true;
  } catch (error: any) {
    console.error('[Email Service - SMTP Error]:', error?.message || error);
    return false;
  }
};
