import { useEffect, useRef, useState } from "react";
import { loadHomeBase, milesBetween } from "../lib/homeBase";

const SEEN_KEY = "stormiq-seen-alerts";
const PREF_KEY = "stormiq-notify-on";
const RADIUS_MI = 150;
const POLL_MS = 90_000;

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

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr.slice(-200));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-200));
  } catch {
    // ignore
  }
}

function isPriority(event: string): boolean {
  const e = event.toLowerCase();
  return (
    e.includes("tornado warning") ||
    e.includes("severe thunderstorm warning") ||
    e.includes("flash flood warning") ||
    (e.includes("warning") && e.includes("tornado"))
  );
}

export default function FieldAlerts() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [canInstall, setCanInstall] = useState(false);
  const deferredPrompt = useRef<any>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setPerm("unsupported");
    } else {
      setPerm(Notification.permission);
    }

    try {
      setEnabled(localStorage.getItem(PREF_KEY) === "1");
    } catch {
      // ignore
    }

    seenRef.current = loadSeen();

    // PWA install prompt capture
    const onBip = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // ignore
      });
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (!enabled || perm !== "granted") return;

    let cancelled = false;

    async function check() {
      const home = loadHomeBase();
      if (!home) {
        setStatus("Set Home base to watch nearby warnings");
        return;
      }

      try {
        const res = await fetch("https://api.weather.gov/alerts/active", {
          headers: {
            "User-Agent": "StormIQ (https://storm-iq.vercel.app)",
            Accept: "application/geo+json",
          },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();

        let newCount = 0;

        for (const f of data?.features || []) {
          const p = f.properties || {};
          const id = String(f.id || p.id || "");
          const event = p.event || "Alert";
          if (!id || seenRef.current.has(id)) continue;
          if (!isPriority(event)) {
            seenRef.current.add(id);
            continue;
          }

          const center = getCentroid(f.geometry);
          if (!center) {
            seenRef.current.add(id);
            continue;
          }

          const dist = milesBetween(home, { lat: center[0], lng: center[1] });
          if (dist > RADIUS_MI) {
            seenRef.current.add(id);
            continue;
          }

          // New nearby priority warning
          seenRef.current.add(id);
          newCount++;

          if (Notification.permission === "granted") {
            const title = event;
            const body = `${Math.round(dist)} mi away · ${p.headline || p.areaDesc || "Active warning"}`;
            try {
              const reg = await navigator.serviceWorker?.getRegistration();
              if (reg?.showNotification) {
                await reg.showNotification(title, {
                  body,
                  tag: id,
                  data: { url: "/map" },
                  icon: "/og.svg",
                });
              } else {
                new Notification(title, { body, tag: id });
              }
            } catch {
              // ignore notification errors
            }
          }
        }

        saveSeen(seenRef.current);
        setStatus(
          newCount
            ? `Alerted on ${newCount} nearby warning${newCount === 1 ? "" : "s"}`
            : `Watching within ${RADIUS_MI} mi · ${new Date().toLocaleTimeString()}`
        );
      } catch {
        if (!cancelled) setStatus("Could not check alerts — will retry");
      }
    }

    check();
    const id = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, perm]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPerm("unsupported");
      return;
    }
    const result = await Notification.requestPermission();
    setPerm(result);
    if (result === "granted") {
      setEnabled(true);
      try {
        localStorage.setItem(PREF_KEY, "1");
      } catch {
        // ignore
      }
      setStatus(`Watching warnings within ${RADIUS_MI} mi of home base`);
    }
  }

  function disableNotifications() {
    setEnabled(false);
    try {
      localStorage.setItem(PREF_KEY, "0");
    } catch {
      // ignore
    }
    setStatus("Notifications off");
  }

  async function installApp() {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    deferredPrompt.current = null;
    setCanInstall(false);
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Field tools</div>
          <h2>Install & alerts</h2>
        </div>
        <span className="small muted">
          {enabled && perm === "granted" ? "WATCHING" : "OPTIONAL"}
        </span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 14px" }}>
        Add Storm IQ to your home screen and get browser alerts when a tornado,
        severe thunderstorm, or flash flood warning appears within about{" "}
        {RADIUS_MI} miles of your home base.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {canInstall && (
          <button type="button" className="chase-btn" onClick={installApp}>
            INSTALL APP
          </button>
        )}

        {!canInstall && (
          <span
            className="small muted"
            style={{
              padding: "8px 10px",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          >
            Install: use browser menu → “Add to Home Screen”
          </span>
        )}

        {perm === "unsupported" && (
          <span className="small muted">Notifications not supported in this browser</span>
        )}

        {perm !== "unsupported" && !enabled && (
          <button type="button" className="chase-btn" onClick={enableNotifications}>
            ENABLE NEAR-ME ALERTS
          </button>
        )}

        {perm === "granted" && enabled && (
          <button
            type="button"
            className="chase-btn chase-btn-on"
            onClick={disableNotifications}
          >
            ALERTS ON · TAP TO OFF
          </button>
        )}

        {perm === "denied" && (
          <span className="small muted">
            Notifications blocked — enable them in browser settings
          </span>
        )}
      </div>

      {status && (
        <p className="small muted" style={{ marginTop: 12 }}>
          {status}
        </p>
      )}

      <p className="small muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
        Alerts require a set Home base and only fire for new priority warnings.
        This does not replace NWS Wireless Emergency Alerts on your phone.
      </p>
    </div>
  );
}
