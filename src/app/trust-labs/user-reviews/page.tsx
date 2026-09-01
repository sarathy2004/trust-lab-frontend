"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { userReviewsApi, productsApi, UserReviewResponse } from "@/lib/api";
import {
  MessageSquare, Search, RefreshCw, ThumbsUp, AlertTriangle,
  FileText, MessageCircle, ExternalLink, Cpu, ShieldCheck, UserCheck, Layers, ChevronDown, ChevronUp
} from "lucide-react";

const PRESET_DEVICES = [
  "Fortigate 80F",
  "Fortigate 7121F",
  "Palo Alto PA-3200",
  "Cisco Firepower 2100",
  "Check Point 1500"
];

export default function UserReviewsPage() {
  const [deviceName, setDeviceName] = useState("Fortigate 80F");
  const [limit, setLimit] = useState(10);
  const [activeSubTab, setActiveSubTab] = useState<"report" | "threads">("report");
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  // Query catalog products for quick selection
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list()
  });

  // Mutation for fetching/synthesizing user review data from backend API
  const reviewMutation = useMutation({
    mutationFn: (vars: { device: string; limitNum: number }) =>
      userReviewsApi.getSummary(vars.device, vars.limitNum)
  });

  const handleAnalyze = (targetDevice?: string) => {
    const queryDev = targetDevice || deviceName;
    if (!queryDev.trim()) return;
    setDeviceName(queryDev);
    reviewMutation.mutate({ device: queryDev, limitNum: limit });
  };

  const togglePostExpand = (postId: string) => {
    setExpandedPosts(prev => ({ ...prev, [postId]: !prev[postId] }));
  };

  const data: UserReviewResponse | undefined = reviewMutation.data;
  const isLoading = reviewMutation.isPending;

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">User Review & Community Intelligence</div>
          <div className="page-subtitle">
            AI-synthesized Reddit community feedback, operational deployment experiences, and peer reviews
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Search & Control Card */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
                <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "var(--muted)" }} />
                <input
                  type="text"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  placeholder="Enter device or product name (e.g. FortiGate 7121F)..."
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>Threads limit:</span>
                <select
                  className="form-control"
                  style={{ width: 80 }}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={() => handleAnalyze()}
                disabled={isLoading}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                {isLoading ? (
                  <>
                    <RefreshCw size={15} className="spin" /> Synthesizing...
                  </>
                ) : (
                  <>
                    <MessageSquare size={15} /> Fetch & Synthesize
                  </>
                )}
              </button>
            </div>

            {/* Quick Select Presets */}
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>Quick Select:</span>
              {PRESET_DEVICES.map(p => (
                <button
                  key={p}
                  className={`btn btn-sm ${deviceName === p ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => handleAnalyze(p)}
                  disabled={isLoading}
                >
                  {p}
                </button>
              ))}

              {catalogProducts.length > 0 && catalogProducts.slice(0, 3).map(p => (
                <button
                  key={`cat-${p.id}`}
                  className={`btn btn-sm ${deviceName === p.name ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => handleAnalyze(p.name)}
                  disabled={isLoading}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="card" style={{ textAlign: "center", padding: "48px 24px", marginBottom: 24 }}>
            <RefreshCw size={36} className="spin" style={{ color: "var(--primary)", margin: "0 auto 16px" }} />
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Scraping Reddit & Synthesizing Reviews</h3>
            <p style={{ color: "var(--muted)", maxWidth: 520, margin: "0 auto", fontSize: 14 }}>
              Querying keyless Reddit endpoints, extracting post threads and comment trees for <strong>"{deviceName}"</strong>, and processing via Gemini LLM...
            </p>
          </div>
        )}

        {/* Error State */}
        {reviewMutation.isError && (
          <div className="card" style={{ borderColor: "var(--danger)", marginBottom: 24 }}>
            <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--danger)" }}>
              <AlertTriangle size={24} />
              <div>
                <div style={{ fontWeight: 600 }}>Error fetching user reviews</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {(reviewMutation.error as Error).message || "Failed to reach backend user review service."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Display */}
        {data && !isLoading && (
          <div>
            {/* Metric Summary Cards */}
            <div className="grid-4" style={{ marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-icon blue"><Cpu size={20} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: 16 }}>{data.device_name}</div>
                  <div className="stat-label">Evaluated Device</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon green"><MessageCircle size={20} /></div>
                <div>
                  <div className="stat-value">{data.post_count}</div>
                  <div className="stat-label">Reddit Threads Analyzed</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon amber"><ShieldCheck size={20} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: 15, color: "var(--success)" }}>Positive (Cautious)</div>
                  <div className="stat-label">Overall Sentiment</div>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon blue"><UserCheck size={20} /></div>
                <div>
                  <div className="stat-value" style={{ fontSize: 14 }}>
                    {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="stat-label">Synthesis Time</div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs (Report vs Scraped Threads) */}
            <div style={{ display: "flex", gap: 12, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
              <button
                className={`btn ${activeSubTab === "report" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveSubTab("report")}
                style={{ borderRadius: "8px 8px 0 0", borderBottom: activeSubTab === "report" ? "2px solid var(--primary)" : "none" }}
              >
                <FileText size={15} /> Executive Intelligence Report
              </button>
              <button
                className={`btn ${activeSubTab === "threads" ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveSubTab("threads")}
                style={{ borderRadius: "8px 8px 0 0", borderBottom: activeSubTab === "threads" ? "2px solid var(--primary)" : "none" }}
              >
                <Layers size={15} /> Scraped Reddit Threads ({data.scraped_payload.length})
              </button>
            </div>

            {/* Sub-Tab 1: Executive Intelligence Report */}
            {activeSubTab === "report" && (
              <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="card-title">User Review & Operational Experience Summary</div>
                  <span className="badge badge-green">In-Memory Synthesized</span>
                </div>
                <div className="card-body">
                  <MarkdownRenderer content={data.summary_report} />
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Scraped Reddit Threads */}
            {activeSubTab === "threads" && (
              <div className="stack" style={{ gap: 16 }}>
                {data.scraped_payload.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: "center" }}>
                    <MessageSquare size={32} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
                    <p style={{ color: "var(--muted)" }}>No scraped Reddit threads available for this query.</p>
                  </div>
                ) : (
                  data.scraped_payload.map((post, idx) => (
                    <div key={post.post_id || idx} className="card">
                      <div className="card-body">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                          <div>
                            <span className="badge badge-blue" style={{ marginRight: 8 }}>{post.subreddit}</span>
                            <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>Posted by {post.author}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "var(--muted)" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <ThumbsUp size={14} /> {post.score}
                            </span>
                            {post.permalink && (
                              <a href={post.permalink} target="_blank" rel="noreferrer" style={{ color: "var(--primary)", display: "flex", alignItems: "center", gap: 3 }}>
                                Reddit Link <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        </div>

                        <h4 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                          {post.title}
                        </h4>

                        {post.selftext && (
                          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, marginBottom: 12, whiteSpace: "pre-wrap" }}>
                            {post.selftext.length > 300 && !expandedPosts[post.post_id]
                              ? `${post.selftext.slice(0, 300)}...`
                              : post.selftext}
                          </p>
                        )}

                        {post.comments && post.comments.length > 0 && (
                          <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => togglePostExpand(post.post_id)}
                              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
                            >
                              <MessageCircle size={14} />
                              {post.comments.length} Comment Threads
                              {expandedPosts[post.post_id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {expandedPosts[post.post_id] && (
                              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10, paddingLeft: 14, borderLeft: "2px solid var(--border)" }}>
                                {post.comments.map((c, cIdx) => (
                                  <div key={c.comment_id || cIdx} style={{ fontSize: 13 }}>
                                    <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>
                                      {c.author} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12 }}>({c.score} points)</span>
                                    </div>
                                    <div style={{ color: "var(--muted)", lineHeight: 1.4 }}>{c.body}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Initial Empty / Prompt State */}
        {!data && !isLoading && !reviewMutation.isError && (
          <div className="card" style={{ textAlign: "center", padding: "54px 24px" }}>
            <MessageSquare size={44} style={{ color: "var(--primary)", margin: "0 auto 16px", opacity: 0.8 }} />
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Explore Real-World User Reviews</h3>
            <p style={{ color: "var(--muted)", maxWidth: 540, margin: "0 auto 20px", fontSize: 14, lineHeight: 1.6 }}>
              Select a target device above or type any enterprise security product name to fetch keyless Reddit community discussions and generate an AI-synthesized operational experience report.
            </p>
            <button className="btn btn-primary" onClick={() => handleAnalyze()}>
              Analyze Fortigate 80F
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Helper component to format structured markdown content cleanly
 */
function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  // Split report into sections and render styled blocks
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let keyCounter = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(1).filter(r => !r.every(cell => cell.includes("---") || cell.includes(":")));
      elements.push(
        <div key={`table-${keyCounter++}`} className="table-wrap" style={{ margin: "20px 0" }}>
          <table>
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i}>{h.trim()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>
                      {cell.trim().startsWith("`") && cell.trim().endsWith("`") ? (
                        <code style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4, fontSize: 12 }}>
                          {cell.trim().replace(/`/g, "")}
                        </code>
                      ) : (
                        cell.trim()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line: string) => {
    const trimmed = line.trim();


    if (trimmed.startsWith("|")) {
      inTable = true;
      const cells = trimmed.split("|").slice(1, -1);
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${keyCounter++}`} style={{ fontSize: 22, fontWeight: 700, margin: "24px 0 14px", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
          {trimmed.replace("# ", "")}
        </h1>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${keyCounter++}`} style={{ fontSize: 18, fontWeight: 600, margin: "20px 0 10px", color: "var(--primary)" }}>
          {trimmed.replace("## ", "")}
        </h2>
      );
    } else if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${keyCounter++}`} style={{ fontSize: 15, fontWeight: 600, margin: "16px 0 8px" }}>
          {trimmed.replace("### ", "")}
        </h3>
      );
    } else if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      elements.push(
        <li key={`li-${keyCounter++}`} style={{ marginLeft: 20, marginBottom: 4, fontSize: 14, lineHeight: 1.5, color: "var(--text)" }}>
          {renderFormattedText(trimmed.substring(2))}
        </li>
      );
    } else if (trimmed === "---") {
      elements.push(<hr key={`hr-${keyCounter++}`} style={{ margin: "20px 0", border: "none", borderTop: "1px solid var(--border)" }} />);
    } else if (trimmed.length > 0) {
      elements.push(
        <p key={`p-${keyCounter++}`} style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 10, color: "var(--text)" }}>
          {renderFormattedText(trimmed)}
        </p>
      );
    }
  });

  if (inTable) {
    flushTable();
  }

  return <div style={{ lineHeight: 1.6 }}>{elements}</div>;
}

function renderFormattedText(text: string) {
  // Simple bold parser
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
