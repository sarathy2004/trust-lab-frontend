export default function MonitoringPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Monitoring</div>
          <div className="page-subtitle">Continuous threat intelligence and automatic recalculation (Phase 7 — coming soon)</div>
        </div>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="empty-state" style={{ padding: 80 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🔭</div>
            <h3>Monitoring — Phase 7</h3>
            <p style={{ maxWidth: 480, margin: "8px auto 0", lineHeight: 1.7 }}>
              After the ranking engine is validated, this module will include:<br />
              Official source scraping · AI extraction · NVD/CISA KEV integration ·
              Vendor PSIRT feeds · Automatic recalculation on new threats.
            </p>
            <div className="alert alert-info" style={{ maxWidth: 400, margin: "20px auto 0", textAlign: "left" }}>
              The first test is deliberately manual: manual template + manual product values + deterministic ranking engine = working comparison platform.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
