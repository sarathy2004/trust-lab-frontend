// Trust Labs API client — all REST calls to the FastAPI backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Categories ────────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => request<Category[]>("/categories"),
  create: (data: CategoryCreate) => request<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<CategoryCreate>) => request<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/categories/${id}`, { method: "DELETE" }),
};

// ── Product Classes ────────────────────────────────────────────────────────────
export const productClassesApi = {
  list: (categoryId?: number) => request<ProductClass[]>(`/product-classes${categoryId ? `?category_id=${categoryId}` : ""}`),
  create: (data: ProductClassCreate) => request<ProductClass>("/product-classes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ProductClassCreate>) => request<ProductClass>(`/product-classes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Characteristics ───────────────────────────────────────────────────────────
export const characteristicsApi = {
  list: () => request<Characteristic[]>("/characteristics"),
  create: (data: CharacteristicCreate) => request<Characteristic>("/characteristics", { method: "POST", body: JSON.stringify(data) }),
  getOptions: (charId: number) => request<CharacteristicOption[]>(`/characteristics/${charId}/options`),
  createOption: (charId: number, data: CharacteristicOptionCreate) =>
    request<CharacteristicOption>(`/characteristics/${charId}/options`, { method: "POST", body: JSON.stringify({ ...data, characteristic_id: charId }) }),
};

