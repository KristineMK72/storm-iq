import { useEffect, useState } from "react";
import {
  estimateDriveMinutes,
  formatDuration,
  loadHomeBase,
  type HomeBase,
} from "../lib/homeBase";

type BoardItem = {
  name: string;
  score: number;
  status: string;
  state: string;
  event: string;
  lat?: number;
  lng?: number;
  etaMin?: number;
  etaMiles?: number;
};

function scoreFromAlert(event: string, severity?: string, urgency?: string): number {
  const e = (event || "").toLowerCase();
  const s = (severity || "").toLowerCase();
  const u = (urgency || "").toLowerCase();

  let base = 45;
  if (s === "extreme") base = 92;
  else if (s === "severe") base = 84;
  else if (s === "moderate") base = 70;
  else if (s === "minor") base = 58;

  if (e.includes("tornado")) base = Math.min(99, base + 10);
  else if (e.includes("severe thunderstorm")) base = Math.min(96, base + 6);
  else if (e.includes("flash flood")) base = Math.min(93, base + 4);

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

export default function TargetBoard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [home, setHome] = useState<HomeBase | null>(null);

  useEffect(() => {
    setHome(loadHomeBase());
    const onUpdate = () => setHome(loadHomeBase());
    window.addEventListener("stormiq-home-updated", onUpdate);
    return () => window.removeEventListener("stormiq-home-updated", onUpdate);
  }, []);

  useEffect(() => {
    async function load() {
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
          if (score < 62) continue;

          let statusLabel = "ACTIVE";
          if (severity === "Extreme" || severity === "Severe") statusLabel = "WARNING";
          else if (event.toLowerCase().includes("watch")) statusLabel = "WATCH";

          const center = getCentroid(f.geometry);

          scored.push({
            name: shortArea(p.areaDesc),
            score,
            status: statusLabel,
            state: guessState(p.areaDesc),
            event,
            lat: center?.[0],
            lng: center?.[1],
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
          if (unique.length >= 5) break;
        }

        // Attach ETAs if home base is set
        const currentHome = loadHomeBase();
        if (currentHome) {
          await Promise.all(
            unique.map(async (item) => {
              if (item.lat == null || item.lng == null) return;
              const eta = await estimateDriveMinutes(currentHome, {
                lat: item.lat,
                lng: item.lng,
              });
              item.etaMin = eta.minutes;
              item.etaMiles = eta.miles;
            })
          );
        }

        setItems([...unique]);
        setStatus(unique.length > 0 ? "ready" : "empty");
      } catch {
        setStatus("error");
      }
    }
    load();
  }, [home]);

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <div className="eyebrow">National board</div>
          <h2>Top storm targets</h2>
        </div>
        <span className="small muted">
          {status === "ready" ? (home ? "LIVE + ETA" : "LIVE NWS") : status === "loading" ? "LOADING…" : "LIVE"}
        </span>
      </div>

      {status === "loading" && (
        <p className="muted" style={{ marginTop: 12 }}>Loading live alerts…</p>
      )}

      {(status === "empty" || status === "error") && (
        <p className="muted" style={{ marginTop: 12 }}>
          No high-impact alerts at the moment. Check the map for SPC outlook.
        </p>
      )}

      {items.map((item, index) => (
        <div className="target-row" key={item.name + index}>
          <div className="rank">0{index + 1}</div>
          <div>
            <strong>{item.name}</strong>
            <div className="small muted">
              {item.state} · {item.event}
              {item.etaMin != null && (
                <> · ~{formatDuration(item.etaMin)} · {item.etaMiles} mi</>
              )}
            </div>
          </div>
          <div className={`badge ${item.status === "WARNING" ? "warn" : ""}`}>
            {item.status}
          </div>
          <div className="score-num">{item.score}</div>
        </div>
      ))}

      {home && items.some((i) => i.etaMin != null) && (
        <p className="small muted" style={{ marginTop: 10 }}>
          ETAs are driving estimates from your home base (OSRM / distance).
        </p>
      )}
    </div>
  );
}
