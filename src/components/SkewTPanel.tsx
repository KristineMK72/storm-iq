import { useEffect, useState } from "react";
import {
  fetchSounding,
  capeLabel,
  shearLabel,
  type Sounding,
} from "../lib/sounding";
import { fetchNearestObserved, type ObservedSounding } from "../lib/raob";

function cToF(c: number): number {
  return (c * 9) / 5 + 32;
}
function mToFt(m: number): number {
  return m * 3.28084;
}

type Props = {
  lat: number;
  lng: number;
  onClose: () => void;
};

type Mode = "both" | "model" | "obs";

type ChartLevel = {
  hPa: number;
  tC: number | null;
  tdC: number | null;
  windKt: number | null;
};

function ProfileChart({
  modelLevels,
  obsLevels,
  mode,
}: {
  modelLevels: ChartLevel[];
  obsLevels: ChartLevel[];
  mode: Mode;
}) {
  const W = 280;
  const H = 220;
  const padL = 36;
  const padR = 48;
  const padT = 12;
  const padB = 28;

  const showModel = mode === "both" || mode === "model";
  const showObs = mode === "both" || mode === "obs";

  const all = [
    ...(showModel ? modelLevels : []),
    ...(showObs ? obsLevels : []),
  ].filter((L) => L.tC != null);

  if (all.length < 2) {
    return (
      <div className="small muted" style={{ padding: 12 }}>
        Not enough vertical levels for a profile chart.
      </div>
    );
  }

  const pMax = Math.max(...all.map((L) => L.hPa), 1000);
  const pMin = Math.min(...all.map((L) => L.hPa), 200);
  const temps = all.flatMap((L) => [L.tC!, L.tdC].filter((x): x is number => x != null)).map(cToF);
  const tMin = Math.min(...temps) - 8;
  const tMax = Math.max(...temps) + 8;

  const yOf = (hPa: number) => {
    const logP = Math.log(hPa);
    const logMax = Math.log(pMax);
    const logMin = Math.log(pMin);
    return padT + ((logMax - logP) / (logMax - logMin || 1)) * (H - padT - padB);
  };
  const xOf = (tF: number) =>
    padL + ((tF - tMin) / (tMax - tMin || 1)) * (W - padL - padR);

  const pathFor = (levels: ChartLevel[], field: "tC" | "tdC") => {
    const pts = levels.filter((L) => L[field] != null);
    if (pts.length < 2) return "";
    return pts
      .map(
        (L, i) =>
          (i === 0 ? "M" : "L") + " " + xOf(cToF(L[field]!)).toFixed(1) + " " + yOf(L.hPa).toFixed(1)
      )
      .join(" ");
  };

  const pTicks = [1000, 850, 700, 500, 300, 200].filter((p) => p <= pMax + 1 && p >= pMin - 1);

  return (
    <svg width="100%" viewBox={"0 0 " + W + " " + H} style={{ display: "block", maxWidth: W }}>
      <rect x={0} y={0} width={W} height={H} fill="rgba(5,9,11,0.5)" rx={8} />
      {pTicks.map((p) => (
        <g key={p}>
          <line x1={padL} x2={W - padR} y1={yOf(p)} y2={yOf(p)} stroke="rgba(184,221,225,0.12)" strokeWidth={1} />
          <text x={4} y={yOf(p) + 3} fill="#8fa6a8" fontSize={9}>{p}</text>
        </g>
      ))}
      {showModel && pathFor(modelLevels, "tdC") && (
        <path d={pathFor(modelLevels, "tdC")} fill="none" stroke="#52e0d0" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.85} />
      )}
      {showModel && pathFor(modelLevels, "tC") && (
        <path d={pathFor(modelLevels, "tC")} fill="none" stroke="#ff9f43" strokeWidth={2} opacity={0.9} />
      )}
      {showObs && pathFor(obsLevels, "tdC") && (
        <path d={pathFor(obsLevels, "tdC")} fill="none" stroke="#d9ff4a" strokeWidth={2} strokeDasharray="3 2" />
      )}
      {showObs && pathFor(obsLevels, "tC") && (
        <path d={pathFor(obsLevels, "tC")} fill="none" stroke="#edf8f7" strokeWidth={2.5} />
      )}
      {showObs &&
        obsLevels
          .filter((L) => L.windKt != null && [1000, 850, 700, 500, 300].some((p) => Math.abs(L.hPa - p) < 15))
          .map((L) => (
            <text key={"w" + L.hPa} x={W - padR + 2} y={yOf(L.hPa) + 3} fill="#edf8f7" fontSize={8} fontWeight={700}>
              {Math.round(L.windKt!)}kt
            </text>
          ))}
      <text x={padL} y={H - 8} fill="#8fa6a8" fontSize={8}>
        {(showModel ? "Model T/Td  " : "") + (showObs ? "Obs balloon  " : "") + "°F · hPa"}
      </text>
    </svg>
  );
}

