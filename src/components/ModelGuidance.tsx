import { useEffect, useState } from "react";

export default function ModelGuidance() {
  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    async function load() {
      // Try a couple of endpoints / modes — SPC is occasionally flaky from browsers
      const urls = [
        "https://www.spc.noaa.gov/products/outlook/day1otlk.txt",
        "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
      ];

      for (const url of urls) {
        try {
          const res = await fetch(url, {
            mode: "cors",
            cache: "no-cache",
          });
          if (!res.ok) continue;

          let raw = await res.text();

          // If we got HTML, try to extract the preformatted product text
          if (url.endsWith(".html")) {
            const preMatch = raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            if (preMatch?.[1]) {
              raw = preMatch[1]
                .replace(/<[^>]+>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">");
            } else {
              continue;
            }
          }

          raw = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

          const idx = raw.search(/\.\.\.SUMMARY\.\.\./i);
          let text = idx >= 0 ? raw.slice(idx) : raw;

          if (text.length > 900) text = text.slice(0, 900) + "…";

          if (text.length > 40) {
            setSummary(text);
            setStatus("ready");
            return;
          }
        } catch {
          // try next url
        }
      }

      setStatus("error");
    }

    load();
  }, []);

  return (
    <div className="card">
      <div className="section-title">
        <div>
          <div className="eyebrow">Environment & models</div>
          <h2>Guidance snapshot</h2>
        </div>
        <span className="small muted">
          {status === "ready" ? "LIVE SPC" : status === "loading" ? "LOADING…" : "SPC LINK"}
        </span>
      </div>

      {status === "loading" && <p className="muted">Loading SPC summary…</p>}

      {status === "error" && (
        <div style={{ marginBottom: 14 }}>
          <p className="muted" style={{ marginBottom: 10 }}>
            Summary text couldn’t be loaded in-browser (SPC sometimes blocks
            direct fetches). Use the official product instead:
          </p>
          <a
            href="https://www.spc.noaa.gov/products/outlook/day1otlk.html"
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-block",
              background: "rgba(82,224,208,0.12)",
              border: "1px solid rgba(82,224,208,0.35)",
              color: "var(--cyan)",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              fontSize: 13,
              textDecoration: "none",
            }}
          >
            Open Day 1 discussion on SPC →
          </a>
        </div>
      )}

      {status === "ready" && summary && (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--muted)",
            margin: "8px 0 14px",
            maxHeight: 180,
            overflow: "auto",
            background: "rgba(0,0,0,0.22)",
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--line)",
          }}
        >
          {summary}
        </pre>
      )}

      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Model parameters (SPC Mesoanalysis)
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <a
          href="https://www.spc.noaa.gov/exper/mesoanalysis/new/viewsector.php?sector=19&parm=mlcape"
          target="_blank"
          rel="noopener"
          className="alert"
          style={{ textDecoration: "none", display: "block" }}
        >
          <strong>MLCAPE</strong>
          <p>Mixed-layer CAPE — instability</p>
        </a>

        <a
          href="https://www.spc.noaa.gov/exper/mesoanalysis/new/viewsector.php?sector=19&parm=shr6"
          target="_blank"
          rel="noopener"
          className="alert"
          style={{ textDecoration: "none", display: "block" }}
        >
          <strong>0-6 km Shear</strong>
          <p>Deep-layer shear for organized storms</p>
        </a>

        <a
          href="https://www.spc.noaa.gov/exper/mesoanalysis/new/viewsector.php?sector=19&parm=effsrh"
          target="_blank"
          rel="noopener"
          className="alert"
          style={{ textDecoration: "none", display: "block" }}
        >
          <strong>Effective SRH</strong>
          <p>Storm-relative helicity (tornado potential)</p>
        </a>

        <a
          href="https://www.spc.noaa.gov/exper/mesoanalysis/"
          target="_blank"
          rel="noopener"
          className="alert"
          style={{ textDecoration: "none", display: "block" }}
        >
          <strong>Full Mesoanalysis</strong>
          <p>All SPC environment fields →</p>
        </a>
      </div>

      <p className="small muted" style={{ marginTop: 14 }}>
        Full gridded CAPE/shear overlays need a model tile service.
        These links open the official SPC mesoanalysis for the current
        environment.
      </p>
    </div>
  );
}
