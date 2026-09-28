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
  const recipientsList = Array.isArray(options.to)
    ? options.to
    : options.to.split(',').map((e) => e.trim()).filter(Boolean);

  const user = process.env.SMTP_USER || process.env.EMAIL_USER || 'divyayadav141203@gmail.com';
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || 'nhvdndiomfuwotyl';
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"FAST HRM - Work Reports" <${user}>`;
  const cleanPass = pass.replace(/\s+/g, '');

  let overallSuccess = true;

  for (const recipient of recipientsList) {
    let sent = false;

    // Strategy A: Port 465 (Gmail SSL)
    try {
      const transporter465 = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: user.trim(), pass: cleanPass },
        tls: { rejectUnauthorized: false },
      });
      await transporter465.sendMail({
        from,
        to: recipient,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
        attachments: options.attachments,
      });
      console.log(`[Email Service - SMTP 465] Successfully sent to ${recipient}`);
      sent = true;
    } catch (err465: any) {
      console.warn(`[Email Service - SMTP 465 failed for ${recipient}]:`, err465?.message);
    }

    // Strategy B: Port 587 (Gmail STARTTLS) if 465 failed
    if (!sent) {
      try {
        const transporter587 = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: { user: user.trim(), pass: cleanPass },
          tls: { rejectUnauthorized: false },
        });
        await transporter587.sendMail({
          from,
          to: recipient,
          subject: options.subject,
          text: options.text,
          html: options.html || options.text,
          attachments: options.attachments,
        });
        console.log(`[Email Service - SMTP 587] Successfully sent to ${recipient}`);
        sent = true;
      } catch (err587: any) {
        console.warn(`[Email Service - SMTP 587 failed for ${recipient}]:`, err587?.message);
      }
    }

    // Strategy C: Google Apps Script Web App fallback
    if (!sent) {
      const scriptUrl =
        process.env.GMAIL_SCRIPT_URL ||
        'https://script.google.com/macros/s/AKfycbySSRoh5lgjv5ieQFFJ-_3IH4RJ0NNAcmUyotN2iB5xfnGqjxd_EEVH5eLcgITmWJvdNg/exec';

      if (scriptUrl) {
        try {
          const getUrl = `${scriptUrl}?to=${encodeURIComponent(recipient)}&subject=${encodeURIComponent(options.subject)}&html=${encodeURIComponent(options.html || options.text)}`;
          const response = await fetch(getUrl, { method: 'GET', redirect: 'follow' });
          if (response.ok || response.status === 200 || response.status === 302) {
            console.log(`[Email Service - WebApp] Successfully sent to ${recipient}`);
            sent = true;
          }
        } catch (scriptError: any) {
          console.warn(`[Email Service - WebApp failed for ${recipient}]:`, scriptError?.message);
        }
      }
    }

    if (!sent) {
      overallSuccess = false;
    }
  }

  return overallSuccess;
};
