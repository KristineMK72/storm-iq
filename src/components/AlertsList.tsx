import { useEffect, useState } from "react";

type Alert = {
  id: string;
  event: string;
  headline?: string;
  areaDesc?: string;
  severity?: string;
  urgency?: string;
  expires?: string;
};

export default function AlertsList() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState("all");

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

        const list: Alert[] = (data?.features || [])
          .map((f: any) => {
            const p = f.properties || {};
            return {
              id: f.id || crypto.randomUUID(),
              event: p.event || "Weather Alert",
              headline: p.headline,
              areaDesc: p.areaDesc,
              severity: p.severity,
              urgency: p.urgency,
              expires: p.expires,
            };
          })
          .filter((a: Alert) => !a.event.toLowerCase().includes("test"));

        // Prefer warnings first
        list.sort((a, b) => {
          const rank = (s?: string) =>
            s === "Extreme" ? 0 : s === "Severe" ? 1 : s === "Moderate" ? 2 : 3;
          return rank(a.severity) - rank(b.severity);
        });

        setAlerts(list);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }
    load();
  }, []);

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    const e = a.event.toLowerCase();
    if (filter === "warning") return e.includes("warning");
    if (filter === "watch") return e.includes("watch");
    if (filter === "tornado") return e.includes("tornado");
    if (filter === "tstm") return e.includes("thunderstorm");
    return true;
  });

  return (
    <div className="card">
      <div className="section-title">
        <h2>National NWS alerts</h2>
        <span className="small muted">
          {status === "loading"
            ? "LOADING…"
            : status === "error"
            ? "ERROR"
            : `${filtered.length} shown`}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["all", "All"],
          ["warning", "Warnings"],
          ["watch", "Watches"],
          ["tornado", "Tornado"],
          ["tstm", "Thunderstorm"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            style={{
              background:
                filter === id ? "rgba(217,255,74,0.14)" : "rgba(0,0,0,0.25)",
              border:
                filter === id
                  ? "1px solid rgba(217,255,74,0.4)"
                  : "1px solid var(--line)",
              color: filter === id ? "#d9ff4a" : "var(--muted)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {status === "loading" && <p className="muted">Loading live alerts…</p>}

      {status === "error" && (
        <div className="notice">
          Live NWS alerts could not be loaded. Try refreshing.
        </div>
      )}

      {status === "ready" && filtered.length === 0 && (
        <p className="muted">No alerts match this filter right now.</p>
      )}

      {filtered.slice(0, 40).map((alert) => (
        <div className="alert" key={alert.id}>
          <strong>{alert.event}</strong>
          <p>{alert.headline ?? alert.areaDesc ?? "Active National Weather Service alert."}</p>
          <div className="small muted" style={{ marginTop: 7 }}>
            {alert.areaDesc ?? ""}
            {alert.severity ? ` · ${alert.severity}` : ""}
            {alert.expires
              ? ` · expires ${new Date(alert.expires).toLocaleString()}`
              : ""}
          </div>
        </div>
      ))}
    </div>
  );
}
