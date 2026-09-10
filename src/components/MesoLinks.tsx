import { useEffect, useState } from "react";

type MdItem = {
  id: string;
  title: string;
  href: string;
};

export default function MesoLinks() {
  const [items, setItems] = useState<MdItem[]>([]);
  const [status, setStatus] = useState("Loading MDs…");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Official MD index — parse lightweight links from HTML
        const res = await fetch("https://www.spc.noaa.gov/products/md/", {
          mode: "cors",
          cache: "no-cache",
        });
        if (!res.ok) throw new Error("fail");
        const html = await res.text();

        const found: MdItem[] = [];
        const re = /href="(\/products\/md\/md\d{4}_\d{4}\.html)"[^>]*>([^<]+)</gi;
        let m: RegExpExecArray | null;
        while ((m = re.exec(html)) && found.length < 8) {
          const path = m[1];
          const title = m[2].replace(/\s+/g, " ").trim();
          if (!title || title.length < 4) continue;
          found.push({
            id: path,
            title: title.slice(0, 90),
            href: `https://www.spc.noaa.gov${path}`,
          });
        }

        // Fallback: known product pages if parse empty
        if (!found.length) {
          found.push(
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
              title: "SPC mesoanalysis (regional sectors)",
              href: "https://www.spc.noaa.gov/exper/mesoanalysis/",
            }
          );
        }

        if (!cancelled) {
          setItems(found);
          setStatus(found.length ? `${found.length} links` : "Index");
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
        One-tap official SPC mesoscale discussions and outlook text — use these when
        a target lights up and you need the full story.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <a
            key={it.id}
            href={it.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "rgba(0,0,0,0.22)",
              fontSize: 13,
              lineHeight: 1.4,
              color: "var(--cyan)",
              fontWeight: 600,
            }}
          >
            {it.title} →
          </a>
        ))}
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
