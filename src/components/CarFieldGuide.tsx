export default function CarFieldGuide() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="section-title">
        <div>
          <div className="eyebrow">Field deploy</div>
          <h2>Car · CarPlay · Android</h2>
        </div>
        <span className="small muted">PWA PATH</span>
      </div>

      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
        Storm IQ is a progressive web app — not a native CarPlay/Android Auto app
        (those require Apple/Google partner access). Best field setup:
      </p>

      <ol style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, lineHeight: 1.65 }}>
        <li>
          <strong style={{ color: "var(--text)" }}>Add to Home Screen</strong> from Safari/Chrome
        </li>
        <li>
          <strong style={{ color: "var(--text)" }}>Enable chase sounds + near-me alerts</strong> on Command
        </li>
        <li>
          On the Map page, turn on <strong style={{ color: "var(--text)" }}>Chase Mode</strong> (full-screen)
        </li>
        <li>
          Mount the phone; use <strong style={{ color: "var(--text)" }}>Open in Maps</strong> for turn-by-turn
          in Apple Maps / Google Maps (CarPlay / Android Auto friendly)
        </li>
        <li>
          Keep volume on for warning tones — official NWS alerts still win
        </li>
      </ol>

      <div className="notice" style={{ marginTop: 14 }}>
        <strong>True CarPlay / Android Auto UI</strong> needs a native app binary. Storm IQ is
        web-first by design so it stays free of app-store delays and works nationwide today.
      </div>
    </div>
  );
}
