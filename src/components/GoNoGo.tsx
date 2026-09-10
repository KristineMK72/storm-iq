import { useEffect, useState } from "react";
import {
  estimateDriveMinutes,
  formatDuration,
  loadHomeBase,
} from "../lib/homeBase";

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") coords = geometry.coordinates[0] || [];
  else if (geometry.type === "MultiPolygon") coords = geometry.coordinates?.[0]?.[0] || [];
  else if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries || []) {
      const c = getCentroid(g);
      if (c) return c;
    }
    return null;
  } else return null;
  if (!coords.length) return null;
  let lat = 0, lng = 0, n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

function scoreEvent(event: string, severity?: string): number {
  const e = event.toLowerCase();
  const s = (severity || "").toLowerCase();
  let base = s === "extreme" ? 95 : s === "severe" ? 85 : s === "moderate" ? 70 : 55;
  if (e.includes("tornado warning")) base = 99;
  else if (e.includes("tornado watch")) base = 80;
  else if (e.includes("severe thunderstorm warning")) base = 88;
  else if (e.includes("flash flood warning")) base = 86;
  return base;
}

type Strip = {
  label: string;
  detail: string;
  tone: "quiet" | "watch" | "go" | "danger";
};

export default function GoNoGo() {
  const [strip, setStrip] = useState<Strip>({
    label: "Checking…",
    detail: "Loading national threat picture",
    tone: "quiet",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok) throw new Error("fail");
        const data = await res.json();
        const home = loadHomeBase();

        type Cand = {
          event: string;
          area: string;
          score: number;
          lat?: number;
          lng?: number;
        };
        const cands: Cand[] = [];

        for (const f of data?.features || []) {
          const p = f.properties || {};
          const event = p.event || "";
          if (!event || (event || "").toLowerCase().includes("test")) continue;
          const score = scoreEvent(event, p.severity);
          if (score < 70) continue;
          const center = getCentroid(f.geometry);
          cands.push({
            event,
            area: (p.areaDesc || "").split(";")[0] || "—",
            score,
            lat: center?.[0],
            lng: center?.[1],
          });
        }

        cands.sort((a, b) => b.score - a.score);
        const top = cands[0];

        if (!top) {
          if (!cancelled) {
            setStrip({
              label: "QUIET / MONITOR",
              detail: "No high-priority CONUS warnings ranked right now — check outlooks",
              tone: "quiet",
            });
          }
          return;
        }

        let eta = "";
        if (home && top.lat != null && top.lng != null) {
          try {
            const d = await estimateDriveMinutes(home, { lat: top.lat, lng: top.lng });
            eta = ` · ~${formatDuration(d.minutes)} / ${d.miles} mi`;
          } catch {
            // ignore
          }
        }

        const isWarn = top.event.toLowerCase().includes("warning");
        const isTorn = top.event.toLowerCase().includes("tornado");

        if (!cancelled) {
          setStrip({
            label: isTorn && isWarn ? "DANGER — TORNADO WARNING" : isWarn ? "ACTIVE WARNING" : "WATCH WINDOW",
            detail: `${top.event} · ${top.area}${eta}`,
            tone: isTorn && isWarn ? "danger" : isWarn ? "go" : "watch",
          });
        }
      } catch {
        if (!cancelled) {
          setStrip({
            label: "STATUS UNKNOWN",
            detail: "Could not load live alerts — open Map / Alerts",
            tone: "quiet",
          });
        }
      }
    }

    load();
    const id = window.setInterval(load, 120000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const colors =
    strip.tone === "danger"
      ? { border: "rgba(255,92,92,0.55)", bg: "rgba(255,92,92,0.12)", text: "#ff8a8a" }
      : strip.tone === "go"
      ? { border: "rgba(255,159,67,0.45)", bg: "rgba(255,159,67,0.1)", text: "#ffb06b" }
      : strip.tone === "watch"
      ? { border: "rgba(255,209,102,0.4)", bg: "rgba(255,209,102,0.08)", text: "#ffd166" }
      : { border: "rgba(82,224,208,0.3)", bg: "rgba(82,224,208,0.06)", text: "#52e0d0" };

  return (
    <div
      style={{
        marginBottom: 18,
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          color: colors.text,
          marginBottom: 4,
        }}
      >
        GO / NO-GO STRIP
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text)", fontFamily: "Barlow Condensed, sans-serif" }}>
        {strip.label}
      </div>
      <div className="small muted" style={{ marginTop: 4, lineHeight: 1.45 }}>
        {strip.detail}
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        Not a chase clearance. Official NWS warnings always take priority.
      </div>
    </div>
  );
}
