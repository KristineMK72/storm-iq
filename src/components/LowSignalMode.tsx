import { useEffect, useState } from "react";
import {
  loadOfflineCache,
  refreshOfflineCache,
  type OfflineCache,
} from "../lib/offlineCache";

const MODE_KEY = "stormiq-low-signal";

export default function LowSignalMode() {
  const [on, setOn] = useState(false);
  const [cache, setCache] = useState<OfflineCache | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      setOn(localStorage.getItem(MODE_KEY) === "1");
    } catch {
      // ignore
    }
    setCache(loadOfflineCache());
    const onEvt = () => setCache(loadOfflineCache());
    window.addEventListener("stormiq-offline-cache", onEvt);

    // Background refresh when online
    refreshOfflineCache()
      .then((c) => setCache(c))
      .catch(() => {});

    const id = window.setInterval(() => {
      if (navigator.onLine) {
        refreshOfflineCache()
          .then((c) => setCache(c))
          .catch(() => {});
      }
    }, 5 * 60_000);

    return () => {
      window.removeEventListener("stormiq-offline-cache", onEvt);
      window.clearInterval(id);
    };
  }, []);

  function toggle() {
    setOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(MODE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      document.documentElement.classList.toggle("stormiq-text-mode", next);
      return next;
    });
  }

  useEffect(() => {
    document.documentElement.classList.toggle("stormiq-text-mode", on);
  }, [on]);

  async function saveNow() {
    setStatus("Saving full cache…");
    try {
      const c = await refreshOfflineCache();
      setCache(c);
      setStatus("Cache saved for offline");
      window.setTimeout(() => setStatus(""), 2500);
    } catch {
      setStatus("Save failed — still showing last cache if any");
    }
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: 18,
        borderColor: on ? "rgba(255,209,102,0.5)" : "var(--line)",
      }}
    >
      <div className="section-title">
        <div>
          <div className="eyebrow">Signal survival</div>
          <h2>Low-signal / offline</h2>
        </div>
        <span className="small muted">{on ? "TEXT MODE ON" : "READY"}</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Before you lose coverage: save a full cache. In the field, turn on text mode for a compact
        warning strip that uses the last good data when the network dies.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <button type="button" className="chase-btn" onClick={saveNow}>
          SAVE CACHE NOW
        </button>
        <button
          type="button"
          className={on ? "chase-btn chase-btn-on" : "chase-btn"}
          onClick={toggle}
        >
          {on ? "EXIT TEXT MODE" : "ENTER TEXT MODE"}
        </button>
      </div>

      {status && (
        <p className="small muted" style={{ marginBottom: 8 }}>
          {status}
        </p>
      )}

      {cache ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "rgba(0,0,0,0.28)",
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 800, color: "#d9ff4a", marginBottom: 4 }}>
            {cache.posture}
          </div>
          <div style={{ fontWeight: 700 }}>
            {cache.tor} TOR · {cache.svr} SVR · {cache.ffw} FFW · {cache.watches} WATCH
          </div>
          {cache.spcValid && (
            <div className="small muted" style={{ marginTop: 6 }}>
              {cache.spcValid}
            </div>
          )}
          {cache.spcSummary && (
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.45 }}>
              {cache.spcSummary}
            </p>
          )}

          {on && cache.alerts.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="small muted" style={{ marginBottom: 6 }}>
                Cached warnings (text)
              </div>
              {cache.alerts.slice(0, 12).map((a, i) => (
                <div
                  key={i}
                  style={{
                    borderTop: "1px solid var(--line)",
                    padding: "6px 0",
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  <strong>{a.event}</strong>
                  <div className="small muted">{a.area}</div>
                  {a.headline && (
                    <div className="small muted">{a.headline}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="small muted" style={{ marginTop: 8 }}>
            Saved {new Date(cache.savedAt).toLocaleString()} · {cache.alerts.length} alerts cached.
            {" "}
            {navigator.onLine ? "Online" : "OFFLINE — using cache"}. {cache.note}
          </p>
        </div>
      ) : (
        <p className="small muted">No cache yet — tap SAVE CACHE NOW while you still have signal.</p>
      )}
    </div>
  );
}
