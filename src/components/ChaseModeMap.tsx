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
                ? "Near-me focus · tall map · live layers"
                : "Tall map on — set Home base on Command for near-me zoom"
              : "Flip on for a bigger field-ready map"}
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
          <span>CHASE MODE</span>
          <span className="small muted">
            Official warnings always win · do not drive into danger zones
          </span>
        </div>
      )}

      <div className={chase ? "map-shell map-shell-chase" : "map-shell"}>
        <StormMap chaseMode={chase} />
      </div>
    </div>
  );
}
