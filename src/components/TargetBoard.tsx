import { useEffect, useState } from "react";
import {
  estimateDriveMinutes,
  formatDuration,
  loadHomeBase,
  type HomeBase,
} from "../lib/homeBase";

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
  return first.length > 36 ? first.slice(0, 34) + "…" : first;
}

function guessState(areaDesc?: string): string {
  if (!areaDesc) return "—";
  const match = areaDesc.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : "US";
}

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") coords = geometry.coordinates[0] || [];
  else if (geometry.type === "MultiPolygon") coords = geometry.coordinates?.[0]?.[0] || [];
  else return null;
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

  if (
    a.includes("hawaii") ||
    a.includes("kauai") ||
    a.includes("oahu") ||
    a.includes("maui") ||
    a.includes("honolulu") ||
    a.includes("alaska") ||
    a.includes("puerto rico") ||
    a.includes("guam") ||
    a.includes("virgin islands") ||
    /\bhi\b/.test(a) ||
    /\bak\b/.test(a)
  ) {
    return false;
  }

  if (lat != null && lng != null) {
    if (lat < 24.5 || lat > 49.5 || lng < -125 || lng > -66.5) return false;
  }

  if (lat == null && (e.includes("hurricane") || e.includes("tropical"))) {
    return false;
  }

  return true;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function TargetBoard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [home, setHome] = useState<HomeBase | null>(null);
  const [etaStatus, setEtaStatus] = useState<"idle" | "calc" | "done">("idle");
  const [openId, setOpenId] = useState<string | null>(null);

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

      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok) throw new Error("NWS error");

        const data = await res.json();
        const features = data?.features ?? [];
        const scored: BoardItem[] = [];

        for (const f of features) {
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
            id: f.id || `${event}-${p.areaDesc}-${score}`,
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
          if (unique.length >= 6) break;
        }

        if (cancelled) return;

        const currentHome = loadHomeBase();
        if (currentHome && unique.length) {
          setEtaStatus("calc");
          await Promise.all(
            unique.map(async (item) => {
              if (item.lat == null || item.lng == null) return;
              try {
                const eta = await estimateDriveMinutes(currentHome, {
                  lat: item.lat,
                  lng: item.lng,
                });
                item.etaMin = eta.minutes;
                item.etaMiles = eta.miles;
              } catch {
                // leave blank
              }
            })
          );
          if (!cancelled) setEtaStatus("done");
        }

        if (!cancelled) {
          setItems([...unique]);
          setStatus(unique.length > 0 ? "ready" : "empty");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [home]);

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <div className="eyebrow">National board</div>
          <h2>Top storm targets</h2>
        </div>
        <span className="small muted">
          {status === "loading"
            ? "LOADING…"
            : etaStatus === "calc"
            ? "CALC ETA…"
            : home
            ? "LIVE + ETA"
            : "LIVE NWS"}
        </span>
      </div>

      {!home && status === "ready" && (
        <p className="small muted" style={{ marginTop: 4, marginBottom: 8 }}>
          Set Home base above to see drive times. Tap a target for full warning detail.
        </p>
      )}

      {status === "loading" && (
        <p className="muted" style={{ marginTop: 12 }}>Loading live alerts…</p>
      )}

      {(status === "empty" || status === "error") && (
        <p className="muted" style={{ marginTop: 12 }}>
          No ranked CONUS alerts right now. Check the map for SPC outlook & radar.
        </p>
      )}

      {items.map((item, index) => {
        const open = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
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
                  {item.etaMin != null ? (
                    <>
                      {" "}·{" "}
                      <span style={{ color: "var(--lime)" }}>
                        ~{formatDuration(item.etaMin)}
                      </span>
                      {" "}· {item.etaMiles} mi
                    </>
                  ) : null}
                  <span style={{ opacity: 0.7 }}> · {open ? "hide detail" : "tap for detail"}</span>
                </div>
              </div>
              <div className={`badge ${item.status === "WARNING" ? "warn" : ""}`}>
                {item.status}
              </div>
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
                {item.headline && (
                  <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>
                    {item.headline}
                  </div>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div className="small muted">Severity</div>
                    <strong>{item.severity || "—"}</strong>
                  </div>
                  <div>
                    <div className="small muted">Urgency</div>
                    <strong>{item.urgency || "—"}</strong>
                  </div>
                  <div>
                    <div className="small muted">Certainty</div>
                    <strong>{item.certainty || "—"}</strong>
                  </div>
                  <div>
                    <div className="small muted">Office</div>
                    <strong style={{ fontSize: 11 }}>{item.senderName || "NWS"}</strong>
                  </div>
                </div>

                <div className="small muted" style={{ marginBottom: 4 }}>
                  Area
                </div>
                <div style={{ marginBottom: 10, color: "var(--muted)", fontSize: 12 }}>
                  {item.areaDesc || "—"}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div className="small muted">Onset</div>
                    <strong>{fmtTime(item.onset)}</strong>
                  </div>
                  <div>
                    <div className="small muted">Expires</div>
                    <strong>{fmtTime(item.expires)}</strong>
                  </div>
                </div>

                {item.description && (
                  <>
                    <div className="small muted" style={{ marginBottom: 4 }}>
                      Warning text
                    </div>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                        fontSize: 12,
                        color: "var(--muted)",
                        margin: "0 0 12px",
                        maxHeight: 220,
                        overflow: "auto",
                        lineHeight: 1.5,
                      }}
                    >
                      {item.description}
                    </pre>
                  </>
                )}

                {item.instruction && (
                  <>
                    <div className="small muted" style={{ marginBottom: 4 }}>
                      Instructions
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#cdd9b0",
                        background: "rgba(217,255,74,0.06)",
                        border: "1px solid rgba(217,255,74,0.18)",
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.instruction}
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    href="/map"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--cyan)",
                    }}
                  >
                    Open map →
                  </a>
                  <a
                    href="/alerts"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--cyan)",
                    }}
                  >
                    All alerts →
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {home && etaStatus === "done" && items.some((i) => i.etaMin != null) && (
        <p className="small muted" style={{ marginTop: 10 }}>
          ETAs are approximate drive times from your home base (contiguous US).
        </p>
      )}
    </div>
  );
}
