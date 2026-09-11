import { useEffect, useRef, useState } from "react";
import { loadHomeBase } from "../lib/homeBase";
import { milesBetween } from "../lib/homeBase";

const KEY = "stormiq-voice-readouts";
const SEEN_KEY = "stormiq-voice-seen";
const RADIUS_MI = 150;

function speak(text: string) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    u.pitch = 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveSeen(set: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-80));
  } catch {
    // ignore
  }
}

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
  let lat = 0,
    lng = 0,
    n = 0;
  for (const c of coords) {
    if (Array.isArray(c) && c.length >= 2) {
      lng += c[0];
      lat += c[1];
      n++;
    }
  }
  return n ? [lat / n, lng / n] : null;
}

export default function VoiceReadouts() {
  const [on, setOn] = useState(false);
  const [last, setLast] = useState("");
  const [supported, setSupported] = useState(true);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    try {
      setOn(localStorage.getItem(KEY) === "1");
    } catch {
      // ignore
    }
    seenRef.current = loadSeen();
  }, []);

  useEffect(() => {
    if (!on) return;

    let cancelled = false;

    async function poll() {
      const home = loadHomeBase();
      if (!home) {
        setLast("Set home base for near-me voice alerts");
        return;
      }
      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok) return;
        const data = await res.json();

        for (const f of data?.features || []) {
          if (cancelled) return;
          const p = f.properties || {};
          const event = p.event || "";
          const el = event.toLowerCase();
          if (p.status === "Test" || el.includes("test")) continue;
          const isTor = el.includes("tornado warning");
          const isSvr = el.includes("severe thunderstorm warning");
          const isFfw = el.includes("flash flood warning");
          if (!isTor && !isSvr && !isFfw) continue;

          const id = String(f.id || p.headline || event + p.areaDesc);
          if (seenRef.current.has(id)) continue;

          const center = getCentroid(f.geometry);
          if (!center) continue;
          const mi = milesBetween(home, { lat: center[0], lng: center[1] });
          if (mi > RADIUS_MI) continue;

          seenRef.current.add(id);
          saveSeen(seenRef.current);

          const area = (p.areaDesc || "your area").split(";")[0].trim().slice(0, 40);
          const line =
            (isTor ? "Tornado warning" : isFfw ? "Flash flood warning" : "Severe thunderstorm warning") +
            " near " +
            area +
            ". About " +
            Math.round(mi) +
            " miles from home base. Official NWS warning. Stay safe.";

          setLast(line);
          speak(line);
          break; // one readout per poll cycle
        }
      } catch {
        // ignore
      }
    }

    poll();
    const id = window.setInterval(poll, 90_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [on]);

  function toggle() {
    setOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      if (next) {
        speak("Storm IQ voice readouts on. Near me warnings will be spoken.");
        setLast("Voice on — listening for TOR / SVR / FFW within " + RADIUS_MI + " mi");
      } else {
        try {
          window.speechSynthesis?.cancel();
        } catch {
          // ignore
        }
        setLast("");
      }
      return next;
    });
  }

  function test() {
    speak("Storm IQ test. Tornado warning example near your home base. This is only a test.");
    setLast("Played test readout");
  }

  return (
    <div className="card" style={{ marginBottom: 18, borderColor: "rgba(217,255,74,0.28)" }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Hands-free</div>
          <h2>Voice warning readouts</h2>
        </div>
        <span className="small muted">{on ? "LIVE" : "OFF"}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Speaks new tornado, severe thunderstorm, and flash flood warnings within about{" "}
        {RADIUS_MI} miles of home base. Keep the tab open. Unmute your phone. Official NWS products
        always win.
      </p>

      {!supported && (
        <p className="small muted">Speech synthesis not supported in this browser.</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className={on ? "chase-btn chase-btn-on" : "chase-btn"}
          onClick={toggle}
          disabled={!supported}
        >
          {on ? "VOICE ON — TAP TO STOP" : "ENABLE VOICE READOUTS"}
        </button>
        <button
          type="button"
          className="chase-btn"
          style={{ background: "transparent", color: "var(--muted)", borderColor: "var(--line)" }}
          onClick={test}
          disabled={!supported}
        >
          TEST VOICE
        </button>
      </div>

      {last && (
        <p className="small muted" style={{ marginTop: 10 }}>
          Last: {last}
        </p>
      )}
    </div>
  );
}
