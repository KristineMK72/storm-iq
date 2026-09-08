import { useEffect, useState } from "react";

type LiveTarget = {
  name: string;
  score: number;
  event: string;
  severity: string;
  urgency?: string;
  area: string;
  headline?: string;
};

function scoreFromAlert(event: string, severity?: string, urgency?: string): number {
  const e = (event || "").toLowerCase();
  const s = (severity || "").toLowerCase();
  const u = (urgency || "").toLowerCase();

  let base = 45;

  // Severity weight
  if (s === "extreme") base = 92;
  else if (s === "severe") base = 84;
  else if (s === "moderate") base = 70;
  else if (s === "minor") base = 58;

  // Event type boost
  if (e.includes("tornado")) base = Math.min(99, base + 10);
  else if (e.includes("severe thunderstorm")) base = Math.min(96, base + 6);
  else if (e.includes("flash flood")) base = Math.min(93, base + 4);
  else if (e.includes("hurricane") || e.includes("tropical")) base = Math.min(95, base + 5);

  // Urgency
  if (u === "immediate") base = Math.min(99, base + 3);
  else if (u === "expected") base = Math.min(97, base + 1);

  return Math.round(base);
}

function shortArea(areaDesc?: string): string {
  if (!areaDesc) return "Multiple areas";
  const first = areaDesc.split(";")[0]?.trim() || areaDesc;
  return first.length > 42 ? first.slice(0, 40) + "…" : first;
}

export default function ChaseScore() {
  const [target, setTarget] = useState<LiveTarget | null>(null);
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

        let best: LiveTarget | null = null;
        let bestScore = 0;

        for (const f of features) {
          const p = f.properties ?? {};
          if ((p.event || "").toLowerCase().includes("test") || p.status === "Test") continue;

          const event = p.event || "Weather Alert";
          const severity = p.severity || "Unknown";
          const score = scoreFromAlert(event, severity, p.urgency);

          if (score > bestScore) {
            bestScore = score;
            best = {
              name: shortArea(p.areaDesc),
              score,
              event,
              severity,
              urgency: p.urgency,
              area: p.areaDesc || "",
              headline: p.headline,
            };
          }
        }

        if (best) {
          setTarget(best);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      } catch {
        setStatus("error");
      }
    }
    load();
  }, []);

  if (status === "loading") {
    return (
      <div className="card target-card">
        <div className="eyebrow">Primary target</div>
        <div className="target-name" style={{ opacity: 0.5 }}>Loading live data…</div>
      </div>
    );
  }

  if (status === "error" || status === "empty" || !target) {
    return (
      <div className="card target-card">
        <div className="eyebrow">Primary target · LIVE</div>
        <div className="target-name">No high-impact alerts</div>
        <div className="target-meta">All clear or data unavailable · check SPC outlook</div>
        <div className="score-wrap">
          <div className="score">
            <b>—</b>
            <small>Chase Score</small>
          </div>
        </div>
      </div>
    );
  }

  const metrics = [
    ["Severity", target.severity === "Extreme" ? 98 : target.severity === "Severe" ? 88 : 68],
    ["Event type", target.event.toLowerCase().includes("tornado") ? 96 : 78],
    ["Urgency", target.urgency === "Immediate" ? 92 : 75],
    ["Coverage", 72],
  ];

  return (
    <div className="card target-card">
      <div className="eyebrow">Primary target · LIVE</div>

      <div className="target-name">{target.name}</div>

      <div className="target-meta">
        {target.event} · {target.severity.toUpperCase()} · VERIFY OFFICIAL WARNINGS
      </div>

      <div className="score-wrap">
        <div className="score">
          <b>{target.score}</b>
          <small>Chase Score</small>
        </div>

        <div className="metric-list">
          {metrics.map(([label, value]) => (
            <div className="metric" key={label as string}>
              <label>{label}</label>
              <div className="bar">
                <i style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="kpis" style={{ marginTop: 22 }}>
        <div className="kpi">
          <span>Event</span>
          <b style={{ fontSize: 15 }}>
            {target.event.replace(" Warning", "").replace(" Watch", "")}
          </b>
        </div>
        <div className="kpi">
          <span>Severity</span>
          <b style={{ fontSize: 15 }}>{target.severity}</b>
        </div>
        <div className="kpi">
          <span>Urgency</span>
          <b style={{ fontSize: 15 }}>{target.urgency || "—"}</b>
        </div>
        <div className="kpi">
          <span>Source</span>
          <b style={{ fontSize: 15 }}>NWS</b>
        </div>
      </div>
    </div>
  );
}
