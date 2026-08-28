export const ZONES = [
  { tz: "America/Los_Angeles", city: "los angeles", f: 71, icon: "clear_day" },
  { tz: "America/Denver", city: "denver", f: 64, icon: "partly_cloudy_day" },
  { tz: "America/Chicago", city: "chicago", f: 68, icon: "cloud" },
  { tz: "America/New_York", city: "new york", f: 73, icon: "partly_cloudy_day" },
  { tz: "America/Sao_Paulo", city: "sao paulo", f: 79, icon: "clear_day" },
  { tz: "Europe/London", city: "london", f: 59, icon: "rainy" },
  { tz: "Europe/Berlin", city: "berlin", f: 62, icon: "cloud" },
  { tz: "Europe/Athens", city: "athens", f: 82, icon: "clear_day" },
  { tz: "Africa/Cairo", city: "cairo", f: 90, icon: "clear_day" },
  { tz: "Asia/Dubai", city: "dubai", f: 98, icon: "clear_day" },
  { tz: "Asia/Kolkata", city: "kolkata", f: 88, icon: "foggy" },
  { tz: "Asia/Singapore", city: "singapore", f: 84, icon: "rainy" },
  { tz: "Asia/Tokyo", city: "tokyo", f: 70, icon: "partly_cloudy_day" },
  { tz: "Australia/Sydney", city: "sydney", f: 66, icon: "clear_day" },
  { tz: "Pacific/Auckland", city: "auckland", f: 60, icon: "rainy" },
  { tz: "UTC", city: "utc", f: 68, icon: "cloud" }
];

export function zoneFor(tz) {
  return ZONES.find(z => z.tz === tz) || { tz, city: "local", f: 72, icon: "partly_cloudy_day" };
}

export function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (e) {
    return "UTC";
  }
}
