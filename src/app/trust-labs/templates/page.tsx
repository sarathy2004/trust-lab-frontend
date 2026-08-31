"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  templatesApi, categoriesApi, productClassesApi, characteristicsApi,
  type RankingTemplate, type RankingGroup, type TemplateCharacteristic, type CharacteristicOption,
} from "@/lib/api";
import { Plus, ChevronDown, ChevronRight, Edit2, Trash2, X, Check } from "lucide-react";
import { pct, characteristicTypeLabel } from "@/lib/formatting";

// ── Schemas ───────────────────────────────────────────────────────────────────

const templateSchema = z.object({
  product_class_id: z.coerce.number().min(1, "Required"),
  name: z.string().min(1, "Required"),
  version: z.string().min(1, "Required"),
  status: z.string(),
  description: z.string().optional(),
});

const groupSchema = z.object({
  name: z.string().min(1, "Required"),
  code: z.string().min(1, "Required"),
  priority: z.coerce.number().min(1),
  display_order: z.coerce.number().min(0),
});

const charSchema = z.object({
  characteristic_id: z.coerce.number().min(1, "Required"),
  priority: z.coerce.number().min(1),
  required: z.boolean(),
  scoring_method: z.string().min(1, "Required"),
  direction: z.string().optional(),
  display_order: z.coerce.number().min(0),
});

