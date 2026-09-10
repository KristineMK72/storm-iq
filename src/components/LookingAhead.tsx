import { useEffect, useState } from "react";

type DayBlock = {
  label: string;
  summary: string;
  href: string;
};

function extractSummary(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  if (text.includes("<pre")) {
    const pre = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (pre?.[1]) {
      text = pre[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
    }
  }

  const sumIdx = text.search(/\.\.\.SUMMARY\.\.\./i);
  if (sumIdx >= 0) text = text.slice(sumIdx);

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const useful: string[] = [];

  for (const line of lines) {
    if (/^\.\.\./.test(line) && useful.length > 0) break;
    if (/^SPC |^NWS |^AC[0-9]|VALID |^DAY /.test(line)) continue;
    useful.push(line);
    if (useful.join(" ").length > 420) break;
  }

  let out = useful.join(" ").replace(/\s+/g, " ").trim();
  if (out.length > 480) out = out.slice(0, 480) + "…";
  return out || text.slice(0, 400) + "…";
}

async function fetchDay(txtUrl: string, htmlUrl: string): Promise<string | null> {
  for (const url of [txtUrl, htmlUrl]) {
    try {
      const res = await fetch(url, { mode: "cors", cache: "no-cache" });
      if (!res.ok) continue;
      const summary = extractSummary(await res.text());
      if (summary.length > 40) return summary;
    } catch {
      // try next
    }
  }
  return null;
}

export default function LookingAhead() {
  const [days, setDays] = useState<DayBlock[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    async function load() {
      const [d2, d3] = await Promise.all([
        fetchDay(
          "https://www.spc.noaa.gov/products/outlook/day2otlk.txt",
          "https://www.spc.noaa.gov/products/outlook/day2otlk.html"
        ),
        fetchDay(
          "https://www.spc.noaa.gov/products/outlook/day3otlk.txt",
          "https://www.spc.noaa.gov/products/outlook/day3otlk.html"
        ),
      ]);

      const blocks: DayBlock[] = [];

      if (d2) {
        blocks.push({
          label: "Day 2",
          summary: d2,
          href: "https://www.spc.noaa.gov/products/outlook/day2otlk.html",
        });
      }
      if (d3) {
        blocks.push({
          label: "Day 3",
          summary: d3,
          href: "https://www.spc.noaa.gov/products/outlook/day3otlk.html",
        });
      }

      blocks.push({
        label: "Day 4–8",
        summary:
          "Extended-range outlook for the rest of the week — check SPC for areas where severe storms may develop beyond Day 3.",
        href: "https://www.spc.noaa.gov/products/exper/day4-8/",
      });

      setDays(blocks);
      setStatus(d2 || d3 ? "ready" : "ready");
    }

    load();
  }, []);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Looking ahead</div>
          <h2>Things to watch</h2>
        </div>
        <span className="small muted">
          {status === "loading" ? "LOADING…" : "SPC"}
        </span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
        Upcoming convective windows from the Storm Prediction Center.
        Use these to plan multi-day chase potential.
      </p>

      {status === "loading" && (
        <p className="muted">Loading Day 2 / Day 3 outlooks…</p>
      )}

      {days.map((d) => (
        <div key={d.label} className="alert" style={{ marginBottom: 10 }}>
          <strong>{d.label}</strong>
          <p style={{ marginTop: 4 }}>{d.summary}</p>
          <a
            href={d.href}
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              marginTop: 6,
              fontSize: 12,
              color: "var(--cyan)",
              fontWeight: 600,
            }}
          >
            Full {d.label} outlook →
          </a>
        </div>
      ))}

      <p className="small muted" style={{ marginTop: 8 }}>
        Official NWS warnings always override outlook guidance.
      </p>
    </div>
  );
}
