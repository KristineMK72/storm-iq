import { useEffect, useState } from "react";
import {
  clearHomeBase,
  loadHomeBase,
  saveHomeBase,
  type HomeBase as HomeBaseType,
} from "../lib/homeBase";

export default function HomeBase() {
  const [home, setHome] = useState<HomeBaseType | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setHome(loadHomeBase());
  }, []);

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("Geolocation not supported in this browser.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Current location",
        };
        saveHomeBase(next);
        setHome(next);
        setBusy(false);
        window.dispatchEvent(new Event("stormiq-home-updated"));
      },
      (err) => {
        setBusy(false);
        if (err.code === 1) {
          setError("Location permission denied. Enable it in browser settings.");
        } else {
          setError("Could not get location. Try again or check permissions.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function clear() {
    clearHomeBase();
    setHome(null);
    window.dispatchEvent(new Event("stormiq-home-updated"));
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Travel scoring</div>
          <h2>Home base</h2>
        </div>
        <span className="small muted">{home ? "SET" : "NOT SET"}</span>
      </div>

      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5 }}>
        Set your starting point to estimate drive time to live targets.
      </p>

      {home ? (
        <div style={{ marginBottom: 12 }}>
          <div className="small muted">Active base</div>
          <strong style={{ fontSize: 14 }}>
            {home.label || `${home.lat.toFixed(3)}, ${home.lng.toFixed(3)}`}
          </strong>
          <div className="small muted" style={{ marginTop: 2 }}>
            {home.lat.toFixed(4)}, {home.lng.toFixed(4)}
          </div>
        </div>
      ) : (
        <p className="small muted" style={{ marginBottom: 12 }}>
          No home base yet — tap the button and allow location access.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={useMyLocation}
          disabled={busy}
          style={{
            background: "rgba(217,255,74,0.14)",
            border: "1px solid rgba(217,255,74,0.4)",
            color: "#d9ff4a",
            borderRadius: 8,
            padding: "8px 14px",
            fontWeight: 700,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
          }}
        >
          {busy ? "LOCATING…" : home ? "UPDATE LOCATION" : "USE MY LOCATION"}
        </button>

        {home && (
          <button
            onClick={clear}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              borderRadius: 8,
              padding: "8px 14px",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            CLEAR
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: "#ff9f43", fontSize: 12, marginTop: 10 }}>{error}</p>
      )}
    </div>
  );
}
