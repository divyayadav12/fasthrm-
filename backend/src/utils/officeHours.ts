export const checkOfficeHours = () => {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const hour = parseInt(formatter.format(now));
  
  // Office hours: 9 AM (9) to 7 PM (19)
  if (hour < 9 || hour >= 19) {
    return false;
  }
  return true;
};
