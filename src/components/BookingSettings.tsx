import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import type { PageProps } from "../lib/useWorkspace";
export function BookingSettings({ context }: PageProps) {
  const { property, data, mutate, busy, notify } = context;
  const settings = data.propertySettings?.find(
    (s) => s.property_id === property.id,
  );
  return (
    <section className="card settings-card booking-settings">
      <div className="card-heading">
        <div>
          <h2>Faqja e rezervimeve direkte</h2>
          <p>
            Publiko linkun për vizitorët pasi kontrollon çmimet dhe kushtet.
          </p>
        </div>
        <Globe size={24} />
      </div>
      <form
        key={property.id + settings?.public_slug}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await mutate(
            "saveBookingSettings",
            {
              propertyId: property.id,
              slug: f.get("slug"),
              policy: f.get("policy"),
              published: f.get("published") === "on",
            },
            "Faqja e rezervimit u përditësua.",
          );
        }}
      >
        <label className="field">
          <span>Adresa e pronës</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={
              settings?.public_slug || "prona-" + property.id.slice(0, 8)
            }
          />
        </label>
        <label className="field">
          <span>Kushtet e rezervimit dhe pagesës</span>
          <textarea
            name="policy"
            required
            rows={3}
            defaultValue={
              settings?.policy ||
              "Pagesa dhe anulimi konfirmohen në marrëveshje me pronën."
            }
          />
        </label>
        <label className="checkbox-line">
          <input
            name="published"
            type="checkbox"
            defaultChecked={!!settings?.published}
          />
          Lejo rezervime publike nga linku
        </label>
        <div className="intro-actions">
          <button className="btn primary" disabled={busy}>
            <Check size={19} />
            Ruaj konfigurimin
          </button>
          {settings?.published === 1 && (
            <>
              <a
                className="btn"
                href={"/book/" + settings.public_slug}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={18} />
                Hap faqen
              </a>
              <button
                className="btn"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    window.location.origin + "/book/" + settings.public_slug,
                  );
                  notify("Linku i rezervimeve u kopjua.");
                }}
              >
                <Copy size={18} />
                Kopjo linkun
              </button>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
