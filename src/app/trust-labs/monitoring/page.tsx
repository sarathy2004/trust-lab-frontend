"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  productsApi, threatIntelApi,
  type Product, type ProductVulnerability,
} from "@/lib/api";
import {
  RefreshCw, ExternalLink, ChevronDown, ChevronRight, AlertTriangle,
  Key, CheckCircle2, AlertCircle, Eye, EyeOff, Zap, ShieldCheck
} from "lucide-react";
import { fmt } from "@/lib/formatting";

function scoreColorFor(score: number): string {
  if (score >= 70) return "var(--success)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

function bandBadgeClass(band: string): string {
  switch (band) {
    case "LOW": return "badge-green";
    case "MEDIUM": return "badge-yellow";
    case "HIGH": return "badge-red";
    case "CRITICAL": return "badge-red";
    default: return "badge-gray";
  }
}

function confidenceBadgeClass(c: string): string {
  return c === "VERSION_CONFIRMED" ? "badge-blue" : "badge-yellow";
}

export default function MonitoringPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list() });

  const fetchAll = useMutation({
    mutationFn: () => threatIntelApi.fetchAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threat-intel"] });
    },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Threat Intelligence</div>
          <div className="page-subtitle">
            CVE data fetched live from NVD, CISA KEV and EPSS — deduplicated, correlated to each product&apos;s exact firmware/software version, and scored per Risk Policy v2.0-auto.
          </div>
        </div>
        <button className="btn btn-primary" disabled={fetchAll.isPending} onClick={() => fetchAll.mutate()}>
          <RefreshCw size={14} style={{ marginRight: 6 }} className={fetchAll.isPending ? "spin" : ""} />
          {fetchAll.isPending ? "Refreshing All…" : "Refresh All"}
        </button>
      </div>

      <div className="page-content">
        {/* NVD API Key Configuration Box */}
        <NvdApiKeyBox />

        {fetchAll.isError && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>{(fetchAll.error as Error).message}</div>
        )}

        {isLoading ? (
          <div className="card"><div className="empty-state">Loading products…</div></div>
        ) : products.length === 0 ? (
          <div className="card"><div className="empty-state">No products yet — add one in Product Intelligence.</div></div>
        ) : (
          <div className="stack">
            {products.map(p => <ProductThreatCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function NvdApiKeyBox() {
  const qc = useQueryClient();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["threat-intel-settings"],
    queryFn: () => threatIntelApi.getSettings(),
  });

  const saveMutation = useMutation({
    mutationFn: (key: string) => threatIntelApi.updateSettings({ nvd_api_key: key }),
    onSuccess: (updated) => {
      qc.setQueryData(["threat-intel-settings"], updated);
      setApiKeyInput("");
      setTestResult({ success: true, message: "NVD API Key saved successfully! All future CVE fetches will authenticate with this key." });
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err?.message?.includes("Method Not Allowed")
          ? "Backend server needs a quick restart to load the new settings route. Please restart the backend uvicorn terminal."
          : (err?.message || "Failed to save API key")
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (key?: string) => threatIntelApi.testApiKey({ nvd_api_key: key }),
    onSuccess: (res) => {
      setTestResult(res);
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        message: err?.message?.includes("Method Not Allowed")
          ? "Backend server needs a quick restart to load the new test route. Please restart the backend uvicorn terminal."
          : (err?.message || "API Key verification failed")
      });
    },
  });

  const isConfigured = settings?.nvd_api_key_configured;

  return (
    <div
      style={{
        marginBottom: 24,
        borderRadius: 12,
        background: "linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)",
        border: "1px solid #bae6fd",
        boxShadow: "0 4px 20px -2px rgba(14, 165, 233, 0.1), 0 2px 6px -1px rgba(0, 0, 0, 0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(186, 230, 253, 0.6)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: isConfigured ? "#dcfce7" : "#e0f2fe",
              border: `1px solid ${isConfigured ? "#86efac" : "#bae6fd"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isConfigured ? "#16a34a" : "#0284c7",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <Key size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
              NIST NVD API Key Configuration
              {isConfigured ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: "#dcfce7",
                    color: "#15803d",
                    border: "1px solid #86efac",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <ShieldCheck size={13} style={{ marginRight: 4 }} /> Key Active ({settings?.rate_limit})
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "3px 10px",
                    borderRadius: 9999,
                    background: "#fef9c3",
                    color: "#854d0e",
                    border: "1px solid #fde047",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  <AlertCircle size={13} style={{ marginRight: 4 }} /> Unauthenticated ({settings?.rate_limit || "5 req / 30s"})
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: "#475569", marginTop: 2 }}>
              Used to authenticate live requests to the NIST NVD CVE 2.0 API and increase rate limit to 50 requests / 30s.
            </div>
          </div>
        </div>

        {isConfigured && settings?.nvd_api_key_masked && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#ffffff",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              border: "1px solid #bae6fd",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <span style={{ color: "#64748b", fontSize: 12, fontWeight: 500 }}>Active Key:</span>
            <code style={{ fontFamily: "monospace", color: "#0284c7", fontWeight: 700, letterSpacing: "0.5px" }}>
              {settings.nvd_api_key_masked}
            </code>
          </div>
        )}
      </div>

      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 340px" }}>
            <input
              type={showKey ? "text" : "password"}
              className="input"
              placeholder={isConfigured ? "Enter new API key to update (e.g. 9858C259-C3A5-F111-...)" : "Paste your NIST NVD API Key here (e.g. 9858C259-C3A5-F111-...)"}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              style={{
                width: "100%",
                paddingRight: 40,
                background: "#ffffff",
                border: "1px solid #94a3b8",
                color: "#0f172a",
                borderRadius: 8,
                fontSize: 13.5,
                fontFamily: apiKeyInput ? "monospace" : "inherit",
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
              }}
              title={showKey ? "Hide key" : "Show key"}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={testMutation.isPending || (!apiKeyInput.trim() && !isConfigured)}
            onClick={() => testMutation.mutate(apiKeyInput.trim() || undefined)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              color: "#334155",
              fontWeight: 500,
            }}
          >
            <Zap size={14} className={testMutation.isPending ? "spin" : ""} color="#0284c7" />
            {testMutation.isPending ? "Verifying..." : "Test Connection"}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={saveMutation.isPending || !apiKeyInput.trim()}
            onClick={() => saveMutation.mutate(apiKeyInput.trim())}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#0284c7",
              borderColor: "#0284c7",
              fontWeight: 600,
            }}
          >
            <Key size={14} />
            {saveMutation.isPending ? "Saving..." : "Save API Key"}
          </button>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: testResult.success ? "#f0fdf4" : "#fef2f2",
              color: testResult.success ? "#15803d" : "#b91c1c",
              border: `1px solid ${testResult.success ? "#86efac" : "#fecaca"}`,
              fontWeight: 500,
            }}
          >
            {testResult.success ? <CheckCircle2 size={17} style={{ flexShrink: 0 }} /> : <AlertCircle size={17} style={{ flexShrink: 0 }} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div
          style={{
            marginTop: 14,
            fontSize: 12.5,
            color: "#475569",
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingTop: 10,
            borderTop: "1px dashed rgba(186, 230, 253, 0.8)",
          }}
        >
          <span>Need to activate your key?</span>
          <a
            href="https://nvd.nist.gov/developers/confirm-api-key"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0284c7", fontWeight: 600, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3 }}
          >
            Confirm your API Key on NIST NVD Portal <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}



function ProductThreatCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selectedCve, setSelectedCve] = useState<ProductVulnerability | null>(null);
  const version = product.versions?.find(v => v.is_current) || product.versions?.[0];

  const { data: result } = useQuery({
    queryKey: ["threat-intel", version?.id],
    queryFn: () => threatIntelApi.get(version!.id),
    enabled: !!version,
  });

  const fetchOne = useMutation({
    mutationFn: () => threatIntelApi.fetch(version!.id),
    onSuccess: (data) => {
      qc.setQueryData(["threat-intel", version?.id], data);
    },
  });

  if (!version) {
    return (
      <div className="card">
        <div style={{ padding: 16, color: "var(--muted)" }}>{product.name} — no version defined yet.</div>
      </div>
    );
  }

  const score = result?.threat_score ?? 0;
  const band = result?.risk_band ?? "UNKNOWN";
  const hasData = !!result && result.data_status !== "UNKNOWN";
  const cves: ProductVulnerability[] = result?.cves || [];

  return (
    <div className="card">
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: hasData ? "pointer" : "default" }}
        onClick={() => hasData && setExpanded(e => !e)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {hasData ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <div style={{ width: 16 }} />}
          <div>
            <div style={{ fontWeight: 700 }}>{product.vendor?.name} — {product.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{version.version}</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {hasData ? (
            <>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: scoreColorFor(score) }}>{fmt(score, 1)} / 100</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>Threat Score</div>
              </div>
              <span className={`badge ${bandBadgeClass(band)}`}>{band}</span>
            </>
          ) : (
            <span className="badge badge-gray">No data yet</span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            disabled={fetchOne.isPending}
            onClick={(e) => { e.stopPropagation(); fetchOne.mutate(); }}
          >
            {fetchOne.isPending ? "Fetching…" : hasData ? "Refresh" : "Fetch"}
          </button>
        </div>
      </div>

      {fetchOne.isError && (
        <div className="alert alert-error" style={{ margin: "0 16px 16px" }}>{(fetchOne.error as Error).message}</div>
      )}

      {hasData && expanded && result && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 16 }}>
          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>
            Last fetched: {new Date(result.calculated_at).toLocaleString()} · Risk policy: {result.risk_policy_version}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
            <PillarStat label="Severity" value={`${result.critical}C / ${result.high}H / ${result.medium}M / ${result.low}L`} />
            <PillarStat label="Max EPSS" value={`${fmt(result.max_epss, 1)}%`} />
            <PillarStat label="Active Exploitation (KEV)" value={String(result.kev)} danger={result.kev > 0} />
            <PillarStat label="Patch Status" value={result.patch_status} sub={`${result.patched_count} patched / ${result.unpatched_count} unpatched`} />
          </div>

          {result.correlation_note && (
            <div className="alert alert-warn" style={{ fontSize: 12, marginBottom: 14 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              {result.correlation_note}
            </div>
          )}

          {cves.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>No CVEs matched this product/version via NVD keyword search.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CVE ID</th>
                    <th>CVSS Score</th>
                    <th>EPSS Prob.</th>
                    <th>KEV Status</th>
                    <th>Vulnerability Status</th>
                    <th>Fixed In</th>
                    <th>Confidence</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {cves.map(cv => {
                    const statusBadge =
                      cv.affected_status === "AFFECTED" ? "badge-red" :
                      cv.affected_status === "PATCHED" ? "badge-green" :
                      cv.affected_status === "MITIGATED" ? "badge-blue" : "badge-gray";

                    return (
                      <tr
                        key={cv.id}
                        onClick={() => setSelectedCve(cv)}
                        style={{ cursor: "pointer", transition: "background 0.15s" }}
                        className="hover-row"
                      >
                        <td>
                          <span style={{ fontWeight: 600, color: "var(--primary, #0284c7)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {cv.vulnerability.cve_id}
                          </span>
                        </td>
                        <td>
                          {cv.vulnerability.cvss_score != null ? (
                            <span style={{ fontWeight: 600, color: cv.vulnerability.cvss_score >= 9 ? "#dc2626" : cv.vulnerability.cvss_score >= 7 ? "#ea580c" : "#ca8a04" }}>
                              {fmt(cv.vulnerability.cvss_score, 1)}
                            </span>
                          ) : "—"}
                        </td>
                        <td>{cv.vulnerability.epss_score != null ? `${(cv.vulnerability.epss_score * 100).toFixed(1)}%` : "—"}</td>
                        <td>
                          {cv.vulnerability.is_kev ? (
                            <span className="badge badge-red" style={{ fontWeight: 700 }}>🚨 KEV</span>
                          ) : "—"}
                        </td>
                        <td>
                          <span className={`badge ${statusBadge}`}>
                            {cv.affected_status}
                          </span>
                        </td>
                        <td>{cv.fixed_version || "—"}</td>
                        <td>
                          <span className={`badge ${confidenceBadgeClass(cv.correlation_confidence)}`}>
                            {cv.correlation_confidence === "VERSION_CONFIRMED" ? "Confirmed" : "Keyword only"}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: "3px 8px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCve(cv);
                            }}
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedCve && (
        <CveDetailModal
          cveLink={selectedCve}
          versionId={version.id}
          productName={`${product.vendor?.name} — ${product.name} (${version.version})`}
          onClose={() => setSelectedCve(null)}
        />
      )}
    </div>
  );
}

function CveDetailModal({
  cveLink,
  versionId,
  productName,
  onClose,
}: {
  cveLink: ProductVulnerability;
  versionId: number;
  productName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const vuln = cveLink.vulnerability;

  const [affectedStatus, setAffectedStatus] = useState<string>(cveLink.affected_status || "AFFECTED");
  const [fixedVersion, setFixedVersion] = useState<string>(cveLink.fixed_version || "");
  const [analystNotes, setAnalystNotes] = useState<string>(cveLink.analyst_notes || "");

  const updateMutation = useMutation({
    mutationFn: () =>
      threatIntelApi.updateVulnerability(cveLink.id, {
        affected_status: affectedStatus,
        fixed_version: fixedVersion.trim() || undefined,
        analyst_notes: analystNotes.trim() || undefined,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["threat-intel"] });
      onClose();
    },
    onError: (err: any) => {
      alert("Failed to update vulnerability: " + (err?.message || "Unknown error"));
    },
  });

  const cvss = vuln.cvss_score;
  const severityText =
    cvss == null ? "Unknown" :
    cvss >= 9.0 ? "CRITICAL" :
    cvss >= 7.0 ? "HIGH" :
    cvss >= 4.0 ? "MEDIUM" : "LOW";

  const severityColor =
    severityText === "CRITICAL" ? "#dc2626" :
    severityText === "HIGH" ? "#ea580c" :
    severityText === "MEDIUM" ? "#ca8a04" : "#16a34a";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 750,
          maxHeight: "90vh",
          backgroundColor: "#ffffff",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", fontFamily: "monospace" }}>
                {vuln.cve_id}
              </span>
              <a
                href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "#0284c7",
                  background: "#e0f2fe",
                  padding: "2px 8px",
                  borderRadius: 6,
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                NVD Advisory <ExternalLink size={12} />
              </a>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 10px",
                  borderRadius: 9999,
                  background: severityColor + "15",
                  color: severityColor,
                  border: `1px solid ${severityColor}40`,
                }}
              >
                {fmt(cvss, 1)} {severityText}
              </span>
              {vuln.is_kev && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "2px 10px",
                    borderRadius: 9999,
                    background: "#fee2e2",
                    color: "#dc2626",
                    border: "1px solid #fca5a5",
                  }}
                >
                  🚨 CISA KEV Active
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              Target Product: <strong style={{ color: "#334155" }}>{productName}</strong>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: 4,
              borderRadius: 6,
            }}
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Key Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>CVSS Severity</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: severityColor, marginTop: 2 }}>
                {fmt(cvss, 1)} / 10.0
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Score Source: {vuln.cvss_source?.toUpperCase() || "NVD"}</div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>EPSS Exploit Prob.</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                {vuln.epss_score != null ? `${(vuln.epss_score * 100).toFixed(1)}%` : "N/A"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>FIRST.org 30-day forecast</div>
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>Active Exploitation</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: vuln.is_kev ? "#dc2626" : "#16a34a", marginTop: 2 }}>
                {vuln.is_kev ? "YES (In Wild)" : "No KEV Activity"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                {vuln.kev_date_added ? `Added: ${vuln.kev_date_added}` : "CISA Catalog"}
              </div>
            </div>
          </div>

          {/* CVSS Vector */}
          {vuln.cvss_vector && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f1f5f9", border: "1px solid #cbd5e1", fontSize: 12 }}>
              <span style={{ fontWeight: 600, color: "#475569" }}>CVSS Vector: </span>
              <code style={{ fontFamily: "monospace", color: "#0f172a", fontWeight: 600 }}>{vuln.cvss_vector}</code>
            </div>
          )}

          {/* Description Section */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 8 }}>
              Vulnerability Description (NIST NVD)
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                fontSize: 13,
                lineHeight: "1.6",
                color: "#334155",
              }}
            >
              {vuln.description || "No official description provided by NIST NVD."}
            </div>
          </div>

          {/* Security Assessment & Override Box */}
          <div
            style={{
              padding: "18px 20px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
              border: "1px solid #bbf7d0",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: "#15803d", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={18} /> Security Analyst Assessment & Status Override
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Vulnerability Status
                </label>
                <select
                  className="input"
                  value={affectedStatus}
                  onChange={(e) => setAffectedStatus(e.target.value)}
                  style={{ width: "100%", fontWeight: 600, background: "#ffffff" }}
                >
                  <option value="AFFECTED">🔴 AFFECTED (Active Unpatched Bug)</option>
                  <option value="PATCHED">🟢 PATCHED (Resolved in Version)</option>
                  <option value="MITIGATED">🔵 MITIGATED (Compensating WAF/IPS Control)</option>
                  <option value="FALSE_POSITIVE">⚪ FALSE_POSITIVE (Not Applicable)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                  Fixed In Version
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. 7.0.8 / 7.2.4"
                  value={fixedVersion}
                  onChange={(e) => setFixedVersion(e.target.value)}
                  style={{ width: "100%", background: "#ffffff" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>
                Analyst Notes / Remediation Comments
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="Add mitigation details, firewall rule references, or patch scheduling notes here..."
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
                style={{ width: "100%", resize: "vertical", fontSize: 13, background: "#ffffff" }}
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 12, color: "#64748b" }}>
            Saving updates will automatically recalculate this product&apos;s Threat Score.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Key size={14} />
              {updateMutation.isPending ? "Updating & Recalculating…" : "Save & Recalculate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarStat({ label, value, sub, danger }: { label: string; value: string; sub?: string; danger?: boolean }) {
  return (
    <div style={{ padding: 10, borderRadius: 6, background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: danger ? "var(--danger)" : "var(--text)", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

