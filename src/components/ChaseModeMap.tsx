import { useEffect, useRef, useState } from "react";
import StormMap from "./StormMap";
import { loadHomeBase } from "../lib/homeBase";
import { parseMapShare, shareMapView, buildMapShareUrl } from "../lib/mapShare";

const KEY = "stormiq-chase-mode";
const NIGHT_KEY = "stormiq-chase-night";

type Props = { immersive?: boolean };

export default function ChaseModeMap({ immersive = false }: Props) {
  const [chase, setChase] = useState(immersive);
  const [night, setNight] = useState(false);
  const [homeSet, setHomeSet] = useState(false);
  const [wakeStatus, setWakeStatus] = useState("");
  const [shareNote, setShareNote] = useState("");
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    try {
      if (!immersive) {
        setChase(localStorage.getItem(KEY) === "1");
      }
      setNight(localStorage.getItem(NIGHT_KEY) === "1");
    } catch {
      // ignore
    }
    setHomeSet(!!loadHomeBase());
    const onHome = () => setHomeSet(!!loadHomeBase());
    window.addEventListener("stormiq-home-updated", onHome);
    return () => window.removeEventListener("stormiq-home-updated", onHome);
  }, [immersive]);

  useEffect(() => {
    const root = document.documentElement;
    if (chase && !immersive) {
      root.classList.add("chase-fullscreen");
      document.body.classList.add("chase-fullscreen");
    } else {
      root.classList.remove("chase-fullscreen");
      document.body.classList.remove("chase-fullscreen");
    }
    if (chase && night) {
      root.classList.add("chase-night");
      document.body.classList.add("chase-night");
    } else {
      root.classList.remove("chase-night");
      document.body.classList.remove("chase-night");
    }
    return () => {
      root.classList.remove("chase-fullscreen");
      document.body.classList.remove("chase-fullscreen");
      root.classList.remove("chase-night");
      document.body.classList.remove("chase-night");
    };
  }, [chase, night, immersive]);

  useEffect(() => {
    let released = false;

    async function requestLock() {
      try {
        if (!chase) {
          if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          }
          setWakeStatus("");
          return;
        }
        if (!("wakeLock" in navigator)) {
          setWakeStatus("Wake lock not supported on this browser");
          return;
        }
        const lock = await (navigator as any).wakeLock.request("screen");
        if (released) {
          await lock.release();
          return;
        }
        wakeLockRef.current = lock;
        setWakeStatus("Screen stay-on · wake lock active");
        lock.addEventListener("release", () => {
          if (!released) setWakeStatus("Wake lock released — tap to re-enable via Chase Mode");
        });
      } catch {
        setWakeStatus("Wake lock blocked — keep display on manually");
      }
    }

    requestLock();

    function onVis() {
      if (document.visibilityState === "visible" && chase) requestLock();
    }
    document.addEventListener("visibilitychange", onVis);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVis);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [chase]);

  function toggle() {
    setChase((v) => {
      const next = !v;
      try {
        localStorage.setItem(KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  function toggleNight() {
    setNight((v) => {
      const next = !v;
      try {
        localStorage.setItem(NIGHT_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function shareView() {
    try {
      const p = parseMapShare();
      const result = await shareMapView({
        lat: p.lat ?? 39.5,
        lng: p.lng ?? -98.0,
        z: p.z ?? 4,
        radar: p.radar ?? true,
        clouds: p.clouds ?? false,
        tropical: p.tropical ?? true,
      });
      setShareNote(result === "shared" ? "Shared!" : result === "copied" ? "Link copied!" : "Could not share");
      window.setTimeout(() => setShareNote(""), 2500);
    } catch {
      setShareNote("Could not share");
      window.setTimeout(() => setShareNote(""), 2500);
    }
  }

  const shellOn = chase || immersive;
  return (
    <div
      className={
        shellOn
          ? night
            ? "chase-shell chase-on chase-night-shell" + (immersive ? " chase-shell-immersive" : "")
            : "chase-shell chase-on" + (immersive ? " chase-shell-immersive" : "")
          : "chase-shell"
      }
    >
      <div className="chase-toolbar">
        <div>
          <div className="eyebrow">{immersive ? "Full map" : chase ? "Field mode" : "Operations"}</div>
          <strong style={{ fontSize: 16 }}>
            {immersive
              ? night
                ? "MAP · NIGHT"
                : "MAP · LIVE"
              : chase
                ? night
                  ? "CHASE MODE · NIGHT"
                  : "CHASE MODE ON"
                : "Standard map"}
          </strong>
          <div className="small muted" style={{ marginTop: 2 }}>
            {immersive
              ? "Radar · layers · tap sounding · share"
              : chase
                ? homeSet
                  ? "Full-screen · near-me · wake lock"
                  : "Full-screen + wake lock — set Home base for near-me zoom"
                : "Flip on for full-screen field map + screen stay-on"}
          </div>
          {chase && wakeStatus && (
            <div className="small" style={{ marginTop: 4, color: "var(--lime)" }}>
              {wakeStatus}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(chase || immersive) && (
            <button
              type="button"
              onClick={toggleNight}
              className={night ? "chase-btn chase-btn-on" : "chase-btn"}
            >
              {night ? "NIGHT ON" : "NIGHT CONTRAST"}
            </button>
          )}
          <button
            type="button"
            onClick={shareView}
            className={shareNote ? "chase-btn chase-btn-on" : "chase-btn"}
            title="Share this map view"
          >
            {shareNote || "🔗 SHARE MAP"}
          </button>
          {!immersive && (
            <button
              type="button"
              onClick={toggle}
              className={chase ? "chase-btn chase-btn-on" : "chase-btn"}
            >
              {chase ? "EXIT CHASE MODE" : "ENTER CHASE MODE"}
            </button>
          )}
        </div>
      </div>

      {chase && !immersive && (
        <div className="chase-banner">
          <span>{night ? "NIGHT CHASE" : "CHASE MODE · FULL SCREEN"}</span>
          <span className="small muted">
            Wake lock keeps the screen awake while this tab is visible
          </span>
        </div>
      )}

      <div className={shellOn ? "map-shell map-shell-chase" + (immersive ? " map-shell-immersive" : "") : "map-shell"}>
        <StormMap chaseMode={chase || immersive} />
      </div>
    </div>
  );
}
