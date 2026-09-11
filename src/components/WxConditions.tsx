import { useEffect, useState } from "react";
import { loadHomeBase, type HomeBase } from "../lib/homeBase";
import { fetchWxPoint, windDirLabel, type WxPoint } from "../lib/wxPoint";

const REFRESH_MS = 5 * 60_000; // auto-refresh every 5 minutes

export default function WxConditions() {
  const [home, setHome] = useState<HomeBase | null>(null);
  const [wx, setWx] = useState<WxPoint | null>(null);
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
      setWx(null);
      setStatus("idle");
      return;
    }

    let cancelled = false;

    async function load() {
      if (!home) return;
      setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        const point = await fetchWxPoint(home.lat, home.lng);
        if (!cancelled) {
          setWx(point);
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
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Surface conditions</div>
          <h2>Wind &amp; clouds</h2>
        </div>
        <span className="small muted">
          {status === "loading"
            ? "LOADING…"
            : status === "error"
            ? "RETRY"
            : status === "ready"
            ? "AUTO 5 MIN"
            : "HOME BASE"}
        </span>
      </div>

      {!home && (
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
          Set a <strong style={{ color: "var(--text)" }}>home base</strong> above to load live wind
          speed, gusts, direction, and cloud cover at your location.
        </p>
      )}

      {home && status === "loading" && !wx && (
        <p className="muted" style={{ fontSize: 13 }}>Fetching surface weather…</p>
      )}

      {home && status === "error" && !wx && (
        <p className="muted" style={{ fontSize: 13 }}>
          Could not reach weather service — will retry automatically.
        </p>
      )}

      {wx && (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <Metric
              label="WIND"
              value={`${Math.round(wx.windMph)} mph`}
              sub={`${windDirLabel(wx.windDirDeg)} ${Math.round(wx.windDirDeg)}°`}
              color="#52e0d0"
            />
            <Metric
              label="GUSTS"
              value={`${Math.round(wx.gustMph)} mph`}
              sub="10 m level"
              color="#ffd166"
            />
            <Metric
              label="CLOUDS"
              value={`${Math.round(wx.cloudPct)}%`}
              sub="sky cover"
              color="#b8dde1"
            />
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            Open-Meteo surface fields at home base
            {home.label ? ` (${home.label})` : ""}.
            Auto-refreshes about every 5 minutes
            {updated ? ` · last ${updated}` : ""}.
            Not a substitute for radar or NWS warnings.
          </p>
        </div>
      )}
    </div>
  );
}

function Metric({
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
        flex: "1 1 90px",
        minWidth: 90,
        padding: "12px 14px",
        borderRadius: 12,
        border: `1px solid ${color}44`,
        background: `${color}12`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "var(--muted)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Barlow Condensed, sans-serif",
          fontSize: 26,
          fontWeight: 800,
          color,
          lineHeight: 1.1,
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div className="small muted" style={{ marginTop: 2 }}>
        {sub}
      </div>
    </div>
  );
}