export default function SkewTPanel({ lat, lng, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [s, setS] = useState<Sounding | null>(null);
  const [obs, setObs] = useState<ObservedSounding | null>(null);
  const [obsStatus, setObsStatus] = useState<"loading" | "ok" | "none" | "error">("loading");
  const [mode, setMode] = useState<Mode>("both");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setObsStatus("loading");
    setS(null);
    setObs(null);

    fetchSounding(lat, lng)
      .then((data) => {
        if (cancelled) return;
        setS(data);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    fetchNearestObserved(lat, lng)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setObs(data);
          setObsStatus("ok");
        } else setObsStatus("none");
      })
      .catch(() => {
        if (!cancelled) setObsStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  const modelLevels: ChartLevel[] = (s?.levels || []).map((L) => ({
    hPa: L.hPa, tC: L.tC, tdC: L.tdC, windKt: L.windKt,
  }));
  const obsLevels: ChartLevel[] = (obs?.levels || []).map((L) => ({
    hPa: L.hPa, tC: L.tC, tdC: L.tdC, windKt: L.windKt,
  }));

  return (
    <div
      style={{
        position: "fixed", left: 12, right: 12, bottom: "max(16px, env(safe-area-inset-bottom))", zIndex: 9999,
        maxWidth: 400, margin: "0 auto",
        background: "linear-gradient(145deg, rgba(16,29,34,0.98), rgba(8,15,18,0.98))",
        border: "1px solid rgba(217,255,74,0.35)", borderRadius: 14, padding: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55)", color: "#edf8f7",
        maxHeight: "min(70vh, 520px)", overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "#d9ff4a" }}>Tap sounding</div>
          <strong style={{ fontSize: 14 }}>{lat.toFixed(2)}, {lng.toFixed(2)}</strong>
          {s?.elevationM != null && (
            <div className="small muted">{Math.round(mToFt(s.elevationM)).toLocaleString()} ft elev · model GFS</div>
          )}
        </div>
        <button type="button" className="chase-btn" onClick={onClose} style={{ padding: "6px 10px" }}>CLOSE</button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {([["both", "Both"], ["obs", "Observed"], ["model", "Model"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            style={{
              padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              border: mode === id ? "1px solid rgba(217,255,74,0.55)" : "1px solid rgba(184,221,225,0.2)",
              background: mode === id ? "rgba(217,255,74,0.15)" : "transparent",
              color: mode === id ? "#d9ff4a" : "#8fa6a8",
            }}
          >{label}</button>
        ))}
      </div>

      {status === "loading" && obsStatus === "loading" && (
        <p className="small muted" style={{ margin: "12px 0 0" }}>Loading model + nearest balloon…</p>
      )}
      {status === "error" && obsStatus !== "ok" && (
        <p className="small" style={{ margin: "12px 0 0", color: "#ff5c5c" }}>Sounding unavailable — try again.</p>
      )}

      {obsStatus === "ok" && obs && (
        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(217,255,74,0.08)", border: "1px solid rgba(217,255,74,0.25)" }}>
          <div style={{ fontWeight: 800, color: "#d9ff4a", fontSize: 13 }}>Observed · {obs.station}</div>
          <div className="small muted" style={{ marginTop: 2, lineHeight: 1.4 }}>
            {obs.name} · {obs.distanceKm < 10 ? obs.distanceKm.toFixed(1) : Math.round(obs.distanceKm)} km away
            <br />
            Balloon valid {new Date(obs.valid).toLocaleString()} (IEM / NWS RAOB)
          </div>
        </div>
      )}
      {obsStatus === "none" && (
        <div className="small muted" style={{ marginTop: 10 }}>No recent observed balloon near this point (launches ~00Z / 12Z).</div>
      )}
      {obsStatus === "error" && (
        <div className="small" style={{ marginTop: 10, color: "#ff9f43" }}>Observed RAOB fetch failed — model still available.</div>
      )}

      {status === "ok" && s && (s.t2m != null || s.td2m != null) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10, marginBottom: 4 }}>
          <div style={{ background: "rgba(255,159,67,0.12)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,159,67,0.3)" }}>
            <div className="small muted">Temp</div>
            <div style={{ fontWeight: 800, color: "#ff9f43", fontSize: 18 }}>
              {s.t2m != null ? Math.round(cToF(s.t2m)) : "—"}°F
            </div>
            <div className="small muted">{s.t2m != null ? Math.round(s.t2m) + "°C" : ""}</div>
          </div>
          <div style={{ background: "rgba(82,224,208,0.12)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(82,224,208,0.3)" }}>
            <div className="small muted">Dewpoint</div>
            <div style={{ fontWeight: 800, color: "#52e0d0", fontSize: 18 }}>
              {s.td2m != null ? Math.round(cToF(s.td2m)) : "—"}°F
            </div>
            <div className="small muted">{s.td2m != null ? Math.round(s.td2m) + "°C" : ""}</div>
          </div>
          <div style={{ background: "rgba(237,248,247,0.06)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(184,221,225,0.2)" }}>
            <div className="small muted">Wind</div>
            <div style={{ fontWeight: 800, color: "#edf8f7", fontSize: 18 }}>
              {s.wind10Kt != null ? Math.round(s.wind10Kt) : "—"} <span style={{ fontSize: 11 }}>kt</span>
            </div>
            <div className="small muted">{s.wind10Dir != null ? Math.round(s.wind10Dir) + "°" : "surface"}</div>
          </div>
        </div>
      )}

      {status === "ok" && s && (mode === "both" || mode === "model") && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10, marginBottom: 10 }}>
          <div style={{ background: "rgba(217,255,74,0.08)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(217,255,74,0.2)" }}>
            <div className="small muted">CAPE (model)</div>
            <div style={{ fontWeight: 800, color: "#d9ff4a", fontSize: 16 }}>{Math.round(s.cape)} <span style={{ fontSize: 10 }}>J/kg</span></div>
            <div className="small muted">{capeLabel(s.cape)}</div>
          </div>
          <div style={{ background: "rgba(82,224,208,0.08)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(82,224,208,0.2)" }}>
            <div className="small muted">CIN</div>
            <div style={{ fontWeight: 800, color: "#52e0d0", fontSize: 16 }}>{Math.round(s.cin)} <span style={{ fontSize: 10 }}>J/kg</span></div>
            <div className="small muted">{s.cin < -50 ? "Capped" : "Weak lid"}</div>
          </div>
          <div style={{ background: "rgba(255,159,67,0.08)", borderRadius: 10, padding: "8px 10px", border: "1px solid rgba(255,159,67,0.2)" }}>
            <div className="small muted">0–6 km shear</div>
            <div style={{ fontWeight: 800, color: "#ff9f43", fontSize: 16 }}>{s.shear0_6kt != null ? Math.round(s.shear0_6kt) : "—"} <span style={{ fontSize: 10 }}>kt</span></div>
            <div className="small muted">{shearLabel(s.shear0_6kt)}</div>
          </div>
        </div>
      )}

      {(status === "ok" || obsStatus === "ok") && (
        <ProfileChart modelLevels={modelLevels} obsLevels={obsLevels} mode={mode} />
      )}

      <div className="small muted" style={{ marginTop: 8, lineHeight: 1.45 }}>
        <strong style={{ color: "#edf8f7" }}>White/lime</strong> = real radiosonde (balloon).{" "}
        <strong style={{ color: "#ff9f43" }}>Orange/cyan</strong> = GFS model at tap point. CAPE/CIN/shear are model-derived. Surface temp is model 2 m air temp at the tap point (°F).
      </div>
    </div>
  );
}
