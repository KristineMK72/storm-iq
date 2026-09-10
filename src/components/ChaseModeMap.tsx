import { useEffect, useState } from "react";
import StormMap from "./StormMap";
import { loadHomeBase } from "../lib/homeBase";

const KEY = "stormiq-chase-mode";
const NIGHT_KEY = "stormiq-chase-night";

export default function ChaseModeMap() {
  const [chase, setChase] = useState(false);
  const [night, setNight] = useState(false);
  const [homeSet, setHomeSet] = useState(false);

  useEffect(() => {
    try {
      setChase(localStorage.getItem(KEY) === "1");
      setNight(localStorage.getItem(NIGHT_KEY) === "1");
    } catch {
      // ignore
    }
    setHomeSet(!!loadHomeBase());
    const onHome = () => setHomeSet(!!loadHomeBase());
    window.addEventListener("stormiq-home-updated", onHome);
    return () => window.removeEventListener("stormiq-home-updated", onHome);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (chase) {
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
  }, [chase, night]);

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

  return (
    <div className={chase ? (night ? "chase-shell chase-on chase-night-shell" : "chase-shell chase-on") : "chase-shell"}>
      <div className="chase-toolbar">
        <div>
          <div className="eyebrow">{chase ? "Field mode" : "Operations"}</div>
          <strong style={{ fontSize: 16 }}>
            {chase ? (night ? "CHASE MODE · NIGHT" : "CHASE MODE ON") : "Standard map"}
          </strong>
          <div className="small muted" style={{ marginTop: 2 }}>
            {chase
              ? homeSet
                ? "Full-screen · near-me · live layers"
                : "Full-screen — set Home base on Command for near-me zoom"
              : "Flip on for full-screen field map"}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {chase && (
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
            onClick={toggle}
            className={chase ? "chase-btn chase-btn-on" : "chase-btn"}
          >
            {chase ? "EXIT CHASE MODE" : "ENTER CHASE MODE"}
          </button>
        </div>
      </div>

      {chase && (
        <div className="chase-banner">
          <span>{night ? "NIGHT CHASE" : "CHASE MODE · FULL SCREEN"}</span>
          <span className="small muted">
            Left: RADAR · TORNADO · HAIL · POLYGONS · CITIES · REPORTS · YESTERDAY · REFRESH
          </span>
        </div>
      )}

      <div className={chase ? "map-shell map-shell-chase" : "map-shell"}>
        <StormMap chaseMode={chase} />
      </div>
    </div>
  );
}
