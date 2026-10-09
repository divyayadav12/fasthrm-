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
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS || 'yzjxbbseybwhjiuo';
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || `"FAST HRM - Work Reports" <${user}>`;
  const cleanPass = pass.replace(/\s+/g, '');

  const sendToRecipient = async (recipient: string): Promise<boolean> => {
    // Strategy 1: Google Apps Script Web App (Fastest & 100% reliable on cloud without SMTP port blocks)
    const scriptUrl =
      process.env.GMAIL_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbySSRoh5lgjv5ieQFFJ-_3IH4RJ0NNAcmUyotN2iB5xfnGqjxd_EEVH5eLcgITmWJvdNg/exec';

    if (scriptUrl) {
      try {
        const payload: any = {
          to: recipient,
          subject: options.subject,
          html: options.html || options.text,
          text: options.text,
        };
        if (options.attachments && options.attachments.length > 0) {
          payload.attachments = options.attachments.map((a) => ({
            filename: a.filename,
            content: typeof a.content === 'string' ? a.content : (a.content as Buffer).toString('base64'),
            contentType: a.contentType || 'application/pdf',
          }));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const resText = await response.text();
        console.log(`[Email Service - WebApp POST] Status: ${response.status}, Response: ${resText.substring(0, 100)}`);
        if (response.ok || response.status === 200 || response.status === 302 || resText.includes('success') || resText.includes('ok')) {
          console.log(`[Email Service - WebApp] Successfully dispatched to ${recipient}`);
          return true;
        }
      } catch (scriptError: any) {
        console.warn(`[Email Service - WebApp failed for ${recipient}]:`, scriptError?.message);
      }
    }

    // Strategy 2: Direct Port 465 SSL with Gmail SMTP fallback
    try {
      const transporter465 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: user.trim(), pass: cleanPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });

      const info = await transporter465.sendMail({
        from,
        to: recipient,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
        attachments: options.attachments,
      });
      console.log(`[Email Service - Port 465 SSL] Successfully sent to ${recipient}: ${info.messageId || 'OK'}`);
      return true;
    } catch (err1: any) {
      console.warn(`[Email Service - Port 465 SSL failed for ${recipient}]:`, err1?.message);
    }

    // Strategy 3: Port 587 STARTTLS
    try {
      const transporter587 = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: user.trim(), pass: cleanPass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      const info = await transporter587.sendMail({
        from,
        to: recipient,
        subject: options.subject,
        text: options.text,
        html: options.html || options.text,
        attachments: options.attachments,
      });
      console.log(`[Email Service - SMTP 587] Successfully sent to ${recipient}: ${info.messageId || 'OK'}`);
      return true;
    } catch (err3: any) {
      console.warn(`[Email Service - SMTP 587 failed for ${recipient}]:`, err3?.message);
    }

    return false;
  };

  const results = await Promise.all(recipientsList.map((r) => sendToRecipient(r)));
  return results.some((r) => r === true);
};