type TemplateForm = z.infer<typeof templateSchema>;
type GroupForm = z.infer<typeof groupSchema>;
type CharForm = z.infer<typeof charSchema>;

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<RankingTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState<{ open: boolean; group?: RankingGroup }>({ open: false });
  const [showCharModal, setShowCharModal] = useState<{ open: boolean; groupId?: number; tc?: TemplateCharacteristic }>({ open: false });
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [optionPriorities, setOptionPriorities] = useState<Record<number, number>>({});
  const [newOptionName, setNewOptionName] = useState("");
  const [riskConfig, setRiskConfig] = useState({
    critical_weight: 10,
    high_weight: 6,
    medium_weight: 3,
    low_weight: 1,
    kev_weight: 20,
    normalization_method: "RELATIVE",
  });

  const { data: templates = [], isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => templatesApi.list() });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoriesApi.list });
  const { data: productClasses = [] } = useQuery({ queryKey: ["product-classes"], queryFn: () => productClassesApi.list() });
  const { data: characteristics = [] } = useQuery({ queryKey: ["characteristics"], queryFn: characteristicsApi.list });

  // ── Template form ──────────────────────────────────────────────────────────
  const tmplForm = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: { status: "DRAFT", version: "1.0" },
  });

  const createTemplate = useMutation({
    mutationFn: (data: TemplateForm) => templatesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); setShowTemplateModal(false); tmplForm.reset(); },
  });

  const publishTemplate = useMutation({
    mutationFn: (id: number) => templatesApi.update(id, { status: "PUBLISHED" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); refetchSelected(); },
  });

  // ── Group form ─────────────────────────────────────────────────────────────
  const groupForm = useForm<GroupForm>({ resolver: zodResolver(groupSchema) as any, defaultValues: { priority: 1, display_order: 0 } });

  const saveGroup = useMutation({
    mutationFn: (data: GroupForm) => {
      if (showGroupModal.group) {
        return templatesApi.updateGroup(selectedTemplate!.id, showGroupModal.group.id, data);
      }
      return templatesApi.createGroup(selectedTemplate!.id, data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); refetchSelected(); setShowGroupModal({ open: false }); groupForm.reset(); },
  });

  const deleteGroup = useMutation({
    mutationFn: (groupId: number) => templatesApi.deleteGroup(selectedTemplate!.id, groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); refetchSelected(); },
  });

  // ── Characteristic form ────────────────────────────────────────────────────
  const charForm = useForm<CharForm>({ resolver: zodResolver(charSchema) as any, defaultValues: { priority: 1, required: false, display_order: 0 } });

  const selectedCharId = charForm.watch("characteristic_id");
  const selectedCharObj = characteristics.find(c => c.id === Number(selectedCharId));

  useEffect(() => {
    if (showCharModal.tc) {
      const tc = showCharModal.tc;
      charForm.reset({
        characteristic_id: tc.characteristic_id,
        priority: tc.priority,
        required: tc.required,
        scoring_method: tc.scoring_method,
        direction: tc.direction || "",
        display_order: tc.display_order || 0,
      });
      const initialOptPriorities: Record<number, number> = {};
      tc.template_options?.forEach(opt => {
        initialOptPriorities[opt.characteristic_option_id] = opt.priority;
      });
      setOptionPriorities(initialOptPriorities);

      const cfg = tc.scoring_config_json || {};
      setRiskConfig({
        critical_weight: cfg.critical_weight ?? 10,
        high_weight: cfg.high_weight ?? 6,
        medium_weight: cfg.medium_weight ?? 3,
        low_weight: cfg.low_weight ?? 1,
        kev_weight: cfg.kev_weight ?? 20,
        normalization_method: cfg.normalization_method ?? "RELATIVE",
      });
    } else {
      charForm.reset({ priority: 1, required: false, display_order: 0, scoring_method: "", direction: "" });
      setOptionPriorities({});
      setRiskConfig({
        critical_weight: 10,
        high_weight: 6,
        medium_weight: 3,
        low_weight: 1,
        kev_weight: 20,
        normalization_method: "RELATIVE",
      });
    }
  }, [showCharModal]);

  const saveChar = useMutation({
    mutationFn: (data: CharForm) => {
      const isComposite = data.scoring_method === "COMPOSITE" || selectedCharObj?.characteristic_type === "COMPOSITE";
      const isRisk = data.scoring_method === "RISK" || selectedCharObj?.characteristic_type === "RISK";

      const template_options = isComposite && selectedCharObj?.options ? selectedCharObj.options.map(opt => ({
        characteristic_option_id: opt.id,
        priority: optionPriorities[opt.id] ?? opt.default_priority ?? 1,
        required: false,
      })) : undefined;

      const payload = {
        ranking_group_id: showCharModal.groupId!,
        ...data,
        template_options,
        scoring_config_json: isRisk ? riskConfig : undefined,
      };

      if (showCharModal.tc) {
        return templatesApi.updateCharacteristic(showCharModal.tc.id, payload);
      }
      return templatesApi.addCharacteristic(showCharModal.groupId!, payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); refetchSelected(); setShowCharModal({ open: false }); charForm.reset(); },
  });

  const removeChar = useMutation({
    mutationFn: (charId: number) => templatesApi.removeCharacteristic(charId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["templates"] }); refetchSelected(); },
  });

  const addOption = useMutation({
    mutationFn: (name: string) => characteristicsApi.createOption(Number(selectedCharId), {
      name,
      code: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      data_type: "BOOLEAN",
      default_priority: 1
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["characteristics"] });
      setNewOptionName("");
    }
  });

  // ── Selected template detail ───────────────────────────────────────────────
  const { data: templateDetail, refetch: refetchSelected } = useQuery({
    queryKey: ["template", selectedTemplate?.id],
    queryFn: () => templatesApi.get(selectedTemplate!.id),
    enabled: !!selectedTemplate?.id,
  });

  const detail = templateDetail || selectedTemplate;

  const toggleGroup = (id: number) => setExpandedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const SCORING_METHODS = ["RELATIVE_MAX", "RELATIVE_MIN", "CATEGORICAL", "COMPOSITE", "THRESHOLD", "RISK", "LIFECYCLE", "RANGE", "ASSURANCE"];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Ranking Templates</div>
          <div className="page-subtitle">Create and manage versioned ranking methodologies per product class</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {detail && detail.status === "DRAFT" && (
            <button
              className="btn btn-secondary"
              disabled={publishTemplate.isPending}
              onClick={() => {
                if (confirm(`Publish "${detail.name}" v${detail.version}? Published templates are the official methodology and should be treated as stable.`)) {
                  publishTemplate.mutate(detail.id);
                }
              }}
            >
              <Check size={15} /> {publishTemplate.isPending ? "Publishing…" : "Publish Template"}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowTemplateModal(true)}>
            <Plus size={15} /> New Template
          </button>
        </div>
      </div>

      <div className="page-content" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {/* Template List */}
        <div className="card" style={{ width: 300, flexShrink: 0 }}>
          <div className="card-header"><div className="card-title">Templates ({templates.length})</div></div>
          {isLoading ? (
            <div style={{ padding: 20, textAlign: "center" }}><div className="loading-spin" style={{ margin: "0 auto" }} /></div>
          ) : templates.length === 0 ? (
            <div className="empty-state"><div>No templates yet</div></div>
          ) : (
            <div>
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t); setExpandedGroups(new Set(t.groups?.map(g => g.id))); }}
                  style={{
                    padding: "14px 16px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                    background: selectedTemplate?.id === t.id ? "var(--primary-light)" : "transparent",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13, color: selectedTemplate?.id === t.id ? "var(--primary)" : "var(--text)" }}>
                    {t.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>v{t.version}</span>
                    <span className={`badge ${t.status === "PUBLISHED" ? "badge-green" : t.status === "ARCHIVED" ? "badge-purple" : "badge-gray"}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Template Detail */}
        {detail ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header info card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="card-title">{detail.name}</div>
                    <span className="badge badge-blue">v{detail.version}</span>
                    <span className={`badge ${detail.status === "PUBLISHED" ? "badge-green" : "badge-gray"}`}>{detail.status}</span>
                  </div>
                  {detail.description && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{detail.description}</div>}
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const gIdSet = new Set((detail.groups || []).map(g => g.id));
                    setExpandedGroups(gIdSet);
                    setShowGroupModal({ open: true });
                    groupForm.reset({ priority: 1, display_order: 0, name: "", code: "" });
                  }}
                >
                  <Plus size={14} /> Add Group
                </button>
              </div>
            </div>

            {/* Groups list */}
            <div className="stack">
              {(detail.groups || []).filter(g => g.is_active).map(group => (
                <div key={group.id} className="card">
                  {/* Group Header */}
                  <div
                    className="card-header"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => toggleGroup(group.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {expandedGroups.has(group.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          Priority {group.priority} · {group.template_characteristics?.filter(tc => tc.is_active).length || 0} characteristics
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {group.group_weight != null && (
                        <span className="weight-chip">{(group.group_weight * 100).toFixed(1)}%</span>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setShowCharModal({ open: true, groupId: group.id }); }}>
                        <Plus size={13} /> Add Metric
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => {
                          e.stopPropagation();
                          groupForm.reset({ name: group.name, code: group.code, priority: group.priority, display_order: group.display_order });
                          setShowGroupModal({ open: true, group });
                        }}
                      >
                        <Edit2 size={13} /> Edit Group
                      </button>
                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                        onClick={e => { e.stopPropagation(); if (confirm("Delete group?")) deleteGroup.mutate(group.id); }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Characteristics Table */}
                  {expandedGroups.has(group.id) && (
                    <div className="table-wrap">
                      {(group.template_characteristics || []).filter(tc => tc.is_active).length === 0 ? (
                        <div className="empty-state" style={{ padding: "24px" }}>
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>No characteristics. Click "Add Metric" to add one.</div>
                        </div>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>Characteristic</th>
                              <th>Type</th>
                              <th>Method</th>
                              <th>Priority</th>
                              <th>Required</th>
                              <th>Weight</th>
                              <th style={{ textAlign: "right" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(group.template_characteristics || []).filter(tc => tc.is_active).map(tc => {
                              const groupPriorityTotal = group.template_characteristics.filter(x => x.is_active).reduce((s, x) => s + x.priority, 0);
                              const charWeight = groupPriorityTotal > 0 ? tc.priority / groupPriorityTotal : 0;
                              const overallWeight = group.group_weight != null ? charWeight * group.group_weight : null;
                              return (
                                <tr key={tc.id}>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{tc.characteristic?.name}</div>
                                    {tc.template_options?.length > 0 && (
                                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{tc.template_options.length} child options</div>
                                    )}
                                  </td>
                                  <td>
                                    <span className="badge badge-blue">{characteristicTypeLabel(tc.characteristic?.characteristic_type)}</span>
                                  </td>
                                  <td><span style={{ fontSize: 12, color: "var(--muted)" }}>{tc.scoring_method}</span></td>
                                  <td><span style={{ fontWeight: 600 }}>{tc.priority}</span></td>
                                  <td>{tc.required ? <Check size={14} style={{ color: "var(--success)" }} /> : "—"}</td>
                                  <td>
                                    <div style={{ fontSize: 12 }}>
                                      <span className="weight-chip">{overallWeight != null ? pct(overallWeight) : pct(charWeight)}</span>
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowCharModal({ open: true, groupId: group.id, tc })}
                                      >
                                        <Edit2 size={13} /> Edit
                                      </button>
                                      <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }}
                                        onClick={() => { if (confirm("Remove characteristic?")) removeChar.mutate(tc.id); }}>
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card" style={{ flex: 1 }}>
            <div className="empty-state">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <h3>Select a Template</h3>
              <p style={{ color: "var(--muted)" }}>Choose a template from the left to view its groups and characteristics.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: Add / Edit Template ────────────────────────────────────────── */}
      {showTemplateModal && (
        <div className="modal-backdrop" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">New Ranking Template</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTemplateModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={tmplForm.handleSubmit(d => createTemplate.mutate(d))}>
              <div className="modal-body stack">
                <div className="form-group">
                  <label className="form-label">Product Class *</label>
                  <select className="form-control" {...tmplForm.register("product_class_id")}>
                    <option value="">Select product class…</option>
                    {productClasses.map(pc => <option key={pc.id} value={pc.id}>{pc.name}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Template Name *</label><input className="form-control" placeholder="Enterprise Firewall Test" {...tmplForm.register("name")} /></div>
                  <div className="form-group"><label className="form-label">Version *</label><input className="form-control" placeholder="1.0" {...tmplForm.register("version")} /></div>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-control" {...tmplForm.register("status")}>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" {...tmplForm.register("description")} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTemplateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createTemplate.isPending}>{createTemplate.isPending ? "Creating…" : "Create Template"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Group ───────────────────────────────────────────── */}
      {showGroupModal.open && (
        <div className="modal-backdrop" onClick={() => setShowGroupModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{showGroupModal.group ? "Edit Group" : "Add Group"}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowGroupModal({ open: false })}><X size={16} /></button>
            </div>
            <form onSubmit={groupForm.handleSubmit((d) => saveGroup.mutate(d as unknown as GroupForm))}>
              <div className="modal-body stack">
                <div className="alert alert-info">
                  Group Weight = Priority / Sum of Active Group Priorities (auto-calculated)
                </div>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-control" placeholder="e.g. Security" {...groupForm.register("name")} />
                </div>
                <div className="form-group">
                  <label className="form-label">Code *</label>
                  <input className="form-control" placeholder="e.g. security" {...groupForm.register("code")} />
                </div>
                <div className="form-group">
                  <label className="form-label">Priority *</label>
                  <input type="number" min={1} className="form-control" {...groupForm.register("priority")} />
                  <div className="form-hint">Higher priority = larger weight share</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Order</label>
                  <input type="number" min={0} className="form-control" {...groupForm.register("display_order")} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal({ open: false })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveGroup.isPending}>
                  {saveGroup.isPending ? "Saving…" : showGroupModal.group ? "Update Group" : "Add Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Characteristic ──────────────────────────────────── */}
      {showCharModal.open && (
        <div className="modal-backdrop" onClick={() => setShowCharModal({ open: false })}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{showCharModal.tc ? `Edit Metric: ${showCharModal.tc.characteristic?.name}` : "Add Metric to Group"}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCharModal({ open: false })}><X size={16} /></button>
            </div>
            <form onSubmit={charForm.handleSubmit((d) => saveChar.mutate(d as unknown as CharForm))}>
              <div className="modal-body stack">
                <div className="form-group">
                  <label className="form-label">Characteristic *</label>
                  <select className="form-control" disabled={!!showCharModal.tc} {...charForm.register("characteristic_id")}>
                    <option value="">Select characteristic…</option>
                    {characteristics.map(c => <option key={c.id} value={c.id}>{c.name} ({characteristicTypeLabel(c.characteristic_type)})</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Priority (Weight) *</label>
                    <input type="number" min={1} className="form-control" {...charForm.register("priority")} />
                    <div className="form-hint">Relative weight within group</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scoring Method *</label>
                    <select className="form-control" {...charForm.register("scoring_method")}>
                      <option value="">Select method…</option>
                      {SCORING_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Direction</label>
                  <select className="form-control" {...charForm.register("direction")}>
                    <option value="">N/A</option>
                    <option value="HIGHER">HIGHER (more is better)</option>
                    <option value="LOWER">LOWER (less is better)</option>
                  </select>
                </div>
                <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <input type="checkbox" id="req" {...charForm.register("required")} />
                  <label htmlFor="req" className="form-label" style={{ margin: 0 }}>Required (ineligible if missing)</label>
                </div>

                {/* Composite Child Option Priorities */}
                {(charForm.watch("scoring_method") === "COMPOSITE" || selectedCharObj?.characteristic_type === "COMPOSITE") && selectedCharObj && (
                  <div style={{ marginTop: 12, padding: 12, background: "var(--bg-subtle)", borderRadius: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Child Option Priorities (Composite Scoring)</div>
                    
                    {selectedCharObj.options && selectedCharObj.options.length > 0 ? (
                      <div className="stack" style={{ gap: 8 }}>
                        {selectedCharObj.options.map(opt => (
                          <div key={opt.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12 }}>{opt.name}</span>
                            <input
                              type="number"
                              min={1}
                              style={{ width: 80, padding: "4px 8px" }}
                              className="form-control"
                              value={optionPriorities[opt.id] ?? opt.default_priority ?? 1}
                              onChange={e => setOptionPriorities({ ...optionPriorities, [opt.id]: parseInt(e.target.value) || 1 })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>No options defined yet.</div>
                    )}

                    {/* Add new option inline */}
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ padding: "4px 8px", fontSize: 12 }}
                        placeholder="New child option..."
                        value={newOptionName}
                        onChange={e => setNewOptionName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (newOptionName.trim()) addOption.mutate(newOptionName.trim());
                          }
                        }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-secondary btn-sm"
                        disabled={!newOptionName.trim() || addOption.isPending}
                        onClick={() => addOption.mutate(newOptionName.trim())}
                      >
                        {addOption.isPending ? "Adding..." : "Add"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Threat Intelligence / RISK Multipliers Configuration */}
                {(charForm.watch("scoring_method") === "RISK" || selectedCharObj?.characteristic_type === "RISK") && (
                  <div style={{ marginTop: 12, padding: 14, background: "var(--bg-subtle)", borderRadius: 8, border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      Threat Risk Multipliers (Risk Points)
                    </div>
                    <div className="alert alert-info" style={{ fontSize: 11, marginBottom: 12 }}>
                      These are <strong>Risk Points / Multipliers</strong> used to calculate the parent Threat Score, distinct from the parent metric ranking priority.
                    </div>

                    <div className="grid-2" style={{ gap: 10 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Critical Risk Points</label>
                        <input
                          type="number" min={0} className="form-control"
                          value={riskConfig.critical_weight}
                          onChange={e => setRiskConfig(c => ({ ...c, critical_weight: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>High Risk Points</label>
                        <input
                          type="number" min={0} className="form-control"
                          value={riskConfig.high_weight}
                          onChange={e => setRiskConfig(c => ({ ...c, high_weight: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 10, marginTop: 8 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Medium Risk Points</label>
                        <input
                          type="number" min={0} className="form-control"
                          value={riskConfig.medium_weight}
                          onChange={e => setRiskConfig(c => ({ ...c, medium_weight: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Low Risk Points</label>
                        <input
                          type="number" min={0} className="form-control"
                          value={riskConfig.low_weight}
                          onChange={e => setRiskConfig(c => ({ ...c, low_weight: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="grid-2" style={{ gap: 10, marginTop: 8 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>CISA KEV Exploits Modifier</label>
                        <input
                          type="number" min={0} className="form-control"
                          value={riskConfig.kev_weight}
                          onChange={e => setRiskConfig(c => ({ ...c, kev_weight: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11 }}>Normalization Model</label>
                        <select
                          className="form-control"
                          value={riskConfig.normalization_method}
                          onChange={e => setRiskConfig(c => ({ ...c, normalization_method: e.target.value }))}
                        >
                          <option value="RELATIVE">Relative Market Inversion (Worst-to-Best)</option>
                          <option value="ABSOLUTE">Absolute Penalty (100 - Points)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCharModal({ open: false })}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saveChar.isPending}>
                  {saveChar.isPending ? "Saving…" : showCharModal.tc ? "Update Metric" : "Add Metric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
