import { useEffect, useState } from "react";

type Mode = "loading" | "quiet" | "active" | "error";

export default function QuietDay() {
  const [mode, setMode] = useState<Mode>("loading");
  const [detail, setDetail] = useState("");

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

        let tor = 0,
          svr = 0,
          ffw = 0;
        for (const f of data?.features || []) {
          const e = (f.properties?.event || "").toLowerCase();
          if (e.includes("test")) continue;
          if (e.includes("tornado warning")) tor++;
          else if (e.includes("severe thunderstorm warning")) svr++;
          else if (e.includes("flash flood warning")) ffw++;
        }

        const hot = tor + svr + ffw;
        if (!cancelled) {
          if (hot === 0) {
            setMode("quiet");
            setDetail("No TOR / SVR / FFW warnings active — planning mode on.");
            try {
              localStorage.setItem("stormiq-quiet-day", "1");
              window.dispatchEvent(new CustomEvent("stormiq-quiet-day", { detail: true }));
            } catch {
              // ignore
            }
          } else {
            setMode("active");
            setDetail(`${tor} TOR · ${svr} SVR · ${ffw} FFW — operations mode.`);
            try {
              localStorage.setItem("stormiq-quiet-day", "0");
              window.dispatchEvent(new CustomEvent("stormiq-quiet-day", { detail: false }));
            } catch {
              // ignore
            }
          }
        }
      } catch {
        if (!cancelled) {
          setMode("error");
          setDetail("Could not assess quiet-day status.");
        }
      }
    }

    load();
    const id = window.setInterval(load, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (mode === "loading" || mode === "active") return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 18,
        borderColor: "rgba(82,224,208,0.35)",
        background: "linear-gradient(145deg, rgba(12,28,32,0.98), rgba(8,15,18,0.98))",
      }}
    >
      <div className="section-title">
        <div>
          <div className="eyebrow">Quiet day</div>
          <h2>Planning mode</h2>
        </div>
        <span className="small muted">AUTO</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        {detail} Use this window to study outlooks and recent reports — not a free pass to ignore
        watches that may still be up.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <a
          href="/map"
          className="chase-btn"
          style={{ textDecoration: "none", display: "inline-block" }}
          onClick={() => {
            try {
              localStorage.setItem("stormiq-prefer-yesterday", "1");
            } catch {
              // ignore
            }
          }}
        >
          MAP · YESTERDAY REPORTS
        </a>
        <a
          href="#future-targets"
          className="chase-btn"
          style={{
            textDecoration: "none",
            display: "inline-block",
            background: "rgba(82,224,208,0.1)",
            borderColor: "rgba(82,224,208,0.35)",
            color: "var(--cyan)",
          }}
        >
          DAY 2 / 3 OUTLOOKS
        </a>
        <a
          href="https://www.spc.noaa.gov/products/outlook/day2otlk.html"
          target="_blank"
          rel="noopener noreferrer"
          className="chase-btn"
          style={{
            textDecoration: "none",
            display: "inline-block",
            background: "transparent",
            borderColor: "var(--line)",
            color: "var(--muted)",
          }}
        >
          SPC DAY 2 →
        </a>
      </div>
    </div>
  );
}
