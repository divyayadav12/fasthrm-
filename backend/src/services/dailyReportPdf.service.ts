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
  const baseDate = targetDate ? new Date(targetDate) : new Date();
  
  // Format formatted date string in Indian Standard Time (IST)
  const formattedDate = baseDate.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  
  // Get date parts in IST (YYYY-MM-DD)
  const istFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = istFormatter.format(baseDate);

  // Exact 00:00:00 to 23:59:59.999 bounds in IST (+05:30)
  const startOfDay = new Date(`${dateStr}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999+05:30`);

  // Fetch all registered staff & all work logs for the date in parallel (1 query instead of N+1)
  const [staffList, allLogs] = await Promise.all([
    User.find({}).sort({ name: 1 }),
    WorkLog.find({
      $or: [
        { createdAt: { $gte: startOfDay, $lte: endOfDay } },
        { startTime: { $gte: startOfDay, $lte: endOfDay } },
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
      ],
    })
      .populate('taskId', 'title description status')
      .sort({ createdAt: 1 }),
  ]);

  // Group logs by employeeId in memory for ultra-fast lookup
  const logsByEmp = new Map<string, any[]>();
  for (const log of (allLogs as any[])) {
    const empIdStr = log.employeeId ? log.employeeId.toString() : '';
    if (!logsByEmp.has(empIdStr)) {
      logsByEmp.set(empIdStr, []);
    }
    logsByEmp.get(empIdStr)!.push(log);
  }

  // Sort all staff by department hierarchy (IT & Support, Career, Editor DTP, HR, Faculty, Others)
  const deptOrder: Record<string, number> = {
    'it and support': 1,
    'it & support': 1,
    'career': 2,
    'careear': 2,
    'editor dtp': 3,
    'hr': 4,
    'faculty': 5,
    'others': 6,
    'management': 7,
    'admin': 8,
  };

  staffList.sort((a, b) => {
    const deptA = ((a.department || a.designation || 'others').toLowerCase().trim());
    const deptB = ((b.department || b.designation || 'others').toLowerCase().trim());
    const orderA = deptOrder[deptA] || (deptA.includes('it') ? 1 : (deptA.includes('career') ? 2 : (deptA.includes('editor') || deptA.includes('dtp') ? 3 : 6)));
    const orderB = deptOrder[deptB] || (deptB.includes('it') ? 1 : (deptB.includes('career') ? 2 : (deptB.includes('editor') || deptB.includes('dtp') ? 3 : 6)));
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '');
  });

  const employeeData: EmployeeDailyData[] = [];
  let totalTeamMinutes = 0;
  let totalCompletedTasks = 0;
  let activeEmployeesCount = 0;

  for (const emp of staffList) {
    const logs = logsByEmp.get(emp._id.toString()) || [];

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
    const safeName = emp.name || empObj.fullName || (emp.email ? emp.email.split('@')[0] : 'Staff Member');
    employeeData.push({
      employee: {
        _id: emp._id ? emp._id.toString() : 'emp',
        name: safeName,
        email: emp.email || '',
        department: empObj.department || 'Staff',
        designation: empObj.designation || emp.role || 'Staff Member',
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
        margin: 32,
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
      const textColor = '#1E293B';
      const grayColor = '#64748B';
      const lightBg = '#F8FAFC';
      const borderGray = '#CBD5E1';
      const pageWidth = 531; // 595 - 64
      const leftMargin = 32;

      const drawHeader = (isFirstPage: boolean) => {
        if (isFirstPage) {
          // --- MAIN HEADER ---
          doc.rect(leftMargin, 32, pageWidth, 58).fill('#1E293B');

          doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold').text('F.A.S.T. - FIRST ATTEMPT SUCCESS TUTORIALS', leftMargin + 14, 44);
          doc.fontSize(9).font('Helvetica').fillColor('#94A3B8').text('WorkPulse HRM • Daily Staff Work & Productivity Report', leftMargin + 14, 64);

          doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#38BDF8').text(summary.formattedDate, leftMargin + pageWidth - 180, 46, { align: 'right', width: 166 });
          doc.fontSize(8).font('Helvetica').fillColor('#94A3B8').text(`End-of-Day Report • 10:00 PM IST`, leftMargin + pageWidth - 180, 62, { align: 'right', width: 166 });
        } else {
          // Compact header on subsequent pages
          doc.rect(leftMargin, 32, pageWidth, 24).fill('#1E293B');
          doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold').text('FAST HRM WorkPulse • Daily Work Report', leftMargin + 10, 39);
          doc.fillColor('#38BDF8').fontSize(8.5).font('Helvetica').text(summary.formattedDate, leftMargin + pageWidth - 180, 39, { align: 'right', width: 170 });
        }
      };

      // Draw initial page header
      drawHeader(true);

      // --- SUMMARY METRIC CARDS ---
      let startY = 100;
      doc.rect(leftMargin, startY, pageWidth, 46).fill('#F8FAFC');
      doc.rect(leftMargin, startY, pageWidth, 46).stroke(borderGray);

      const colW = pageWidth / 4;
      
      // Card 1: Total Staff
      doc.fillColor(grayColor).fontSize(7.5).font('Helvetica-Bold').text('TOTAL STAFF', leftMargin + 8, startY + 8);
      doc.fillColor(textColor).fontSize(13).font('Helvetica-Bold').text(`${summary.totalEmployees}`, leftMargin + 8, startY + 22);

      // Card 2: Active Today
      doc.fillColor(grayColor).fontSize(7.5).font('Helvetica-Bold').text('ACTIVE TODAY', leftMargin + colW + 8, startY + 8);
      doc.fillColor('#059669').fontSize(13).font('Helvetica-Bold').text(`${summary.activeEmployeesCount}`, leftMargin + colW + 8, startY + 22);

      // Card 3: Total Hours Logged
      doc.fillColor(grayColor).fontSize(7.5).font('Helvetica-Bold').text('HOURS LOGGED', leftMargin + colW * 2 + 8, startY + 8);
      doc.fillColor(secondaryColor).fontSize(13).font('Helvetica-Bold').text(summary.totalTeamDurationStr, leftMargin + colW * 2 + 8, startY + 22);

      // Card 4: Completed Tasks
      doc.fillColor(grayColor).fontSize(7.5).font('Helvetica-Bold').text('COMPLETED TASKS', leftMargin + colW * 3 + 8, startY + 8);
      doc.fillColor('#D97706').fontSize(13).font('Helvetica-Bold').text(`${summary.totalCompletedTasks}`, leftMargin + colW * 3 + 8, startY + 22);

      startY += 58;

      const drawTableHeader = (y: number) => {
        doc.rect(leftMargin, y, pageWidth, 18).fill('#F1F5F9');
        doc.rect(leftMargin, y, pageWidth, 18).stroke(borderGray);

        doc.fillColor('#475569').fontSize(7.5).font('Helvetica-Bold');
        doc.text('TIMING', leftMargin + 8, y + 5, { width: 80 });
        doc.text('TASK NAME', leftMargin + 92, y + 5, { width: 135 });
        doc.text('DESCRIPTION / WORK DONE', leftMargin + 232, y + 5, { width: 160 });
        doc.text('DURATION', leftMargin + 396, y + 5, { width: 55 });
        doc.text('STATUS', leftMargin + 455, y + 5, { width: 68, align: 'right' });
        return y + 18;
      };

      // --- EMPLOYEE SECTIONS GROUPED BY DEPARTMENT ---
      let lastDepartment = '';
      for (let i = 0; i < summary.employeeData.length; i++) {
        const emp = summary.employeeData[i];
        const rawDept = (emp.employee?.department || emp.employee?.designation || 'OTHERS').toUpperCase();
        let displayDept = rawDept;
        if (rawDept.includes('IT') || rawDept.includes('SUPPORT')) displayDept = 'IT & SUPPORT';
        else if (rawDept.includes('CAREER')) displayDept = 'CAREER';
        else if (rawDept.includes('EDITOR') || rawDept.includes('DTP')) displayDept = 'EDITOR DTP';
        else if (rawDept.includes('HR')) displayDept = 'HR DEPARTMENT';
        else if (rawDept.includes('FACULTY') || rawDept.includes('EDUCATION')) displayDept = 'FACULTY & EDUCATION';
        else if (rawDept.includes('ADMIN') || rawDept.includes('MANAGEMENT')) displayDept = 'ADMIN & MANAGEMENT';

        // Render Department Banner when department changes
        if (displayDept !== lastDepartment) {
          lastDepartment = displayDept;
          if (startY > 680) {
            doc.addPage();
            drawHeader(false);
            startY = 66;
          }
          doc.rect(leftMargin, startY, pageWidth, 22).fill('#0F172A');
          doc.fillColor('#38BDF8').fontSize(9.5).font('Helvetica-Bold').text(`🏢 DEPARTMENT: ${displayDept}`, leftMargin + 10, startY + 6);
          startY += 26;
        }

        // Check if employee block will fit on page (need at least 60pt)
        if (startY > 720) {
          doc.addPage();
          drawHeader(false);
          startY = 66;
        }

        // Employee Header Bar
        doc.rect(leftMargin, startY, pageWidth, 22).fill('#EEF2FF');
        doc.rect(leftMargin, startY, pageWidth, 22).stroke('#C7D2FE');

        const empName = (emp.employee?.name || 'Staff Member').toUpperCase();
        const role = emp.employee?.designation || emp.employee?.department || 'Staff';
        const totalDur = formatMinutesToDuration(emp.totalMinutes);

        doc.fillColor('#312E81').fontSize(8.5).font('Helvetica-Bold').text(`👤  ${empName} (${role})`, leftMargin + 10, startY + 6);
        doc.fillColor('#4338CA').fontSize(8).font('Helvetica-Bold').text(`Total Worked Today: ${totalDur}`, leftMargin + pageWidth - 180, startY + 6, { align: 'right', width: 170 });

        startY += 24;

        if (emp.logs.length === 0) {
          doc.rect(leftMargin, startY, pageWidth, 18).fill('#FFFFFF');
          doc.rect(leftMargin, startY, pageWidth, 18).stroke(borderGray);
          doc.fillColor('#64748B').fontSize(7.5).font('Helvetica').text('⚪ No work logged / Offline for this date (0h 0m)', leftMargin + 10, startY + 5);
          startY += 22;
        } else {
          startY = drawTableHeader(startY);

          // Table Rows
          for (const log of emp.logs) {
            // Calculate accurate dynamic row height based on text content
            doc.fontSize(7.5).font('Helvetica');
            const titleH = doc.heightOfString(log.taskTitle || '', { width: 135 });
            const descH = doc.heightOfString(log.description || '-', { width: 160 });
            const contentHeight = Math.max(titleH, descH);
            const rowHeight = Math.max(20, contentHeight + 8);

            if (startY + rowHeight > 780) {
              doc.addPage();
              drawHeader(false);
              startY = drawTableHeader(66);
            }

            doc.rect(leftMargin, startY, pageWidth, rowHeight).fill(startY % 2 === 0 ? '#FFFFFF' : '#FAFAFA');
            doc.rect(leftMargin, startY, pageWidth, rowHeight).stroke(borderGray);

            // 1. Timing
            doc.fillColor(textColor).fontSize(7).font('Helvetica').text(log.timing, leftMargin + 8, startY + 5, { width: 80 });

            // 2. Task Name
            doc.font('Helvetica-Bold').fillColor('#0F172A').fontSize(7.5).text(log.taskTitle, leftMargin + 92, startY + 5, { width: 135, lineBreak: true });
            
            // 3. Description
            doc.font('Helvetica').fillColor('#475569').fontSize(7.5).text(log.description || '-', leftMargin + 232, startY + 5, { width: 160, lineBreak: true });

            // 4. Duration
            doc.font('Helvetica-Bold').fillColor('#1E293B').fontSize(7.5).text(log.durationStr, leftMargin + 396, startY + 5, { width: 55 });

            // 5. Status
            let statusColor = '#059669';
            if (log.status === 'WORKING') statusColor = '#2563EB';
            else if (log.status === 'ON_HOLD') statusColor = '#D97706';
            else if (log.status === 'PENDING') statusColor = '#EA580C';

            doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(7).text(log.status, leftMargin + 455, startY + 5, { width: 68, align: 'right' });

            startY += rowHeight;
          }
          startY += 10;
        }
      }

      // --- PAGE NUMBERING FOOTER ---
      const range = doc.bufferedPageRange();
      const totalPages = (range && range.count) ? range.count : 1;
      for (let p = 0; p < totalPages; p++) {
        try {
          doc.switchToPage(p);
          doc.fillColor(grayColor).fontSize(7).font('Helvetica').text(
            `FAST HRM WorkPulse • Daily Staff Work & Productivity Report • Page ${p + 1} of ${totalPages}`,
            leftMargin,
            804,
            { align: 'center', width: pageWidth }
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
 * Generate fully responsive, high quality HTML email body (mobile & desktop optimized)
 */
export const generateDailyReportHtml = (summary: DailyReportSummary): string => {
  const employeeSectionsHtml = summary.employeeData
    .map((emp) => {
      const totalDur = formatMinutesToDuration(emp.totalMinutes);

      const desktopRows = emp.logs.length === 0
        ? `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic; font-size: 12px;">No activity recorded for this employee today</td></tr>`
        : emp.logs
            .map((l) => {
              const statusBg = l.status === 'COMPLETED' ? '#dcfce7' : l.status === 'WORKING' ? '#dbeafe' : l.status === 'ON_HOLD' ? '#fef3c7' : '#ffedd5';
              const statusColor = l.status === 'COMPLETED' ? '#166534' : l.status === 'WORKING' ? '#1e40af' : l.status === 'ON_HOLD' ? '#92400e' : '#9a3412';
              return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 8px 10px; font-size: 11px; color: #475569; white-space: nowrap;">${l.timing}</td>
                  <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: #0f172a;">${l.taskTitle}</td>
                  <td style="padding: 8px 10px; font-size: 11.5px; color: #475569; word-break: break-word;">${l.description}</td>
                  <td style="padding: 8px 10px; font-size: 11.5px; font-weight: 700; color: #1e293b;">${l.durationStr}</td>
                  <td style="padding: 8px 10px; font-size: 10px; font-weight: 700; text-align: right;">
                    <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; background-color: ${statusBg}; color: ${statusColor};">${l.status}</span>
                  </td>
                </tr>
              `;
            })
            .join('');

      const mobileCards = emp.logs.length === 0
        ? `<div style="padding: 12px; text-align: center; color: #94a3b8; font-style: italic; font-size: 12px;">No activity recorded today</div>`
        : emp.logs
            .map((l) => {
              const statusBg = l.status === 'COMPLETED' ? '#dcfce7' : l.status === 'WORKING' ? '#dbeafe' : l.status === 'ON_HOLD' ? '#fef3c7' : '#ffedd5';
              const statusColor = l.status === 'COMPLETED' ? '#166534' : l.status === 'WORKING' ? '#1e40af' : l.status === 'ON_HOLD' ? '#92400e' : '#9a3412';
              return `
                <div style="border-top: 1px solid #e2e8f0; padding: 12px; background-color: #ffffff;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
                    <div style="font-size: 13px; font-weight: 700; color: #0f172a; flex: 1;">${l.taskTitle}</div>
                    <span style="display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background-color: ${statusBg}; color: ${statusColor}; white-space: nowrap;">${l.status}</span>
                  </div>
                  <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #64748b; margin-bottom: 6px;">
                    <div>⏱ <strong>Timing:</strong> ${l.timing}</div>
                    <div>⏳ <strong>Time Spent:</strong> <span style="color: #1e293b; font-weight: 700;">${l.durationStr}</span></div>
                  </div>
                  <div style="font-size: 12px; color: #334155; background-color: #f8fafc; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-word;">
                    ${l.description}
                  </div>
                </div>
              `;
            })
            .join('');

      return `
        <div class="emp-container" style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; background-color: #ffffff;">
          <!-- Employee Card Header -->
          <div style="background-color: #eef2ff; border-bottom: 1px solid #c7d2fe; padding: 10px 14px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="vertical-align: middle; text-align: left;">
                  <span style="font-weight: 700; color: #312e81; font-size: 14px;">👤 ${emp.employee?.name || 'Staff Member'}</span>
                  <span style="font-weight: 500; color: #6366f1; font-size: 12px; margin-left: 4px;">(${emp.employee?.designation || emp.employee?.department || 'Staff'})</span>
                </td>
                <td style="vertical-align: middle; text-align: right; white-space: nowrap;">
                  <span style="font-size: 12px; color: #4338ca; font-weight: 700; background: #ffffff; padding: 3px 8px; border-radius: 6px; border: 1px solid #c7d2fe;">Total: ${totalDur}</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Desktop Table View -->
          <table class="desktop-table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 18%;">Timing</th>
                <th style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 28%;">Task Name</th>
                <th style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 34%;">Description</th>
                <th style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 10%;">Time</th>
                <th style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #64748b; text-transform: uppercase; width: 10%; text-align: right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${desktopRows}
            </tbody>
          </table>

          <!-- Mobile Card View -->
          <div class="mobile-only-cards" style="display: none;">
            ${mobileCards}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>FAST HRM Daily Work Report</title>
      <style>
        body { margin: 0; padding: 12px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
        .wrapper { max-width: 760px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .header { background-color: #1e293b; color: #ffffff; padding: 18px 20px; }
        .stat-box { padding: 12px 8px; text-align: center; }

        @media only screen and (max-width: 600px) {
          body { padding: 6px !important; }
          .wrapper { border-radius: 8px !important; }
          .desktop-table { display: none !important; }
          .mobile-only-cards { display: block !important; }
          .header h1 { font-size: 15px !important; }
          .stat-num { font-size: 16px !important; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <!-- Header -->
        <div class="header">
          <h1 style="margin: 0; font-size: 17px; font-weight: 800; letter-spacing: 0.3px; color: #ffffff;">F.A.S.T. - FIRST ATTEMPT SUCCESS TUTORIALS</h1>
          <p style="margin: 4px 0 0 0; font-size: 12.5px; color: #94a3b8;">WorkPulse HRM • Daily Staff Work Report • <strong style="color: #38bdf8;">${summary.formattedDate}</strong></p>
        </div>

        <!-- Metric Summary Bar -->
        <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
          <tr>
            <td class="stat-box" style="width: 25%; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Total Staff</div>
              <div class="stat-num" style="font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 2px;">${summary.totalEmployees}</div>
            </td>
            <td class="stat-box" style="width: 25%; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Active Today</div>
              <div class="stat-num" style="font-size: 18px; font-weight: 800; color: #059669; margin-top: 2px;">${summary.activeEmployeesCount}</div>
            </td>
            <td class="stat-box" style="width: 25%; border-right: 1px solid #e2e8f0;">
              <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Team Hours</div>
              <div class="stat-num" style="font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 2px;">${summary.totalTeamDurationStr}</div>
            </td>
            <td class="stat-box" style="width: 25%;">
              <div style="font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Completed Tasks</div>
              <div class="stat-num" style="font-size: 18px; font-weight: 800; color: #d97706; margin-top: 2px;">${summary.totalCompletedTasks}</div>
            </td>
          </tr>
        </table>

        <!-- Body Content -->
        <div style="padding: 16px;">
          <p style="font-size: 12.5px; color: #475569; margin: 0 0 16px 0; line-height: 1.5;">
            Respected Sir, here is the consolidated staff work log summary for <strong>${summary.formattedDate}</strong>. The complete formatted PDF report is also attached with this email.
          </p>

          ${employeeSectionsHtml}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
          FAST HRM WorkPulse • Automated Daily Report (10:00 PM IST)<br/>
          Attached Document: <strong>Daily_Staff_Work_Report_${summary.dateStr}.pdf</strong>
        </div>
      </div>
    </body>
    </html>
  `;
};
