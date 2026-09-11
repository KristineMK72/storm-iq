import { useEffect, useState } from "react";

type WindowItem = {
  id: string;
  event: string;
  area: string;
  onset: Date | null;
  expires: Date | null;
  kind: "watch" | "warning" | "other";
  severity?: string;
};

type TimingState = {
  status: "loading" | "ready" | "error";
  posture: string;
  postureDetail: string;
  spcValid: string;
  spcSummary: string;
  cues: string[];
  windows: WindowItem[];
  nowLabel: string;
};

function parseIso(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtLocal(d: Date | null): string {
  if (!d) return "-";
  try {
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toISOString();
  }
}

function minsUntil(d: Date | null, now: Date): number | null {
  if (!d) return null;
  return Math.round((d.getTime() - now.getTime()) / 60000);
}

function formatRemaining(mins: number | null): string {
  if (mins == null) return "";
  if (mins <= 0) return "ended / ending";
  if (mins < 60) return mins + "m left";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? h + "h " + m + "m left" : h + "h left";
}

function parseSpcValid(text: string): string {
  const m = text.match(/Valid\s+(\d{6})Z\s*-\s*(\d{6})Z/i);
  if (!m) return "Day 1 period (see SPC)";
  return "Valid " + m[1] + "Z - " + m[2] + "Z";
}

function extractSummary(text: string): string {
  const m = text.match(/\.\.\.SUMMARY\.\.\.\s*([\s\S]*?)(?:\n\s*\n|\.\.\.[A-Z])/i);
  if (m && m[1]) return m[1].replace(/\s+/g, " ").trim().slice(0, 320);
  return "";
}

function extractTimingCues(text: string): string[] {
  const cues: string[] = [];
  const patterns = [
    /\b(late this afternoon(?: into tonight)?|this afternoon into the evening|this evening|overnight|through tonight|by mid\/?afternoon|toward evening)\b/gi,
    /\b(\d{2}-\d{2}Z|\d{2}Z)\b[^.\n]{0,80}/g,
    /\b(initiation|develop(?:ment)?|expected to|timing)[^.\n]{10,100}/gi,
  ];
  const seen = new Set<string>();
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(text)) && cues.length < 6) {
      const line = m[0].replace(/\s+/g, " ").trim();
      if (line.length < 12) continue;
      const key = line.toLowerCase().slice(0, 48);
      if (seen.has(key)) continue;
      seen.add(key);
      cues.push(line.slice(0, 140));
    }
  }
  return cues;
}

function computePosture(
  now: Date,
  windows: WindowItem[],
  cues: string[]
): { posture: string; detail: string } {
  const warnings = windows.filter((w) => w.kind === "warning");
  const watches = windows.filter((w) => w.kind === "watch");
  const liveWarnings = warnings.filter(
    (w) => w.expires && w.expires.getTime() > now.getTime()
  );
  const upcomingWatches = watches.filter(
    (w) => w.onset && w.onset.getTime() > now.getTime()
  );
  const activeWatches = watches.filter((w) => {
    const started = !w.onset || w.onset.getTime() <= now.getTime();
    const open = !w.expires || w.expires.getTime() > now.getTime();
    return started && open;
  });

  if (liveWarnings.length > 0) {
    return {
      posture: "IN WINDOW - WARNINGS",
      detail:
        liveWarnings.length +
        " active warning(s) - priority is official NWS guidance and safety.",
    };
  }
  if (activeWatches.length > 0) {
    return {
      posture: "IN WINDOW - WATCHES",
      detail:
        activeWatches.length +
        " watch(es) in effect - favored period is underway; stay flexible.",
    };
  }
  if (upcomingWatches.length > 0) {
    const next = upcomingWatches
      .slice()
      .sort((a, b) => a.onset!.getTime() - b.onset!.getTime())[0];
    const mins = minsUntil(next.onset, now);
    return {
      posture: "STAGING",
      detail:
        "Next watch onset ~" +
        fmtLocal(next.onset) +
        " (" +
        formatRemaining(mins) +
        "). Use this time for positioning - not core penetration.",
    };
  }
  if (cues.some((c) => /afternoon|evening|tonight|22-|00Z|01Z/i.test(c))) {
    return {
      posture: "PLANNING - DAY 1 SIGNAL",
      detail:
        "SPC discussion suggests later timing. Watches may still be issued - keep checking.",
    };
  }
  return {
    posture: "MONITOR",
    detail:
      "No severe watches/warnings in the timing board right now. Outlook may still evolve.",
  };
}

