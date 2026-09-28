import PDFDocument from 'pdfkit';
import User from '../models/User';
import WorkLog from '../models/WorkLog';
import Task from '../models/Task';

export interface EmployeeDailyData {
  employee: {
    _id: string;
    name: string;
    email: string;
    department?: string;
    designation?: string;
    status?: string;
  };
  totalMinutes: number;
  tasksCount: number;
  completedTasksCount: number;
  logs: Array<{
    timing: string;
    taskTitle: string;
    description: string;
    durationMinutes: number;
    durationStr: string;
    status: string;
  }>;
}

export interface DailyReportSummary {
  dateStr: string;
  formattedDate: string;
  totalEmployees: number;
  activeEmployeesCount: number;
  totalTeamMinutes: number;
  totalTeamDurationStr: string;
  totalCompletedTasks: number;
  employeeData: EmployeeDailyData[];
}

export const formatMinutesToDuration = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
};

/**
 * Collect all daily work data for all employees on a given date (default today)
 */
export const collectDailyWorkData = async (targetDate?: Date): Promise<DailyReportSummary> => {
  const date = targetDate ? new Date(targetDate) : new Date();
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const formattedDate = date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dateStr = date.toISOString().split('T')[0];

  // Fetch all registered staff / users across all roles (so NO employee is missed)
  const staffList = await User.find({}).sort({ name: 1 });

  const employeeData: EmployeeDailyData[] = [];
  let totalTeamMinutes = 0;
  let totalCompletedTasks = 0;
  let activeEmployeesCount = 0;

  for (const emp of staffList) {
    const logs = await WorkLog.find({
      employeeId: emp._id,
      $or: [
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
        { startTime: { $gte: startOfDay, $lte: endOfDay } },
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('taskId', 'title description status')
      .sort({ createdAt: 1 });

    let empTotalMinutes = 0;
    const taskTitles = new Set<string>();
    let empCompletedTasks = 0;
    const formattedLogs: EmployeeDailyData['logs'] = [];

    for (const log of (logs as any[])) {
      const taskTitle = log.taskId?.title || log.customTaskTitle || 'General Work';
      taskTitles.add(taskTitle);

      let dur = log.duration || log.durationMinutes || 0;
      if (log.status === 'WORKING' && !dur) {
        // If live working
        const st = new Date(log.startTime || log.createdAt);
        dur = Math.max(1, Math.floor((Math.min(Date.now(), endOfDay.getTime()) - st.getTime()) / 60000));
      }

      if (dur > 0) {
        empTotalMinutes += dur;
      }

      if (log.status === 'COMPLETED') {
        empCompletedTasks++;
        totalCompletedTasks++;
      }

      const logTime = new Date(log.startTime || log.createdAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      let timingRange = logTime;
      if (log.endTime) {
        const endTimeStr = new Date(log.endTime).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        timingRange = `${logTime} - ${endTimeStr}`;
      }

      let displayStatus: string = log.status;
      if (taskTitle.trim().toLowerCase() === 'lunch break') {
        if (log.status === 'WORKING') displayStatus = 'LUNCH START';
        if (log.status === 'COMPLETED') displayStatus = 'LUNCH END';
      }

      formattedLogs.push({
        timing: timingRange,
        taskTitle,
        description: log.description || '-',
        durationMinutes: dur,
        durationStr: dur > 0 ? formatMinutesToDuration(dur) : (log.status === 'WORKING' ? 'Active' : '-'),
        status: displayStatus,
      });
    }

    if (empTotalMinutes > 0 || formattedLogs.length > 0) {
      activeEmployeesCount++;
    }
    totalTeamMinutes += empTotalMinutes;

    const empObj = emp as any;
    employeeData.push({
      employee: {
        _id: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        department: empObj.department || 'Staff',
        designation: empObj.designation || emp.role,
        status: empObj.status || 'OFFLINE',
      },
      totalMinutes: empTotalMinutes,
      tasksCount: taskTitles.size,
      completedTasksCount: empCompletedTasks,
      logs: formattedLogs,
    });
  }

  return {
    dateStr,
    formattedDate,
    totalEmployees: staffList.length,
    activeEmployeesCount,
    totalTeamMinutes,
    totalTeamDurationStr: formatMinutesToDuration(totalTeamMinutes),
    totalCompletedTasks,
    employeeData,
  };
};

/**
 * Generate a clean, high quality PDF buffer for the Daily Work Report
 */
export const generateDailyReportPdfBuffer = async (summary: DailyReportSummary): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        bufferPages: true,
        margin: 36,
        size: 'A4',
        info: {
          Title: `FAST HRM Daily Work Report - ${summary.formattedDate}`,
          Author: 'FAST HRM WorkPulse',
          Subject: 'Daily Employee Work Logs & Time Tracking Report',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      const primaryColor = '#1E3A8A'; // Deep Blue
      const secondaryColor = '#4F46E5'; // Indigo
      const textColor = '#1F2937';
      const grayColor = '#6B7280';
      const lightBg = '#F3F4F6';
      const borderGray = '#E5E7EB';

      // --- HEADER ---
      doc.rect(36, 36, 523, 62).fill('#1E293B');

      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('F.A.S.T. - FIRST ATTEMPT SUCCESS TUTORIALS', 50, 48);
      doc.fontSize(10).font('Helvetica').fillColor('#94A3B8').text('WorkPulse HRM • Daily Staff Work & Productivity Report', 50, 70);

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#38BDF8').text(summary.formattedDate, 380, 56, { align: 'right', width: 165 });
      doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(`Generated at 10:00 PM IST`, 380, 72, { align: 'right', width: 165 });

      doc.moveDown(2);

      // --- SUMMARY CARDS ---
      let startY = 110;
      doc.rect(36, startY, 523, 48).fill('#F8FAFC');
      doc.rect(36, startY, 523, 48).stroke(borderGray);

      const colW = 523 / 4;
      
      // Card 1: Total Staff
      doc.fillColor(grayColor).fontSize(8).font('Helvetica-Bold').text('REGISTERED STAFF', 36 + 10, startY + 10);
      doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold').text(`${summary.totalEmployees}`, 36 + 10, startY + 24);

      // Card 2: Active Today
      doc.fillColor(grayColor).fontSize(8).font('Helvetica-Bold').text('ACTIVE TODAY', 36 + colW + 10, startY + 10);
      doc.fillColor('#059669').fontSize(14).font('Helvetica-Bold').text(`${summary.activeEmployeesCount}`, 36 + colW + 10, startY + 24);

      // Card 3: Total Hours Logged
      doc.fillColor(grayColor).fontSize(8).font('Helvetica-Bold').text('TOTAL HOURS LOGGED', 36 + colW * 2 + 10, startY + 10);
      doc.fillColor(secondaryColor).fontSize(14).font('Helvetica-Bold').text(summary.totalTeamDurationStr, 36 + colW * 2 + 10, startY + 24);

      // Card 4: Completed Tasks
      doc.fillColor(grayColor).fontSize(8).font('Helvetica-Bold').text('COMPLETED TASKS', 36 + colW * 3 + 10, startY + 10);
      doc.fillColor('#D97706').fontSize(14).font('Helvetica-Bold').text(`${summary.totalCompletedTasks}`, 36 + colW * 3 + 10, startY + 24);

      startY += 62;

      // --- EMPLOYEE SECTIONS ---
      for (let i = 0; i < summary.employeeData.length; i++) {
        const emp = summary.employeeData[i];

        // Check page overflow
        if (startY > 680) {
          doc.addPage();
          startY = 40;
        }

        // Employee Header Bar
        doc.rect(36, startY, 523, 26).fill('#EEF2FF');
        doc.rect(36, startY, 523, 26).stroke('#C7D2FE');

        const empName = emp.employee.name.toUpperCase();
        const role = emp.employee.designation || emp.employee.department || 'Team Member';
        const totalDur = formatMinutesToDuration(emp.totalMinutes);

        doc.fillColor('#312E81').fontSize(10).font('Helvetica-Bold').text(`👤  ${empName} (${role})`, 44, startY + 8);
        doc.fillColor('#4338CA').fontSize(9).font('Helvetica-Bold').text(`Total Worked Today: ${totalDur}`, 380, startY + 8, { align: 'right', width: 170 });

        startY += 30;

        if (emp.logs.length === 0) {
          doc.rect(36, startY, 523, 20).fill('#FFFFFF');
          doc.rect(36, startY, 523, 20).stroke(borderGray);
          doc.fillColor(grayColor).fontSize(8).font('Helvetica-Oblique').text('No activity recorded for this employee today.', 44, startY + 6);
          startY += 26;
        } else {
          // Table Header
          doc.rect(36, startY, 523, 18).fill('#F1F5F9');
          doc.rect(36, startY, 523, 18).stroke(borderGray);

          doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
          doc.text('TIMING', 42, startY + 5, { width: 85 });
          doc.text('TASK NAME', 130, startY + 5, { width: 140 });
          doc.text('DESCRIPTION / WORK DONE', 275, startY + 5, { width: 145 });
          doc.text('DURATION', 425, startY + 5, { width: 60 });
          doc.text('STATUS', 490, startY + 5, { width: 60, align: 'right' });

          startY += 18;

          // Table Rows
          for (const log of emp.logs) {
            if (startY > 740) {
              doc.addPage();
              startY = 40;
            }

            const rowHeight = Math.max(18, Math.min(38, Math.ceil((log.description?.length || 0) / 38) * 10 + 10));

            doc.rect(36, startY, 523, rowHeight).fill(startY % 2 === 0 ? '#FFFFFF' : '#FAFAFA');
            doc.rect(36, startY, 523, rowHeight).stroke(borderGray);

            doc.fillColor(textColor).fontSize(7.5).font('Helvetica');
            doc.text(log.timing, 42, startY + 5, { width: 85 });

            doc.font('Helvetica-Bold').fillColor('#0F172A').text(log.taskTitle, 130, startY + 5, { width: 140, lineBreak: true });
            
            doc.font('Helvetica').fillColor('#475569').text(log.description, 275, startY + 5, { width: 145, lineBreak: true });

            doc.font('Helvetica-Bold').fillColor('#1E293B').text(log.durationStr, 425, startY + 5, { width: 60 });

            let statusColor = '#059669';
            if (log.status === 'WORKING') statusColor = '#2563EB';
            else if (log.status === 'ON_HOLD') statusColor = '#D97706';
            else if (log.status === 'PENDING') statusColor = '#EA580C';

            doc.fillColor(statusColor).font('Helvetica-Bold').text(log.status, 490, startY + 5, { width: 60, align: 'right' });

            startY += rowHeight;
          }
          startY += 10;
        }
      }

      // Final Footer
      const range = doc.bufferedPageRange();
      const totalPages = (range && range.count) ? range.count : 1;
      for (let p = 0; p < totalPages; p++) {
        try {
          doc.switchToPage(p);
          doc.fillColor(grayColor).fontSize(7.5).font('Helvetica').text(
            `FAST HRM WorkPulse • Automated End-of-Day Report • Page ${p + 1} of ${totalPages}`,
            36,
            795,
            { align: 'center', width: 523 }
          );
        } catch (pageErr) {}
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate professional HTML body email
 */
export const generateDailyReportHtml = (summary: DailyReportSummary): string => {
  const employeeRowsHtml = summary.employeeData
    .map((emp) => {
      const totalDur = formatMinutesToDuration(emp.totalMinutes);
      const logRows = emp.logs.length === 0
        ? `<tr><td colspan="5" style="padding: 10px; text-align: center; color: #9ca3af; font-style: italic;">No activity logged today</td></tr>`
        : emp.logs
            .map((l) => `
              <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 8px 10px; font-size: 12px; color: #4b5563; white-space: nowrap;">${l.timing}</td>
                <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: #1f2937;">${l.taskTitle}</td>
                <td style="padding: 8px 10px; font-size: 12px; color: #4b5563;">${l.description}</td>
                <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: #111827;">${l.durationStr}</td>
                <td style="padding: 8px 10px; font-size: 11px; font-weight: 700;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background-color: ${
                    l.status === 'COMPLETED' ? '#d1fae5; color: #065f46;' :
                    l.status === 'WORKING' ? '#dbeafe; color: #1e40af;' :
                    l.status === 'ON_HOLD' ? '#fef3c7; color: #92400e;' :
                    '#ffedd5; color: #9a3412;'
                  }">${l.status}</span>
                </td>
              </tr>
            `)
            .join('');

      return `
        <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #eef2ff; border-bottom: 1px solid #c7d2fe; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div style="font-weight: 700; color: #312e81; font-size: 14px;">
              👤 ${emp.employee.name} <span style="font-weight: 400; color: #6366f1; font-size: 12px;">(${emp.employee.designation || emp.employee.department || 'Staff'})</span>
            </div>
            <div style="font-weight: 700; color: #4338ca; font-size: 13px;">
              Total Worked: <span style="background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #c7d2fe;">${totalDur}</span>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Timing</th>
                <th style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Task Name</th>
                <th style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Description</th>
                <th style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Time Spent</th>
                <th style="padding: 8px 10px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${logRows}
            </tbody>
          </table>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; color: #1f2937; }
        .container { max-width: 720px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
        .header { background-color: #1e293b; color: #ffffff; padding: 24px; text-align: left; }
        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 16px 20px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; }
        .card { background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center; }
        .content { padding: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">F.A.S.T. - FIRST ATTEMPT SUCCESS TUTORIALS</h1>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Daily Staff Work & Productivity Report • <strong>${summary.formattedDate}</strong></p>
        </div>

        <!-- Metric Summary -->
        <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <tr>
            <td style="padding: 14px 10px; border-right: 1px solid #e2e8f0; width: 25%;">
              <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Staff</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${summary.totalEmployees}</div>
            </td>
            <td style="padding: 14px 10px; border-right: 1px solid #e2e8f0; width: 25%;">
              <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Active Today</div>
              <div style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 2px;">${summary.activeEmployeesCount}</div>
            </td>
            <td style="padding: 14px 10px; border-right: 1px solid #e2e8f0; width: 25%;">
              <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Hours Logged</div>
              <div style="font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 2px;">${summary.totalTeamDurationStr}</div>
            </td>
            <td style="padding: 14px 10px; width: 25%;">
              <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase;">Completed Tasks</div>
              <div style="font-size: 18px; font-weight: 800; color: #d97706; margin-top: 2px;">${summary.totalCompletedTasks}</div>
            </td>
          </tr>
        </table>

        <!-- Body -->
        <div class="content">
          <p style="font-size: 13px; color: #475569; margin-bottom: 16px;">
            Respected Sir, here is the consolidated daily work summary of all employees for <strong>${summary.formattedDate}</strong>. The complete formatted PDF report is also attached with this email for your reference.
          </p>

          ${employeeRowsHtml}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e5e7eb; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8;">
          This is an automated report generated by FAST HRM WorkPulse at 10:00 PM IST.<br/>
          Attached File: <strong>Daily_Staff_Work_Report_${summary.dateStr}.pdf</strong>
        </div>
      </div>
    </body>
    </html>
  `;
};
