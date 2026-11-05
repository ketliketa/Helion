import {
  Activity,
  BedDouble,
  Brush,
  CalendarDays,
  DoorOpen,
  Globe,
  LayoutDashboard,
  Link2,
  Mail,
  Users,
  Wallet,
} from "lucide-react";
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "receptionist" | "housekeeper";
  csrf: string;
  verified: boolean;
};
export type Property = {
  id: string;
  name: string;
  city: string;
  email: string;
  phone: string;
  currency: string;
  timezone: string;
  demo: number;
};
export type Room = {
  id: string;
  property_id: string;
  name: string;
  type: string;
  capacity: number;
  price: number;
  floor: string;
  housekeeping: string;
  blocked: number;
};
export type Reservation = {
  id: string;
  property_id: string;
  room_id: string;
  guest: string;
  email: string;
  phone: string;
  check_in: string;
  check_out: string;
  adults: number;
  total: number;
  nightly: number;
  status: string;
  source: string;
  notes: string;
  version: number;
  created: string;
};
export type Payment = {
  id: string;
  reservation_id: string;
  amount: number;
  method: string;
  created: string;
};
export type Audit = {
  id: string;
  property_id: string;
  action: string;
  detail: string;
  created: string;
};
export type State = {
  properties: Property[];
  rooms: Room[];
  reservations: Reservation[];
  payments: Payment[];
  audit: Audit[];
  assignments?: any[];
  propertySettings?: any[];
  staff?: any[];
  subscription?: any;
  integrations?: any;
  emails?: any[];
  reportCatalog?: any[];
  checkouts?: any[];
  user?: CurrentUser;
  channelJobs: {
    id: string;
    property_id: string;
    created: string;
    result: string;
  }[];
};
export const newId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
export const empty: State = {
  properties: [],
  rooms: [],
  reservations: [],
  payments: [],
  audit: [],
  channelJobs: [],
};
export const money = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: v % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(v / 100);
export const localToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const shift = (s: string, n: number) =>
  new Date(
    (Number.isFinite(Date.parse(s))
      ? Date.parse(s)
      : Date.parse(localToday())) +
      n * 86400000,
  )
    .toISOString()
    .slice(0, 10);
export const days = (a: string, b: string) =>
  Number.isFinite(Date.parse(a)) && Number.isFinite(Date.parse(b))
    ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
    : 0;
export const months = [
  "janar",
  "shkurt",
  "mars",
  "prill",
  "maj",
  "qershor",
  "korrik",
  "gusht",
  "shtator",
  "tetor",
  "nëntor",
  "dhjetor",
];
export const fmt = (s: string, long = false) =>
  `${Number(s.slice(8, 10))} ${long ? months[Number(s.slice(5, 7)) - 1] : months[Number(s.slice(5, 7)) - 1].slice(0, 3)}`;
export const weekday = (s: string) =>
  ["Die", "Hën", "Mar", "Mër", "Enj", "Pre", "Sht"][
    new Date(s + "T12:00:00Z").getUTCDay()
  ];
export const propertyDate = (s: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Tirane",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(s));
export const statusNames: Record<string, string> = {
  confirmed: "Konfirmuar",
  in_house: "Në qëndrim",
  checked_out: "Përfunduar",
  cancelled: "Anuluar",
  no_show: "Nuk u paraqit",
};
export const cleanNames: Record<string, string> = {
  clean: "E pastër",
  dirty: "Për pastrim",
  cleaning: "Në pastrim",
};
export const active = (r: Reservation) =>
  !["cancelled", "no_show"].includes(r.status);
export const initials = (s: string) =>
  s
    .split(" ")
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase();
export const nav = [
  { id: "today", label: "Sot", icon: LayoutDashboard },
  { id: "calendar", label: "Kalendari", icon: CalendarDays },
  { id: "reservations", label: "Rezervimet", icon: BedDouble },
  { id: "rooms", label: "Dhomat & çmimet", icon: DoorOpen },
  { id: "payments", label: "Pagesat", icon: Wallet },
  { id: "housekeeping", label: "Pastrimi", icon: Brush },
  { id: "guests", label: "Klientët", icon: Users },
];
export const secondary = [
  { id: "booking", label: "Booking Engine", icon: Globe },
  { id: "channels", label: "Channel Manager", icon: Link2 },
  { id: "reports", label: "Raportet", icon: Activity },
  { id: "staff", label: "Stafi & rolet", icon: Users },
  { id: "emails", label: "Email-et", icon: Mail },
  { id: "subscription", label: "Abonimi", icon: Wallet },
];
