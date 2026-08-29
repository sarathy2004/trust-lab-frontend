import Sidebar from "@/components/layout/Sidebar";

export default function TrustLabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">{children}</div>
    </div>
  );
}
