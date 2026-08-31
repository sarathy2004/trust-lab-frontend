"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  vendorsApi, productsApi, categoriesApi, productClassesApi, characteristicsApi, cvesApi,
  type Product, type ProductVersion, type ProductValue, type ProductOptionValue, type Characteristic,
  type ProductCVE, type ProductCVECreate,
} from "@/lib/api";
import { Plus, Package, X, ChevronDown, ChevronRight, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Key, Shield, ShieldAlert, ShieldCheck, Bug, ExternalLink, Search, Flame } from "lucide-react";
import { statusColor, characteristicTypeLabel, scoreColor } from "@/lib/formatting";

const vendorSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  website: z.string().optional(),
  description: z.string().optional(),
});

const productSchema = z.object({
  vendor_id: z.coerce.number().min(1, "Required"),
  category_id: z.coerce.number().min(1, "Required"),
  name: z.string().min(1),
  model: z.string().optional(),
  product_family: z.string().optional(),
  description: z.string().optional(),
});

const versionSchema = z.object({
  version: z.string().min(1),
  support_status: z.string().min(1),
  is_current: z.boolean(),
});

type VendorForm = z.infer<typeof vendorSchema>;
type ProductForm = z.infer<typeof productSchema>;
type VersionForm = z.infer<typeof versionSchema>;

