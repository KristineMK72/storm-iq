import { useEffect, useState } from "react";
import {
  clearChaseLog,
  exportChaseLogText,
  loadChaseLog,
  type ChaseLogEntry,
} from "../lib/chaseLog";
import { focusMap } from "../lib/mapFocus";

export default function ChaseLogPanel() {
  const [entries, setEntries] = useState<ChaseLogEntry[]>([]);

  function reload() {
    setEntries(loadChaseLog());
  }

  useEffect(() => {
    reload();
    const on = () => reload();
    window.addEventListener("stormiq-chase-log", on);
    return () => window.removeEventListener("stormiq-chase-log", on);
  }, []);

  async function exportText() {
    const text = exportChaseLogText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Storm IQ chase log", text });
        return;
      }
    } catch {
      // fall through
    }
    try {
      await navigator.clipboard.writeText(text);
      alert("Chase log copied to clipboard");
    } catch {
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stormiq-chase-log-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Field memory</div>
          <h2>Chase log</h2>
        </div>
        <span className="small muted">{entries.length} saved</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 10px" }}>
        Targets you open on the board are logged on this device (up to 40). Export anytime.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <button type="button" className="chase-btn" onClick={exportText}>
          EXPORT LOG
        </button>
        <button
          type="button"
          className="chase-btn"
          style={{ background: "transparent", color: "var(--muted)", borderColor: "var(--line)" }}
          onClick={() => {
            if (confirm("Clear chase log on this device?")) clearChaseLog();
          }}
        >
          CLEAR
        </button>
      </div>

      {!entries.length && (
        <p className="small muted">No entries yet — open a target on the board to start the log.</p>
      )}

      <div style={{ maxHeight: 220, overflow: "auto" }}>
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              borderTop: "1px solid var(--line)",
              padding: "8px 0",
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: 10 }}>
              {new Date(e.at).toLocaleString()}
              {e.score != null ? ` · score ${e.score}` : ""}
            </div>
            <strong>{e.event}</strong>
            <div className="small muted">{e.area}</div>
            {e.lat != null && e.lng != null && (
              <button
                type="button"
                onClick={() => {
                  focusMap({ lat: e.lat!, lng: e.lng!, title: e.event, zoom: 7 });
                  window.location.href = "/map";
                }}
                style={{
                  marginTop: 4,
                  background: "none",
                  border: "none",
                  color: "var(--cyan)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                View on map →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
