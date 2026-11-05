export class AppError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function text(
  value: unknown,
  label: string,
  max = 150,
  required = true,
): string {
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > max
  )
    throw new AppError(400, `${label}: vlerë e pavlefshme.`);
  return value.trim();
}
export function date(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    throw new AppError(400, "Data nuk është e vlefshme.");
  return value;
}
export function nights(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
}
export function range(start: unknown, end: unknown) {
  const a = date(start),
    b = date(end),
    n = nights(a, b);
  if (n < 1 || n > 365)
    throw new AppError(400, "Qëndrimi duhet të jetë 1–365 net.");
  return { a, b, n };
}
export function integer(
  value: unknown,
  min: number,
  max: number,
  label: string,
) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new AppError(400, `${label}: vlerë e pavlefshme.`);
  return value;
}
export function today(timezone = "Europe/Tirane") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function nextStatus(
  current: string,
  next: string,
  arrival: string,
  departure: string,
  localToday: string,
  clean: string,
) {
  const allowed: Record<string, string[]> = {
    confirmed: ["in_house", "cancelled", "no_show"],
    in_house: ["checked_out"],
    checked_out: [],
    cancelled: [],
    no_show: [],
  };
  if (!allowed[current]?.includes(next))
    throw new AppError(409, "Ky ndryshim statusi nuk lejohet.");
  if (next === "in_house" && (arrival > localToday || departure <= localToday))
    throw new AppError(409, "Check-in lejohet gjatë datave të qëndrimit.");
  if (next === "in_house" && clean !== "clean")
    throw new AppError(409, "Dhoma duhet të jetë e pastër për check-in.");
  if (next === "no_show" && arrival > localToday)
    throw new AppError(409, "Rezervimi ende nuk ka filluar.");
}
