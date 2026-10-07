import cron from 'node-cron';
import { sendEmail } from '../utils/sendEmail';
import {
  collectDailyWorkData,
  generateDailyReportPdfBuffer,
  generateDailyReportHtml,
  DailyReportSummary,
} from '../services/dailyReportPdf.service';

export const getReportRecipients = (): string[] => {
  const envEmails = process.env.DAILY_REPORT_EMAILS || process.env.DAILY_REPORT_EMAIL;
  if (envEmails) {
    return envEmails
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);
  }
  return ['esarthak@gmail.com', 'divyayadav141203@gmail.com'];
};

/**
 * Dispatch Daily Report Email with PDF Attachment to all configured recipients
 */
export const dispatchDailyWorkReport = async (targetDate?: Date): Promise<{
  success: boolean;
  recipients: string[];
  summary: DailyReportSummary;
  message: string;
}> => {
  const recipients = getReportRecipients();
  console.log(`[Daily Report] Starting daily report generation for ${recipients.join(', ')}...`);

  const summary = await collectDailyWorkData(targetDate);
  const pdfBuffer = await generateDailyReportPdfBuffer(summary);
  const htmlContent = generateDailyReportHtml(summary);

  const nowIst = new Date();
  const timeStr = nowIst.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const subject = `📊 FAST HRM: Daily Staff Work Report - ${summary.formattedDate} [${timeStr}]`;
  const filename = `Daily_Staff_Work_Report_${summary.dateStr}.pdf`;

  const isSent = await sendEmail({
    to: recipients,
    subject,
    text: `Respected Sir, please find attached the Daily Staff Work Report for ${summary.formattedDate}. Total Hours Logged: ${summary.totalTeamDurationStr}.`,
    html: htmlContent,
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  if (isSent) {
    console.log(`[Daily Report] Successfully sent daily PDF work report to ${recipients.join(', ')}`);
    return {
      success: true,
      recipients,
      summary,
      message: `Daily work report with PDF successfully emailed to ${recipients.join(', ')}!`,
    };
  } else {
    console.error(`[Daily Report] Failed to dispatch daily report email to ${recipients.join(', ')}`);
    return {
      success: false,
      recipients,
      summary,
      message: `Failed to send email. Please check SMTP credentials.`,
    };
  }
};

/**
 * Starts the automated Cron Jobs:
 * 1. Morning 10:00 AM IST (10:00 IST) - Sends Yesterday's complete daily staff work report PDF
 * 2. Evening 10:00 PM IST (22:00 IST) - Sends Today's daily staff work report PDF
 */
export const startDailyReportCronJob = () => {
  // Morning 10:00 AM IST Cron Job for Yesterday's Work Report
  cron.schedule(
    '0 10 * * *',
    async () => {
      console.log(`[Daily Report Cron] Triggering 10:00 AM automated morning report for Yesterday...`);
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await dispatchDailyWorkReport(yesterday);
      } catch (err: any) {
        console.error('[Daily Report Morning Cron Error]:', err?.message || err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // Evening 10:00 PM IST Cron Job for Today's Work Report
  cron.schedule(
    '0 22 * * *',
    async () => {
      console.log(`[Daily Report Cron] Triggering 10:00 PM automated evening report for Today...`);
      try {
        await dispatchDailyWorkReport();
      } catch (err: any) {
        console.error('[Daily Report Evening Cron Error]:', err?.message || err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('✅ Daily Report Cron Jobs initialized (Scheduled for 10:00 AM IST [Yesterday Report] & 10:00 PM IST [Today Report]).');
};
