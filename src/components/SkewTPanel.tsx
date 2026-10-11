import { useEffect, useState } from "react";
import {
  fetchSounding,
  capeLabel,
  shearLabel,
  type Sounding,
} from "../lib/sounding";

type Props = {
  lat: number;
  lng: number;
  onClose: () => void;
};

/** Simplified T/Td vs pressure diagram (dark Storm IQ theme). */
function ProfileChart({ s }: { s: Sounding }) {
  const W = 280;
  const H = 220;
  const padL = 36;
  const padR = 48;
  const padT = 12;
  const padB = 24;
  const levels = s.levels.filter((L) => L.tC != null);
  if (levels.length < 2) {
    return (
      <div className="small muted" style={{ padding: 12 }}>
        Not enough vertical levels for a profile chart.
      </div>
    );
  }

  const pMax = Math.max(...levels.map((L) => L.hPa));
  const pMin = Math.min(...levels.map((L) => L.hPa));
  const temps = levels.flatMap((L) => [L.tC!, L.tdC].filter((x): x is number => x != null));
  const tMin = Math.min(...temps) - 5;
  const tMax = Math.max(...temps) + 5;

  const yOf = (hPa: number) => {
    const logP = Math.log(hPa);
    const logMax = Math.log(pMax);
    const logMin = Math.log(pMin);
    return padT + ((logMax - logP) / (logMax - logMin || 1)) * (H - padT - padB);
  };
  const xOf = (tC: number) =>
    padL + ((tC - tMin) / (tMax - tMin || 1)) * (W - padL - padR);

  const tPath = levels
    .map((L, i) => `${i === 0 ? "M" : "L"} ${xOf(L.tC!).toFixed(1)} ${yOf(L.hPa).toFixed(1)}`)
    .join(" ");
  const tdPath = levels
    .filter((L) => L.tdC != null)
    .map((L, i) => `${i === 0 ? "M" : "L"} ${xOf(L.tdC!).toFixed(1)} ${yOf(L.hPa).toFixed(1)}`)
    .join(" ");

  const pTicks = [1000, 850, 700, 500, 300, 200].filter((p) => p <= pMax && p >= pMin);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", maxWidth: W }}>
      <rect x={0} y={0} width={W} height={H} fill="rgba(5,9,11,0.5)" rx={8} />
      {pTicks.map((p) => (
        <g key={p}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yOf(p)}
            y2={yOf(p)}
            stroke="rgba(184,221,225,0.12)"
            strokeWidth={1}
          />
          <text x={4} y={yOf(p) + 3} fill="#8fa6a8" fontSize={9}>
            {p}
          </text>
        </g>
      ))}
      {tdPath && (
        <path d={tdPath} fill="none" stroke="#52e0d0" strokeWidth={2} strokeDasharray="4 3" />
      )}
      <path d={tPath} fill="none" stroke="#ff9f43" strokeWidth={2.5} />
      {levels
        .filter((L) => L.windKt != null && [1000, 850, 700, 500, 300].includes(L.hPa))
        .map((L) => (
          <text
            key={"w" + L.hPa}
            x={W - padR + 4}
            y={yOf(L.hPa) + 3}
            fill="#edf8f7"
            fontSize={8}
            fontWeight={700}
          >
            {Math.round(L.windKt!)}kt
          </text>
        ))}
      <text x={padL} y={H - 6} fill="#8fa6a8" fontSize={9}>
        T (°C) orange · Td cyan · hPa
      </text>
    </svg>
  );
}

export default function SkewTPanel({ lat, lng, onClose }: Props) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [s, setS] = useState<Sounding | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setS(null);
    fetchSounding(lat, lng)
      .then((data) => {
        if (cancelled) return;
        setS(data);
        setStatus("ok");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return (
    <div
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 72,
        zIndex: 1200,
        maxWidth: 360,
        margin: "0 auto",
        background: "linear-gradient(145deg, rgba(16,29,34,0.98), rgba(8,15,18,0.98))",
        border: "1px solid rgba(217,255,74,0.35)",
        borderRadius: 14,
        padding: 12,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        color: "#edf8f7",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
        <div>
          <div className="eyebrow" style={{ color: "#d9ff4a" }}>
            Tap sounding
          </div>
          <strong style={{ fontSize: 14 }}>
            {lat.toFixed(2)}°, {lng.toFixed(2)}°
          </strong>
          {s?.elevationM != null && (
            <div className="small muted">{Math.round(s.elevationM)} m elev · {s.model}</div>
          )}
        </div>
        <button type="button" className="chase-btn" onClick={onClose} style={{ padding: "6px 10px" }}>
          CLOSE
        </button>
      </div>

      {status === "loading" && (
        <p className="small muted" style={{ margin: "12px 0 0" }}>
          Loading vertical profile…
        </p>
      )}
      {status === "error" && (
        <p className="small" style={{ margin: "12px 0 0", color: "#ff5c5c" }}>
          Sounding unavailable — try again in a moment.
        </p>
      )}

      {status === "ok" && s && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
              marginTop: 10,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                background: "rgba(217,255,74,0.08)",
                borderRadius: 10,
                padding: "8px 10px",
                border: "1px solid rgba(217,255,74,0.2)",
              }}
            >
              <div className="small muted">CAPE</div>
              <div style={{ fontWeight: 800, color: "#d9ff4a", fontSize: 16 }}>
                {Math.round(s.cape)} <span style={{ fontSize: 10 }}>J/kg</span>
              </div>
              <div className="small muted">{capeLabel(s.cape)}</div>
            </div>
            <div
              style={{
                background: "rgba(82,224,208,0.08)",
                borderRadius: 10,
                padding: "8px 10px",
                border: "1px solid rgba(82,224,208,0.2)",
              }}
            >
              <div className="small muted">CIN</div>
              <div style={{ fontWeight: 800, color: "#52e0d0", fontSize: 16 }}>
                {Math.round(s.cin)} <span style={{ fontSize: 10 }}>J/kg</span>
              </div>
              <div className="small muted">{s.cin < -50 ? "Capped" : "Weak lid"}</div>
            </div>
            <div
              style={{
                background: "rgba(255,159,67,0.08)",
                borderRadius: 10,
                padding: "8px 10px",
                border: "1px solid rgba(255,159,67,0.2)",
              }}
            >
              <div className="small muted">0–6 km shear</div>
              <div style={{ fontWeight: 800, color: "#ff9f43", fontSize: 16 }}>
                {s.shear0_6kt != null ? Math.round(s.shear0_6kt) : "—"}{" "}
                <span style={{ fontSize: 10 }}>kt</span>
              </div>
              <div className="small muted">{shearLabel(s.shear0_6kt)}</div>
            </div>
          </div>

          <ProfileChart s={s} />

          <div className="small muted" style={{ marginTop: 8, lineHeight: 1.45 }}>
            Model guidance only — not a observed balloon sounding. Surface{" "}
            {s.t2m != null ? Math.round(s.t2m) + "°C" : "—"}
            {s.td2m != null ? " / Td " + Math.round(s.td2m) + "°C" : ""}
            {s.wind10Kt != null ? " · " + Math.round(s.wind10Kt) + " kt" : ""}
            {s.time ? " · " + new Date(s.time).toLocaleString() : ""}
          </div>
        </>
      )}
    </div>
  );
}
