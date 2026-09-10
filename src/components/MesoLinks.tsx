import { useEffect, useState } from "react";

type MdItem = {
  id: string;
  title: string;
  href: string;
};

async function fetchMdBody(href: string): Promise<string> {
  const res = await fetch(href, { mode: "cors", cache: "no-cache" });
  if (!res.ok) throw new Error("MD fetch failed");
  const html = await res.text();
  const pre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (pre?.[1]) {
    return pre[1]
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\r/g, "")
      .trim();
  }
  // fallback: strip tags roughly
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 4000) || "Could not parse discussion text.";
}

export default function MesoLinks() {
  const [items, setItems] = useState<MdItem[]>([]);
  const [status, setStatus] = useState("Loading MDs…");
  const [openId, setOpenId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [bodyStatus, setBodyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("https://www.spc.noaa.gov/products/md/", {
          mode: "cors",
          cache: "no-cache",
        });
        if (!res.ok) throw new Error("fail");
        const html = await res.text();

        const found: MdItem[] = [];
        const re = /href="(\/products\/md\/md\d+(?:_\d+)?\.html)"[^>]*>([^<]+)</gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) && found.length < 8) {
          const path = m[1];
          const title = m[2].replace(/\s+/g, " ").trim();
          if (!title || title.length < 4) continue;
          found.push({
            id: path,
            title: title.slice(0, 100),
            href: `https://www.spc.noaa.gov${path}`,
          });
        }

        if (!found.length) {
          found.push(
            {
              id: "md-index",
              title: "Current mesoscale discussions (SPC index)",
              href: "https://www.spc.noaa.gov/products/md/",
            },
            {
              id: "day1",
              title: "Day 1 convective outlook discussion",
              href: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
            },
            {
              id: "meso",
              title: "SPC mesoanalysis (regional sectors)",
              href: "https://www.spc.noaa.gov/exper/mesoanalysis/",
            }
          );
        }

        if (!cancelled) {
          setItems(found);
          setStatus(found.length ? `${found.length} products` : "Index");
        }
      } catch {
        if (!cancelled) {
          setItems([
            {
              id: "md-index",
              title: "Current mesoscale discussions (SPC)",
              href: "https://www.spc.noaa.gov/products/md/",
            },
            {
              id: "day1",
              title: "Day 1 convective outlook discussion",
              href: "https://www.spc.noaa.gov/products/outlook/day1otlk.html",
            },
            {
              id: "meso",
              title: "SPC mesoanalysis",
              href: "https://www.spc.noaa.gov/exper/mesoanalysis/",
            },
          ]);
          setStatus("Direct SPC links");
        }
      }
    }

    load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function togglePreview(item: MdItem) {
    if (openId === item.id) {
      setOpenId(null);
      setBody("");
      setBodyStatus("idle");
      return;
    }
    setOpenId(item.id);
    setBody("");
    setBodyStatus("loading");
    try {
      const text = await fetchMdBody(item.href);
      setBody(text);
      setBodyStatus("ready");
    } catch {
      setBody(
        "Could not load full text in-app (network or CORS). Use Open on SPC for the official product."
      );
      setBodyStatus("error");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">SPC products</div>
          <h2>Meso &amp; discussion links</h2>
        </div>
        <span className="small muted">{status}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Tap a product to preview the official text here. Full product always available on SPC.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => {
          const open = openId === it.id;
          return (
            <div key={it.id}>
              <button
                type="button"
                onClick={() => togglePreview(it)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: open
                    ? "1px solid rgba(217,255,74,0.4)"
                    : "1px solid var(--line)",
                  background: open ? "rgba(217,255,74,0.06)" : "rgba(0,0,0,0.22)",
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: "var(--cyan)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {it.title} {open ? "· hide" : "· preview"}
              </button>

              {open && (
                <div
                  style={{
                    marginTop: 6,
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid var(--line)",
                    background: "rgba(0,0,0,0.35)",
                  }}
                >
                  {bodyStatus === "loading" && (
                    <p className="small muted">Loading discussion…</p>
                  )}
                  {(bodyStatus === "ready" || bodyStatus === "error") && (
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        fontSize: 11,
                        lineHeight: 1.45,
                        color: bodyStatus === "error" ? "#ffd166" : "var(--muted)",
                        margin: 0,
                        maxHeight: 320,
                        overflow: "auto",
                      }}
                    >
                      {body}
                    </pre>
                  )}
                  <a
                    href={it.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--lime)",
                    }}
                  >
                    Open on SPC →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
        <a
          href="https://www.spc.noaa.gov/products/md/"
          target="_blank"
          rel="noopener noreferrer"
          className="small"
          style={{ color: "var(--lime)", fontWeight: 700 }}
        >
          All MDs →
        </a>
        <a
          href="https://www.spc.noaa.gov/exper/mesoanalysis/"
          target="_blank"
          rel="noopener noreferrer"
          className="small"
          style={{ color: "var(--lime)", fontWeight: 700 }}
        >
          Mesoanalysis →
        </a>
        <a
          href="https://www.spc.noaa.gov/products/outlook/day1otlk.html"
          target="_blank"
          rel="noopener noreferrer"
          className="small"
          style={{ color: "var(--lime)", fontWeight: 700 }}
        >
          Day 1 discussion →
        </a>
      </div>
    </div>
  );
}
