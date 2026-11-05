import { AboutDialog } from "./components/dialogs/AboutDialog";
import { ChannelDialog } from "./components/dialogs/ChannelDialog";
import { EditRoomDialog } from "./components/dialogs/EditRoomDialog";
import { ReservationDetailsDialog } from "./components/dialogs/ReservationDetailsDialog";
import { ReservationDialog } from "./components/dialogs/ReservationDialog";
import { RoomDialog } from "./components/dialogs/RoomDialog";
import { PaymentsPage } from "./pages/PaymentsPage";

import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  House,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Brand } from "./components/ui";
import { CurrentUser, State, initials, nav, secondary } from "./lib/shared";
import { useWorkspace } from "./lib/useWorkspace";
import { BookingPage } from "./pages/BookingPage";
import { CalendarPage } from "./pages/CalendarPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { EmailsPage } from "./pages/EmailsPage";
import { GuestsPage } from "./pages/GuestsPage";
import { HousekeepingPage } from "./pages/HousekeepingPage";
import { ReportsPage } from "./pages/ReportsPage";
import { ReservationsPage } from "./pages/ReservationsPage";
import { RoomsPage } from "./pages/RoomsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StaffPage } from "./pages/StaffPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { TodayPage } from "./pages/TodayPage";
export default function Workspace({
  user,
  previewState,
}: {
  user: CurrentUser;
  previewState?: State;
}) {
  const context = useWorkspace(user, previewState);
  const [managementOpen, setManagementOpen] = useState(false);
  const {
    data,
    loading,
    busy,
    error,
    setError,
    toast,
    setToast,
    setPid,
    page,
    modal,
    setModal,
    selected,
    setSelected,
    sidebar,
    setSidebar,
    filter,
    setSetupStep,
    property,
    arrivals,
    mutate,
    navigate,
    title,
    setupModal,
  } = context;
  if (loading)
    return (
      <div className="entry">
        <Brand />
        <Loader2 className="spin" />
        <p>Po hapim hapësirën tënde…</p>
      </div>
    );
  if (!property)
    return (
      <div className="entry">
        <Brand />
        <div className="entry-card welcome">
          <span className="eyebrow">
            MIRË SE ERDHE, {user.name.toUpperCase()}
          </span>
          <h1>
            Çdo qëndrim i mirë
            <br />
            nis me një hap të thjeshtë.
          </h1>
          <p>
            Krijo pronën tënde ose eksploro HotelFlow me një pronë shembull.
          </p>
          {error && (
            <div className="error">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          <button
            className="btn primary wide"
            onClick={() => {
              setSetupStep(1);
              setModal("setup");
            }}
          >
            <Plus size={18} /> Konfiguro pronën time
          </button>
          <button
            className="btn wide"
            disabled={busy}
            onClick={async () => {
              const d = await mutate("demo", {}, "Prona shembull është gati.");
              if (d) setPid(d.id);
            }}
          >
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            Provo me të dhëna shembull
          </button>
          <div className="welcome-features">
            <span>
              <ShieldCheck size={16} /> Hapësirë private
            </span>
            <span>
              <CheckCircle2 size={16} /> Prova fillestare 14 ditë
            </span>
          </div>
        </div>
        {modal === "setup" && setupModal()}
      </div>
    );
  return (
    <div className="app-shell">
      {sidebar && (
        <div className="mobile-backdrop" onClick={() => setSidebar(false)} />
      )}
      <aside className={"sidebar " + (sidebar ? "open" : "")}>
        <Brand />
        <div className="property-switch">
          <span className="property-icon">
            <Building2 size={20} />
          </span>
          <div>
            <select
              aria-label="Zgjidh pronën"
              value={property.id}
              onChange={(e) => {
                setPid(e.target.value);
                setSelected(null);
              }}
            >
              {data.properties.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <small>{property.city}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">HAPËSIRA E PUNËS</div>
        <nav>
          {nav
            .filter(
              (n) => user.role !== "housekeeper" || n.id === "housekeeping",
            )
            .map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "today" && arrivals.length > 0 && (
                  <b>{arrivals.length}</b>
                )}
              </button>
            ))}
        </nav>
        <div className="nav-label second">RRITJA E BIZNESIT</div>
        <nav>
          {secondary
            .filter((n) => !["staff", "emails", "subscription"].includes(n.id))
            .filter(
              (n) =>
                user.role === "owner" ||
                (user.role === "manager" &&
                  [
                    "booking",
                    "channels",
                    "reports",
                    "staff",
                    "emails",
                  ].includes(n.id)) ||
                (user.role === "receptionist" &&
                  ["booking", "reports"].includes(n.id)) ||
                (user.role === "housekeeper" && n.id === "reports"),
            )
            .map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.id === "channels" && <i className="nav-dot" />}
              </button>
            ))}
        </nav>
        {["owner", "manager"].includes(user.role) && (
          <>
            <button
              className="management-toggle"
              aria-expanded={managementOpen}
              onClick={() => setManagementOpen(!managementOpen)}
            >
              <Settings size={20} />
              <span>Menaxhimi</span>
              <ChevronDown size={17} />
            </button>
            {managementOpen && (
              <nav className="management-nav">
                {secondary
                  .filter(
                    (n) =>
                      ["staff", "emails", "subscription"].includes(n.id) &&
                      (user.role === "owner" || n.id !== "subscription"),
                  )
                  .map((n) => (
                    <button
                      key={n.id}
                      className={page === n.id ? "active" : ""}
                      onClick={() => navigate(n.id)}
                    >
                      <n.icon size={20} />
                      {n.label}
                    </button>
                  ))}
              </nav>
            )}
          </>
        )}
        <div className="sidebar-bottom">
          <div className="mini-card">
            <div>
              <span className="live-dot" />
              VERSION ZHVILLIMI
            </div>
            <p>
              Një bazë e re për
              <br />
              mikpritjen tënde.
            </p>
            <button onClick={() => setModal("about")}>
              Çfarë funksionon <ArrowUpRight size={14} />
            </button>
          </div>
          <button
            className={"settings-nav " + (page === "settings" ? "active" : "")}
            onClick={() => navigate("settings")}
          >
            <Settings size={18} />
            Cilësimet
          </button>
          <div className="profile">
            <span className="avatar owner">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>
                {previewState ? "Demo · vetëm shikim" : "Anëtar i ekipit"}
              </small>
            </div>
            <a
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                await fetch("/api/auth/logout", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": user.csrf,
                  },
                  body: "{}",
                });
                window.location.href = "/";
              }}
              title="Dil nga llogaria"
            >
              <LogOut size={17} />
            </a>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Hap menunë"
              onClick={() => setSidebar(true)}
            >
              <Menu size={20} />
            </button>
            <House size={16} />
            <span>/</span>
            <span>{title}</span>
          </div>
          <div className="top-actions">
            <span className="save-status">
              <span className="live-dot" />
              {previewState ? "Demo · vetëm shikim" : "Të dhënat në databazë"}
            </span>
            <button
              className="icon-btn"
              aria-label="Ndihmë"
              onClick={() => setModal("about")}
            >
              <HelpCircle size={19} />
            </button>
            <span className="avatar owner small">{initials(user.name)}</span>
          </div>
        </header>
        <main
          className={"content " + (page === "booking" ? "booking-content" : "")}
        >
          {property.demo === 1 && (
            <div className="demo-banner">
              <Sparkles size={14} />
              <span>
                {previewState
                  ? "Demo vetëm për shikim — hyr në llogari për të krijuar dhe ruajtur rezervime."
                  : "Pronë shembull — të gjitha rezervimet dhe pagesat janë për demonstrim."}
              </span>
              <button
                onClick={() => {
                  if (previewState) {
                    window.location.href = "/";
                    return;
                  }
                  setSetupStep(1);
                  setModal("setup");
                }}
              >
                Krijo pronën tënde <ArrowRight size={13} />
              </button>
            </div>
          )}
          {error && !modal && !selected && (
            <div className="error">
              <AlertCircle size={17} />
              {error}
              <button
                className="icon-btn"
                aria-label="Mbyll gabimin"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {page === "today" && <TodayPage context={context} />}
          {page === "calendar" && <CalendarPage context={context} />}
          {page === "reservations" && <ReservationsPage context={context} />}
          {page === "rooms" && <RoomsPage context={context} />}
          {page === "housekeeping" && <HousekeepingPage context={context} />}
          {page === "guests" && <GuestsPage context={context} />}
          {page === "booking" && <BookingPage context={context} />}
          {page === "channels" && <ChannelsPage context={context} />}
          {page === "reports" && <ReportsPage context={context} />}
          {page === "payments" && <PaymentsPage context={context} />}{" "}
          {page === "staff" && <StaffPage context={context} />}{" "}
          {page === "emails" && <EmailsPage context={context} />}{" "}
          {page === "subscription" && <SubscriptionPage context={context} />}{" "}
          {page === "settings" && <SettingsPage context={context} />}
          <footer className="workspace-footer">
            <span>
              HotelFlow <span className="footer-dot">·</span> Më shumë hapësirë
              për mikpritje.
            </span>
            <span>
              Versioni 0.2 <span className="footer-dot">·</span>{" "}
              {property.currency}
            </span>
          </footer>
        </main>
      </div>
      {modal === "setup" && setupModal()}
      <ReservationDialog context={context} />
      <RoomDialog context={context} />
      <EditRoomDialog context={context} />
      <ChannelDialog context={context} />
      <AboutDialog context={context} />
      <ReservationDetailsDialog context={context} />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
          <button onClick={() => setToast("")} aria-label="Mbyll njoftimin">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