// ── Templates ─────────────────────────────────────────────────────────────────
export const templatesApi = {
  list: (productClassId?: number) => request<RankingTemplate[]>(`/templates${productClassId ? `?product_class_id=${productClassId}` : ""}`),
  get: (id: number) => request<RankingTemplate>(`/templates/${id}`),
  create: (data: RankingTemplateCreate) => request<RankingTemplate>("/templates", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<RankingTemplateCreate>) => request<RankingTemplate>(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  createGroup: (templateId: number, data: RankingGroupCreate) =>
    request<RankingGroup>(`/templates/${templateId}/groups`, { method: "POST", body: JSON.stringify(data) }),
  updateGroup: (templateId: number, groupId: number, data: RankingGroupCreate) =>
    request<RankingGroup>(`/templates/${templateId}/groups/${groupId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteGroup: (templateId: number, groupId: number) =>
    request<void>(`/templates/${templateId}/groups/${groupId}`, { method: "DELETE" }),
  addCharacteristic: (groupId: number, data: TemplateCharacteristicCreate) =>
    request<TemplateCharacteristic>(`/templates/groups/${groupId}/characteristics`, { method: "POST", body: JSON.stringify(data) }),
  updateCharacteristic: (charId: number, data: Partial<TemplateCharacteristicCreate>) =>
    request<TemplateCharacteristic>(`/templates/characteristics/${charId}`, { method: "PUT", body: JSON.stringify(data) }),
  removeCharacteristic: (charId: number) =>
    request<void>(`/templates/characteristics/${charId}`, { method: "DELETE" }),
  addCharOption: (tcId: number, data: TemplateCharacteristicOptionCreate) =>
    request<TemplateCharacteristicOption>(`/templates/characteristics/${tcId}/options`, { method: "POST", body: JSON.stringify(data) }),
};

// ── Vendors ───────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list: () => request<Vendor[]>("/vendors"),
  create: (data: VendorCreate) => request<Vendor>("/vendors", { method: "POST", body: JSON.stringify(data) }),
  get: (id: number) => request<Vendor>(`/vendors/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { vendor_id?: number; category_id?: number; product_class_id?: number }) => {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : "";
    return request<Product[]>(`/products${qs}`);
  },
  get: (id: number) => request<Product>(`/products/${id}`),
  create: (data: ProductCreate) => request<Product>("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: Partial<ProductCreate>) => request<Product>(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  addVersion: (productId: number, data: ProductVersionCreate) =>
    request<ProductVersion>(`/products/${productId}/versions`, { method: "POST", body: JSON.stringify(data) }),
  updateVersion: (versionId: number, data: Partial<ProductVersionCreate>) =>
    request<ProductVersion>(`/products/versions/${versionId}`, { method: "PUT", body: JSON.stringify(data) }),
  addClassMapping: (productId: number, productClassId: number) =>
    request<void>(`/products/${productId}/class-mappings`, { method: "POST", body: JSON.stringify({ product_class_id: productClassId }) }),
  getClassMappings: (productId: number) => request<ClassMapping[]>(`/products/${productId}/class-mappings`),
  addValue: (versionId: number, data: ProductValueCreate) =>
    request<ProductValue>(`/products/versions/${versionId}/values`, { method: "POST", body: JSON.stringify(data) }),
  updateValue: (valueId: number, data: Partial<ProductValueCreate>) =>
    request<ProductValue>(`/products/values/${valueId}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteValue: (valueId: number) =>
    request<void>(`/products/values/${valueId}`, { method: "DELETE" }),
  getValues: (versionId: number) => request<ProductValue[]>(`/products/versions/${versionId}/values`),
  addOptionValue: (versionId: number, data: ProductOptionValueCreate) =>
    request<ProductOptionValue>(`/products/versions/${versionId}/option-values`, { method: "POST", body: JSON.stringify(data) }),
  getOptionValues: (versionId: number) => request<ProductOptionValue[]>(`/products/versions/${versionId}/option-values`),
};


// ── Threat Intelligence ──────────────────────────────────────────────────────
export const threatIntelApi = {
  get: (versionId: number) => request<ThreatIntelResult>(`/threat-intel/${versionId}`),
  fetch: (versionId: number) => request<ThreatIntelResult>(`/threat-intel/fetch/${versionId}`, { method: "POST" }),
  fetchAll: () => request<ThreatIntelFetchAllItem[]>("/threat-intel/fetch-all", { method: "POST" }),
  getSettings: () => request<ThreatIntelSettings>("/threat-intel/settings"),
  updateSettings: (data: { nvd_api_key: string }) => request<ThreatIntelSettings>("/threat-intel/settings", { method: "PUT", body: JSON.stringify(data) }),
  testApiKey: (data: { nvd_api_key?: string }) => request<{ success: boolean; message: string }>("/threat-intel/test-api-key", { method: "POST", body: JSON.stringify(data) }),
  updateVulnerability: (id: number, data: { affected_status?: string; fixed_version?: string; analyst_notes?: string }) => request<ProductVulnerability>(`/threat-intel/vulnerabilities/${id}`, { method: "PUT", body: JSON.stringify(data) }),
};


// ── Comparisons ───────────────────────────────────────────────────────────────
export const comparisonsApi = {
  list: () => request<ComparisonRun[]>("/comparisons"),
  create: (data: ComparisonRunCreate) => request<ComparisonRun>("/comparisons", { method: "POST", body: JSON.stringify(data) }),
  get: (id: number) => request<ComparisonRun>(`/comparisons/${id}`),
  getResults: (id: number) => request<RankedResult[]>(`/comparisons/${id}/results`),
  rerank: (id: number) => request<ComparisonRun>(`/comparisons/${id}/rerank`, { method: "POST" }),
};


// ── Types ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: number; name: string; code: string; description?: string; is_active: boolean; created_at: string; updated_at: string;
}
export interface CategoryCreate { name: string; code: string; description?: string; is_active?: boolean; }

export interface ProductClass {
  id: number; category_id: number; parent_class_id?: number; name: string; code: string; description?: string; is_active: boolean; created_at: string; updated_at: string;
}
export interface ProductClassCreate { category_id: number; parent_class_id?: number; name: string; code: string; description?: string; }

export interface Characteristic {
  id: number; name: string; code: string; description?: string; characteristic_type: string; default_data_type?: string; is_active: boolean;
  options: CharacteristicOption[];
}
export interface CharacteristicCreate { name: string; code: string; characteristic_type: string; description?: string; }
export interface CharacteristicOption { id: number; characteristic_id: number; name: string; code: string; data_type: string; default_priority: number; is_active: boolean; }
export interface CharacteristicOptionCreate { name: string; code: string; data_type?: string; default_priority?: number; characteristic_id?: number; }

export interface RankingTemplate {
  id: number; product_class_id: number; name: string; version: string; status: string; description?: string;
  effective_from?: string; effective_to?: string; created_at: string; updated_at: string; groups: RankingGroup[];
}
export interface RankingTemplateCreate { product_class_id: number; name: string; version: string; status?: string; description?: string; }
export interface RankingGroup {
  id: number; ranking_template_id: number; name: string; code: string; priority: number; group_weight?: number; display_order: number; is_active: boolean;
  template_characteristics: TemplateCharacteristic[];
}
export interface RankingGroupCreate { name: string; code: string; priority: number; display_order?: number; }
export interface TemplateCharacteristic {
  id: number; ranking_group_id: number; characteristic_id: number; priority: number; required: boolean;
  scoring_method: string; direction?: string; display_order: number; is_active: boolean;
  scoring_config_json?: Record<string, any>;
  characteristic: Characteristic; template_options: TemplateCharacteristicOption[];
}
export interface TemplateCharacteristicCreate {
  ranking_group_id: number; characteristic_id: number; priority: number; required?: boolean;
  scoring_method: string; direction?: string; display_order?: number;
  scoring_config_json?: Record<string, any>;
  template_options?: TemplateCharacteristicOptionCreate[];
}
export interface TemplateCharacteristicOption {
  id: number; template_characteristic_id: number; characteristic_option_id: number; priority: number; required: boolean; is_active: boolean;
  option: CharacteristicOption;
}
export interface TemplateCharacteristicOptionCreate { characteristic_option_id: number; priority: number; required?: boolean; }

export interface Vendor { id: number; name: string; code: string; website?: string; is_active: boolean; created_at: string; updated_at: string; }
export interface VendorCreate { name: string; code: string; description?: string; website?: string; }

export interface Product {
  id: number; vendor_id: number; category_id: number; name: string; model?: string; product_family?: string;
  description?: string; lifecycle_status: string; is_active: boolean;
  vendor: Vendor; versions: ProductVersion[];
}
export interface ProductCreate { vendor_id: number; category_id: number; name: string; model?: string; product_family?: string; description?: string; }
export interface ProductVersion {
  id: number; product_id: number; version: string; release_date?: string; eol_date?: string;
  support_status: string; is_current: boolean; product_values: ProductValue[]; product_option_values: ProductOptionValue[];
}
export interface ProductVersionCreate { version: string; release_date?: string; eol_date?: string; support_status?: string; is_current?: boolean; }
export interface ProductValue {
  id: number; product_version_id: number; characteristic_id: number; value_numeric?: number;
  value_text?: string; value_boolean?: boolean; value_json?: Record<string, unknown>; unit?: string; status: string;
}
export interface ProductValueCreate {
  characteristic_id: number; value_numeric?: number; value_text?: string;
  value_boolean?: boolean; value_json?: Record<string, unknown>; unit?: string; status?: string;
}
export interface ProductOptionValue {
  id: number; product_version_id: number; characteristic_option_id: number;
  value_boolean?: boolean; value_numeric?: number; value_text?: string; status?: string; license_dependency?: string;
}
export interface ProductOptionValueCreate {
  characteristic_option_id: number; value_boolean?: boolean; value_numeric?: number; value_text?: string; status?: string; license_dependency?: string;
}

export interface ClassMapping { id: number; product_class_id: number; eligibility_status: string; }

export interface Vulnerability {
  id: number; cve_id: string; description?: string;
  cvss_score?: number; cvss_vector?: string; cvss_source?: string;
  epss_score?: number; is_kev: boolean; kev_date_added?: string; published_date?: string;
}
export interface ProductVulnerability {
  id: number; product_version_id: number; vulnerability_id: number;
  affected_status: "AFFECTED" | "PATCHED" | "MITIGATED" | "FALSE_POSITIVE" | "UNKNOWN";
  correlation_confidence: "VERSION_CONFIRMED" | "PRODUCT_MATCH_ONLY";
  fixed_version?: string;
  analyst_notes?: string;
  cve_risk?: number;
  vulnerability: Vulnerability;
}
export interface ThreatIntelResult {
  product_version_id: number;
  threat_score: number; raw_risk: number; policy_risk: number;
  risk_band: string; data_status: string; risk_policy_version: string; calculated_at: string;
  critical: number; high: number; medium: number; low: number;
  max_epss: number; weaponized_count: number; kev: number;
  patched_count: number; unpatched_count: number; patch_status: string;
  correlation_note?: string;
  cves: ProductVulnerability[];
}
export interface ThreatIntelFetchAllItem {
  product_version_id: number; product_name: string; success: boolean;
  result?: ThreatIntelResult; error?: string;
}
export interface ThreatIntelSettings {
  nvd_api_key_configured: boolean;
  nvd_api_key_masked?: string;
  rate_limit: string;
  source: "DATABASE" | "ENV" | "NONE";
}

export interface ComparisonRun {
  id: number; ranking_template_id: number; product_class_id: number; asset_product_id?: number;
  status: string; calculation_version: string; created_at: string; completed_at?: string;
  comparison_results: RankedResult[]; eligibilities: EligibilityResult[];
}
export interface ComparisonRunCreate { ranking_template_id: number; product_class_id: number; asset_product_id?: number; product_ids: number[]; }

export interface RankedResult {
  product_id: number; product_name: string; vendor_name: string; rank?: number; rank_status: string;
  overall_score?: number; is_current_asset: boolean;
  security_score?: number; performance_score?: number; compliance_score?: number;
  eligibility_status: string; failed_requirements?: Array<{ characteristic: string; reason: string }>;
  group_scores: GroupScore[]; characteristic_scores: CharacteristicScore[];
}
export interface GroupScore { group_id: number; group_score?: number; group_weight?: number; weighted_group_score?: number; }
export interface CharacteristicScore {
  tc_id: number; name: string; normalized_score?: number; weight?: number; weighted_score?: number;
  calculation_details?: Record<string, unknown>; option_results: OptionScore[];
}
export interface OptionScore { option_id: number; option_name: string; child_score?: number; child_priority?: number; weighted_child_score?: number; raw_value?: Record<string, unknown>; }
export interface EligibilityResult { product_id: number; status: string; failed_requirements_json?: unknown[]; }