export default function ChaseTiming() {
  const [state, setState] = useState<TimingState>({
    status: "loading",
    posture: "...",
    postureDetail: "",
    spcValid: "",
    spcSummary: "",
    cues: [],
    windows: [],
    nowLabel: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      try {
        const [alertsRes, spcRes] = await Promise.all([
          fetch("https://api.weather.gov/alerts/active", {
            headers: {
              "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
              Accept: "application/geo+json",
            },
          }),
          fetch("https://www.spc.noaa.gov/products/outlook/day1otlk.txt", {
            mode: "cors",
            cache: "no-cache",
          }),
        ]);

        let spcValid = "Day 1 convective outlook";
        let spcSummary = "";
        let cues: string[] = [];
        if (spcRes.ok) {
          const text = await spcRes.text();
          spcValid = parseSpcValid(text);
          spcSummary = extractSummary(text);
          cues = extractTimingCues(text);
        }

        const windows: WindowItem[] = [];
        if (alertsRes.ok) {
          const data = await alertsRes.json();
          for (const f of data.features || []) {
            const p = f.properties || {};
            const event = p.event || "Alert";
            const el = event.toLowerCase();
            if (el.includes("test") || p.status === "Test") continue;
            const interesting =
              el.includes("tornado") ||
              el.includes("severe thunderstorm") ||
              el.includes("flash flood") ||
              (el.includes("watch") &&
                (el.includes("tornado") ||
                  el.includes("severe") ||
                  el.includes("flash flood")));
            if (!interesting) continue;

            let kind: WindowItem["kind"] = "other";
            if (el.includes("warning")) kind = "warning";
            else if (el.includes("watch")) kind = "watch";

            const onset = parseIso(p.onset || p.effective);
            const expires = parseIso(p.expires);
            if (expires && expires.getTime() < now.getTime() - 30 * 60000) continue;

            windows.push({
              id: f.id || event + "-" + (p.areaDesc || ""),
              event,
              area: (p.areaDesc || "Multiple areas").split(";")[0].trim().slice(0, 48),
              onset,
              expires,
              kind,
              severity: p.severity,
            });
          }
        }

        windows.sort((a, b) => {
          if (a.kind !== b.kind) {
            if (a.kind === "warning") return -1;
            if (b.kind === "warning") return 1;
            if (a.kind === "watch") return -1;
            if (b.kind === "watch") return 1;
          }
          const ae = a.expires?.getTime() ?? a.onset?.getTime() ?? 0;
          const be = b.expires?.getTime() ?? b.onset?.getTime() ?? 0;
          return ae - be;
        });

        const top = windows.slice(0, 10);
        const { posture, detail } = computePosture(now, top, cues);

        if (!cancelled) {
          setState({
            status: "ready",
            posture,
            postureDetail: detail,
            spcValid,
            spcSummary,
            cues,
            windows: top,
            nowLabel: now.toLocaleString(),
          });
        }
      } catch {
        if (!cancelled) {
          setState((s) => ({ ...s, status: "error" }));
        }
      }
    }

    load();
    const id = window.setInterval(load, 90000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const now = new Date();

  return (
    <div>
      <div className="small muted" style={{ marginBottom: 8 }}>
        {state.status === "loading"
          ? "Loading timing..."
          : state.status === "error"
          ? "Could not refresh - try again shortly"
          : "LIVE - updates ~90s"}
      </div>

      <div
        style={{
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid rgba(217,255,74,0.35)",
          background: "rgba(217,255,74,0.08)",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: "#d9ff4a",
          }}
        >
          {state.posture}
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>
          {state.postureDetail ||
            "Assessing watches, warnings, and SPC Day 1 timing..."}
        </p>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="small muted">SPC Day 1 valid</div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {state.spcValid || "-"}
        </div>
        {state.spcSummary ? (
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "6px 0 0" }}>
            {state.spcSummary}
            {state.spcSummary.length >= 300 ? "..." : ""}
          </p>
        ) : null}
      </div>

      {state.cues.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Timing cues (from SPC Day 1 text)
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: "var(--muted)",
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            {state.cues.map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="small muted" style={{ marginBottom: 6 }}>
        Watches and warnings (severe / flood focus)
      </div>

      {!state.windows.length && state.status === "ready" ? (
        <p className="muted" style={{ fontSize: 13 }}>
          No tornado/severe/flash-flood watches or warnings in the timing list right now.
        </p>
      ) : null}

      {state.windows.map((w) => {
        const left = formatRemaining(minsUntil(w.expires, now));
        const border =
          w.kind === "warning"
            ? "rgba(255,92,92,0.45)"
            : w.kind === "watch"
            ? "rgba(255,209,102,0.4)"
            : "var(--line)";
        return (
          <div
            key={w.id}
            style={{
              border: "1px solid " + border,
              borderRadius: 10,
              padding: "10px 12px",
              marginBottom: 8,
              background: "rgba(0,0,0,0.22)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <strong style={{ fontSize: 13 }}>{w.event}</strong>
              <span
                className="small"
                style={{
                  color: w.kind === "warning" ? "#ff8a8a" : "#ffd166",
                  fontWeight: 700,
                }}
              >
                {w.kind.toUpperCase()}
                {left ? " - " + left : ""}
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {w.area}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              Onset {fmtLocal(w.onset)} - Until {fmtLocal(w.expires)}
            </div>
          </div>
        );
      })}

      <p className="small muted" style={{ marginTop: 10 }}>
        Timing is guidance from official NWS/SPC products - not a guarantee of initiation.
        Always defer to the latest watches, warnings, and local office updates.
      </p>

      <div style={{ marginTop: 8 }}>
        <a
          href="https://www.spc.noaa.gov/products/outlook/day1otlk.html"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}
        >
          Full Day 1 discussion
        </a>
      </div>
    </div>
  );
}
