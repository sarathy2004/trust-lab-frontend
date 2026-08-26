// Formatting utilities for scores, weights and labels

export function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function scoreBadgeClass(score: number | null | undefined): string {
  if (score == null) return "badge-gray";
  if (score >= 90) return "badge-green";
  if (score >= 70) return "badge-yellow";
  return "badge-red";
}

export function statusColor(status: string): string {
  switch (status) {
    case "ELIGIBLE": return "text-green-600 bg-green-50";
    case "INELIGIBLE": return "text-red-600 bg-red-50";
    case "REVIEW": return "text-yellow-600 bg-yellow-50";
    case "PUBLISHED": return "text-blue-600 bg-blue-50";
    case "DRAFT": return "text-gray-600 bg-gray-50";
    case "ARCHIVED": return "text-purple-600 bg-purple-50";
    case "ACTIVE": return "text-green-600 bg-green-50";
    case "END_OF_LIFE": return "text-red-600 bg-red-50";
    case "SUPPORTED": return "text-green-600 bg-green-50";
    case "NOT_SUPPORTED": return "text-red-600 bg-red-50";
    case "PARTIAL": return "text-yellow-600 bg-yellow-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

export function characteristicTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    NUMERIC: "Numeric",
    COMPOSITE: "Composite",
    FEATURE: "Feature",
    LICENSED_FEATURE: "Licensed Feature",
    THRESHOLD: "Threshold",
    RISK: "Risk",
    LIFECYCLE: "Lifecycle",
    RANGE: "Range",
    ASSURANCE: "Assurance",
  };
  return labels[type] || type;
}

export function scoreColor(score: number | null | undefined): string {
  if (score == null) return "#94A3B8";
  if (score >= 90) return "#16A34A";
  if (score >= 70) return "#F59E0B";
  return "#DC2626";
}
