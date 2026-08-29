"use client";
import { useQuery } from "@tanstack/react-query";
import { comparisonsApi } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from "recharts";
import { fmt } from "@/lib/formatting";

export default function ReportsPage() {
  const { data: comparisons = [], isLoading } = useQuery({ queryKey: ["comparisons"], queryFn: comparisonsApi.list });

  const completed = comparisons.filter(c => c.status === "COMPLETED");

  const timeline = completed.map((c, i) => ({
    name: `Run #${c.id}`,
    date: new Date(c.created_at).toLocaleDateString(),
    results: c.comparison_results?.length || 0,
  }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Historical comparison analytics and trend analysis</div>
        </div>
      </div>
      <div className="page-content stack">
        {/* Summary stats */}
        <div className="grid-4">
          {[
            { label: "Total Comparisons", value: comparisons.length },
            { label: "Completed", value: completed.length },
            { label: "Failed", value: comparisons.filter(c => c.status === "FAILED").length },
            { label: "Avg Results/Run", value: completed.length > 0 ? (completed.reduce((s, c) => s + (c.comparison_results?.length || 0), 0) / completed.length).toFixed(1) : "0" },
          ].map(({ label, value }) => (
            <div key={label} className="card" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: "var(--primary)" }}>{value}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Timeline Chart */}
        <div className="card">
          <div className="card-header"><div className="card-title">Comparison Timeline</div></div>
          <div className="card-body">
            {timeline.length === 0 ? (
              <div className="empty-state"><h3>No data yet</h3><p>Run comparisons to see reports.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="results" name="Products Compared" fill="#2563EB" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="card">
          <div className="card-header"><div className="card-title">Comparison History</div></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Run ID</th><th>Status</th><th>Products</th><th>Created</th><th>Calc Version</th></tr>
              </thead>
              <tbody>
                {comparisons.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>#{c.id}</td>
                    <td><span className={`badge ${c.status === "COMPLETED" ? "badge-green" : c.status === "FAILED" ? "badge-red" : "badge-yellow"}`}>{c.status}</span></td>
                    <td>{c.comparison_results?.length || 0}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{new Date(c.created_at).toLocaleString()}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>v{c.calculation_version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
