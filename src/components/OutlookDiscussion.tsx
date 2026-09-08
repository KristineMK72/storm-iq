import { useEffect, useState } from "react";

type DayKey = "day1" | "day2" | "day3" | "day48";

const SOURCES: Record<DayKey, { label: string; url: string; isText: boolean }> = {
  day1: {
    label: "Day 1",
    url: "https://www.spc.noaa.gov/products/outlook/day1otlk.txt",
    isText: true,
  },
  day2: {
    label: "Day 2",
    url: "https://www.spc.noaa.gov/products/outlook/day2otlk.txt",
    isText: true,
  },
  day3: {
    label: "Day 3",
    url: "https://www.spc.noaa.gov/products/outlook/day3otlk.txt",
    isText: true,
  },
  day48: {
    label: "Day 4–8",
    url: "https://www.spc.noaa.gov/products/exper/day4-8/",
    isText: false,
  },
};

function cleanDiscussion(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const summaryIdx = text.search(/\.\.\.SUMMARY\.\.\./i);
  const discussionIdx = text.search(/\.\.\.DISCUSSION\.\.\./i);

  if (summaryIdx >= 0) text = text.slice(summaryIdx);
  else if (discussionIdx >= 0) text = text.slice(discussionIdx);

  if (text.length > 3200) text = text.slice(0, 3200) + "\n\n… (full text on SPC)";
  return text;
}

export default function OutlookDiscussion() {
  const [active, setActive] = useState<DayKey>("day1");
  const [cache, setCache] = useState<Partial<Record<DayKey, string>>>( {} );
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load(day: DayKey) {
      if (cache[day]) {
        setStatus("ready");
        return;
      }

      const src = SOURCES[day];
      if (!src.isText) {
        setStatus("ready");
        return;
      }

      setStatus("loading");
      try {
        const res = await fetch(src.url, {
          headers: { "User-Agent": "StormIQ (https://storm-iq.vercel.app)" },
        });
        if (!res.ok) throw new Error("Failed");
        const raw = await res.text();
        if (cancelled) return;
        setCache((prev) => ({ ...prev, [day]: cleanDiscussion(raw) }));
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load(active);
    return () => {
      cancelled = true;
    };
  }, [active]);

  const tabs: DayKey[] = ["day1", "day2", "day3", "day48"];

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Look-ahead · this week</div>
          <h2>SPC extended discussion</h2>
        </div>
        <span className="small muted">
          {status === "ready" ? "LIVE" : status === "loading" ? "LOADING…" : "UNAVAILABLE"}
        </span>
      </div>

      {/* Day tabs */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            style={{
              background:
                active === key ? "rgba(217,255,74,0.16)" : "rgba(0,0,0,0.25)",
              border:
                active === key
                  ? "1px solid rgba(217,255,74,0.45)"
                  : "1px solid var(--line)",
              color: active === key ? "#d9ff4a" : "var(--muted)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.03em",
            }}
          >
            {SOURCES[key].label}
          </button>
        ))}
      </div>

      {active === "day48" ? (
        <div>
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 12 }}>
            The Day 4–8 outlook covers the rest of the week and highlights
            areas where severe storms are possible beyond Day 3. SPC issues
            this as a probabilistic / narrative product.
          </p>
          <a
            href="https://www.spc.noaa.gov/products/exper/day4-8/"
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              background: "rgba(217,255,74,0.12)",
              border: "1px solid rgba(217,255,74,0.35)",
              color: "#d9ff4a",
              borderRadius: 8,
              padding: "10px 14px",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Open full Day 4–8 outlook on SPC →
          </a>
          <p className="small muted" style={{ marginTop: 14 }}>
            Use this together with Day 1–3 to plan multi-day chase windows.
          </p>
        </div>
      ) : (
        <>
          {status === "loading" && (
            <p className="muted">Loading {SOURCES[active].label} discussion…</p>
          )}

          {status === "error" && (
            <p className="muted">
              Could not load discussion.{" "}
              <a
                href={SOURCES[active].url.replace(".txt", ".html")}
                target="_blank"
                rel="noopener"
                style={{ color: "var(--cyan)" }}
              >
                View on SPC →
              </a>
            </p>
          )}

          {status === "ready" && cache[active] && (
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 12,
                lineHeight: 1.55,
                color: "var(--muted)",
                margin: 0,
                maxHeight: 440,
                overflow: "auto",
                background: "rgba(0,0,0,0.25)",
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--line)",
              }}
            >
              {cache[active]}
            </pre>
          )}

          <p className="small muted" style={{ marginTop: 12 }}>
            Source:{" "}
            <a
              href={
                active === "day1"
                  ? "https://www.spc.noaa.gov/products/outlook/day1otlk.html"
                  : active === "day2"
                  ? "https://www.spc.noaa.gov/products/outlook/day2otlk.html"
                  : "https://www.spc.noaa.gov/products/outlook/day3otlk.html"
              }
              target="_blank"
              rel="noopener"
              style={{ color: "var(--cyan)" }}
            >
              Storm Prediction Center – full {SOURCES[active].label} outlook
            </a>
          </p>
        </>
      )}
    </div>
  );
}
