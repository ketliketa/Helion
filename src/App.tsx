import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  House,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import Workspace from "./Workspace";
import { api } from "./lib/api";
import type { CurrentUser } from "./lib/shared";
import { PublicBooking } from "./pages/PublicBooking";
export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const query = new URLSearchParams(window.location.search),
    special = window.location.pathname.slice(1),
    token = query.get("token") || "";
  const [mode, setMode] = useState(
      ["invite", "reset", "verify"].includes(special) ? special : "login",
    ),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [show, setShow] = useState(false);
  useEffect(() => {
    api("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  if (window.location.pathname.startsWith("/book/"))
    return (
      <PublicBooking
        slug={decodeURIComponent(window.location.pathname.slice(6))}
      />
    );
  if (loading)
    return (
      <div className="entry">
        <Loader2 className="spin" size={30} />
        <p>Po hapet hapësira jote…</p>
      </div>
    );
  if (user && !["invite", "reset", "verify"].includes(special))
    return <Workspace user={user} />;
  const headings: Record<string, string> = {
    login: "Mirë se erdhe sërish.",
    register: "Hapësira jote e mikpritjes.",
    forgot: "Rikupero llogarinë.",
    reset: "Vendos fjalëkalim të ri.",
    invite: "Bashkohu me ekipin.",
    verify: "Verifiko email-in tënd.",
  };
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <div className="brand">
          <span>
            <House size={25} />
          </span>
          <strong>
            hotel<span>flow</span>
          </strong>
        </div>
        <div>
          <span className="eyebrow">MIKPRITJA, ME MË SHUMË QARTËSI</span>
          <h1>
            Një ditë e organizuar.
            <br />
            Një qëndrim më i mirë.
          </h1>
          <p>
            Rezervimet, ekipi dhe shifrat që të duhen për të menaxhuar pronën me
            qetësi.
          </p>
          <div className="auth-benefits">
            <span>
              <CheckCircle2 />
              Kalendari dhe Front Desk
            </span>
            <span>
              <CheckCircle2 />
              Raporte për çdo rol
            </span>
            <span>
              <CheckCircle2 />
              Rezervime direkte dhe pagesa
            </span>
          </div>
        </div>
        <small>HotelFlow · Hapësira e punës për akomodimet</small>
      </aside>
      <main className="auth-main">
        <div className="auth-form">
          <span className="eyebrow">HAPËSIRA E BIZNESIT</span>
          <h1>{headings[mode]}</h1>
          <p>
            {mode === "register"
              ? "Krijo llogarinë dhe fillo provën 14-ditore."
              : mode === "invite"
                ? "Nëse ke llogari, përdor fjalëkalimin ekzistues. Për një llogari të re vendos një fjalëkalim të fortë."
                : "Menaxho pronën nga një vend i vetëm."}
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              setError("");
              try {
                const result = await api(
                  "/api/auth/" + (mode === "invite" ? "accept-invite" : mode),
                  { ...f, token },
                );
                if (["login", "register", "invite"].includes(mode)) {
                  window.location.href = "/";
                  return;
                }
                setNotice(
                  result.message ||
                    "Veprimi u krye. Tani mund të hysh në llogari.",
                );
                if (mode !== "forgot") setMode("login");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Veprimi dështoi.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {["register", "invite"].includes(mode) && (
              <label className="field">
                <span>Emri dhe mbiemri</span>
                <input
                  name="name"
                  required
                  autoComplete="name"
                  maxLength={100}
                />
              </label>
            )}
            {mode === "register" && (
              <label className="field">
                <span>Emri i biznesit</span>
                <input name="business" required maxLength={150} />
              </label>
            )}
            {["login", "register", "forgot"].includes(mode) && (
              <label className="field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={200}
                />
              </label>
            )}
            {["login", "register", "reset", "invite"].includes(mode) && (
              <label className="field">
                <span>
                  Fjalëkalimi {mode !== "login" && "· të paktën 12 karaktere"}
                </span>
                <div className="password-input">
                  <input
                    name="password"
                    type={show ? "text" : "password"}
                    required
                    minLength={mode === "login" ? 1 : 12}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                  />
                  <button
                    type="button"
                    aria-label={
                      show ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"
                    }
                    onClick={() => setShow(!show)}
                  >
                    {show ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </label>
            )}
            {mode === "verify" && (
              <p className="auth-description">
                Kliko butonin për të konfirmuar adresën e email-it.
              </p>
            )}
            <button className="btn primary wide" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={20} />
              ) : (
                <ArrowRight size={20} />
              )}
              {
                {
                  login: "Hyr në llogari",
                  register: "Krijo llogarinë",
                  forgot: "Dërgo linkun",
                  reset: "Ruaj fjalëkalimin",
                  invite: "Prano ftesën",
                  verify: "Verifiko email-in",
                }[mode]
              }
            </button>
          </form>
          {mode === "login" ? (
            <>
              <button
                className="auth-link"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setNotice("");
                }}
              >
                Harrove fjalëkalimin?
              </button>
              {import.meta.env.DEV && (
                <button
                  className="btn wide demo-login"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await api("/api/auth/demo", {});
                      window.location.href = "/";
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Prova nuk u hap.",
                      );
                      setBusy(false);
                    }
                  }}
                >
                  Provo me të dhëna shembull <ArrowRight size={19} />
                </button>
              )}
              <div className="auth-divider" />
              <p className="auth-switch">
                Nuk ke llogari?{" "}
                <button
                  onClick={() => {
                    setMode("register");
                    setError("");
                    setNotice("");
                  }}
                >
                  Krijo një të re
                </button>
              </p>
            </>
          ) : (
            <button
              className="auth-link"
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
            >
              <ArrowLeft size={16} />
              Kthehu te hyrja
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
