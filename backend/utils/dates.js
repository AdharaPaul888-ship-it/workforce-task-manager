exports.workingDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const workingDays = [];
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays.push({
        date: current.toISOString().split("T")[0],
        isWorkingDay: true,
        isHoliday: false,
      });
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
};

exports.isoWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

exports.tenantToday = (tenantId) => {
  const now = new Date();
  return now;
};