import { useEffect, useRef, useState } from "react";
import { loadHomeBase, milesBetween } from "../lib/homeBase";

const SEEN_KEY = "stormiq-seen-alerts";
const PREF_KEY = "stormiq-notify-on";
const RADIUS_MI = 150;
const POLL_MS = 90_000;

const VAPID_PUBLIC_KEY = "BEWSGm5aEMjBxLg1gOX2mMyxNfJ6dVLjOzE2vWI0FdJpR-AHRBYvQN0b_ZZZ2e9kG-H6lgqHbGRq_OewH2YPSDo";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

const CHASE_RISKS = new Set(["MRGL", "SLGT", "ENH", "MDT", "HIGH"]);

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

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi + 0.0) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeometry(lng: number, lat: number, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates || [];
    if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates || []) {
      if (poly?.[0] && pointInRing(lng, lat, poly[0])) return true;
    }
  }
  return false;
}

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr.slice(-300));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
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

async function showNote(title: string, body: string, tag: string, url = "/map") {
  if (Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        tag,
        data: { url },
        icon: "/og.svg",
      });
    } else {
      new Notification(title, { body, tag });
    }
  } catch {
    // ignore
  }
}

async function subscribePush(home: { lat: number; lng: number } | null) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription: sub.toJSON(),
        lat: home?.lat,
        lng: home?.lng,
      }),
    });
  } catch {
    // ignore
  }
}

async function testPush() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager.getSubscription();
    const res = await fetch("/api/push-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub?.toJSON() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "failed");
    return "Test sent — check your notification shade";
  } catch (e: any) {
    return "Test failed: " + (e?.message || "unknown");
  }
}

async function checkSpcOutlooks(home: { lat: number; lng: number }, seen: Set<string>): Promise<string | null> {
  const days = [
    { day: 1, url: "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson" },
    { day: 2, url: "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.lyr.geojson" },
  ];

  let lastMsg: string | null = null;

  for (const { day, url } of days) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();

      let best: { label: string; label2: string; issue: string } | null = null;
      const order = ["HIGH", "MDT", "ENH", "SLGT", "MRGL"];

      for (const f of data?.features || []) {
        const p = f.properties || {};
        const label = String(p.LABEL || "").toUpperCase();
        if (!CHASE_RISKS.has(label)) continue;
        if (!pointInGeometry(home.lng, home.lat, f.geometry)) continue;

        if (!best || order.indexOf(label) < order.indexOf(best.label)) {
          best = {
            label,
            label2: p.LABEL2 || label,
            issue: String(p.ISSUE || p.ISSUE_ISO || ""),
          };
        }
      }

      if (!best) continue;

      const key = `spc-d${day}-${best.issue}-${best.label}`;
      if (seen.has(key)) continue;

      seen.add(key);
      const when = day === 1 ? "today" : "tomorrow";
      const title = `Day ${day} ${best.label} Risk`;
      const body = `${best.label2} near home base — potential chase setup ${when}. Tap for map.`;
      await showNote(title, body, key, "/forecast");
      lastMsg = title;
    } catch {
      // ignore
    }
  }

  return lastMsg;
}

export default function FieldAlerts() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [testing, setTesting] = useState(false);
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

    const onBip = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e;
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (!enabled || perm !== "granted") return;

    let cancelled = false;

    async function check() {
      const home = loadHomeBase();
      if (!home) {
        setStatus("Set Home base to watch nearby warnings + outlooks");
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

          seenRef.current.add(id);
          newCount++;

          const title = event;
          const body = `${Math.round(dist)} mi away · ${p.headline || p.areaDesc || "Active warning"}`;
          await showNote(title, body, id, "/map");
        }

        const outlookNote = await checkSpcOutlooks(home, seenRef.current);
        subscribePush(home);

        saveSeen(seenRef.current);
        if (cancelled) return;

        const parts: string[] = [];
        if (newCount) parts.push(`Alerted on ${newCount} nearby warning${newCount === 1 ? "" : "s"}`);
        if (outlookNote) parts.push(outlookNote);
        if (!parts.length) parts.push(`Watching warnings + Day 1/2 outlooks · ${new Date().toLocaleTimeString()}`);
        setStatus(parts.join(" · "));
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
      setStatus(`Watching warnings + Day 1/2 outlooks near home base`);
      subscribePush(loadHomeBase());
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
    <div style={{ marginTop: 4 }}>
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
            Install: browser menu → “Add to Home Screen”
          </span>
        )}

        {perm === "unsupported" && (
          <span className="small muted">Notifications not supported here</span>
        )}

        {perm !== "unsupported" && !enabled && (
          <button type="button" className="chase-btn" onClick={enableNotifications}>
            ENABLE CHASE ALERTS
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

        {perm === "granted" && enabled && (
          <button
            type="button"
            className="chase-btn"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setTestStatus("");
              const msg = await testPush();
              setTestStatus(msg);
              setTesting(false);
            }}
          >
            {testing ? "SENDING…" : "TEST PUSH"}
          </button>
        )}

        {perm === "denied" && (
          <span className="small muted">
            Notifications blocked — enable in browser settings
          </span>
        )}
      </div>

      {status && (
        <p className="small muted" style={{ marginTop: 12 }}>
          {status}
        </p>
      )}
      {testStatus && (
        <p className="small" style={{ marginTop: 8, color: "var(--lime)" }}>
          {testStatus}
        </p>
      )}

      <p className="small muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
        Needs Home base set above. Alerts on new tornado / severe / flash-flood
        warnings within ~{RADIUS_MI} mi, plus SPC Day 1 and Day 2 Marginal+ risk
        over your base for advance chase heads-up. Background push works when
        the app is installed and notifications are allowed. Does not replace phone emergency alerts.
      </p>
    </div>
  );
}
