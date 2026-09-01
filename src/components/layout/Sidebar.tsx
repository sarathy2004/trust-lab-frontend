"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Shield, Package, BarChart3,
  Settings, ChevronRight, FileText, Activity, Eye, GitCompare, MessageSquare
} from "lucide-react";

const globalNav = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Trust Labs", href: "/trust-labs/overview", icon: Shield },
  { label: "Settings", href: "/settings", icon: Settings },
];

const trustLabsNav = [
  { label: "Overview", href: "/trust-labs/overview", icon: Eye },
  { label: "Product Intelligence", href: "/trust-labs/products", icon: Package },
  { label: "Templates", href: "/trust-labs/templates", icon: FileText },
  { label: "Compare & Rank", href: "/trust-labs/comparisons", icon: GitCompare },
  { label: "Threat Intelligence", href: "/trust-labs/monitoring", icon: Activity },
  { label: "User Reviews", href: "/trust-labs/user-reviews", icon: MessageSquare },
  { label: "Reports", href: "/trust-labs/reports", icon: BarChart3 },
];




export default function Sidebar() {
  const pathname = usePathname();
  const inTrustLabs = pathname.startsWith("/trust-labs");

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">TL</div>
        <div>
          <div className="logo-text">Trust Labs</div>
          <div className="logo-sub">VERAC Platform</div>
        </div>
      </div>

      {/* Global Nav */}
      <div className="sidebar-section">
        <div className="sidebar-section-title">Navigation</div>
        {globalNav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`nav-item ${pathname === href || (href !== "/" && pathname.startsWith(href)) ? "active" : ""}`}
          >
            <Icon size={16} />
            {label}
            {label === "Trust Labs" && <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />}
          </Link>
        ))}
      </div>

      {/* Trust Labs Sub-Nav */}
      {inTrustLabs && (
        <div className="sidebar-section" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="sidebar-section-title">Trust Labs</div>
          {trustLabsNav.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={`nav-item ${pathname === href ? "active" : ""}`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}

        </div>
      )}

      {/* Bottom */}
      <div style={{ marginTop: "auto", padding: "16px", borderTop: "1px solid var(--border)" }}>
        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
          Ranking Engine v1.0
        </div>
        <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: 2 }}>
          © 2026 Trust Labs
        </div>
      </div>
    </aside>
  );
}
