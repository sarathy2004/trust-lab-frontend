"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  vendorsApi, productsApi, categoriesApi, productClassesApi, characteristicsApi,
  type Product, type ProductVersion, type ProductValue, type ProductOptionValue, type Characteristic,
} from "@/lib/api";
import { Plus, Package, X, ChevronDown, ChevronRight, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Key, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
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
  
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [mapClassId, setMapClassId] = useState<string>("");
  
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionCode, setNewOptionCode] = useState("");

  const [threatForm, setThreatForm] = useState({ critical: "0", high: "0", medium: "0", low: "0", kev: "0" });

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
  const critCount = Number(threatJson.critical || 0);
  const highCount = Number(threatJson.high || 0);
  const medCount = Number(threatJson.medium || 0);
  const lowCount = Number(threatJson.low || 0);
  const kevCount = Number(threatJson.kev || 0);

  // Total Risk Points calculation (Critical: 10, High: 6, Medium: 3, Low: 1, KEV: 20)
  const totalRiskPoints = (critCount * 10) + (highCount * 6) + (medCount * 3) + (lowCount * 1) + (kevCount * 20);

  const saveThreatIntel = useMutation({
    mutationFn: () => {
      if (!threatChar) throw new Error("Threat characteristic not found");
      const payload: Partial<import("@/lib/api").ProductValueCreate> = {
        characteristic_id: threatChar.id,
        status: "SUPPORTED",
        value_json: {
          critical: parseInt(threatForm.critical || "0"),
          high: parseInt(threatForm.high || "0"),
          medium: parseInt(threatForm.medium || "0"),
          low: parseInt(threatForm.low || "0"),
          kev: parseInt(threatForm.kev || "0"),
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

            {/* Dedicated Threat Intelligence & Vulnerabilities Card */}
            {selectedVersionId && threatChar && (
              <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="card-title">Threat Intelligence & Vulnerabilities</div>
                      <span className="badge badge-blue">Risk Model</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      Recorded vulnerability counts across severity tiers and active exploitation for this device version.
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setThreatForm({
                        critical: String(critCount),
                        high: String(highCount),
                        medium: String(medCount),
                        low: String(lowCount),
                        kev: String(kevCount),
                      });
                      setShowThreatModal(true);
                    }}
                  >
                    <Edit2 size={13} /> Edit Threat Intel
                  </button>
                </div>
                <div className="card-body stack" style={{ gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                    {/* Critical CVEs */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 8,
                      background: critCount > 0 ? "rgba(220, 38, 38, 0.06)" : "var(--bg-subtle)",
                      border: `1px solid ${critCount > 0 ? "rgba(220, 38, 38, 0.3)" : "var(--border)"}`,
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Critical (CVSS 9+)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: critCount > 0 ? "var(--danger)" : "var(--text)" }}>{critCount}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>10 Risk Pts each</div>
                    </div>

                    {/* High CVEs */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 8,
                      background: highCount > 0 ? "rgba(245, 158, 11, 0.06)" : "var(--bg-subtle)",
                      border: `1px solid ${highCount > 0 ? "rgba(245, 158, 11, 0.3)" : "var(--border)"}`,
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>High (CVSS 7-8.9)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: highCount > 0 ? "var(--warning)" : "var(--text)" }}>{highCount}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>6 Risk Pts each</div>
                    </div>

                    {/* Medium CVEs */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 8,
                      background: "var(--bg-subtle)", border: "1px solid var(--border)",
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Medium (CVSS 4-6.9)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{medCount}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>3 Risk Pts each</div>
                    </div>

                    {/* Low CVEs */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 8,
                      background: "var(--bg-subtle)", border: "1px solid var(--border)",
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>Low (CVSS 0.1-3.9)</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{lowCount}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>1 Risk Pt each</div>
                    </div>

                    {/* CISA KEV Exploits */}
                    <div style={{
                      padding: "14px 16px", borderRadius: 8,
                      background: kevCount > 0 ? "rgba(220, 38, 38, 0.1)" : "var(--bg-subtle)",
                      border: `1px solid ${kevCount > 0 ? "rgba(220, 38, 38, 0.4)" : "var(--border)"}`,
                      display: "flex", flexDirection: "column", gap: 2,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase" }}>CISA KEV Exploits</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: kevCount > 0 ? "var(--danger)" : "var(--text)" }}>{kevCount}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>+20 Risk Pts each</div>
                    </div>
                  </div>

                  {/* Calculated Risk Points Strip */}
                  <div style={{
                    padding: "14px 18px", borderRadius: 8, background: "var(--bg-subtle)",
                    border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Calculated Total Risk Points</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: totalRiskPoints > 60 ? "var(--danger)" : totalRiskPoints > 25 ? "var(--warning)" : "var(--success)", marginTop: 2 }}>
                        {totalRiskPoints} Risk Points
                        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
                          (Lower is better)
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 360, textAlign: "right" }}>
                      Risk formula: (2×10) + (4×6) + (7×3) + (10×1) + (1×20)
                      <div style={{ marginTop: 2, fontWeight: 500, color: "var(--text)" }}>
                        Normalized into 0–100 Threat Score during comparison
                      </div>
                    </div>
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

      {/* ── Modal: Dedicated Edit Threat Intelligence ────────────────────────── */}
      {showThreatModal && (
        <div className="modal-backdrop" onClick={() => setShowThreatModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Edit Threat Intelligence</div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Set CVE vulnerability counts for device version #{selectedVersionId}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowThreatModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body stack">
              <div className="alert alert-info" style={{ fontSize: 12 }}>
                <strong>Risk Points Formula (Lower points = Better security posture):</strong>
                <div style={{ marginTop: 4 }}>
                  Total Risk Points = (Crit × 10) + (High × 6) + (Med × 3) + (Low × 1) + (KEV × 20)
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Critical CVEs (CVSS 9+)</label>
                  <input
                    type="number" min="0" className="form-control"
                    value={threatForm.critical}
                    onChange={e => setThreatForm(f => ({ ...f, critical: e.target.value }))}
                  />
                  <div className="form-hint" style={{ color: "var(--danger)" }}>10 Risk Points each</div>
                </div>

                <div className="form-group">
                  <label className="form-label">High CVEs (CVSS 7-8.9)</label>
                  <input
                    type="number" min="0" className="form-control"
                    value={threatForm.high}
                    onChange={e => setThreatForm(f => ({ ...f, high: e.target.value }))}
                  />
                  <div className="form-hint" style={{ color: "var(--warning)" }}>6 Risk Points each</div>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Medium CVEs (CVSS 4-6.9)</label>
                  <input
                    type="number" min="0" className="form-control"
                    value={threatForm.medium}
                    onChange={e => setThreatForm(f => ({ ...f, medium: e.target.value }))}
                  />
                  <div className="form-hint">3 Risk Points each</div>
                </div>

                <div className="form-group">
                  <label className="form-label">Low CVEs (CVSS 0.1-3.9)</label>
                  <input
                    type="number" min="0" className="form-control"
                    value={threatForm.low}
                    onChange={e => setThreatForm(f => ({ ...f, low: e.target.value }))}
                  />
                  <div className="form-hint">1 Risk Point each</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">CISA KEV Exploits (Actively Exploited in the Wild)</label>
                <input
                  type="number" min="0" className="form-control"
                  value={threatForm.kev}
                  onChange={e => setThreatForm(f => ({ ...f, kev: e.target.value }))}
                />
                <div className="form-hint" style={{ color: "var(--danger)" }}>+20 Risk Points modifier each</div>
              </div>

              {/* Live Calculation Preview */}
              {(() => {
                const c = parseInt(threatForm.critical || "0") || 0;
                const h = parseInt(threatForm.high || "0") || 0;
                const m = parseInt(threatForm.medium || "0") || 0;
                const l = parseInt(threatForm.low || "0") || 0;
                const k = parseInt(threatForm.kev || "0") || 0;
                const pts = (c * 10) + (h * 6) + (m * 3) + (l * 1) + (k * 20);
                return (
                  <div style={{ padding: 14, borderRadius: 6, background: "var(--bg-subtle)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>Computed Risk Points:</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: pts > 50 ? "var(--danger)" : pts > 20 ? "var(--warning)" : "var(--success)", marginTop: 2 }}>
                      {pts} Total Risk Points
                    </div>
                  </div>
                );
              })()}
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
