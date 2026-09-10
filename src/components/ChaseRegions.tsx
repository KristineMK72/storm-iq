import { useEffect, useState } from "react";
import {
  addRegion,
  loadRegions,
  removeRegion,
  type ChaseRegion,
} from "../lib/chaseRegions";
import { loadHomeBase } from "../lib/homeBase";

const PRESETS = [
  { name: "Tornado Alley core", lat: 35.5, lng: -97.5, radiusMi: 200 },
  { name: "Dixie Alley", lat: 33.5, lng: -88.5, radiusMi: 180 },
  { name: "High Plains", lat: 38.5, lng: -101.0, radiusMi: 220 },
  { name: "Midwest corridor", lat: 41.0, lng: -89.0, radiusMi: 200 },
];

export default function ChaseRegions() {
  const [regions, setRegions] = useState<ChaseRegion[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    setRegions(loadRegions());
    const onUp = () => setRegions(loadRegions());
    window.addEventListener("stormiq-regions-updated", onUp);
    return () => window.removeEventListener("stormiq-regions-updated", onUp);
  }, []);

  function addPreset(p: (typeof PRESETS)[0]) {
    setRegions(addRegion(p));
  }

  function addFromHome() {
    const home = loadHomeBase();
    if (!home) {
      alert("Set Home base first");
      return;
    }
    setRegions(
      addRegion({
        name: name.trim() || home.label || "Home region",
        lat: home.lat,
        lng: home.lng,
        radiusMi: 150,
      })
    );
    setName("");
  }

  // Nested inside parent card on Command — compact controls only
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="chase-btn"
            onClick={() => addPreset(p)}
            style={{ padding: "7px 10px", fontSize: 11 }}
          >
            + {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name for home region"
          style={{
            flex: "1 1 160px",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "8px 10px",
            color: "var(--text)",
            fontSize: 13,
          }}
        />
        <button type="button" className="chase-btn" onClick={addFromHome}>
          PIN HOME BASE
        </button>
      </div>

      {regions.length === 0 && (
        <p className="small muted">No regions yet — add a preset or pin home base.</p>
      )}

      {regions.map((r) => (
        <div
          key={r.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
            borderTop: "1px solid var(--line)",
          }}
        >
          <div>
            <strong style={{ fontSize: 14 }}>{r.name}</strong>
            <div className="small muted">
              {r.lat.toFixed(2)}, {r.lng.toFixed(2)} · {r.radiusMi} mi radius
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRegions(removeRegion(r.id))}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
