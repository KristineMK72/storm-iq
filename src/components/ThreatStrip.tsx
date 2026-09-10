import { useEffect, useState } from "react";

type Counts = {
  tor: number;
  svr: number;
  ffw: number;
  watches: number;
  other: number;
};

export default function ThreatStrip() {
  const [c, setC] = useState<Counts | null>(null);
  const [err, setErr] = useState(false);

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
        const next: Counts = { tor: 0, svr: 0, ffw: 0, watches: 0, other: 0 };

        for (const f of data?.features || []) {
          const p = f.properties || {};
          const e = (p.event || "").toLowerCase();
          if (e.includes("test") || p.status === "Test") continue;
          if (e.includes("tornado warning")) next.tor++;
          else if (e.includes("severe thunderstorm warning")) next.svr++;
          else if (e.includes("flash flood warning")) next.ffw++;
          else if (e.includes("watch")) next.watches++;
          else if (e.includes("warning")) next.other++;
        }

        if (!cancelled) {
          setC(next);
          setErr(false);
        }
      } catch {
        if (!cancelled) setErr(true);
      }
    }

    load();
    const id = window.setInterval(load, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const chip = (label: string, n: number, color: string) => (
    <div
      style={{
        flex: "1 1 70px",
        minWidth: 70,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${color}44`,
        background: `${color}14`,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "Barlow Condensed, sans-serif" }}>
        {c ? n : "—"}
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", color: "var(--muted)" }}>
        {label}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">National pulse</div>
          <h2>Active warning counts</h2>
        </div>
        <span className="small muted">{err ? "RETRY" : "LIVE NWS"}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chip("TOR", c?.tor ?? 0, "#ff5c5c")}
        {chip("SVR", c?.svr ?? 0, "#ff9f43")}
        {chip("FFW", c?.ffw ?? 0, "#52e0d0")}
        {chip("WATCH", c?.watches ?? 0, "#ffd166")}
        {chip("OTHER", c?.other ?? 0, "#8fa6a8")}
      </div>

      <p className="small muted" style={{ marginTop: 10 }}>
        Contiguous-US focused counts refresh about every 90s. Official NWS products always win.
      </p>
    </div>
  );
}
