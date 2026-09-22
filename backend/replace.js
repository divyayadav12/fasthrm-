const fs = require('fs');
const path = './backend/src/controllers/reports.controller.ts';
let content = fs.readFileSync(path, 'utf8');

const search = `const taskIds = tasks.map((t) => t._id);
    const latestLogPerTask = await WorkLog.aggregate([
      {
        $match: {
          employeeId,
          taskId: { $in: taskIds },
          ...dateMatch,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$taskId',
          lastActivity: { $first: '$createdAt' },
          logCount: { $sum: 1 },
        },
      },
    ]);

    const logMap: Record<string, { lastActivity: Date; logCount: number }> = {};
    for (const entry of latestLogPerTask) {
      logMap[entry._id.toString()] = {
        lastActivity: entry.lastActivity,
        logCount: entry.logCount,
      };
    }

    // Build report - include live elapsed time for WORKING tasks
    const now = Date.now();
    const report = tasks.map((task) => {
      let totalMinutes = task.totalDuration || 0;
      if (task.status === 'WORKING' && task.startedAt) {
        const liveElapsed = Math.max(0, Math.round((now - new Date(task.startedAt).getTime()) / 60000));
        totalMinutes += liveElapsed;
      }
      const logInfo = logMap[task._id.toString()];
      const taskAny = task as any; // Mongoose timestamps not typed in ITask
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        progress: task.progress,
        totalMinutes,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        lastActivity: logInfo?.lastActivity || taskAny.updatedAt,
        logCount: logInfo?.logCount || 0,
        createdAt: taskAny.createdAt,
      };
    });`;

const replacement = `const hasDateFilter = !!(dateFrom || dateTo);
    const taskIds = tasks.map((t) => t._id);
    const latestLogPerTask = await WorkLog.aggregate([
      {
        $match: {
          employeeId,
          taskId: { $in: taskIds },
          ...dateMatch,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$taskId',
          lastActivity: { $first: '$createdAt' },
          logCount: { $sum: 1 },
          filteredDuration: { $sum: { $ifNull: ['$duration', 0] } }
        },
      },
    ]);

    const logMap: Record<string, { lastActivity: Date; logCount: number; filteredDuration: number }> = {};
    for (const entry of latestLogPerTask) {
      logMap[entry._id.toString()] = {
        lastActivity: entry.lastActivity,
        logCount: entry.logCount,
        filteredDuration: entry.filteredDuration || 0
      };
    }

    // Build report - include live elapsed time for WORKING tasks
    const now = Date.now();
    const report = tasks
      .filter((task) => !hasDateFilter || logMap[task._id.toString()] || (task.status === 'WORKING' && task.startedAt && (!dateFrom || new Date(task.startedAt) >= new Date(dateFrom as string))))
      .map((task) => {
      const logInfo = logMap[task._id.toString()];
      let totalMinutes = hasDateFilter ? (logInfo?.filteredDuration || 0) : (task.totalDuration || 0);

      if (task.status === 'WORKING' && task.startedAt) {
        const startedAtDate = new Date(task.startedAt);
        let includeLive = true;
        if (hasDateFilter) {
          if (dateFrom && startedAtDate < new Date(dateFrom as string)) includeLive = false;
          if (dateTo && startedAtDate > new Date(dateTo as string)) includeLive = false;
        }
        
        if (includeLive) {
          const liveElapsed = Math.max(0, Math.round((now - startedAtDate.getTime()) / 60000));
          totalMinutes += liveElapsed;
        }
      }
      
      const taskAny = task as any;
      return {
        _id: task._id,
        title: task.title,
        description: task.description,
        status: task.status,
        progress: task.progress,
        totalMinutes,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        lastActivity: logInfo?.lastActivity || taskAny.updatedAt,
        logCount: logInfo?.logCount || 0,
        createdAt: taskAny.createdAt,
      };
    });`;

if (content.includes(search.substring(0, 100))) {
    // We can't just replace because of CRLF or indentation differences. We'll find indices.
    const startIdx = content.indexOf('const taskIds = tasks.map((t) => t._id);');
    const endStr = 'createdAt: taskAny.createdAt,\n      };\n    });';
    const endIdx = content.indexOf(endStr) + endStr.length;
    if (startIdx !== -1 && endIdx !== -1) {
        content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
        fs.writeFileSync(path, content);
        console.log('Replaced successfully!');
    } else {
        console.log('Could not find indices');
    }
} else {
    console.log('Search text not found');
}
