import { useEffect, useRef, useState } from "react";
import { playChaseOutlookSound, playWarningSound } from "../lib/alertSound";
import { loadRegions } from "../lib/chaseRegions";
import { loadHomeBase, milesBetween } from "../lib/homeBase";

const SOUND_KEY = "stormiq-sound-on";
const SEEN_OUTLOOK_KEY = "stormiq-seen-outlook";
const SEEN_WARN_KEY = "stormiq-seen-warn-sound";

const RISK_RANK: Record<string, number> = {
  TSTM: 1,
  MRGL: 2,
  SLGT: 3,
  ENH: 4,
  MDT: 5,
  HIGH: 6,
};

function getCentroid(geometry: any): [number, number] | null {
  if (!geometry) return null;
  let coords: number[][] = [];
  if (geometry.type === "Point") return [geometry.coordinates[1], geometry.coordinates[0]];
  if (geometry.type === "Polygon") coords = geometry.coordinates[0] || [];
  else if (geometry.type === "MultiPolygon") coords = geometry.coordinates?.[0]?.[0] || [];
  else if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries || []) {
      const c = getCentroid(g);
      if (c) return c;
    }
    return null;
  } else return null;
  if (!coords.length) return null;
  let lat = 0, lng = 0, n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

function nearAnyZone(lat: number, lng: number): boolean {
  const regions = loadRegions();
  const home = loadHomeBase();
  const points = [
    ...regions.map((r) => ({ lat: r.lat, lng: r.lng, r: r.radiusMi })),
    ...(home ? [{ lat: home.lat, lng: home.lng, r: 150 }] : []),
  ];
  if (!points.length) return true; // national watch if no zones
  return points.some((p) => milesBetween(p, { lat, lng }) <= p.r);
}

export default function ChaseWatch() {
  const [soundOn, setSoundOn] = useState(false);
  const [status, setStatus] = useState("Sound off");
  const armed = useRef(false);

  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem(SOUND_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!soundOn) return;

    let cancelled = false;

    async function checkOutlooks() {
      try {
        // Day 1 + Day 2 categorical
        const urls = [
          "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson",
          "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson",
        ];

        const seenRaw = localStorage.getItem(SEEN_OUTLOOK_KEY);
        const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

        let bestNew: { key: string; label: string; day: string } | null = null;

        for (let i = 0; i < urls.length; i++) {
          const day = i === 0 ? "Day 1" : "Day 2";
          const res = await fetch(urls[i], { mode: "cors", cache: "no-cache" });
          if (!res.ok) continue;
          const geo = await res.json();

          for (const f of geo?.features || []) {
            const label = String(f.properties?.LABEL || f.properties?.label || "").toUpperCase();
            const rank = RISK_RANK[label] || 0;
            // "Good chase" = Enhanced or higher
            if (rank < 4) continue;

            const center = getCentroid(f.geometry);
            if (!center) continue;
            if (!nearAnyZone(center[0], center[1])) continue;

            const key = `${day}-${label}-${center[0].toFixed(1)}-${center[1].toFixed(1)}`;
            if (seen.has(key)) continue;

            if (!bestNew || rank > (RISK_RANK[bestNew.label] || 0)) {
              bestNew = { key, label, day };
            }
            seen.add(key);
          }
        }

        // Cap seen set
        const arr = [...seen].slice(-80);
        localStorage.setItem(SEEN_OUTLOOK_KEY, JSON.stringify(arr));

        if (bestNew && armed.current && !cancelled) {
          playChaseOutlookSound();
          setStatus(`Chase outlook · ${bestNew.day} ${bestNew.label}`);
          try {
            if (Notification.permission === "granted") {
              new Notification(`Storm IQ · ${bestNew.day} ${bestNew.label}`, {
                body: "Enhanced+ risk near your zones — check outlooks & map",
                tag: bestNew.key,
              });
            }
          } catch {
            // ignore
          }
        } else if (!cancelled) {
          setStatus("Watching Day 1–2 enhanced+ near your zones");
        }
      } catch {
        if (!cancelled) setStatus("Outlook check failed — will retry");
      }
    }

    async function checkWarnings() {
      try {
        const home = loadHomeBase();
        if (!home) return;

        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok) return;
        const data = await res.json();

        const seenRaw = localStorage.getItem(SEEN_WARN_KEY);
        const seen = new Set<string>(seenRaw ? JSON.parse(seenRaw) : []);

        for (const f of data?.features || []) {
          const p = f.properties || {};
          const id = String(f.id || "");
          const event = (p.event || "").toLowerCase();
          if (!id || seen.has(id)) continue;

          const priority =
            event.includes("tornado warning") ||
            event.includes("severe thunderstorm warning") ||
            event.includes("flash flood warning");
          if (!priority) {
            seen.add(id);
            continue;
          }

          const center = getCentroid(f.geometry);
          if (!center) {
            seen.add(id);
            continue;
          }

          const dist = milesBetween(home, { lat: center[0], lng: center[1] });
          if (dist > 150) {
            seen.add(id);
            continue;
          }

          seen.add(id);
          if (armed.current && !cancelled) {
            playWarningSound();
            setStatus(`Warning sound · ${p.event} (~${Math.round(dist)} mi)`);
          }
        }

        localStorage.setItem(SEEN_WARN_KEY, JSON.stringify([...seen].slice(-120)));
      } catch {
        // ignore
      }
    }

    // Arm after first pass so we don't blast on page load
    checkOutlooks().then(() => {
      armed.current = true;
    });
    checkWarnings();

    const outlookId = window.setInterval(checkOutlooks, 5 * 60_000);
    const warnId = window.setInterval(checkWarnings, 90_000);

    return () => {
      cancelled = true;
      window.clearInterval(outlookId);
      window.clearInterval(warnId);
    };
  }, [soundOn]);

  function toggle() {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
    if (next) {
      // Unlock audio on user gesture
      playChaseOutlookSound();
      setStatus("Sounds on · watching outlooks + near-me warnings");
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } else {
      setStatus("Sound off");
    }
  }

  return (
    <div
      className="card"
      style={{ marginBottom: 18, borderColor: soundOn ? "rgba(217,255,74,0.28)" : undefined }}
    >
      <div className="section-title">
        <div>
          <div className="eyebrow">Audio watch</div>
          <h2>Chase alert sounds</h2>
        </div>
        <span className="small muted">{soundOn ? "ARMED" : "OFF"}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Soft tone when <strong style={{ color: "var(--text)" }}>Day 1/2 Enhanced+</strong> shows
        near your saved regions (or nationally if none saved). Urgent tone for new tornado /
        severe / flash-flood warnings near home base.
      </p>

      <button
        type="button"
        className={soundOn ? "chase-btn chase-btn-on" : "chase-btn"}
        onClick={toggle}
      >
        {soundOn ? "SOUNDS ON · TAP TO MUTE" : "ENABLE CHASE SOUNDS"}
      </button>

      <p className="small muted" style={{ marginTop: 10 }}>
        {status}
      </p>
    </div>
  );
}
