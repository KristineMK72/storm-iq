import { useEffect, useState } from "react";

type BoardItem = {
  name: string;
  score: number;
  status: string;
  state: string;
  event: string;
};

function scoreFromAlert(event: string, severity?: string): number {
  const e = (event || "").toLowerCase();
  const s = (severity || "").toLowerCase();

  let base = 50;
  if (s === "extreme") base = 94;
  else if (s === "severe") base = 86;
  else if (s === "moderate") base = 72;
  else if (s === "minor") base = 58;

  if (e.includes("tornado")) base = Math.min(99, base + 8);
  else if (e.includes("severe thunderstorm")) base = Math.min(95, base + 4);
  else if (e.includes("flash flood")) base = Math.min(92, base + 2);

  return base;
}

function shortArea(areaDesc?: string): string {
  if (!areaDesc) return "Multiple areas";
  const first = areaDesc.split(";")[0]?.trim() || areaDesc;
  return first.length > 36 ? first.slice(0, 34) + "…" : first;
}

function guessState(areaDesc?: string): string {
  if (!areaDesc) return "—";
  // Very rough extraction of state abbreviation if present
  const match = areaDesc.match(/\b([A-Z]{2})\b/);
  return match ? match[1] : "US";
}

export default function TargetBoard() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");

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
          const event = p.event || "Weather Alert";
          const severity = p.severity || "Unknown";
          const score = scoreFromAlert(event, severity);

          // Only keep meaningful alerts
          if (score < 60) continue;

          let statusLabel = "WATCH";
          if (severity === "Extreme" || severity === "Severe") statusLabel = "WARNING";
          else if (event.toLowerCase().includes("watch")) statusLabel = "WATCH";
          else statusLabel = "ACTIVE";

          scored.push({
            name: shortArea(p.areaDesc),
            score,
            status: statusLabel,
            state: guessState(p.areaDesc),
            event,
          });
        }

        // Sort by score descending and take unique-ish top 5
        scored.sort((a, b) => b.score - a.score);

        const unique: BoardItem[] = [];
        const seen = new Set<string>();
        for (const item of scored) {
          const key = item.name.slice(0, 20);
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(item);
          if (unique.length >= 5) break;
        }

        setItems(unique);
        setStatus(unique.length > 0 ? "ready" : "empty");
      } catch {
        setStatus("error");
      }
    }
    load();
  }, []);

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <div className="eyebrow">National board</div>
          <h2>Top storm targets</h2>
        </div>
        <span className="small muted">
          {status === "ready" ? "LIVE NWS" : status === "loading" ? "LOADING…" : "LIVE"}
        </span>
      </div>

      {status === "loading" && (
        <p className="muted" style={{ marginTop: 12 }}>Loading live alerts…</p>
      )}

      {(status === "empty" || status === "error") && (
        <p className="muted" style={{ marginTop: 12 }}>
          No high-impact alerts at the moment.
        </p>
      )}

      {items.map((item, index) => (
        <div className="target-row" key={item.name + index}>
          <div className="rank">0{index + 1}</div>

          <div>
            <strong>{item.name}</strong>
            <div className="small muted">
              {item.state} · {item.event}
            </div>
          </div>

          <div
            className={`badge ${
              item.status === "WARNING" ? "warn" : ""
            }`}
          >
            {item.status}
          </div>

          <div className="score-num">{item.score}</div>
        </div>
      ))}
    </div>
  );
}
