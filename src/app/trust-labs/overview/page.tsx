"use client";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi, productClassesApi, templatesApi, productsApi, comparisonsApi } from "@/lib/api";
import { Shield, Package, FileText, GitCompare, TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { fmt } from "@/lib/formatting";

export default function OverviewPage() {
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list() });
  const { data: templates = [] } = useQuery({ queryKey: ["templates"], queryFn: () => templatesApi.list() });
  const { data: comparisons = [] } = useQuery({ queryKey: ["comparisons"], queryFn: comparisonsApi.list });

  const latestComparisons = comparisons.slice(0, 5);
  const completedCount = comparisons.filter(c => c.status === "COMPLETED").length;
  const publishedTemplates = templates.filter(t => t.status === "PUBLISHED").length;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Trust Labs Overview</div>
          <div className="page-subtitle">Enterprise cybersecurity product ranking & intelligence platform</div>
        </div>
        <Link href="/trust-labs/comparisons/new" className="btn btn-primary">
          <GitCompare size={15} /> New Comparison
        </Link>
      </div>

      <div className="page-content">
        {/* Stats */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <div className="stat-card">
            <div className="stat-icon blue"><Package size={20} /></div>
            <div>
              <div className="stat-value">{products.length}</div>
              <div className="stat-label">Products Tracked</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FileText size={20} /></div>
            <div>
              <div className="stat-value">{publishedTemplates}</div>
              <div className="stat-label">Published Templates</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon amber"><GitCompare size={20} /></div>
            <div>
              <div className="stat-value">{comparisons.length}</div>
              <div className="stat-label">Comparisons Run</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><Shield size={20} /></div>
            <div>
              <div className="stat-value">{categories.length}</div>
              <div className="stat-label">Product Categories</div>
            </div>
          </div>
        </div>

        <div className="grid-2">
          {/* Recent Comparisons */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Recent Comparisons</div>
              <Link href="/trust-labs/comparisons" className="btn btn-ghost btn-sm">View all</Link>
            </div>
            <div className="table-wrap">
              {latestComparisons.length === 0 ? (
                <div className="empty-state">
                  <GitCompare size={40} />
                  <h3>No comparisons yet</h3>
                  <p>Start your first comparison to rank products.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestComparisons.map(c => (
                      <tr key={c.id}>
                        <td><span style={{ fontWeight: 600 }}>#{c.id}</span></td>
                        <td>
                          <span className={`badge ${c.status === "COMPLETED" ? "badge-green" : c.status === "FAILED" ? "badge-red" : "badge-yellow"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ color: "var(--muted)" }}>
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          <Link href={`/trust-labs/comparisons/${c.id}`} className="btn btn-ghost btn-sm">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Actions</div>
            </div>
            <div className="card-body">
              <div className="stack">
                {[
                  { label: "New Comparison", desc: "Run a product ranking comparison", href: "/trust-labs/comparisons/new", icon: GitCompare, color: "blue" },
                  { label: "Add Product", desc: "Register a new vendor product", href: "/trust-labs/products", icon: Package, color: "green" },
                  { label: "Create Template", desc: "Define a new ranking methodology", href: "/trust-labs/templates", icon: FileText, color: "amber" },
                  { label: "View Reports", desc: "Analyse historical rankings", href: "/trust-labs/reports", icon: TrendingUp, color: "blue" },
                ].map(({ label, desc, href, icon: Icon, color }) => (
                  <Link key={href} href={href} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px",
                      border: "1px solid var(--border)", borderRadius: 10,
                      transition: "all 0.15s", cursor: "pointer",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                      <div className={`stat-icon ${color}`}><Icon size={18} /></div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{label}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>{desc}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Platform Status */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <div className="card-title">Platform Status</div>
          </div>
          <div className="card-body">
            <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
              {[
                { label: "Ranking Engine", status: "Operational", icon: CheckCircle, ok: true },
                { label: "Template System", status: `${publishedTemplates} published`, icon: CheckCircle, ok: true },
                { label: "Product Catalog", status: `${products.length} products`, icon: CheckCircle, ok: true },
                { label: "Comparison Engine", status: `${completedCount} completed`, icon: CheckCircle, ok: true },
              ].map(({ label, status, icon: Icon, ok }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={16} style={{ color: ok ? "var(--success)" : "var(--danger)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
