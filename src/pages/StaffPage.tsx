import { Copy, Mail, Plus, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import type { PageProps } from "../lib/useWorkspace";
const roleLabels: Record<string, string> = {
  owner: "Pronar",
  manager: "Menaxher",
  receptionist: "Recepsion",
  housekeeper: "Pastrim",
};
export function StaffPage({ context }: PageProps) {
  const { data, user, busy, mutate, notify } = context;
  const [invite, setInvite] = useState(false),
    [link, setLink] = useState("");
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">NJË EKIP NË TË NJËJTËN RRJEDHË</span>
          <h1>Stafi dhe përgjegjësitë.</h1>
          <p>Çdo punonjës ka llogarinë dhe lejet e veta.</p>
        </div>
        {user.role === "owner" && (
          <button className="btn primary" onClick={() => setInvite(!invite)}>
            <Plus size={20} />
            Fto punonjës
          </button>
        )}
      </div>
      {invite && (
        <section className="card settings-card">
          <h2>Ftesë e re</h2>
          <form
            className="invite-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = Object.fromEntries(new FormData(form)),
                r = await mutate(
                  "invite",
                  f,
                  "Ftesa u ruajt në radhën e email-eve.",
                );
              if (r) {
                setLink(r.inviteUrl || "");
                form.reset();
              }
            }}
          >
            <label className="field">
              <span>Email i punonjësit</span>
              <input
                name="email"
                type="email"
                required
                placeholder="punonjes@shembull.com"
              />
            </label>
            <label className="field">
              <span>Roli</span>
              <select name="role">
                <option value="receptionist">Recepsion</option>
                <option value="housekeeper">Pastrim</option>
                <option value="manager">Menaxher</option>
              </select>
            </label>
            <button className="btn primary" disabled={busy}>
              <Mail size={19} />
              Krijo ftesën
            </button>
          </form>
          {link && (
            <div className="notice">
              <strong>Link për provë lokale</strong>
              <p>
                Pa ofrues email-i, ftesa nuk dërgohet jashtë. Kopjoje këtë link
                për ta provuar në një dritare tjetër.
              </p>
              <button
                className="btn"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  notify("Linku u kopjua.");
                }}
              >
                <Copy size={18} />
                Kopjo linkun e ftesës
              </button>
            </div>
          )}
        </section>
      )}
      <section className="card">
        <div className="card-heading">
          <h2>Anëtarët e ekipit</h2>
          <Users size={23} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Punonjësi</th>
                <th>Email</th>
                <th>Roli</th>
                <th>Statusi</th>
                <th>Veprimet</th>
              </tr>
            </thead>
            <tbody>
              {(data.staff || []).map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                  </td>
                  <td>{s.email}</td>
                  <td>
                    {user.role === "owner" && s.role !== "owner" ? (
                      <select
                        aria-label={"Roli i " + s.name}
                        value={s.role}
                        onChange={(e) =>
                          mutate(
                            "updateMember",
                            {
                              userId: s.id,
                              role: e.target.value,
                              active: !!s.active,
                            },
                            "Roli u ndryshua; sesionet e vjetra u mbyllën.",
                          )
                        }
                      >
                        <option value="manager">Menaxher</option>
                        <option value="receptionist">Recepsion</option>
                        <option value="housekeeper">Pastrim</option>
                      </select>
                    ) : (
                      roleLabels[s.role]
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        "badge " + (s.active ? "in_house" : "cancelled")
                      }
                    >
                      {s.active ? "Aktiv" : "Pezulluar"}
                    </span>
                  </td>
                  <td>
                    {user.role === "owner" && s.role !== "owner" ? (
                      <button
                        className="btn"
                        disabled={busy}
                        onClick={() =>
                          mutate(
                            "updateMember",
                            { userId: s.id, role: s.role, active: !s.active },
                            "Aksesi u përditësua.",
                          )
                        }
                      >
                        {s.active ? "Pezullo aksesin" : "Riaktivizo"}
                      </button>
                    ) : (
                      <span className="muted">
                        {s.role === "owner"
                          ? "Pronari i biznesit"
                          : "Vetëm shikim"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card permissions-card">
        <h2>Çfarë mund të bëjë secili rol</h2>
        <div className="permission-grid">
          {[
            ["owner", "Prona, rezervime, financa, staf, arkëtim dhe abonim."],
            ["manager", "Operimi i pronës, raportet, detyrat dhe email-et."],
            [
              "receptionist",
              "Rezervime, check-in/out, pagesa dhe lista operative.",
            ],
            [
              "housekeeper",
              "Gjendja e dhomave dhe detyrat e lejuara, pa financa.",
            ],
          ].map(([r, label]) => (
            <div key={r}>
              <ShieldCheck size={23} />
              <h3>{roleLabels[r]}</h3>
              <p>{label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
