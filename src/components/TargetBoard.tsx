import { useEffect, useState } from "react";

type BoardItem = {
  name: string;
  score: number;
  status: string;
  state: string;
  event: string;
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
          if ((p.event || "").toLowerCase().includes("test") || p.status === "Test") continue;

          const event = p.event || "Weather Alert";
          const severity = p.severity || "Unknown";
          const score = scoreFromAlert(event, severity, p.urgency);
          if (score < 62) continue;

          let statusLabel = "ACTIVE";
          if (severity === "Extreme" || severity === "Severe") statusLabel = "WARNING";
          else if (event.toLowerCase().includes("watch")) statusLabel = "WATCH";

          scored.push({
            name: shortArea(p.areaDesc),
            score,
            status: statusLabel,
            state: guessState(p.areaDesc),
            event,
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
            </div>
          </div>
          <div className={`badge ${item.status === "WARNING" ? "warn" : ""}`}>
            {item.status}
          </div>
          <div className="score-num">{item.score}</div>
        </div>
      ))}
    </div>
  );
}
