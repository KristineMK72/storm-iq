import { useEffect, useState } from "react";
import StormMap from "./StormMap";
import { loadHomeBase } from "../lib/homeBase";

const KEY = "stormiq-chase-mode";

export default function ChaseModeMap() {
  const [chase, setChase] = useState(false);
  const [homeSet, setHomeSet] = useState(false);

  useEffect(() => {
    try {
      setChase(localStorage.getItem(KEY) === "1");
    } catch {
      // ignore
    }
    setHomeSet(!!loadHomeBase());
    const onHome = () => setHomeSet(!!loadHomeBase());
    window.addEventListener("stormiq-home-updated", onHome);
    return () => window.removeEventListener("stormiq-home-updated", onHome);
  }, []);

  // Full-screen field UI: hide chrome while chase mode is on
  useEffect(() => {
    const root = document.documentElement;
    if (chase) {
      root.classList.add("chase-fullscreen");
      document.body.classList.add("chase-fullscreen");
    } else {
      root.classList.remove("chase-fullscreen");
      document.body.classList.remove("chase-fullscreen");
    }
    return () => {
      root.classList.remove("chase-fullscreen");
      document.body.classList.remove("chase-fullscreen");
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

  return (
    <div className={chase ? "chase-shell chase-on" : "chase-shell"}>
      <div className="chase-toolbar">
        <div>
          <div className="eyebrow">{chase ? "Field mode" : "Operations"}</div>
          <strong style={{ fontSize: 16 }}>
            {chase ? "CHASE MODE ON" : "Standard map"}
          </strong>
          <div className="small muted" style={{ marginTop: 2 }}>
            {chase
              ? homeSet
                ? "Full-screen map · near-me · live layers"
                : "Full-screen map — set Home base on Command for near-me zoom"
              : "Flip on for full-screen field map"}
          </div>
        </div>

        <button
          type="button"
          onClick={toggle}
          className={chase ? "chase-btn chase-btn-on" : "chase-btn"}
        >
          {chase ? "EXIT CHASE MODE" : "ENTER CHASE MODE"}
        </button>
      </div>

      {chase && (
        <div className="chase-banner">
          <span>CHASE MODE · FULL SCREEN</span>
          <span className="small muted">
            Left toggles: RADAR · TORNADO · HAIL · POLYGONS · CITIES · REPORTS
          </span>
        </div>
      )}

      <div className={chase ? "map-shell map-shell-chase" : "map-shell"}>
        <StormMap chaseMode={chase} />
      </div>
    </div>
  );
}
