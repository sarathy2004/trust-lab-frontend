"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  categoriesApi, productClassesApi, templatesApi, productsApi, comparisonsApi,
  type RankingTemplate, type Product, type RankedResult,
} from "@/lib/api";
import Link from "next/link";
import { Plus, ChevronRight, Star, AlertCircle, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { fmt, pct, scoreColor } from "@/lib/formatting";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell } from "recharts";

// ── Step 1: Setup ─────────────────────────────────────────────────────────────

function SetupStep({
  onNext,
}: {
  onNext: (params: { templateId: number; productClassId: number; categoryId: number; assetProductId?: number }) => void;
}) {
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [productClassId, setProductClassId] = useState<number | "">("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [assetId, setAssetId] = useState<number | "">("");

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const { data: productClasses = [] } = useQuery({ queryKey: ["product-classes", categoryId], queryFn: () => productClassesApi.list(categoryId as number | undefined), enabled: true });
  const { data: templates = [] } = useQuery({ queryKey: ["templates", productClassId], queryFn: () => templatesApi.list(productClassId as number | undefined), enabled: !!productClassId });
  const { data: products = [] } = useQuery({ queryKey: ["products", productClassId], queryFn: () => productsApi.list({ product_class_id: productClassId as number | undefined }), enabled: !!productClassId });

  const filteredClasses = categoryId ? productClasses.filter(pc => pc.category_id === categoryId) : productClasses;

  const canContinue = categoryId && productClassId && templateId;

  return (
    <div>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card">
          <div className="card-header" style={{ borderBottom: "none", paddingBottom: 4 }}>
            <div className="card-title">New Comparison — Setup</div>
          </div>
          <div className="card-body stack">
            <div className="alert alert-info">
              Select a category, product class, and template to define the ranking methodology.
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select className="form-control" value={categoryId} onChange={e => { setCategoryId(e.target.value ? Number(e.target.value) : ""); setProductClassId(""); setTemplateId(""); }}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Product Class *</label>
              <select className="form-control" value={productClassId} disabled={!categoryId} onChange={e => { setProductClassId(e.target.value ? Number(e.target.value) : ""); setTemplateId(""); }}>
                <option value="">Select class…</option>
                {filteredClasses.map(pc => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Ranking Template *</label>
              <select className="form-control" value={templateId} disabled={!productClassId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Select template…</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} v{t.version} ({t.status})</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Asset Product (Your Current Product) <span style={{ color: "var(--muted)", fontWeight: 400 }}>optional</span></label>
              <select className="form-control" value={assetId} disabled={!productClassId} onChange={e => setAssetId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">None (no current asset)</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.vendor?.name}</option>)}
              </select>
              <div className="form-hint">★ The asset will be highlighted in the ranking table.</div>
            </div>

            <button
              className="btn btn-primary btn-lg"
              style={{ width: "100%" }}
              disabled={!canContinue}
              onClick={() => onNext({ templateId: templateId as number, productClassId: productClassId as number, categoryId: categoryId as number, assetProductId: assetId ? assetId as number : undefined })}
            >
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Select Products ────────────────────────────────────────────────────

function ProductSelectionStep({
  productClassId,
  onBack,
  onRun,
  isRunning,
}: {
  productClassId: number;
  onBack: () => void;
  onRun: (productIds: number[]) => void;
  isRunning: boolean;
}) {
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-for-class", productClassId],
    queryFn: () => productsApi.list({ product_class_id: productClassId }),
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map(p => p.id)));
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Eligible Products</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {selected.size} / {products.length} selected
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={toggleAll}>
            {selected.size === products.length ? "Deselect All" : "Select All"}
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center" }}><div className="loading-spin" style={{ margin: "0 auto" }} /></div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={36} />
            <h3>No products mapped</h3>
            <p>Map products to this class in Product Intelligence first.</p>
          </div>
        ) : (
          <div>
            {products.map(p => (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                  borderBottom: "1px solid var(--border)", cursor: "pointer",
                  background: selected.has(p.id) ? "var(--primary-light)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 16, height: 16 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: selected.has(p.id) ? "var(--primary)" : "var(--text)" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{p.vendor?.name} — {p.model || "N/A"}</div>
                </div>
                <span className={`badge ${p.lifecycle_status === "ACTIVE" ? "badge-green" : "badge-yellow"}`}>{p.lifecycle_status}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "16px 20px", display: "flex", gap: 10, justifyContent: "space-between" }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <button
            className="btn btn-primary"
            disabled={selected.size === 0 || isRunning}
            onClick={() => onRun([...selected])}
          >
            {isRunning ? (
              <><div className="loading-spin" style={{ width: 14, height: 14 }} /> Running…</>
            ) : (
              <>Run Comparison ({selected.size} products)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Results ────────────────────────────────────────────────────────────

// A template's groups vary (Security/Performance/Compliance vs. Security/Performance/Common,
// etc.) -- read them from the run's own group_scores instead of assuming fixed names.
function getDimensions(result: RankedResult): { code: string; name: string; score?: number }[] {
  return [...result.group_scores]
    .sort((a, b) => a.display_order - b.display_order)
    .map(gs => ({ code: gs.group_code, name: gs.group_name, score: gs.group_score }));
}

function ResultsView({ runId, assetProductId }: { runId: number; assetProductId?: number }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"ranking" | "breakdown" | "radar">("ranking");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["comparison-results", runId],
    queryFn: () => comparisonsApi.getResults(runId),
  });

  const rerankMutation = useMutation({
    mutationFn: () => comparisonsApi.rerank(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comparison-results", runId] });
      qc.invalidateQueries({ queryKey: ["comparisons"] });
      qc.invalidateQueries({ queryKey: ["comparison", runId] });
    },
  });

  const ranked = results.filter(r => r.rank_status === "RANKED").sort((a, b) => (a.rank || 99) - (b.rank || 99));
  const ineligible = results.filter(r => r.rank_status === "INELIGIBLE");
  const selectedResult = results.find(r => r.product_id === selectedProductId);

  // This run's dimensions (e.g. Security/Performance/Compliance, or Security/Performance/Common)
  // -- every ranked result in one run shares the same template, so the first one defines them all.
  const dimensions = ranked[0] ? getDimensions(ranked[0]) : [];
  const DIM_COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED", "#0891B2"];

  const radarData = dimensions.map(dim => ({
    dimension: dim.name,
    ...Object.fromEntries(ranked.map(r => [r.product_name, getDimensions(r).find(d => d.code === dim.code)?.score || 0])),
  }));

  const barData = ranked.map(r => ({
    name: r.product_name.replace("FortiGate", "FG").replace("Palo Alto", "PA").replace("Cisco", "CS").replace("Check Point", "CP"),
    overall: r.overall_score || 0,
    isAsset: r.is_current_asset,
    ...Object.fromEntries(getDimensions(r).map(d => [d.code, d.score || 0])),
  }));

  const COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626"];

  if (isLoading) return <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spin" style={{ margin: "0 auto" }} /></div>;

  return (
    <div>
      {/* Summary Banner */}
      <div style={{
        background: "linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)",
        borderRadius: 12, padding: "24px 28px", marginBottom: 20,
        color: "white", display: "flex", gap: 24, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>Comparison Run #{runId}</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
              {ranked.length} Products Ranked
            </div>
          </div>
          {ranked[0] && (
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: 28 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Top Performer</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ranked[0].product_name}</div>
              <div style={{ fontSize: 14, opacity: 0.9 }}>Overall Score: {fmt(ranked[0].overall_score)}</div>
            </div>
          )}
          {ineligible.length > 0 && (
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: 28 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Ineligible</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{ineligible.length}</div>
            </div>
          )}
          {assetProductId && results.find(r => r.product_id === assetProductId) && (
            <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: 28 }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>Your Asset</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                ★ Rank #{results.find(r => r.product_id === assetProductId)?.rank} — {fmt(results.find(r => r.product_id === assetProductId)?.overall_score)}
              </div>
            </div>
          )}
        </div>

        <button
          className="btn"
          style={{
            background: "white",
            color: "#1D4ED8",
            fontWeight: 600,
            fontSize: 13,
            padding: "9px 16px",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            cursor: "pointer",
            border: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
          }}
          disabled={rerankMutation.isPending}
          onClick={() => rerankMutation.mutate()}
        >
          <RefreshCw size={14} className={rerankMutation.isPending ? "loading-spin" : ""} />
          {rerankMutation.isPending ? "Re-evaluating…" : "Rerank / Re-evaluate"}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {[
          { key: "ranking", label: "Ranking Table" },
          { key: "breakdown", label: "Score Breakdown" },
          { key: "radar", label: "Visual Analysis" },
        ].map(t => (
          <button key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key as typeof activeTab)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Ranking Table */}
      {activeTab === "ranking" && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Product</th>
                  <th>Vendor</th>
                  {dimensions.map(dim => <th key={dim.code}>{dim.name}</th>)}
                  <th>Overall Score</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => (
                  <tr
                    key={r.product_id}
                    className={r.is_current_asset ? "asset-row" : ""}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedProductId(selectedProductId === r.product_id ? null : r.product_id)}
                  >
                    <td>
                      <div className={`rank-badge ${r.rank === 1 ? "rank-1" : r.rank === 2 ? "rank-2" : r.rank === 3 ? "rank-3" : "rank-n"}`}>
                        {r.rank}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {r.product_name}
                        {r.is_current_asset && <span className="asset-star" title="Current Asset">★</span>}
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{r.vendor_name}</td>
                    {getDimensions(r).map(dim => (
                      <td key={dim.code}>
                        <div className="score-bar">
                          <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${dim.score || 0}%`, background: scoreColor(dim.score) }} /></div>
                          <div className="score-val" style={{ color: scoreColor(dim.score) }}>{fmt(dim.score)}</div>
                        </div>
                      </td>
                    ))}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${r.overall_score || 0}%`, height: "100%", background: scoreColor(r.overall_score), borderRadius: 4 }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: scoreColor(r.overall_score) }}>{fmt(r.overall_score)}</span>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setSelectedProductId(r.product_id); setActiveTab("breakdown"); }}>
                        Explain →
                      </button>
                    </td>
                  </tr>
                ))}
                {ineligible.map(r => (
                  <tr key={r.product_id} style={{ opacity: 0.55 }}>
                    <td><div className="rank-badge rank-n">—</div></td>
                    <td><div style={{ fontWeight: 600 }}>{r.product_name}</div></td>
                    <td style={{ color: "var(--muted)" }}>{r.vendor_name}</td>
                    <td colSpan={dimensions.length + 1} style={{ color: "var(--danger)", fontSize: 12 }}>
                      <XCircle size={13} style={{ display: "inline", marginRight: 4 }} />
                      INELIGIBLE — {r.failed_requirements?.map(f => f.reason).join(", ")}
                    </td>
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Score Breakdown */}
      {activeTab === "breakdown" && (
        <div className="grid-2" style={{ alignItems: "flex-start" }}>
          {/* Product Selector */}
          <div className="card">
            <div className="card-header"><div className="card-title">Select Product</div></div>
            <div>
              {ranked.map(r => (
                <div
                  key={r.product_id}
                  onClick={() => setSelectedProductId(r.product_id)}
                  style={{
                    padding: "12px 16px", cursor: "pointer",
                    background: selectedProductId === r.product_id ? "var(--primary-light)" : "transparent",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <div className={`rank-badge ${r.rank === 1 ? "rank-1" : r.rank === 2 ? "rank-2" : r.rank === 3 ? "rank-3" : "rank-n"}`} style={{ width: 28, height: 28, fontSize: 12 }}>
                    {r.rank}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: selectedProductId === r.product_id ? "var(--primary)" : "var(--text)" }}>
                      {r.product_name} {r.is_current_asset && "★"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Overall: {fmt(r.overall_score)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown Detail */}
          {selectedResult ? (
            <div className="stack">
              {/* Header */}
              <div className="card">
                <div className="card-body">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>
                        {selectedResult.product_name}
                        {selectedResult.is_current_asset && <span className="asset-star">★ Current Asset</span>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)" }}>{selectedResult.vendor_name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>Rank</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>#{selectedResult.rank} / {ranked.length}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16, display: "flex", gap: 20 }}>
                    {[
                      { label: "Overall Score", value: selectedResult.overall_score },
                      ...getDimensions(selectedResult).map(d => ({ label: d.name, value: d.score })),
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor(value) }}>{fmt(value)}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Characteristic Scores */}
              <div className="card">
                <div className="card-header"><div className="card-title">Characteristic Breakdown</div></div>
                <div style={{ padding: "8px 20px" }}>
                  {selectedResult.characteristic_scores.map(cs => (
                    <div key={cs.tc_id}>
                      <div className="breakdown-row">
                        <div className="breakdown-name">{cs.name}</div>
                        <div className="score-bar" style={{ width: 160 }}>
                          <div className="score-bar-track"><div className="score-bar-fill" style={{ width: `${cs.normalized_score || 0}%`, background: scoreColor(cs.normalized_score) }} /></div>
                        </div>
                        <div className="breakdown-score" style={{ color: scoreColor(cs.normalized_score) }}>{fmt(cs.normalized_score)}</div>
                        <div className="breakdown-weight">{pct(cs.weight)}</div>
                      </div>
                      {/* Threat Intel details */}
                      {Boolean(cs.name === "Threat Intelligence" || (cs.calculation_details && (cs.calculation_details.method === "THREAT_SCORE" || cs.calculation_details.method === "RISK"))) && (
                        <div style={{ paddingLeft: 20, paddingBottom: 8, fontSize: 12, color: "var(--muted)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                          <span>🛡️ <strong>Threat Score:</strong> <span style={{ color: scoreColor(cs.normalized_score), fontWeight: 700 }}>{fmt(cs.normalized_score)}/100</span></span>
                          {Boolean((cs.calculation_details as any)?.risk_band) && (
                            <span><strong>Risk Band:</strong> <span style={{
                              padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                              background: (cs.calculation_details as any)?.risk_band === "LOW" ? "rgba(34,197,94,0.12)" : (cs.calculation_details as any)?.risk_band === "CRITICAL" ? "rgba(220,38,38,0.12)" : "rgba(245,158,11,0.12)",
                              color: (cs.calculation_details as any)?.risk_band === "LOW" ? "var(--success)" : (cs.calculation_details as any)?.risk_band === "CRITICAL" ? "var(--danger)" : "var(--warning)",
                            }}>{String((cs.calculation_details as any)?.risk_band)}</span></span>
                          )}
                          <span><strong>Crit:</strong> {String((cs.calculation_details?.cve_counts as any)?.critical ?? (cs.calculation_details?.raw_value as any)?.critical ?? 0)}</span>
                          <span><strong>High:</strong> {String((cs.calculation_details?.cve_counts as any)?.high ?? (cs.calculation_details?.raw_value as any)?.high ?? 0)}</span>
                          <span><strong>Med:</strong> {String((cs.calculation_details?.cve_counts as any)?.medium ?? (cs.calculation_details?.raw_value as any)?.medium ?? 0)}</span>
                          <span><strong>Low:</strong> {String((cs.calculation_details?.cve_counts as any)?.low ?? (cs.calculation_details?.raw_value as any)?.low ?? 0)}</span>
                          <span><strong>KEV:</strong> <span style={{ color: Number((cs.calculation_details?.cve_counts as any)?.kev ?? (cs.calculation_details?.raw_value as any)?.kev ?? 0) > 0 ? "var(--danger)" : "var(--muted)", fontWeight: 600 }}>{String((cs.calculation_details?.cve_counts as any)?.kev ?? (cs.calculation_details?.raw_value as any)?.kev ?? 0)}</span></span>
                        </div>
                      )}
                      {/* Child options */}
                      {cs.option_results.length > 0 && (
                        <div style={{ paddingLeft: 20, paddingBottom: 8 }}>
                          {cs.option_results.map(or => (
                            <div key={or.option_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 12, color: "var(--muted)" }}>
                              <div style={{
                                width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                                background: or.child_score === 100 ? "var(--success)" : or.child_score === 0 ? "var(--danger)" : "var(--warning)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {or.child_score === 100 ? <CheckCircle size={10} style={{ color: "white" }} /> : <XCircle size={10} style={{ color: "white" }} />}
                              </div>
                              <span style={{ flex: 1 }}>{or.option_name}</span>
                              <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmt(or.child_score)}</span>
                              <span style={{ color: "var(--muted)" }}>P{or.child_priority}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state"><Star size={36} /><h3>Select a Product</h3><p>Click a product on the left to see its detailed score breakdown.</p></div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Visual Analysis */}
      {activeTab === "radar" && (
        <div className="stack" style={{ gap: 24 }}>
          {/* Multi-Dimension Radar Chart (Full Size) */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="card-title" style={{ fontSize: 16 }}>Multi-Dimension Radar Comparison</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Comprehensive performance comparison across {dimensions.map(d => d.name).join(", ")} dimensions (0–100 scale)
                </div>
              </div>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 500 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={radarData}
                  >
                    <PolarGrid stroke="#CBD5E1" strokeWidth={1} />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fontSize: 14, fontWeight: 700, fill: "var(--text)" }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "var(--muted)" }}
                      stroke="#94A3B8"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255, 255, 255, 0.96)",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        border: "1px solid var(--border)",
                        fontSize: 12,
                      }}
                      formatter={(val: any) => [`${fmt(val)} / 100`, ""]}
                    />
                    {ranked.map((r, i) => (
                      <Radar
                        key={r.product_id}
                        name={r.product_name}
                        dataKey={r.product_name}
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2.5}
                        fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.18}
                        dot={{ r: 4, fill: COLORS[i % COLORS.length] }}
                      />
                    ))}
                    <Legend
                      iconSize={12}
                      wrapperStyle={{ paddingTop: 20, fontSize: 13, fontWeight: 500 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Dimension Score Comparison Table */}
              <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
                  Dimension Scores Overview
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th style={{ textAlign: "center" }}>Overall</th>
                        {dimensions.map(dim => <th key={dim.code} style={{ textAlign: "center" }}>{dim.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((r, i) => (
                        <tr key={r.product_id}>
                          <td style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "inline-block" }} />
                            <span>{r.product_name}</span>
                            {r.is_current_asset && <span className="asset-star">★ Asset</span>}
                          </td>
                          <td style={{ textAlign: "center", fontWeight: 700, color: scoreColor(r.overall_score) }}>
                            {fmt(r.overall_score)}
                          </td>
                          {getDimensions(r).map(dim => (
                            <td key={dim.code} style={{ textAlign: "center", fontWeight: 600, color: scoreColor(dim.score) }}>
                              {fmt(dim.score)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Dimension Breakdown Bar Chart */}
          <div className="card">
            <div className="card-header"><div className="card-title" style={{ fontSize: 16 }}>Dimension Scores by Product</div></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={barData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 500 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(255, 255, 255, 0.96)",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                      border: "1px solid var(--border)",
                      fontSize: 12,
                    }}
                  />
                  <Legend iconSize={12} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                  {dimensions.map((dim, i) => (
                    <Bar key={dim.code} dataKey={dim.code} name={dim.name} fill={DIM_COLORS[i % DIM_COLORS.length]} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Comparisons Page ─────────────────────────────────────────────────────

export default function ComparisonsPage() {
  const [step, setStep] = useState<"list" | "setup" | "select" | "results">("list");
  const [setupParams, setSetupParams] = useState<{ templateId: number; productClassId: number; categoryId: number; assetProductId?: number } | null>(null);
  const [runId, setRunId] = useState<number | null>(null);

  const { data: comparisons = [], isLoading } = useQuery({
    queryKey: ["comparisons"],
    queryFn: comparisonsApi.list,
    enabled: step === "list",
  });

  const runComparison = useMutation({
    mutationFn: (productIds: number[]) =>
      comparisonsApi.create({
        ranking_template_id: setupParams!.templateId,
        product_class_id: setupParams!.productClassId,
        asset_product_id: setupParams!.assetProductId,
        product_ids: productIds,
      }),
    onSuccess: (run) => { setRunId(run.id); setStep("results"); },
  });

  const stepLabels = [
    { key: "setup", label: "Setup" },
    { key: "select", label: "Select Products" },
    { key: "results", label: "Results" },
  ];

  // Stepper helper
  const getStepStatus = (key: string) => {
    if (key === "setup") return step === "setup" ? "active" : (step === "select" || step === "results") ? "done" : "todo";
    if (key === "select") return step === "select" ? "active" : step === "results" ? "done" : "todo";
    if (key === "results") return step === "results" ? "active" : "todo";
    return "todo";
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Compare & Rank</div>
          <div className="page-subtitle">Run deterministic product comparison and ranking using your templates</div>
        </div>
        {step === "list" && (
          <button className="btn btn-primary" onClick={() => setStep("setup")}>
            <Plus size={15} /> New Comparison
          </button>
        )}
        {step !== "list" && (
          <button className="btn btn-secondary" onClick={() => { setStep("list"); setSetupParams(null); setRunId(null); }}>
            ← All Comparisons
          </button>
        )}
      </div>

      <div className="page-content">
        {/* Comparison List */}
        {step === "list" && (
          <div className="card">
            <div className="card-header"><div className="card-title">Comparison History</div></div>
            {isLoading ? (
              <div style={{ padding: 40, textAlign: "center" }}><div className="loading-spin" style={{ margin: "0 auto" }} /></div>
            ) : comparisons.length === 0 ? (
              <div className="empty-state" style={{ padding: 60 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
                <h3>No comparisons yet</h3>
                <p>Run your first comparison to rank products.</p>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setStep("setup")}>Start Comparison</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>ID</th><th>Template</th><th>Status</th><th>Created</th><th>Completed</th><th>Version</th><th></th></tr>
                  </thead>
                  <tbody>
                    {comparisons.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700 }}>#{c.id}</td>
                        <td>Template #{c.ranking_template_id}</td>
                        <td>
                          <span className={`badge ${c.status === "COMPLETED" ? "badge-green" : c.status === "FAILED" ? "badge-red" : "badge-yellow"}`}>{c.status}</span>
                        </td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(c.created_at).toLocaleString()}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>{c.completed_at ? new Date(c.completed_at).toLocaleString() : "—"}</td>
                        <td style={{ color: "var(--muted)", fontSize: 12 }}>v{c.calculation_version}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setRunId(c.id); setSetupParams({ templateId: c.ranking_template_id, productClassId: c.product_class_id, categoryId: 0, assetProductId: c.asset_product_id || undefined }); setStep("results"); }}>
                            View Results
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Wizard Steps */}
        {step !== "list" && (
          <>
            {/* Stepper */}
            <div className="stepper" style={{ marginBottom: 28, maxWidth: 540 }}>
              {stepLabels.map((s, i) => (
                <div key={s.key} className="step-item">
                  <div className={`step-circle ${getStepStatus(s.key)}`}>{getStepStatus(s.key) === "done" ? "✓" : i + 1}</div>
                  <div className={`step-label ${getStepStatus(s.key)}`}>{s.label}</div>
                  {i < stepLabels.length - 1 && <div className={`step-line ${getStepStatus(s.key) === "done" ? "done" : ""}`} />}
                </div>
              ))}
            </div>

            {step === "setup" && (
              <SetupStep onNext={(params) => { setSetupParams(params); setStep("select"); }} />
            )}

            {step === "select" && setupParams && (
              <ProductSelectionStep
                productClassId={setupParams.productClassId}
                onBack={() => setStep("setup")}
                onRun={(ids) => runComparison.mutate(ids)}
                isRunning={runComparison.isPending}
              />
            )}

            {step === "results" && runId && (
              <ResultsView runId={runId} assetProductId={setupParams?.assetProductId} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
