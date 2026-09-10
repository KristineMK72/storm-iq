import { useState } from "react";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadJson(url: string, filename: string) {
  const res = await fetch(url, {
    headers: url.includes("weather.gov")
      ? {
          "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
          Accept: "application/geo+json",
        }
      : undefined,
  });
  if (!res.ok) throw new Error("download failed");
  const text = await res.text();
  downloadBlob(filename, new Blob([text], { type: "application/geo+json" }));
}

export default function DataExport() {
  const [status, setStatus] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(`${label} done`);
      window.setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus(`${label} failed — try again or use SPC link`);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">GIS / research</div>
          <h2>Download map data</h2>
        </div>
        <span className="small muted">GEOJSON</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Download live layers as <strong style={{ color: "var(--text)" }}>GeoJSON</strong> for QGIS,
        ArcGIS, or Python. GeoJSON is the web standard — open it in QGIS and export to shapefile
        (.shp) if you need that format. Official SPC packages stay the source of record.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className="chase-btn"
          onClick={() =>
            run("Alerts", () =>
              downloadJson(
                "https://api.weather.gov/alerts/active",
                `nws-active-alerts-${new Date().toISOString().slice(0, 10)}.geojson`
              )
            )
          }
        >
          NWS ALERTS (.geojson)
        </button>
        <button
          type="button"
          className="chase-btn"
          onClick={() =>
            run("Day 1 cat", () =>
              downloadJson(
                "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
                `spc-day1-cat-${new Date().toISOString().slice(0, 10)}.geojson`
              )
            )
          }
        >
          DAY 1 CATEGORICAL
        </button>
        <button
          type="button"
          className="chase-btn"
          onClick={() =>
            run("Torn", () =>
              downloadJson(
                "https://www.spc.noaa.gov/products/outlook/day1otlk_torn.nolyr.geojson",
                `spc-day1-torn-${new Date().toISOString().slice(0, 10)}.geojson`
              )
            )
          }
        >
          DAY 1 TORNADO
        </button>
        <button
          type="button"
          className="chase-btn"
          onClick={() =>
            run("Hail", () =>
              downloadJson(
                "https://www.spc.noaa.gov/products/outlook/day1otlk_hail.nolyr.geojson",
                `spc-day1-hail-${new Date().toISOString().slice(0, 10)}.geojson`
              )
            )
          }
        >
          DAY 1 HAIL
        </button>
        <button
          type="button"
          className="chase-btn"
          onClick={() =>
            run("Day 2", () =>
              downloadJson(
                "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson",
                `spc-day2-cat-${new Date().toISOString().slice(0, 10)}.geojson`
              )
            )
          }
        >
          DAY 2 CATEGORICAL
        </button>
      </div>

      {status && (
        <p className="small muted" style={{ marginTop: 10 }}>
          {status}
        </p>
      )}

      <div style={{ marginTop: 14, fontSize: 12, lineHeight: 1.5, color: "var(--muted)" }}>
        <strong style={{ color: "var(--text)" }}>Shapefile path:</strong> download GeoJSON → open in
        QGIS → Export → ESRI Shapefile. Or use SPC’s official product pages for published packages:{" "}
        <a
          href="https://www.spc.noaa.gov/products/outlook/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--cyan)", fontWeight: 700 }}
        >
          SPC outlooks →
        </a>
      </div>
    </div>
  );
}