export default function ProductsPage() {
  const qc = useQueryClient();
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [showVersionModal, setShowVersionModal] = useState<{ open: boolean; productId?: number }>({ open: false });
  const [showMappingModal, setShowMappingModal] = useState<{ open: boolean; productId?: number }>({ open: false });
  const [showValueModal, setShowValueModal] = useState<{ open: boolean; versionId?: number; productId?: number; valueToEdit?: ProductValue }>({ open: false });
  const [showCompositeModal, setShowCompositeModal] = useState<{ open: boolean; char?: Characteristic }>({ open: false });
  const [showAddOptionModal, setShowAddOptionModal] = useState<{ open: boolean; charId?: number }>({ open: false });
  const [showThreatModal, setShowThreatModal] = useState(false);
  const [showCveModal, setShowCveModal] = useState<{ open: boolean; cveToEdit?: ProductCVE }>({ open: false });
  const [cveSearch, setCveSearch] = useState("");
  const [cveSeverityFilter, setCveSeverityFilter] = useState("ALL");
  const [cveForm, setCveForm] = useState({
    cve_id: "",
    severity: "HIGH",
    cvss_score: "7.5",
    epss_score: "0.25",
    is_kev: false,
    patch_status: "PATCHED",
    fixed_version: "",
    source: "Vendor PSIRT",
    description: "",
  });
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [mapClassId, setMapClassId] = useState<string>("");
  
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionCode, setNewOptionCode] = useState("");

  const [threatForm, setThreatForm] = useState({
    threat_score: "0",
    raw_risk: "0",
    policy_risk: "0",
    risk_band: "UNKNOWN",
    data_status: "COMPLETE",
    risk_policy_version: "1.0",
    critical: "0", high: "0", medium: "0", low: "0", kev: "0",
  });

  const [valueForm, setValueForm] = useState({
    characteristic_id: "", value_numeric: "", value_text: "", value_boolean: "", unit: "", status: "SUPPORTED",
    risk_critical: "0", risk_high: "0", risk_medium: "0", risk_low: "0", risk_kev: "0",
  });

  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: vendorsApi.list });
  const { data: products = [], isLoading } = useQuery({ queryKey: ["products"], queryFn: () => productsApi.list() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const { data: productClasses = [] } = useQuery({ queryKey: ["product-classes"], queryFn: () => productClassesApi.list() });
  const { data: characteristics = [] } = useQuery({ queryKey: ["characteristics"], queryFn: characteristicsApi.list });

  const { data: classMappings = [] } = useQuery({
    queryKey: ["class-mappings", selectedProduct?.id],
    queryFn: () => productsApi.getClassMappings(selectedProduct!.id),
    enabled: !!selectedProduct,
  });

  const { data: productValues = [] } = useQuery({
    queryKey: ["product-values", selectedVersionId],
    queryFn: () => productsApi.getValues(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: optionValues = [] } = useQuery({
    queryKey: ["option-values", selectedVersionId],
    queryFn: () => productsApi.getOptionValues(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  const { data: versionCves = [], isLoading: isLoadingCves } = useQuery({
    queryKey: ["cves", selectedVersionId],
    queryFn: () => cvesApi.list(selectedVersionId!),
    enabled: !!selectedVersionId,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const vendorForm = useForm<VendorForm>({ resolver: zodResolver(vendorSchema) });
  const createVendor = useMutation({
    mutationFn: (d: VendorForm) => vendorsApi.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vendors"] }); setShowVendorModal(false); vendorForm.reset(); },
  });

  const productForm = useForm<ProductForm>({ resolver: zodResolver(productSchema) });
  const saveProduct = useMutation({
    mutationFn: (d: ProductForm) => {
      if (showProductModal.product) {
        return productsApi.update(showProductModal.product.id, d);
      }
      return productsApi.create(d);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowProductModal({ open: false }); productForm.reset(); },
  });

  const versionForm = useForm<VersionForm>({ resolver: zodResolver(versionSchema) as any, defaultValues: { support_status: "ACTIVE", is_current: true } });
  const createVersion = useMutation({
    mutationFn: (d: VersionForm) => productsApi.addVersion(showVersionModal.productId!, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); setShowVersionModal({ open: false }); versionForm.reset(); },
  });

  const addMapping = useMutation({
    mutationFn: () => productsApi.addClassMapping(showMappingModal.productId!, parseInt(mapClassId)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["class-mappings"] }); setShowMappingModal({ open: false }); setMapClassId(""); },
  });

  const saveValue = useMutation({
    mutationFn: () => {
      const selectedChar = characteristics.find(c => c.id === parseInt(valueForm.characteristic_id));
      const isRisk = selectedChar?.characteristic_type === "RISK";

      const payload: Partial<import("@/lib/api").ProductValueCreate> = {
        characteristic_id: parseInt(valueForm.characteristic_id),
        status: valueForm.status as any,
        ...(valueForm.unit ? { unit: valueForm.unit } : {}),
        ...(valueForm.value_numeric !== "" ? { value_numeric: parseFloat(valueForm.value_numeric) } : {}),
        ...(valueForm.value_text ? { value_text: valueForm.value_text } : {}),
        ...(valueForm.value_boolean !== "" ? { value_boolean: valueForm.value_boolean === "true" } : {}),
        ...(isRisk ? {
          value_json: {
            critical: parseInt(valueForm.risk_critical || "0"),
            high: parseInt(valueForm.risk_high || "0"),
            medium: parseInt(valueForm.risk_medium || "0"),
            low: parseInt(valueForm.risk_low || "0"),
            kev: parseInt(valueForm.risk_kev || "0"),
          }
        } : {}),
      };
      if (showValueModal.valueToEdit) {
        return productsApi.updateValue(showValueModal.valueToEdit.id, payload);
      }
      return productsApi.addValue(showValueModal.versionId!, payload as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-values"] });
      setShowValueModal({ open: false });
      setValueForm({
        characteristic_id: "", value_numeric: "", value_text: "", value_boolean: "", unit: "", status: "SUPPORTED",
        risk_critical: "0", risk_high: "0", risk_medium: "0", risk_low: "0", risk_kev: "0",
      });
    },
  });

  const deleteValue = useMutation({
    mutationFn: (valueId: number) => productsApi.deleteValue(valueId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["product-values"] }),
  });

  const toggleOptionValue = useMutation({
    mutationFn: ({ optionId, value }: { optionId: number; value: boolean }) =>
      productsApi.addOptionValue(selectedVersionId!, {
        characteristic_option_id: optionId,
        value_boolean: value,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["option-values"] }),
  });

  const saveOptionDetails = useMutation({
    mutationFn: ({ optionId, value_boolean, status, license_dependency }: { optionId: number; value_boolean: boolean; status?: string; license_dependency?: string }) =>
      productsApi.addOptionValue(selectedVersionId!, {
        characteristic_option_id: optionId,
        value_boolean,
        status: status as any || (value_boolean ? "SUPPORTED" : "NOT_SUPPORTED"),
        license_dependency: license_dependency || undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["option-values"] }),
  });

  const createChildOption = useMutation({
    mutationFn: () => characteristicsApi.createOption(showAddOptionModal.charId!, {
      name: newOptionName,
      code: newOptionCode || newOptionName.toUpperCase().replace(/\s+/g, "_"),
      default_priority: 5,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characteristics"] });
      setShowAddOptionModal({ open: false });
      setNewOptionName("");
      setNewOptionCode("");
    },
  });

  const threatChar = characteristics.find(c => c.characteristic_type === "RISK" || c.code === "THREAT_INTEL");
  const threatValue = productValues.find(v => v.characteristic_id === threatChar?.id);
  const threatJson = (threatValue?.value_json || {}) as Record<string, any>;

  // ── Spec §25: threat_score is the authoritative value from the TI module ──
  // The Ranking Engine reads threat_score directly. CVE counts are display-only metadata.
  const tiThreatScore = threatJson.threat_score != null ? Number(threatJson.threat_score) : null;
  const tiRawRisk     = threatJson.raw_risk    != null ? Number(threatJson.raw_risk)    : null;
  const tiPolicyRisk  = threatJson.policy_risk != null ? Number(threatJson.policy_risk) : null;
  const tiRiskBand    = (threatJson.risk_band   as string) || null;
  const tiDataStatus  = (threatJson.data_status as string) || "UNKNOWN";
  const tiCalcAt      = (threatJson.calculated_at as string) || null;
  const tiPolicyVer   = (threatJson.risk_policy_version as string) || null;
  // CVE counts — display/audit metadata only (not used by Ranking Engine)
  const critCount = Number(threatJson.critical || 0);
  const highCount = Number(threatJson.high || 0);
  const medCount  = Number(threatJson.medium  || 0);
  const lowCount  = Number(threatJson.low     || 0);
  const kevCount  = Number(threatJson.kev     || 0);

  const saveThreatIntel = useMutation({
    mutationFn: () => {
      if (!threatChar) throw new Error("Threat characteristic not found");
      // Spec §25: Save the full TI module response shape.
      // threat_score is authoritative; CVE counts are display-only metadata.
      const ts = parseFloat(threatForm.threat_score || "0");
      const rr = parseFloat(threatForm.raw_risk || "0");
      const pr = parseFloat(threatForm.policy_risk || "0");
      const payload: Partial<import("@/lib/api").ProductValueCreate> = {
        characteristic_id: threatChar.id,
        status: "SUPPORTED",
        value_json: {
          threat_score:        Math.min(100, Math.max(0, ts)),
          raw_risk:            rr,
          policy_risk:         pr,
          risk_band:           threatForm.risk_band || "UNKNOWN",
          data_status:         threatForm.data_status || "COMPLETE",
          risk_policy_version: threatForm.risk_policy_version || "1.0",
          calculated_at:       new Date().toISOString(),
          // CVE counts — display/audit metadata only
          critical: parseInt(threatForm.critical || "0"),
          high:     parseInt(threatForm.high     || "0"),
          medium:   parseInt(threatForm.medium   || "0"),
          low:      parseInt(threatForm.low      || "0"),
          kev:      parseInt(threatForm.kev      || "0"),
        },
      };
      if (threatValue) {
        return productsApi.updateValue(threatValue.id, payload);
      }
      return productsApi.addValue(selectedVersionId!, payload as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-values"] });
      setShowThreatModal(false);
    },
  });

  const saveCve = useMutation({
    mutationFn: () => {
      if (!selectedVersionId) throw new Error("No version selected");
      const payload: ProductCVECreate = {
        cve_id: cveForm.cve_id.trim().toUpperCase(),
        severity: cveForm.severity,
        cvss_score: cveForm.cvss_score ? parseFloat(cveForm.cvss_score) : undefined,
        epss_score: cveForm.epss_score ? parseFloat(cveForm.epss_score) : undefined,
        is_kev: cveForm.is_kev,
        patch_status: cveForm.patch_status,
        fixed_version: cveForm.fixed_version.trim() || undefined,
        source: cveForm.source.trim() || undefined,
        description: cveForm.description.trim() || undefined,
      };
      if (showCveModal.cveToEdit) {
        return cvesApi.update(selectedVersionId, showCveModal.cveToEdit.id, payload);
      }
      return cvesApi.create(selectedVersionId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cves", selectedVersionId] });
      setShowCveModal({ open: false });
    },
  });

  const deleteCve = useMutation({
    mutationFn: (cveId: number) => {
      if (!selectedVersionId) throw new Error("No version selected");
      return cvesApi.delete(selectedVersionId, cveId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cves", selectedVersionId] });
    },
  });


  const openAddValueModal = () => {
    setValueForm({
      characteristic_id: "", value_numeric: "", value_text: "", value_boolean: "", unit: "", status: "SUPPORTED",
      risk_critical: "0", risk_high: "0", risk_medium: "0", risk_low: "0", risk_kev: "0",
    });
    setShowValueModal({ open: true, versionId: selectedVersionId!, productId: selectedProduct!.id });
  };

  const openEditValueModal = (val: ProductValue) => {
    const rJson = (val.value_json || {}) as Record<string, any>;
    setValueForm({
      characteristic_id: String(val.characteristic_id),
      value_numeric: val.value_numeric != null ? String(val.value_numeric) : "",
      value_text: val.value_text || "",
      value_boolean: val.value_boolean != null ? String(val.value_boolean) : "",
      unit: val.unit || "",
      status: val.status || "SUPPORTED",
      risk_critical: rJson.critical != null ? String(rJson.critical) : "0",
      risk_high: rJson.high != null ? String(rJson.high) : "0",
      risk_medium: rJson.medium != null ? String(rJson.medium) : "0",
      risk_low: rJson.low != null ? String(rJson.low) : "0",
      risk_kev: rJson.kev != null ? String(rJson.kev) : "0",
    });
    setShowValueModal({ open: true, versionId: selectedVersionId!, productId: selectedProduct!.id, valueToEdit: val });
  };

  const compositeCharacteristics = characteristics.filter(c => c.characteristic_type === "COMPOSITE");
  const standardProductValues = productValues.filter(v => {
    const char = characteristics.find(c => c.id === v.characteristic_id);
    return char?.characteristic_type !== "RISK";
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Product Intelligence</div>
          <div className="page-subtitle">Manage vendors, products, versions, class mappings, and product values</div>
        </div>
        <div className="flex-row">
          <button className="btn btn-secondary" onClick={() => setShowVendorModal(true)}><Plus size={14} /> Vendor</button>
          <button className="btn btn-primary" onClick={() => { productForm.reset(); setShowProductModal({ open: true }); }}><Plus size={14} /> Product</button>
        </div>
      </div>

      <div className="page-content" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Products List */}
        <div className="card" style={{ width: 340, flexShrink: 0 }}>
          <div className="card-header">
            <div className="card-title">Products ({products.length})</div>
          </div>
          {isLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}><div className="loading-spin" style={{ margin: "0 auto" }} /></div>
          ) : products.length === 0 ? (
            <div className="empty-state"><Package size={36} /><h3>No products yet</h3></div>
          ) : (
            <div>
              {products.map(p => (
                <div key={p.id}>
                  <div
                    onClick={() => { setSelectedProduct(p); setExpandedProduct(expandedProduct === p.id ? null : p.id); setSelectedVersionId(p.versions?.find(v => v.is_current)?.id || p.versions?.[0]?.id || null); }}
                    style={{
                      padding: "14px 16px", cursor: "pointer",
                      background: selectedProduct?.id === p.id ? "var(--primary-light)" : "transparent",
                      borderBottom: "1px solid var(--border)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: selectedProduct?.id === p.id ? "var(--primary)" : "var(--text)" }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.vendor?.name} · {p.model}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {p.versions?.length || 0} version(s)
                      </div>
                    </div>
                    {expandedProduct === p.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Detail */}
        {selectedProduct ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Info Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">{selectedProduct.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{selectedProduct.vendor?.name} — {selectedProduct.model}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      productForm.reset({
                        vendor_id: selectedProduct.vendor_id,
                        category_id: selectedProduct.category_id,
                        name: selectedProduct.name,
                        model: selectedProduct.model || "",
                        product_family: selectedProduct.product_family || "",
                        description: selectedProduct.description || "",
                      });
                      setShowProductModal({ open: true, product: selectedProduct });
                    }}
                  >
                    <Edit2 size={13} /> Edit Product
                  </button>
                  <span className={`badge ${selectedProduct.lifecycle_status === "ACTIVE" ? "badge-green" : "badge-red"}`}>
                    {selectedProduct.lifecycle_status}
                  </span>
                </div>
              </div>
              <div className="card-body">
                <div className="grid-3">
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Category</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{categories.find(c => c.id === selectedProduct.category_id)?.name || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Product Family</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{selectedProduct.product_family || "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Versions</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{selectedProduct.versions?.length || 0}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Versions */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Versions</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowVersionModal({ open: true, productId: selectedProduct.id })}>
                  <Plus size={13} /> Add Version
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Version</th><th>Status</th><th>Current</th><th>Values</th><th>Action</th></tr></thead>
                  <tbody>
                    {(selectedProduct.versions || []).map(v => (
                      <tr key={v.id} style={{ background: selectedVersionId === v.id ? "var(--primary-light)" : undefined }}>
                        <td style={{ fontWeight: 600 }}>{v.version}</td>
                        <td><span className={`badge ${v.support_status === "ACTIVE" ? "badge-green" : "badge-red"}`}>{v.support_status}</span></td>
                        <td>{v.is_current ? <span className="badge badge-blue">Current</span> : "—"}</td>
                        <td>{v.product_values?.length || 0} values</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => { setSelectedVersionId(v.id); }}
                          >
                            Select Version
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Class Mappings */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Product Class Mappings</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowMappingModal({ open: true, productId: selectedProduct.id })}>
                  <Plus size={13} /> Map to Class
                </button>
              </div>
              {classMappings.length === 0 ? (
                <div className="empty-state" style={{ padding: 20 }}><div>Not mapped to any class yet.</div></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Product Class</th><th>Eligibility Status</th></tr></thead>
                    <tbody>
                      {classMappings.map(m => (
                        <tr key={m.id}>
                          <td>{productClasses.find(pc => pc.id === m.product_class_id)?.name || `Class #${m.product_class_id}`}</td>
                          <td><span className={`badge ${m.eligibility_status === "ELIGIBLE" ? "badge-green" : "badge-red"}`}>{m.eligibility_status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Dedicated Threat Intelligence Card — Spec §25 Architecture */}
            {selectedVersionId && threatChar && (
              <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="card-title">Threat Intelligence</div>
                      <span className="badge badge-blue">TI Module</span>
                      {tiDataStatus === "COMPLETE" && <span className="badge badge-green">Complete</span>}
                      {tiDataStatus === "PARTIAL"  && <span className="badge badge-yellow">Partial</span>}
                      {tiDataStatus === "UNKNOWN"  && <span className="badge badge-red">Unknown</span>}
                      {tiDataStatus === "STALE"    && <span className="badge badge-yellow">Stale</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Pre-calculated threat score from the Threat Intelligence module. CVE counts shown as audit metadata only.
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setThreatForm({
                        threat_score:        String(tiThreatScore ?? 0),
                        raw_risk:            String(tiRawRisk    ?? 0),
                        policy_risk:         String(tiPolicyRisk ?? 0),
                        risk_band:           tiRiskBand   || "UNKNOWN",
                        data_status:         tiDataStatus || "COMPLETE",
                        risk_policy_version: tiPolicyVer  || "1.0",
                        critical: String(critCount),
                        high:     String(highCount),
                        medium:   String(medCount),
                        low:      String(lowCount),
                        kev:      String(kevCount),
                      });
                      setShowThreatModal(true);
                    }}
                  >
                    <Edit2 size={13} /> Edit Threat Intel
                  </button>
                </div>

                <div className="card-body stack" style={{ gap: 16 }}>

                  {/* ── Row 1: Threat Score (authoritative) + metadata ── */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

                    {/* Threat Score — the single value the Ranking Engine uses */}
                    <div style={{
                      padding: "18px 20px", borderRadius: 10,
                      background: tiThreatScore === null
                        ? "var(--bg-subtle)"
                        : tiThreatScore >= 70 ? "rgba(34, 197, 94, 0.07)"
                        : tiThreatScore >= 40 ? "rgba(245, 158, 11, 0.07)"
                        : "rgba(220, 38, 38, 0.07)",
                      border: `1px solid ${
                        tiThreatScore === null ? "var(--border)"
                        : tiThreatScore >= 70 ? "rgba(34, 197, 94, 0.35)"
                        : tiThreatScore >= 40 ? "rgba(245, 158, 11, 0.35)"
                        : "rgba(220, 38, 38, 0.35)"
                      }`,
                      display: "flex", flexDirection: "column", gap: 4,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Threat Score
                      </div>
                      <div style={{
                        fontSize: 36, fontWeight: 800, lineHeight: 1,
                        color: tiThreatScore === null ? "var(--muted)"
                          : tiThreatScore >= 70 ? "var(--success)"
                          : tiThreatScore >= 40 ? "var(--warning)"
                          : "var(--danger)",
                      }}>
                        {tiThreatScore !== null ? tiThreatScore.toFixed(1) : "—"}
                        <span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)", marginLeft: 4 }}>/100</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Used directly by Ranking Engine
                      </div>
                    </div>

                    {/* Raw Risk + Policy Risk */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: "var(--bg-subtle)", border: "1px solid var(--border)",
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Risk Analysis</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Raw Risk</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{tiRawRisk !== null ? tiRawRisk.toFixed(1) : "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Policy Risk</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{tiPolicyRisk !== null ? tiPolicyRisk.toFixed(1) : "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Risk Band</span>
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                            background: tiRiskBand === "CRITICAL" ? "rgba(220,38,38,0.12)"
                              : tiRiskBand === "HIGH"     ? "rgba(245,158,11,0.12)"
                              : tiRiskBand === "MEDIUM"   ? "rgba(251,191,36,0.12)"
                              : tiRiskBand === "LOW"      ? "rgba(34,197,94,0.12)" : "var(--bg-subtle)",
                            color: tiRiskBand === "CRITICAL" ? "var(--danger)"
                              : tiRiskBand === "HIGH"     ? "var(--warning)"
                              : tiRiskBand === "MEDIUM"   ? "#d97706"
                              : tiRiskBand === "LOW"      ? "var(--success)" : "var(--muted)",
                          }}>{tiRiskBand || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Data provenance */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 10,
                      background: "var(--bg-subtle)", border: "1px solid var(--border)",
                      display: "flex", flexDirection: "column", gap: 8,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Data Provenance</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Status</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: tiDataStatus === "COMPLETE" ? "var(--success)" : tiDataStatus === "UNKNOWN" ? "var(--danger)" : "var(--warning)" }}>{tiDataStatus}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Policy Ver.</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{tiPolicyVer || "—"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>Calculated</span>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            {tiCalcAt ? new Date(tiCalcAt).toLocaleDateString() : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Row 2: CVE Counts (display / audit metadata only) ── */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                      CVE Counts — Audit Metadata (not used in ranking calculation)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                      {[
                        { label: "Critical", sub: "CVSS 9+",    count: critCount, color: "var(--danger)",  bg: critCount > 0 ? "rgba(220,38,38,0.06)"  : "var(--bg-subtle)", border: critCount > 0 ? "rgba(220,38,38,0.25)" : "var(--border)" },
                        { label: "High",     sub: "CVSS 7-8.9", count: highCount, color: "var(--warning)", bg: highCount > 0 ? "rgba(245,158,11,0.06)" : "var(--bg-subtle)", border: highCount > 0 ? "rgba(245,158,11,0.25)" : "var(--border)" },
                        { label: "Medium",   sub: "CVSS 4-6.9", count: medCount,  color: "var(--text)",    bg: "var(--bg-subtle)", border: "var(--border)" },
                        { label: "Low",      sub: "CVSS 0.1-3.9",count: lowCount, color: "var(--text)",    bg: "var(--bg-subtle)", border: "var(--border)" },
                        { label: "KEV",      sub: "CISA Exploit",count: kevCount, color: kevCount > 0 ? "var(--danger)" : "var(--text)", bg: kevCount > 0 ? "rgba(220,38,38,0.08)" : "var(--bg-subtle)", border: kevCount > 0 ? "rgba(220,38,38,0.3)" : "var(--border)" },
                      ].map(({ label, sub, count, color, bg, border }) => (
                        <div key={label} style={{
                          padding: "10px 12px", borderRadius: 8, background: bg,
                          border: `1px solid ${border}`, display: "flex", flexDirection: "column", gap: 1,
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>{label}</div>
                          <div style={{ fontSize: 10, color: "var(--muted)" }}>{sub}</div>
                          <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>{count}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>
                      These counts are calculated by the Threat Intelligence module and stored for audit purposes. The Ranking Engine uses only the Threat Score above.
                    </div>
                  </div>

                  {/* ── Row 3: Live Per-CVE Inventory (Severity, Exploitability, KEV, Patch Status) ── */}
                  <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Bug size={16} style={{ color: "var(--danger)" }} />
                          <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Vulnerability & CVE Inventory
                          </div>
                          <span className="badge badge-blue">{versionCves.length} Records</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          Individual CVE status fetched live from backend: Severity, Exploitability (EPSS), CISA KEV exploitation, and Patch Status.
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* Search */}
                        <div style={{ position: "relative", minWidth: 180 }}>
                          <input
                            type="text"
                            placeholder="Filter CVE ID / desc…"
                            className="form-control form-control-sm"
                            value={cveSearch}
                            onChange={e => setCveSearch(e.target.value)}
                            style={{ paddingLeft: 28, fontSize: 12 }}
                          />
                          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
                        </div>

                        {/* Severity filter */}
                        <select
                          className="form-control form-control-sm"
                          value={cveSeverityFilter}
                          onChange={e => setCveSeverityFilter(e.target.value)}
                          style={{ fontSize: 12, width: 110 }}
                        >
                          <option value="ALL">All Severities</option>
                          <option value="CRITICAL">Critical</option>
                          <option value="HIGH">High</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="LOW">Low</option>
                          <option value="KEV">KEV Only</option>
                        </select>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setCveForm({
                              cve_id: "",
                              severity: "HIGH",
                              cvss_score: "7.5",
                              epss_score: "0.25",
                              is_kev: false,
                              patch_status: "PATCHED",
                              fixed_version: "",
                              source: "Vendor PSIRT",
                              description: "",
                            });
                            setShowCveModal({ open: true });
                          }}
                        >
                          <Plus size={13} /> Add CVE
                        </button>
                      </div>
                    </div>

                    {/* CVE Table */}
                    {isLoadingCves ? (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        Loading CVE records from backend…
                      </div>
                    ) : versionCves.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", background: "var(--bg-subtle)", borderRadius: 8, fontSize: 13 }}>
                        No CVE records found for this version. Click "Add CVE" to add vulnerability records.
                      </div>
                    ) : (
                      <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                        <table>
                          <thead>
                            <tr style={{ background: "var(--bg-subtle)", position: "sticky", top: 0, zIndex: 2 }}>
                              <th style={{ fontSize: 11 }}>CVE ID & Description</th>
                              <th style={{ fontSize: 11 }}>1. Severity (CVSS)</th>
                              <th style={{ fontSize: 11 }}>2. Exploitability (EPSS)</th>
                              <th style={{ fontSize: 11 }}>3. CISA KEV</th>
                              <th style={{ fontSize: 11 }}>4. Patch Status</th>
                              <th style={{ fontSize: 11, textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {versionCves
                              .filter(cve => {
                                const matchesSearch = !cveSearch ||
                                  cve.cve_id.toLowerCase().includes(cveSearch.toLowerCase()) ||
                                  (cve.description && cve.description.toLowerCase().includes(cveSearch.toLowerCase()));
                                const matchesFilter =
                                  cveSeverityFilter === "ALL" ||
                                  (cveSeverityFilter === "KEV" ? cve.is_kev : cve.severity === cveSeverityFilter);
                                return matchesSearch && matchesFilter;
                              })
                              .map(cve => {
                                const epssPct = cve.epss_score != null ? (cve.epss_score * 100).toFixed(1) : null;
                                return (
                                  <tr key={cve.id}>
                                    {/* CVE ID & Summary */}
                                    <td style={{ maxWidth: 280 }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{ fontWeight: 700, fontFamily: "var(--font-mono, monospace)", fontSize: 13, color: "var(--text)" }}>
                                          {cve.cve_id}
                                        </span>
                                        {cve.source && (
                                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                                            {cve.source}
                                          </span>
                                        )}
                                      </div>
                                      {cve.description && (
                                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cve.description}>
                                          {cve.description}
                                        </div>
                                      )}
                                    </td>

                                    {/* 1. Severity */}
                                    <td>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <span style={{
                                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, textTransform: "uppercase",
                                          background: cve.severity === "CRITICAL" ? "rgba(220,38,38,0.12)"
                                            : cve.severity === "HIGH" ? "rgba(245,158,11,0.12)"
                                            : cve.severity === "MEDIUM" ? "rgba(234,179,8,0.12)"
                                            : "rgba(100,116,139,0.12)",
                                          color: cve.severity === "CRITICAL" ? "var(--danger)"
                                            : cve.severity === "HIGH" ? "var(--warning)"
                                            : cve.severity === "MEDIUM" ? "#d97706"
                                            : "var(--muted)",
                                          border: `1px solid ${
                                            cve.severity === "CRITICAL" ? "rgba(220,38,38,0.3)"
                                              : cve.severity === "HIGH" ? "rgba(245,158,11,0.3)"
                                              : cve.severity === "MEDIUM" ? "rgba(234,179,8,0.3)"
                                              : "var(--border)"
                                          }`,
                                        }}>
                                          {cve.severity}
                                        </span>
                                        {cve.cvss_score != null && (
                                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                                            {cve.cvss_score.toFixed(1)}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* 2. Exploitability (EPSS) */}
                                    <td style={{ minWidth: 140 }}>
                                      {epssPct !== null ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                                            <span style={{ fontWeight: 600, color: Number(epssPct) > 50 ? "var(--danger)" : Number(epssPct) > 20 ? "var(--warning)" : "var(--text)" }}>
                                              {epssPct}%
                                            </span>
                                            <span style={{ fontSize: 10, color: "var(--muted)" }}>prob.</span>
                                          </div>
                                          <div style={{ width: "100%", height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                            <div style={{
                                              width: `${Math.min(100, Number(epssPct))}%`,
                                              height: "100%",
                                              background: Number(epssPct) > 50 ? "var(--danger)" : Number(epssPct) > 20 ? "var(--warning)" : "var(--success)",
                                              borderRadius: 3,
                                            }} />
                                          </div>
                                        </div>
                                      ) : (
                                        <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>
                                      )}
                                    </td>

                                    {/* 3. KEV Status */}
                                    <td>
                                      {cve.is_kev ? (
                                        <span style={{
                                          display: "inline-flex", alignItems: "center", gap: 4,
                                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                                          background: "rgba(220, 38, 38, 0.15)", color: "var(--danger)",
                                          border: "1px solid rgba(220, 38, 38, 0.4)",
                                        }}>
                                          <Flame size={12} /> CISA KEV
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: 11, color: "var(--muted)", padding: "2px 6px" }}>
                                          No
                                        </span>
                                      )}
                                    </td>

                                    {/* 4. Patch Status */}
                                    <td>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                        <span className={`badge ${
                                          cve.patch_status === "PATCHED" ? "badge-green"
                                            : cve.patch_status === "UNPATCHED" ? "badge-red"
                                            : cve.patch_status === "PARTIAL" ? "badge-yellow" : "badge-gray"
                                        }`} style={{ width: "fit-content", fontSize: 10 }}>
                                          {cve.patch_status}
                                        </span>
                                        {cve.fixed_version && (
                                          <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                                            Fixed: {cve.fixed_version}
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Actions */}
                                    <td>
                                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          title="Edit CVE"
                                          onClick={() => {
                                            setCveForm({
                                              cve_id: cve.cve_id,
                                              severity: cve.severity,
                                              cvss_score: cve.cvss_score != null ? String(cve.cvss_score) : "",
                                              epss_score: cve.epss_score != null ? String(cve.epss_score) : "",
                                              is_kev: cve.is_kev,
                                              patch_status: cve.patch_status,
                                              fixed_version: cve.fixed_version || "",
                                              source: cve.source || "Vendor PSIRT",
                                              description: cve.description || "",
                                            });
                                            setShowCveModal({ open: true, cveToEdit: cve });
                                          }}
                                        >
                                          <Edit2 size={12} />
                                        </button>
                                        <button
                                          className="btn btn-ghost btn-sm"
                                          title="Delete CVE"
                                          style={{ color: "var(--danger)" }}
                                          onClick={() => {
                                            if (confirm(`Delete ${cve.cve_id}?`)) {
                                              deleteCve.mutate(cve.id);
                                            }
                                          }}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>


                </div>
              </div>
            )}

            {/* Standard Product Characteristic Values */}
            {selectedVersionId && (
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Product Characteristic Values</div>
                  <button className="btn btn-secondary btn-sm" onClick={openAddValueModal}>
                    <Plus size={13} /> Add Value
                  </button>
                </div>
                {standardProductValues.length === 0 ? (
                  <div className="empty-state" style={{ padding: 20 }}><div>No standard values entered yet. Click "Add Value" above.</div></div>
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Characteristic</th>
                          <th>Value</th>
                          <th>Unit</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standardProductValues.map(v => {
                          const char = characteristics.find(c => c.id === v.characteristic_id);
                          const val = v.value_numeric != null ? String(v.value_numeric) : v.value_text || (v.value_boolean != null ? (v.value_boolean ? "YES" : "NO") : (v.value_json ? JSON.stringify(v.value_json) : "—"));
                          return (
                            <tr key={v.id}>
                              <td style={{ fontWeight: 500 }}>{char?.name || `#${v.characteristic_id}`}</td>
                              <td style={{ fontWeight: 600 }}>{val}</td>
                              <td style={{ color: "var(--muted)" }}>{v.unit || "—"}</td>
                              <td><span className={`badge ${v.status === "SUPPORTED" ? "badge-green" : v.status === "NOT_SUPPORTED" ? "badge-red" : "badge-yellow"}`}>{v.status}</span></td>
                              <td>
                                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openEditValueModal(v)}
                                  >
                                    <Edit2 size={13} /> Edit
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                                    onClick={() => { if (confirm("Delete value?")) deleteValue.mutate(v.id); }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
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

            {/* Composite Feature Options (Child Options for RBAC, Security Controls, etc.) */}
            {selectedVersionId && compositeCharacteristics.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div>
                    <div className="card-title">Composite Child Feature Support</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Configure support for child features (e.g. RBAC permissions, Security Controls) for this device version.
                    </div>
                  </div>
                </div>
                <div className="card-body stack" style={{ gap: 20 }}>
                  {compositeCharacteristics.map(char => (
                    <div key={char.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, background: "var(--bg-subtle)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{char.name}</span>
                          <span className="badge badge-blue">Composite</span>
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>({char.options?.length || 0} child options)</span>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setShowCompositeModal({ open: true, char })}
                          >
                            <Edit2 size={13} /> Edit Composite Feature
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowAddOptionModal({ open: true, charId: char.id })}
                          >
                            <Plus size={13} /> Add Option
                          </button>
                        </div>
                      </div>

                      {(!char.options || char.options.length === 0) ? (
                        <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", padding: "8px 0" }}>
                          No child options defined yet. Click "Add Option" to add one.
                        </div>
                      ) : (
                        <div className="grid-2" style={{ gap: 10 }}>
                          {char.options.map(opt => {
                            const existing = optionValues.find(ov => ov.characteristic_option_id === opt.id);
                            const status = existing?.status || (existing?.value_boolean ? "SUPPORTED" : "NOT_SUPPORTED");
                            const isSupported = status === "SUPPORTED";
                            const isPartial = status === "PARTIAL";

                            return (
                              <div
                                key={opt.id}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "space-between",
                                  padding: "10px 14px", borderRadius: 6, background: "var(--card-bg)",
                                  border: "1px solid var(--border)",
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1, paddingRight: 10 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.name}</div>
                                  {existing?.license_dependency && (
                                    <div style={{ fontSize: 11, color: "var(--warning)", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                                      <Key size={10} /> {existing.license_dependency}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span
                                    onClick={() => toggleOptionValue.mutate({ optionId: opt.id, value: !isSupported })}
                                    style={{ cursor: "pointer" }}
                                  >
                                    {isSupported ? (
                                      <span className="badge badge-green" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                        <CheckCircle2 size={12} /> SUPPORTED
                                      </span>
                                    ) : isPartial ? (
                                      <span className="badge badge-yellow" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                        <AlertTriangle size={12} /> PARTIAL
                                      </span>
                                    ) : (
                                      <span className="badge badge-gray" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                        <XCircle size={12} /> NOT SUPPORTED
                                      </span>
                                    )}
                                  </span>

                                  <button
                                    className="btn btn-ghost btn-sm"
                                    title="Edit details"
                                    onClick={() => setShowCompositeModal({ open: true, char })}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ flex: 1 }}>
            <div className="empty-state"><Package size={48} /><h3>Select a Product</h3><p>Choose a product to view details, versions, and values.</p></div>
          </div>
        )}
      </div>

      {/* ── Vendor Modal ──────────────────────────────────────────────────────── */}
      {showVendorModal && (
        <div className="modal-backdrop" onClick={() => setShowVendorModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Vendor</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVendorModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={vendorForm.handleSubmit(d => createVendor.mutate(d))}>
              <div className="modal-body stack">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" placeholder="Fortinet" {...vendorForm.register("name")} /></div>
                <div className="form-group"><label className="form-label">Code *</label><input className="form-control" placeholder="FORTINET" {...vendorForm.register("code")} /></div>
                <div className="form-group"><label className="form-label">Website</label><input className="form-control" placeholder="https://…" {...vendorForm.register("website")} /></div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" {...vendorForm.register("description")} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVendorModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createVendor.isPending}>{createVendor.isPending ? "Creating…" : "Create Vendor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Product Modal (Create / Edit) ─────────────────────────────────────── */}
      {showProductModal.open && (
        <div className="modal-backdrop" onClick={() => setShowProductModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{showProductModal.product ? "Edit Product" : "Add Product"}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProductModal({ open: false })}><X size={16} /></button>
            </div>
            <form onSubmit={productForm.handleSubmit(d => saveProduct.mutate(d))}>
              <div className="modal-body stack">
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Vendor *</label>
                    <select className="form-control" {...productForm.register("vendor_id")}>
                      <option value="">Select…</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category *</label>
                    <select className="form-control" {...productForm.register("category_id")}>
                      <option value="">Select…</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Product Name *</label><input className="form-control" placeholder="FortiGate 1000F" {...productForm.register("name")} /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Model</label><input className="form-control" {...productForm.register("model")} /></div>
                  <div className="form-group"><label className="form-label">Product Family</label><input className="form-control" {...productForm.register("product_family")} /></div>
                </div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" {...productForm.register("description")} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal({ open: false })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveProduct.isPending}>
                  {saveProduct.isPending ? "Saving…" : showProductModal.product ? "Update Product" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Version Modal ─────────────────────────────────────────────────────── */}
      {showVersionModal.open && (
        <div className="modal-backdrop" onClick={() => setShowVersionModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Version</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowVersionModal({ open: false })}><X size={16} /></button>
            </div>
            <form onSubmit={versionForm.handleSubmit((d) => createVersion.mutate(d as unknown as VersionForm))}>
              <div className="modal-body stack">
                <div className="form-group"><label className="form-label">Version *</label><input className="form-control" placeholder="7.4.x" {...versionForm.register("version")} /></div>
                <div className="form-group">
                  <label className="form-label">Support Status</label>
                  <select className="form-control" {...versionForm.register("support_status")}>
                    <option value="ACTIVE">Active</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="EOL_ANNOUNCED">EOL Announced</option>
                    <option value="END_OF_LIFE">End of Life</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input type="checkbox" id="is_current" {...versionForm.register("is_current")} />
                  <label htmlFor="is_current" className="form-label" style={{ margin: 0 }}>Mark as current version</label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVersionModal({ open: false })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createVersion.isPending}>{createVersion.isPending ? "Adding…" : "Add Version"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Mapping Modal ─────────────────────────────────────────────────────── */}
      {showMappingModal.open && (
        <div className="modal-backdrop" onClick={() => setShowMappingModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Map to Product Class</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowMappingModal({ open: false })}><X size={16} /></button>
            </div>
            <div className="modal-body stack">
              <div className="alert alert-info">One product can belong to multiple classes (e.g. Enterprise Firewall + Cloud Firewall).</div>
              <div className="form-group">
                <label className="form-label">Product Class</label>
                <select className="form-control" value={mapClassId} onChange={e => setMapClassId(e.target.value)}>
                  <option value="">Select…</option>
                  {productClasses.map(pc => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMappingModal({ open: false })}>Cancel</button>
              <button className="btn btn-primary" disabled={!mapClassId || addMapping.isPending} onClick={() => addMapping.mutate()}>
                {addMapping.isPending ? "Mapping…" : "Map"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Threat Intelligence (Spec §25 — TI Module response format) ── */}
      {showThreatModal && (
        <div className="modal-backdrop" onClick={() => setShowThreatModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Edit Threat Intelligence Data</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Enter the Threat Intelligence module output for version #{selectedVersionId}.
                  The Ranking Engine reads <strong>Threat Score</strong> directly — it does not recalculate CVE risk.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowThreatModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body stack">

              {/* Architecture info banner */}
              <div className="alert alert-info" style={{ fontSize: 12 }}>
                <strong>Spec §25 Architecture:</strong> The TI module calculates CVE risk internally and provides a final Threat Score (0–100). The Ranking Engine uses only this score.
                <div style={{ marginTop: 4, color: "var(--muted)" }}>Higher Threat Score = safer product. (Threat Score = 100 − Policy Risk)</div>
              </div>

              {/* ── Threat Score (authoritative) ── */}
              <div style={{ padding: "16px", borderRadius: 8, background: "var(--bg-subtle)", border: "2px solid var(--primary)" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: "var(--primary)", fontWeight: 700 }}>
                    Threat Score (0–100) — Used by Ranking Engine *
                  </label>
                  <input
                    type="number" min="0" max="100" step="0.1" className="form-control"
                    placeholder="e.g. 75.0"
                    value={threatForm.threat_score}
                    onChange={e => setThreatForm(f => ({ ...f, threat_score: e.target.value }))}
                  />
                  <div className="form-hint">0 = most vulnerable, 100 = no risk. Pre-calculated by TI module via: 100 − min(raw_risk, 100)</div>
                </div>
              </div>

              {/* ── Risk breakdown metadata ── */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginTop: 4 }}>Risk Audit Metadata (from TI Module)</div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Raw Risk Points</label>
                  <input
                    type="number" min="0" step="0.1" className="form-control"
                    placeholder="e.g. 95.0"
                    value={threatForm.raw_risk}
                    onChange={e => setThreatForm(f => ({ ...f, raw_risk: e.target.value }))}
                  />
                  <div className="form-hint">Sum before policy cap</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Policy Risk (capped at 100)</label>
                  <input
                    type="number" min="0" max="100" step="0.1" className="form-control"
                    placeholder="e.g. 95.0"
                    value={threatForm.policy_risk}
                    onChange={e => setThreatForm(f => ({ ...f, policy_risk: e.target.value }))}
                  />
                  <div className="form-hint">min(raw_risk, 100)</div>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Risk Band</label>
                  <select className="form-control" value={threatForm.risk_band} onChange={e => setThreatForm(f => ({ ...f, risk_band: e.target.value }))}>
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Data Status</label>
                  <select className="form-control" value={threatForm.data_status} onChange={e => setThreatForm(f => ({ ...f, data_status: e.target.value }))}>
                    <option value="COMPLETE">COMPLETE</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                    <option value="STALE">STALE</option>
                  </select>
                </div>
              </div>

              {/* ── CVE counts (audit metadata) ── */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginTop: 4 }}>CVE Counts — Audit / Display Metadata Only</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {([
                  { key: "critical", label: "Critical", color: "var(--danger)" },
                  { key: "high",     label: "High",     color: "var(--warning)" },
                  { key: "medium",   label: "Medium",   color: "var(--text)" },
                  { key: "low",      label: "Low",      color: "var(--text)" },
                  { key: "kev",      label: "KEV",      color: "var(--danger)" },
                ] as const).map(({ key, label, color }) => (
                  <div className="form-group" key={key} style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ color }}>{label}</label>
                    <input
                      type="number" min="0" className="form-control"
                      value={(threatForm as any)[key]}
                      onChange={e => setThreatForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
                These counts are stored for audit and display purposes only. The Ranking Engine does not use them.
              </div>

              {/* Live preview */}
              <div style={{ padding: 14, borderRadius: 6, background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Threat Score to be saved:</div>
                  <div style={{
                    fontSize: 22, fontWeight: 800,
                    color: parseFloat(threatForm.threat_score) >= 70 ? "var(--success)" : parseFloat(threatForm.threat_score) >= 40 ? "var(--warning)" : "var(--danger)",
                    marginTop: 2,
                  }}>
                    {Math.min(100, Math.max(0, parseFloat(threatForm.threat_score) || 0)).toFixed(1)} / 100
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Risk Band</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{threatForm.risk_band}</div>
                </div>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowThreatModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={saveThreatIntel.isPending}
                onClick={() => saveThreatIntel.mutate()}
              >
                {saveThreatIntel.isPending ? "Saving…" : "Save Threat Intel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit CVE Record ────────────────────────────────────── */}
      {showCveModal.open && (
        <div className="modal-backdrop" onClick={() => setShowCveModal({ open: false })}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  {showCveModal.cveToEdit ? `Edit ${showCveModal.cveToEdit.cve_id}` : "Add Vulnerability (CVE) Record"}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Set Severity, Exploitability (EPSS), CISA KEV status, and Patch Status for device version #{selectedVersionId}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCveModal({ open: false })}><X size={16} /></button>
            </div>
            <div className="modal-body stack">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">CVE Identifier *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. CVE-2024-21762"
                    value={cveForm.cve_id}
                    disabled={!!showCveModal.cveToEdit}
                    onChange={e => setCveForm(f => ({ ...f, cve_id: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data Source</label>
                  <input
                    className="form-control"
                    placeholder="Vendor PSIRT, NVD, CISA…"
                    value={cveForm.source}
                    onChange={e => setCveForm(f => ({ ...f, source: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid-2">
                {/* 1. Severity */}
                <div className="form-group">
                  <label className="form-label">1. Severity Tier *</label>
                  <select
                    className="form-control"
                    value={cveForm.severity}
                    onChange={e => setCveForm(f => ({ ...f, severity: e.target.value }))}
                  >
                    <option value="CRITICAL">CRITICAL (CVSS 9.0–10.0)</option>
                    <option value="HIGH">HIGH (CVSS 7.0–8.9)</option>
                    <option value="MEDIUM">MEDIUM (CVSS 4.0–6.9)</option>
                    <option value="LOW">LOW (CVSS 0.1–3.9)</option>
                    <option value="NONE">NONE (0.0)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">CVSS Base Score (0.0–10.0)</label>
                  <input
                    type="number" min="0" max="10" step="0.1"
                    className="form-control"
                    placeholder="e.g. 9.8"
                    value={cveForm.cvss_score}
                    onChange={e => setCveForm(f => ({ ...f, cvss_score: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid-2">
                {/* 2. Exploitability (EPSS) */}
                <div className="form-group">
                  <label className="form-label">2. Exploitability / EPSS Score (0.00–1.00)</label>
                  <input
                    type="number" min="0" max="1" step="0.01"
                    className="form-control"
                    placeholder="e.g. 0.94"
                    value={cveForm.epss_score}
                    onChange={e => setCveForm(f => ({ ...f, epss_score: e.target.value }))}
                  />
                  <div className="form-hint">Probability of active weaponized exploitation in the wild (0%–100%)</div>
                </div>

                {/* 3. KEV Status */}
                <div className="form-group">
                  <label className="form-label">3. CISA KEV Known Exploited</label>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={cveForm.is_kev}
                        onChange={e => setCveForm(f => ({ ...f, is_kev: e.target.checked }))}
                        style={{ width: 16, height: 16 }}
                      />
                      <span style={{ fontWeight: 600, color: cveForm.is_kev ? "var(--danger)" : "var(--text)" }}>
                        Listed in CISA KEV Catalog
                      </span>
                    </label>
                  </div>
                  <div className="form-hint">Actively leveraged in cyberattacks</div>
                </div>
              </div>

              <div className="grid-2">
                {/* 4. Patch Status */}
                <div className="form-group">
                  <label className="form-label">4. Patch Status *</label>
                  <select
                    className="form-control"
                    value={cveForm.patch_status}
                    onChange={e => setCveForm(f => ({ ...f, patch_status: e.target.value }))}
                  >
                    <option value="PATCHED">PATCHED</option>
                    <option value="UNPATCHED">UNPATCHED</option>
                    <option value="PARTIAL">PARTIAL / WORKAROUND</option>
                    <option value="UNKNOWN">UNKNOWN</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fixed Firmware / Version</label>
                  <input
                    className="form-control"
                    placeholder="e.g. 7.4.4+, Hotfix 2"
                    value={cveForm.fixed_version}
                    onChange={e => setCveForm(f => ({ ...f, fixed_version: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Vulnerability Description / Advisory</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Out-of-bounds write in FortiOS SSL-VPN allows unauthenticated remote code execution"
                  value={cveForm.description}
                  onChange={e => setCveForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCveModal({ open: false })}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!cveForm.cve_id || saveCve.isPending}
                onClick={() => saveCve.mutate()}
              >
                {saveCve.isPending ? "Saving…" : showCveModal.cveToEdit ? "Update CVE" : "Add CVE Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Value Modal (Create / Edit Standard Value) ─────────────────────────── */}

      {showValueModal.open && (
        <div className="modal-backdrop" onClick={() => setShowValueModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{showValueModal.valueToEdit ? "Edit Product Value" : "Enter Product Value"}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowValueModal({ open: false })}><X size={16} /></button>
            </div>
            <div className="modal-body stack">
              <div className="form-group">
                <label className="form-label">Characteristic *</label>
                <select
                  className="form-control"
                  disabled={!!showValueModal.valueToEdit}
                  value={valueForm.characteristic_id}
                  onChange={e => setValueForm(f => ({ ...f, characteristic_id: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {characteristics.filter(c => c.characteristic_type !== "RISK").map(c => <option key={c.id} value={c.id}>{c.name} ({characteristicTypeLabel(c.characteristic_type)})</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Numeric Value</label>
                  <input type="number" step="any" className="form-control" placeholder="e.g. 198" value={valueForm.value_numeric} onChange={e => setValueForm(f => ({ ...f, value_numeric: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <input className="form-control" placeholder="Gbps, µs…" value={valueForm.unit} onChange={e => setValueForm(f => ({ ...f, unit: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Text Value</label>
                <input className="form-control" placeholder="VERIFIED, ACTIVE…" value={valueForm.value_text} onChange={e => setValueForm(f => ({ ...f, value_text: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Boolean Value</label>
                <select className="form-control" value={valueForm.value_boolean} onChange={e => setValueForm(f => ({ ...f, value_boolean: e.target.value }))}>
                  <option value="">N/A</option>
                  <option value="true">YES (true)</option>
                  <option value="false">NO (false)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-control" value={valueForm.status} onChange={e => setValueForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="SUPPORTED">SUPPORTED</option>
                  <option value="PARTIAL">PARTIAL</option>
                  <option value="NOT_SUPPORTED">NOT_SUPPORTED</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowValueModal({ open: false })}>Cancel</button>
              <button className="btn btn-primary" disabled={!valueForm.characteristic_id || saveValue.isPending} onClick={() => saveValue.mutate()}>
                {saveValue.isPending ? "Saving…" : showValueModal.valueToEdit ? "Update Value" : "Save Value"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Composite Feature ────────────────────────────────────── */}
      {showCompositeModal.open && showCompositeModal.char && (
        <div className="modal-backdrop" onClick={() => setShowCompositeModal({ open: false })}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Edit Composite Feature: {showCompositeModal.char.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Set support status & license dependencies for device version #{selectedVersionId}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCompositeModal({ open: false })}><X size={16} /></button>
            </div>
            <div className="modal-body stack" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              {(!showCompositeModal.char.options || showCompositeModal.char.options.length === 0) ? (
                <div className="empty-state"><div>No child options created yet for this feature.</div></div>
              ) : (
                showCompositeModal.char.options.map(opt => {
                  const existing = optionValues.find(ov => ov.characteristic_option_id === opt.id);
                  const currentStatus = existing?.status || (existing?.value_boolean ? "SUPPORTED" : "NOT_SUPPORTED");
                  const currentLicense = existing?.license_dependency || "";

                  return (
                    <div key={opt.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 14, background: "var(--bg-subtle)" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{opt.name}</div>
                      <div className="grid-2" style={{ gap: 10 }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>Support Status</label>
                          <select
                            className="form-control"
                            value={currentStatus}
                            onChange={e => {
                              const st = e.target.value;
                              const isBool = st === "SUPPORTED" || st === "PARTIAL";
                              saveOptionDetails.mutate({
                                optionId: opt.id,
                                value_boolean: isBool,
                                status: st,
                                license_dependency: currentLicense,
                              });
                            }}
                          >
                            <option value="SUPPORTED">SUPPORTED (100% Score)</option>
                            <option value="PARTIAL">PARTIAL (60% Score)</option>
                            <option value="NOT_SUPPORTED">NOT SUPPORTED (0% Score)</option>
                            <option value="UNKNOWN">UNKNOWN</option>
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>License Dependency</label>
                          <input
                            className="form-control"
                            placeholder="e.g. Threat Protection Add-on"
                            defaultValue={currentLicense}
                            onBlur={e => {
                              const lic = e.target.value;
                              const isBool = currentStatus === "SUPPORTED" || currentStatus === "PARTIAL";
                              saveOptionDetails.mutate({
                                optionId: opt.id,
                                value_boolean: isBool,
                                status: currentStatus,
                                license_dependency: lic,
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCompositeModal({ open: false });
                  setShowAddOptionModal({ open: true, charId: showCompositeModal.char?.id });
                }}
              >
                <Plus size={14} /> Add New Child Option
              </button>
              <button className="btn btn-primary" onClick={() => setShowCompositeModal({ open: false })}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Child Option ───────────────────────────────────────────── */}
      {showAddOptionModal.open && (
        <div className="modal-backdrop" onClick={() => setShowAddOptionModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add New Child Option</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddOptionModal({ open: false })}><X size={16} /></button>
            </div>
            <div className="modal-body stack">
              <div className="form-group">
                <label className="form-label">Option Name *</label>
                <input
                  className="form-control"
                  placeholder="e.g. Zero Trust Network Access (ZTNA)"
                  value={newOptionName}
                  onChange={e => setNewOptionName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Option Code</label>
                <input
                  className="form-control"
                  placeholder="e.g. ZTNA_ACCESS"
                  value={newOptionCode}
                  onChange={e => setNewOptionCode(e.target.value)}
                />
                <div className="form-hint">Auto-generated if left blank</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddOptionModal({ open: false })}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!newOptionName || createChildOption.isPending}
                onClick={() => createChildOption.mutate()}
              >
                {createChildOption.isPending ? "Adding…" : "Add Child Option"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
