export function MapLayerLegends() {
  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 220px", background: "rgba(5,9,11,0.85)", border: "1px solid rgba(184,221,225,0.18)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#8fa6a8", letterSpacing: "0.06em", marginBottom: 6 }}>
            RADAR · NEXRAD BASE REFL (approx dBZ)
          </div>
          <div style={{ height: 12, borderRadius: 4, background: "linear-gradient(90deg,#1a3a2a 0%,#2ecc71 18%,#f1c40f 40%,#e67e22 55%,#e74c3c 72%,#9b59b6 88%,#fff 100%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#8fa6a8", fontWeight: 600 }}>
            <span>light</span><span>30</span><span>40</span><span>50</span><span>60+</span><span>hail</span>
          </div>
          <div style={{ fontSize: 9, color: "#6b8082", marginTop: 4 }}>
            Iowa State Mesonet · 5-min frames · last ~50 min
          </div>
        </div>
        <div style={{ flex: "1 1 220px", background: "rgba(5,9,11,0.85)", border: "1px solid rgba(184,221,225,0.18)", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#8fa6a8", letterSpacing: "0.06em", marginBottom: 6 }}>
            CLOUDS · GOES EAST IR
          </div>
          <div style={{ height: 12, borderRadius: 4, background: "linear-gradient(90deg,#0a0a12 0%,#2c3e50 25%,#7f8c8d 45%,#bdc3c7 65%,#ecf0f1 80%,#fff 100%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#8fa6a8", fontWeight: 600 }}>
            <span>warm / clear</span><span>mid cloud</span><span>cold tops</span>
          </div>
          <div style={{ fontSize: 9, color: "#6b8082", marginTop: 4 }}>
            Bright = cold high tops (often storms). Dims while radar plays.
          </div>
        </div>
      </div>
    </div>
  );
}
