import { useEffect, useState } from "react";

type Block = {
  key: string;
  label: string;
  window: string;
  summary: string;
  href: string;
};

function extractSummary(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const sumIdx = text.search(/\.\.\.SUMMARY\.\.\./i);
  if (sumIdx >= 0) text = text.slice(sumIdx);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const useful: string[] = [];
  for (const line of lines) {
    if (/^\.\.\./.test(line) && useful.length > 0) break;
    if (/^SPC |^NWS |^AC[0-9]|VALID |^DAY /.test(line)) continue;
    useful.push(line);
    if (useful.join(" ").length > 520) break;
  }

  let out = useful.join(" ").replace(/\s+/g, " ").trim();
  if (out.length > 560) out = out.slice(0, 560) + "…";
  return out || text.slice(0, 420) + "…";
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-cache" });
    if (!res.ok) return null;
    return extractSummary(await res.text());
  } catch {
    return null;
  }
}

export default function UpcomingPotential() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    async function load() {
      const [d1, d2, d3] = await Promise.all([
        fetchText("https://www.spc.noaa.gov/products/outlook/day1otlk.txt"),
        fetchText("https://www.spc.noaa.gov/products/outlook/day2otlk.txt"),
        fetchText("https://www.spc.noaa.gov/products/outlook/day3otlk.txt"),
      ]);

      const next: Block[] = [];

      if (d1) {
        next.push({
          key: "d1",
          label: "Today / tonight",
          window: "Day 1",
          summary: d1,
          href: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
        });
      }
      if (d2) {
        next.push({
          key: "d2",
          label: "Tomorrow",
          window: "Day 2",
          summary: d2,
          href: "https://www.spc.noaa.gov/products/outlook/day2otlk.html",
        });
      }
      if (d3) {
        next.push({
          key: "d3",
          label: "Day after",
          window: "Day 3",
          summary: d3,
          href: "https://www.spc.noaa.gov/products/outlook/day3otlk.html",
        });
      }

      next.push({
        key: "d48",
        label: "Rest of the week",
        window: "Day 4–8",
        summary:
          "Extended-range outlook for days 4 through 8. Use this to spot multi-day chase windows and larger-scale pattern threats beyond the short-term outlooks.",
        href: "https://www.spc.noaa.gov/products/exper/day4-8/",
      });

      setBlocks(next);
      setStatus("ready");
    }
    load();
  }, []);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Forecast horizon</div>
          <h2>Upcoming potential</h2>
        </div>
        <span className="small muted">{status === "loading" ? "LOADING…" : "SPC"}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
        What the Storm Prediction Center is highlighting for the next several
        days — useful for planning travel and watch windows.
      </p>

      {status === "loading" && <p className="muted">Loading outlook summaries…</p>}

      <div className="grid" style={{ gap: 12 }}>
        {blocks.map((b) => (
          <div
            key={b.key}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "14px 16px",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: 15 }}>{b.label}</strong>
              <span className="small muted">{b.window}</span>
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: 13,
                lineHeight: 1.55,
              }}
            >
              {b.summary}
            </p>
            <a
              href={b.href}
              target="_blank"
              rel="noopener"
              style={{
                display: "inline-block",
                marginTop: 10,
                fontSize: 12,
                fontWeight: 700,
                color: "var(--cyan)",
              }}
            >
              Full {b.window} product →
            </a>
          </div>
        ))}
      </div>

      <p className="small muted" style={{ marginTop: 12 }}>
        Outlooks are not warnings. When a watch or warning is issued, treat that
        as the controlling guidance.
      </p>
    </div>
  );
}
