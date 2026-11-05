import {
  ArrowRight,
  BarChart3,
  Download,
  FileText,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Report } from "../../server/modules/reports";
import { localToday, money, shift } from "../lib/shared";
import type { PageProps } from "../lib/useWorkspace";
export function ReportsPage({ context }: PageProps) {
  const { property, data } = context;
  const catalog = data.reportCatalog || [];
  const [type, setType] = useState(catalog[0]?.id || "occupancy"),
    [from, setFrom] = useState(shift(localToday(), -6)),
    [to, setTo] = useState(localToday()),
    [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const params = new URLSearchParams({
    propertyId: property.id,
    type,
    from,
    to,
  });
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/reports?" + params.toString(), { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setReport(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [property.id, type, from, to]);
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">VENDIME ME MË SHUMË QARTËSI</span>
          <h1>Raportet e pronës.</h1>
          <p>Shifra të dallueshme dhe lista praktike për çdo ditë pune.</p>
        </div>
        <span className="badge neutral">
          {catalog.length} raporte për rolin tënd
        </span>
      </div>
      <div className="report-picker">
        {catalog.map((item) => (
          <button
            className={item.id === type ? "selected" : ""}
            onClick={() => setType(item.id)}
            key={item.id}
          >
            <BarChart3 size={19} />
            {item.name}
            <ArrowRight size={16} />
          </button>
        ))}
      </div>
      <section className="card report-controls">
        <label className="field">
          <span>Nga data</span>
          <input
            type="date"
            required
            value={from}
            max={to}
            onChange={(e) => {
              if (e.target.value) setFrom(e.target.value);
            }}
          />
        </label>
        <label className="field">
          <span>Deri në datën</span>
          <input
            type="date"
            required
            value={to}
            min={from}
            onChange={(e) => {
              if (e.target.value) setTo(e.target.value);
            }}
          />
        </label>
        <div className="export-actions">
          {[
            ["pdf", "PDF"],
            ["docx", "Word"],
            ["csv", "CSV"],
          ].map(([format, label]) => (
            <a
              className="btn"
              href={"/api/reports?" + params.toString() + "&format=" + format}
              key={format}
              download
            >
              <Download size={18} />
              {label}
            </a>
          ))}
        </div>
      </section>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="loading-panel">
          <Loader2 className="spin" />
          Po përgatitet raporti…
        </div>
      ) : (
        report && (
          <>
            <div className="report-summary">
              {report.summary.map((s) => (
                <section className="card" key={s.label}>
                  <span>{s.label}</span>
                  <strong>{s.value}</strong>
                </section>
              ))}
            </div>
            {["occupancy", "revenue"].includes(type) && (
              <section className="card report-chart">
                <div className="card-heading">
                  <div>
                    <h2>
                      {type === "occupancy"
                        ? "Zënia gjatë periudhës"
                        : "Vlera e netëve gjatë periudhës"}
                    </h2>
                    <p>
                      {from} — {to}
                    </p>
                  </div>
                  <TrendingUp size={24} />
                </div>
                <Trend
                  series={report.series}
                  metric={type === "occupancy" ? "occupancy" : "revenue"}
                />
              </section>
            )}
            <section className="card report-table">
              <div className="card-heading">
                <div>
                  <h2>{report.title}</h2>
                  <p>
                    {report.rows.length} rreshta · {report.from} — {report.to}
                  </p>
                </div>
                <FileText size={23} />
              </div>
              <p className="report-definition">{report.description}</p>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {report.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!report.rows.length && (
                  <p className="no-results">
                    Nuk ka të dhëna për këtë periudhë.
                  </p>
                )}
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}
function Trend({
  series,
  metric,
}: {
  series: Report["series"];
  metric: "occupancy" | "revenue";
}) {
  const width = 920,
    height = 210,
    pad = 35,
    max =
      metric === "occupancy"
        ? 100
        : Math.max(1, ...series.map((p) => p.revenue));
  const pts = series.map((p, i) => ({
    x:
      pad +
      (series.length > 1 ? i / (series.length - 1) : 0.5) * (width - 2 * pad),
    y: height - pad - (p[metric] / max) * (height - 2 * pad),
    p,
  }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  return (
    <div className="trend-chart">
      <svg
        role="img"
        aria-label={
          metric === "occupancy"
            ? "Grafiku i zënies ditore"
            : "Grafiku i vlerës së netëve"
        }
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#67a78a" stopOpacity=".24" />
            <stop offset="100%" stopColor="#67a78a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1={pad}
              y1={height - pad - v * (height - 2 * pad)}
              x2={width - pad}
              y2={height - pad - v * (height - 2 * pad)}
              stroke="#e8eeeb"
            />
            <text
              x="0"
              y={height - pad - v * (height - 2 * pad) + 4}
              fontSize="12"
              fill="#77867d"
            >
              {metric === "occupancy"
                ? Math.round(max * v) + "%"
                : Math.round((max * v) / 100)}
            </text>
          </g>
        ))}
        {pts.length > 0 && (
          <>
            <path
              d={`${path} L${pts.at(-1)!.x},${height - pad} L${pts[0].x},${height - pad} Z`}
              fill="url(#chart-fill)"
            />
            <path d={path} fill="none" stroke="#34765d" strokeWidth="3" />
            {pts
              .filter(
                (_, i) =>
                  series.length < 20 || i % Math.ceil(series.length / 14) === 0,
              )
              .map((p) => (
                <g key={p.p.date}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="#34765d"
                    stroke="#fff"
                    strokeWidth="2"
                  >
                    <title>
                      {p.p.date}:{" "}
                      {metric === "occupancy"
                        ? p.p.occupancy + "%"
                        : money(p.p.revenue)}
                    </title>
                  </circle>
                  <text
                    x={p.x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#7d8b82"
                  >
                    {p.p.date.slice(5)}
                  </text>
                </g>
              ))}
          </>
        )}
      </svg>
    </div>
  );
}
