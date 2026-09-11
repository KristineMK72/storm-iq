import { useEffect, useState } from "react";
import {
  estimateDriveMinutes,
  formatDuration,
  loadHomeBase,
  type HomeBase,
} from "../lib/homeBase";
import { focusMap } from "../lib/mapFocus";
import { addChaseLog } from "../lib/chaseLog";
import { fetchWxPoint, windDirLabel, type WxPoint } from "../lib/wxPoint";
import { windowFlag } from "../lib/windowFlag";

type BoardItem = {
  id: string;
  name: string;
  score: number;
  status: string;
  state: string;
  event: string;
  severity?: string;
  urgency?: string;
  certainty?: string;
  headline?: string;
  description?: string;
  instruction?: string;
  areaDesc?: string;
  onset?: string;
  expires?: string;
  senderName?: string;
  lat?: number;
  lng?: number;
  etaMin?: number;
  etaMiles?: number;
  kind?: "alert" | "outlook";
};

const RISK_SCORE: Record<string, number> = {
  HIGH: 95, MDT: 88, ENH: 78, SLGT: 68, MRGL: 58, TSTM: 48,
};

function scoreFromAlert(event: string, severity?: string, urgency?: string): number {
  const e = (event || "").toLowerCase();
  const s = (severity || "").toLowerCase();
  const u = (urgency || "").toLowerCase();
  let base = 40;
  if (s === "extreme") base = 92;
  else if (s === "severe") base = 84;
  else if (s === "moderate") base = 70;
  else if (s === "minor") base = 58;
  else base = 55;
  if (e.includes("tornado")) base = Math.min(99, base + 10);
  else if (e.includes("severe thunderstorm")) base = Math.min(96, base + 6);
  else if (e.includes("flash flood")) base = Math.min(93, base + 4);
  else if (e.includes("warning")) base = Math.min(90, base + 3);
  if (u === "immediate") base = Math.min(99, base + 3);
  return Math.round(base);
}

function shortArea(areaDesc?: string): string {
  if (!areaDesc) return "Multiple areas";
  const first = areaDesc.split(";")[0]?.trim() || areaDesc;
  return first.length > 36 ? first.slice(0, 34) + "..." : first;
}

function guessState(areaDesc?: string): string {
  if (!areaDesc) return "-";
  const match = areaDesc.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : "US";
}

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

function isContiguousUS(lat?: number, lng?: number, areaDesc?: string, event?: string): boolean {
  const e = (event || "").toLowerCase();
  const a = (areaDesc || "").toLowerCase();
  if (a.includes("hawaii") || a.includes("alaska") || a.includes("puerto rico") || a.includes("guam") || a.includes("virgin islands") || /\bhi\b/.test(a) || /\bak\b/.test(a)) return false;
  if (lat != null && lng != null) {
    if (lat < 24.5 || lat > 49.5 || lng < -125 || lng > -66.5) return false;
  }
  if (lat == null && (e.includes("hurricane") || e.includes("tropical"))) return false;
  return true;
}

async function loadOutlookTargets(): Promise<BoardItem[]> {
  try {
    const res = await fetch("https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson");
    if (!res.ok) return [];
    const geo = await res.json();
    const items: BoardItem[] = [];
    for (const f of geo?.features || []) {
      const label = (f.properties?.LABEL || f.properties?.label || "TSTM").toUpperCase();
      if (label === "TSTM") continue;
      const score = RISK_SCORE[label] || 50;
      const center = getCentroid(f.geometry);
      if (!center || !isContiguousUS(center[0], center[1])) continue;
      items.push({
        id: "outlook-" + label + "-" + center[0].toFixed(2) + "-" + center[1].toFixed(2),
        name: "Day 1 " + label + " risk",
        score,
        status: "OUTLOOK",
        state: "US",
        event: "SPC categorical " + label,
        severity: label === "HIGH" || label === "MDT" ? "Severe" : "Moderate",
        headline: "SPC Day 1 " + label + " risk area - watch window, not a warning",
        description: "SPC categorical outlook area - not an NWS warning.",
        instruction: "Planning only. Follow official watches/warnings.",
        areaDesc: "SPC Day 1 " + label + " contour",
        lat: center[0],
        lng: center[1],
        kind: "outlook",
      });
    }
    items.sort((a, b) => b.score - a.score);
    return items.slice(0, 5);
  } catch {
    return [];
  }
}

