const CITIES = ["Dhaka", "Chattogram", "New York", "London", "Toronto", "Dubai"];
const NOTES = [
  "Completed sprint task",
  "Worked on API integration",
  "Reviewed pull request",
  "Fixed reported bug",
  "Updated documentation",
];

const randomEnum = (enumValues) => {
  return enumValues[Math.floor(Math.random() * enumValues.length)];
};

const randomDateBetween = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomWorkingDay = () => {
  const day = Math.floor(Math.random() * 5); // Mon-Fri
  const date = new Date();
  date.setDate(date.getDate() - day);
  date.setHours(9, 0, 0, 0);
  return date;
};

const generateAttendanceDays = (startDate, endDate) => {
  const days = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Skip weekends
      const day = new Date(current);
      const clockIn = new Date(day);
      clockIn.setHours(9, 0, 0, 0);
      const clockOut = new Date(day);
      clockOut.setHours(17, 0, 0, 0);
      days.push({
        date: day.toISOString().split("T")[0],
        status: Math.random() > 0.3 ? "Present" : ["Late", "Half-Day", "Absent", "Leave"][Math.floor(Math.random() * 4)],
        clockIn,
        clockOut,
        durationMinutes: 480 + Math.floor(Math.random() * 120),
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
};

const generateTimeEntries = (tenant, userId, taskIds, startDate, endDate) => {
  const entries = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    if (Math.random() > 0.7) {
      const taskId = taskIds[Math.floor(Math.random() * taskIds.length)];
      const duration = (Math.random() * 8).toFixed(2);
      entries.push({
        tenant,
        user: userId,
        task: taskId,
        date: current.toISOString().split("T")[0],
        startTime: current,
        endTime: new Date(current.getTime() + parseFloat(duration) * 60 * 60 * 1000),
        durationHours: parseFloat(duration),
        category: ["Work", "Meeting", "Training"][Math.floor(Math.random() * 3)],
        location: CITIES[Math.floor(Math.random() * CITIES.length)],
        notes: NOTES[Math.floor(Math.random() * NOTES.length)],
        source: ["timer", "manual"][Math.floor(Math.random() * 2)],
        status: ["Draft", "Submitted", "Approved"][Math.floor(Math.random() * 3)],
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return entries;
};

const generatePayrollRecord = (user, month) => {
  const presentDays = Math.floor(Math.random() * 23) + 5;
  const absentDays = 20 - presentDays;
  const leaveDays = Math.floor(Math.random() * 5);
  const bonus = Math.random() * 1000;
  const deductions = Math.random() * 500;
  const overtimeHours = Math.random() * 20;
  const netSalary = Math.round((15000 + bonus - deductions) * 100) / 100;

  return {
    tenant: user.tenant,
    user: user._id,
    employeeName: user.name,
    empCode: `EMP-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`,
    dept: user.department || "Engineering",
    role: user.role,
    month,
    baseSalary: 15000,
    presentDays,
    absentDays: Math.max(0, 20 - presentDays - leaveDays),
    leaveDays,
    bonus: Math.round(bonus * 100) / 100,
    deductions: Math.round(deductions * 100) / 100,
    overtimeHours: parseFloat(overtimeHours.toFixed(1)),
    netSalary,
    paymentMethod: ["Direct Deposit", "Check", "Cash"][Math.floor(Math.random() * 3)],
    status: ["Draft", "Calculated", "Disbursed"][Math.floor(Math.random() * 3)],
  };
};

module.exports = {
  randomEnum,
  randomDateBetween,
  randomWorkingDay,
  generateAttendanceDays,
  generateTimeEntries,
  generatePayrollRecord,
};