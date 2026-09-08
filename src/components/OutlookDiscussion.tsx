import { useEffect, useState } from "react";

export default function OutlookDiscussion() {
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          "https://www.spc.noaa.gov/products/outlook/day1otlk.txt",
          { headers: { "User-Agent": "StormIQ (https://storm-iq.vercel.app)" } }
        );
        if (!res.ok) throw new Error("Failed to load SPC discussion");

        let raw = await res.text();

        // Clean up the raw product a bit for readability
        raw = raw
          .replace(/\r\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        // Try to start from the summary / main discussion if possible
        const summaryIdx = raw.search(/\.\.\.SUMMARY\.\.\./i);
        const discussionIdx = raw.search(/\.\.\.DISCUSSION\.\.\./i);

        let display = raw;
        if (summaryIdx >= 0) {
          display = raw.slice(summaryIdx);
        } else if (discussionIdx >= 0) {
          display = raw.slice(discussionIdx);
        }

        // Keep it to a reasonable length for the UI
        if (display.length > 2800) {
          display = display.slice(0, 2800) + "\n\n… (full discussion on SPC)";
        }

        setText(display);
        setStatus("ready");
      } catch (e) {
        console.error(e);
        setStatus("error");
      }
    }
    load();
  }, []);

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Look-ahead</div>
          <h2>SPC Day 1 Discussion</h2>
        </div>
        <span className="small muted">
          {status === "ready" ? "LIVE" : status === "loading" ? "LOADING…" : "UNAVAILABLE"}
        </span>
      </div>

      {status === "loading" && (
        <p className="muted">Loading official SPC discussion…</p>
      )}

      {status === "error" && (
        <p className="muted">
          Could not load the discussion.{" "}
          <a
            href="https://www.spc.noaa.gov/products/outlook/"
            target="_blank"
            rel="noopener"
            style={{ color: "var(--cyan)" }}
          >
            View on SPC →
          </a>
        </p>
      )}

      {status === "ready" && text && (
        <>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--muted)",
              margin: "12px 0 0",
              maxHeight: 420,
              overflow: "auto",
              background: "rgba(0,0,0,0.25)",
              padding: 14,
              borderRadius: 10,
              border: "1px solid var(--line)",
            }}
          >
            {text}
          </pre>

          <p className="small muted" style={{ marginTop: 12 }}>
            Source:{" "}
            <a
              href="https://www.spc.noaa.gov/products/outlook/day1otlk.html"
              target="_blank"
              rel="noopener"
              style={{ color: "var(--cyan)" }}
            >
              Storm Prediction Center – full Day 1 outlook
            </a>
          </p>
        </>
      )}
    </div>
  );
}