export default function TargetBoard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [home, setHome] = useState<HomeBase | null>(null);
  const [etaStatus, setEtaStatus] = useState<"idle" | "calc" | "done">("idle");
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<"alerts" | "outlook">("alerts");
  const [nearMe, setNearMe] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [filter, setFilter] = useState<"all" | "warnings" | "watches" | "outlooks">("all");
  const [wxById, setWxById] = useState<Record<string, WxPoint | "loading" | "error">>({});

  useEffect(() => {
    setHome(loadHomeBase());
    const onUpdate = () => setHome(loadHomeBase());
    window.addEventListener("stormiq-home-updated", onUpdate);
    return () => window.removeEventListener("stormiq-home-updated", onUpdate);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setEtaStatus("idle");
      setNearMe(false);
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok) throw new Error("NWS error");
        const data = await res.json();
        const scored: BoardItem[] = [];
        for (const f of data?.features ?? []) {
          const p = f.properties ?? {};
          if ((p.event || "").toLowerCase().includes("test") || p.status === "Test") continue;
          const event = p.event || "Weather Alert";
          const severity = p.severity || "Unknown";
          const score = scoreFromAlert(event, severity, p.urgency);
          if (score < 55) continue;
          const center = getCentroid(f.geometry);
          const lat = center?.[0];
          const lng = center?.[1];
          if (!isContiguousUS(lat, lng, p.areaDesc, event)) continue;
          let statusLabel = "ACTIVE";
          if (severity === "Extreme" || severity === "Severe") statusLabel = "WARNING";
          else if (event.toLowerCase().includes("watch")) statusLabel = "WATCH";
          scored.push({
            id: f.id || event + "-" + p.areaDesc + "-" + score,
            name: shortArea(p.areaDesc),
            score,
            status: statusLabel,
            state: guessState(p.areaDesc),
            event,
            severity,
            urgency: p.urgency,
            certainty: p.certainty,
            headline: p.headline,
            description: p.description,
            instruction: p.instruction,
            areaDesc: p.areaDesc,
            onset: p.onset || p.effective,
            expires: p.expires,
            senderName: p.senderName,
            lat,
            lng,
            kind: "alert",
          });
        }
        scored.sort((a, b) => b.score - a.score);
        const unique: BoardItem[] = [];
        const seen = new Set<string>();
        for (const item of scored) {
          const key = item.name.slice(0, 18);
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(item);
          if (unique.length >= 18) break;
        }
        let finalItems = unique;
        let finalMode: "alerts" | "outlook" = "alerts";
        let usedNearMe = false;
        if (unique.length === 0) {
          finalItems = await loadOutlookTargets();
          finalMode = "outlook";
        }
        if (cancelled) return;
        const currentHome = loadHomeBase();
        if (currentHome && finalItems.length) {
          setEtaStatus("calc");
          await Promise.all(
            finalItems.map(async (item) => {
              if (item.lat == null || item.lng == null) return;
              try {
                const eta = await estimateDriveMinutes(currentHome, {
                  lat: item.lat,
                  lng: item.lng,
                });
                item.etaMin = eta.minutes;
                item.etaMiles = eta.miles;
              } catch {
                /* */
              }
            })
          );
          const withEta = finalItems.filter((i) => i.etaMin != null);
          if (withEta.length >= 2 && finalMode === "alerts") {
            withEta.sort((a, b) => {
              const d = (a.etaMin ?? 9999) - (b.etaMin ?? 9999);
              return d !== 0 ? d : b.score - a.score;
            });
            finalItems = withEta.slice(0, 6);
            usedNearMe = true;
          } else finalItems = finalItems.slice(0, 6);
          if (!cancelled) setEtaStatus("done");
        } else finalItems = finalItems.slice(0, 6);

        if (!cancelled) {
          setItems([...finalItems]);
          setMode(finalMode);
          setNearMe(usedNearMe);
          setStatus(finalItems.length > 0 ? "ready" : "empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    const interval = window.setInterval(load, 180000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [home]);

  async function shareTarget(item: BoardItem) {
    const lines = [
      "Storm IQ target: " + item.event,
      item.headline || item.name,
      item.areaDesc ? "Area: " + item.areaDesc : "",
      item.severity ? "Severity: " + item.severity : "",
      item.etaMin != null ? "ETA ~" + formatDuration(item.etaMin) + " · " + item.etaMiles + " mi" : "",
      "Map: https://storm-iq.vercel.app/map",
      "Official NWS warnings take priority.",
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: item.event, text });
        setShareNote("Shared");
        return;
      }
    } catch {
      /* */
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("Copied to clipboard");
      window.setTimeout(() => setShareNote(""), 2500);
    } catch {
      setShareNote("Could not share");
    }
  }

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    if (filter === "outlooks") return item.kind === "outlook" || item.status === "OUTLOOK";
    if (filter === "warnings")
      return item.status === "WARNING" || (item.event || "").toLowerCase().includes("warning");
    if (filter === "watches")
      return item.status === "WATCH" || (item.event || "").toLowerCase().includes("watch");
    return true;
  });

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <div className="eyebrow">National board</div>
          <h2>Top storm targets</h2>
        </div>
        <span className="small muted">
          {status === "loading"
            ? "LOADING..."
            : etaStatus === "calc"
            ? "CALC ETA..."
            : mode === "outlook"
            ? "WATCH WINDOWS"
            : nearMe
            ? "NEAR ME"
            : home
            ? "LIVE + ETA"
            : "LIVE NWS"}
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 4px" }}>
        {(
          [
            ["all", "ALL"],
            ["warnings", "WARNINGS"],
            ["watches", "WATCHES"],
            ["outlooks", "OUTLOOKS"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            style={{
              background: filter === k ? "rgba(217,255,74,0.16)" : "transparent",
              border: filter === k ? "1px solid rgba(217,255,74,0.45)" : "1px solid var(--line)",
              color: filter === k ? "#d9ff4a" : "var(--muted)",
              borderRadius: 8,
              padding: "5px 9px",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.04em",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="muted" style={{ marginTop: 12 }}>Loading live alerts...</p>}
      {(status === "empty" || status === "error" || (status === "ready" && filteredItems.length === 0)) && (
        <p className="muted" style={{ marginTop: 12 }}>
          {status === "ready" && filteredItems.length === 0
            ? "No targets for this filter - try ALL."
            : "No ranked targets right now. Check Upcoming Potential and the map."}
        </p>
      )}

      {filteredItems.map((item, index) => {
        const open = openId === item.id;
        const wf = windowFlag(item.etaMin, item.expires);
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => {
                const next = open ? null : item.id;
                setOpenId(next);
                if (next) {
                  addChaseLog({
                    id: item.id,
                    event: item.event,
                    area: item.areaDesc || item.name,
                    severity: item.severity,
                    score: item.score,
                    lat: item.lat,
                    lng: item.lng,
                  });
                  if (item.lat != null && item.lng != null && !wxById[item.id]) {
                    setWxById((m) => ({ ...m, [item.id]: "loading" }));
                    fetchWxPoint(item.lat, item.lng)
                      .then((p) => setWxById((m) => ({ ...m, [item.id]: p })))
                      .catch(() => setWxById((m) => ({ ...m, [item.id]: "error" })));
                  }
                }
              }}
              className="target-row"
              style={{
                width: "100%",
                background: open ? "rgba(217,255,74,0.04)" : "transparent",
                border: "none",
                borderTop: "1px solid var(--line)",
                color: "inherit",
                cursor: "pointer",
                textAlign: "left",
                padding: "13px 0",
              }}
            >
              <div className="rank">0{index + 1}</div>
              <div>
                <strong>{item.name}</strong>
                <div className="small muted">
                  {item.state} · {item.event}
                  {item.etaMin != null && (
                    <>
                      {" "}·{" "}
                      <span style={{ color: "var(--lime)" }}>~{formatDuration(item.etaMin)}</span>
                      {" "}· {item.etaMiles} mi
                    </>
                  )}
                  {wf && <span style={{ color: wf.color }}> · {wf.label}</span>}
                  <span style={{ opacity: 0.7 }}> · {open ? "hide detail" : "tap for detail"}</span>
                </div>
              </div>
              <div className={`badge ${item.status === "WARNING" ? "warn" : ""}`}>{item.status}</div>
              <div className="score-num">{item.score}</div>
            </button>

            {open && (
              <div
                style={{
                  margin: "0 0 12px",
                  padding: "14px",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  background: "rgba(0,0,0,0.28)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {item.headline && <div style={{ fontWeight: 700, marginBottom: 8 }}>{item.headline}</div>}
                <div className="small muted" style={{ marginBottom: 4 }}>Area</div>
                <div style={{ marginBottom: 10, color: "var(--muted)", fontSize: 12 }}>
                  {item.areaDesc || "-"}
                </div>
                {wf && (
                  <div
                    style={{
                      marginBottom: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid " + wf.color + "55",
                      color: wf.color,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Timing: {wf.label}
                  </div>
                )}
                {wxById[item.id] === "loading" && (
                  <p className="small muted">Loading wind / clouds...</p>
                )}
                {wxById[item.id] === "error" && (
                  <p className="small muted">Surface weather unavailable</p>
                )}
                {wxById[item.id] && typeof wxById[item.id] === "object" && (
                  <div
                    className="small"
                    style={{
                      marginBottom: 10,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      background: "rgba(82,224,208,0.06)",
                      color: "var(--muted)",
                    }}
                  >
                    <strong style={{ color: "#52e0d0" }}>Surface @ target</strong>
                    {" · "}
                    {Math.round((wxById[item.id] as WxPoint).windMph)} mph{" "}
                    {windDirLabel((wxById[item.id] as WxPoint).windDirDeg)}
                    {" · gusts "}
                    {Math.round((wxById[item.id] as WxPoint).gustMph)} mph
                    {" · clouds "}
                    {Math.round((wxById[item.id] as WxPoint).cloudPct)}%
                    {" · precip "}
                    {(wxById[item.id] as WxPoint).precipMm > 0
                      ? Math.round(((wxById[item.id] as WxPoint).precipMm / 25.4) * 100) / 100 + " in"
                      : "0 in"}
                    {(wxById[item.id] as WxPoint).precipProbPct != null
                      ? " · " + Math.round((wxById[item.id] as WxPoint).precipProbPct as number) + "% chance"
                      : ""}
                  </div>
                )}
                {item.description && (
                  <pre
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "inherit",
                      fontSize: 12,
                      color: "var(--muted)",
                      margin: "0 0 12px",
                      maxHeight: 180,
                      overflow: "auto",
                    }}
                  >
                    {item.description}
                  </pre>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {item.lat != null && item.lng != null && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        focusMap({
                          lat: item.lat!,
                          lng: item.lng!,
                          title: item.event,
                          zoom: 7,
                        });
                        window.location.href = "/map";
                      }}
                      style={{
                        background: "rgba(82,224,208,0.12)",
                        border: "1px solid rgba(82,224,208,0.4)",
                        color: "#52e0d0",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      VIEW ON MAP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      shareTarget(item);
                    }}
                    style={{
                      background: "rgba(217,255,74,0.12)",
                      border: "1px solid rgba(217,255,74,0.35)",
                      color: "#d9ff4a",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    SHARE TARGET
                  </button>
                  <a href="/map" style={{ fontSize: 11, fontWeight: 700, color: "var(--cyan)" }}>
                    Open map
                  </a>
                </div>
                {shareNote && (
                  <p className="small muted" style={{ marginTop: 8 }}>
                    {shareNote}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
