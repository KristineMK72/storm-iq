import { useEffect, useState } from "react";
import {
  loadOfflineSnap,
  refreshOfflineSnap,
  type OfflineSnap,
} from "../lib/offlineSnap";

export default function OfflineSnapPanel() {
  const [snap, setSnap] = useState<OfflineSnap | null>(null);
  const [status, setStatus] = useState("");

  function reload() {
    setSnap(loadOfflineSnap());
  }

  useEffect(() => {
    reload();
    // Auto-refresh snapshot in background
    refreshOfflineSnap()
      .then((s) => setSnap(s))
      .catch(() => setStatus("Live refresh failed — showing last snapshot if any"));

    const on = () => reload();
    window.addEventListener("stormiq-offline-snap", on);
    const id = window.setInterval(() => {
      refreshOfflineSnap()
        .then((s) => setSnap(s))
        .catch(() => {});
    }, 5 * 60_000);
    return () => {
      window.removeEventListener("stormiq-offline-snap", on);
      window.clearInterval(id);
    };
  }, []);

  async function manual() {
    setStatus("Saving…");
    try {
      const s = await refreshOfflineSnap();
      setSnap(s);
      setStatus("Snapshot saved");
      window.setTimeout(() => setStatus(""), 2000);
    } catch {
      setStatus("Could not reach NWS");
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Signal backup</div>
          <h2>Offline last snapshot</h2>
        </div>
        <span className="small muted">LOCAL</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>
        Keeps the last successful national warning counts and headlines on this device if the
        network drops.
      </p>

      <button type="button" className="chase-btn" onClick={manual}>
        SAVE SNAPSHOT NOW
      </button>
      {status && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {status}
        </p>
      )}

      {snap ? (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <div className="small muted">
            Saved {new Date(snap.savedAt).toLocaleString()} · {snap.alertCount} alerts scanned
          </div>
          <div style={{ marginTop: 6, fontWeight: 700, color: "var(--lime)" }}>
            {snap.tor} TOR · {snap.svr} SVR · {snap.ffw} FFW · {snap.watches} WATCH
          </div>
          {snap.headlines.length > 0 && (
            <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--muted)", fontSize: 12 }}>
              {snap.headlines.slice(0, 6).map((h, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {h}
                </li>
              ))}
            </ul>
          )}
          <p className="small muted" style={{ marginTop: 8 }}>
            {snap.note}
          </p>
        </div>
      ) : (
        <p className="small muted" style={{ marginTop: 10 }}>
          No snapshot yet — tap save or wait for auto refresh.
        </p>
      )}
    </div>
  );
}
