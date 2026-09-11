import { useEffect, useState } from "react";
import { loadHomeBase, type HomeBase } from "../lib/homeBase";
import {
  capeLabel,
  fetchModelSeries,
  fmtHour,
  type ModelSeries,
} from "../lib/modelPoint";

const REFRESH_MS = 20 * 60_000;

export default function ModelAtPoint() {
  const [home, setHome] = useState<HomeBase | null>(null);
  const [series, setSeries] = useState<ModelSeries | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    setHome(loadHomeBase());
    const on = () => setHome(loadHomeBase());
    window.addEventListener("stormiq-home-updated", on);
    return () => window.removeEventListener("stormiq-home-updated", on);
  }, []);

  useEffect(() => {
    if (!home) {
      setSeries(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;

    async function load() {
      if (!home) return;
      setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const data = await fetchModelSeries(home.lat, home.lng);
        if (!cancelled) {
          setSeries(data);
          setStatus("ready");
          setUpdated(new Date().toLocaleTimeString());
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    const id = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [home?.lat, home?.lng]);

  return (
    <div
      className="card"
      style={{ marginBottom: 18, borderColor: "rgba(126,182,255,0.35)" }}
    >
      <div className="section-title">
        <div>
          <div className="eyebrow">Model guidance</div>
          <h2>HRRR-style timeline</h2>
        </div>
        <span className="small muted">
          {status === "loading"
            ? "LOADING..."
            : status === "error"
            ? "RETRY"
            : status === "ready"
            ? "~20 MIN"
            : "HOME BASE"}
        </span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Point forecast near home base from Open-Meteo using the NOAA HRRR path when available
        (CAPE, CIN, wind, precip, clouds next ~18 hours). Model guidance only — not observations
        or NWS warnings.
      </p>

      {!home && (
        <p className="muted" style={{ fontSize: 13 }}>
          Set <strong style={{ color: "var(--lime)" }}>home base</strong> above to load the model
          timeline.
        </p>
      )}

      {home && status === "loading" && !series && (
        <p className="muted" style={{ fontSize: 13 }}>Fetching model hours...</p>
      )}

      {home && status === "error" && !series && (
        <p className="muted" style={{ fontSize: 13 }}>
          Model service unavailable — will retry automatically.
        </p>
      )}

      {series && series.hours.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <SummaryChip
              label="PEAK CAPE"
              value={Math.round(series.peakCape) + " J/kg"}
              sub={capeLabel(series.peakCape) + " · " + fmtHour(series.peakCapeTime)}
              color="#ffd166"
            />
            <SummaryChip
              label="MAX PRECIP"
              value={
                series.maxPrecipMm <= 0
                  ? "0 mm"
                  : series.maxPrecipMm < 0.5
                  ? "<0.5 mm"
                  : Math.round(series.maxPrecipMm * 10) / 10 + " mm"
              }
              sub="any hour in window"
              color="#7eb6ff"
            />
            <SummaryChip
              label="HOURS"
              value={String(series.hours.length)}
              sub="in timeline"
              color="#52e0d0"
            />
          </div>

          <div style={{ overflowX: "auto", marginBottom: 8 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                minWidth: 420,
              }}
            >
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    Time
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    CAPE
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    CIN
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    Wind
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    Precip
                  </th>
                  <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                    Cloud
                  </th>
                </tr>
              </thead>
              <tbody>
                {series.hours.map((hr) => {
                  const isPeak = hr.time === series.peakCapeTime && series.peakCape > 0;
                  const wet = hr.precipMm >= 0.5;
                  return (
                    <tr
                      key={hr.time}
                      style={{
                        background: isPeak
                          ? "rgba(255,209,102,0.1)"
                          : wet
                          ? "rgba(126,182,255,0.08)"
                          : "transparent",
                      }}
                    >
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                        {fmtHour(hr.time)}
                        {isPeak ? " *" : ""}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          borderBottom: "1px solid var(--line)",
                          color: hr.cape >= 1500 ? "#ffd166" : "inherit",
                          fontWeight: hr.cape >= 1500 ? 700 : 400,
                        }}
                      >
                        {Math.round(hr.cape)}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                        {Math.round(hr.cin)}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                        {Math.round(hr.windMph)} mph
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                        {hr.precipMm > 0 ? Math.round(hr.precipMm * 10) / 10 : "0"}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)" }}>
                        {Math.round(hr.cloudPct)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="small muted">
            * Peak CAPE hour highlighted. Wet hours (0.5+ mm) tinted. CIN negative means remaining
            inhibition. Source: {series.model}. Updated ~20 min
            {updated ? " · last " + updated : ""}.
          </p>

          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 12 }}>
            <a
              href={
                "https://nomads.ncep.noaa.gov/" +
                "#" +
                series.lat.toFixed(2) +
                "," +
                series.lng.toFixed(2)
              }
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}
            >
              NOAA NOMADS
            </a>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}
            >
              Open-Meteo docs
            </a>
            <a
              href="https://www.spc.noaa.gov/exper/mesoanalysis/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}
            >
              SPC mesoanalysis
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 100px",
        minWidth: 100,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid " + color + "44",
        background: color + "12",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 22,
          fontWeight: 800,
          color,
          marginTop: 2,
        }}
      >
        {value}
      </div>
      <div className="small muted">{sub}</div>
    </div>
  );
}
