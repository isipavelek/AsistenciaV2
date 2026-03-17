/**
 * Generates and downloads an .ics file for a calendar event
 */
export function downloadICS(title, description, startDate, endDate = null) {
  const formatICSDate = (date) => {
    return date.toISOString().replace(/-|:|\.\d+/g, "");
  };

  const start = formatICSDate(new Date(startDate));
  const end = endDate 
    ? formatICSDate(new Date(endDate)) 
    : formatICSDate(new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000));

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UTN//Asistencia//ES",
    "BEGIN:VEVENT",
    `SUMMARY:${title}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title.replace(/\s+/g, "_")}.ics`;
  link.click();
}
