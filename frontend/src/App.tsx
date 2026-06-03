import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Route, Routes } from "react-router-dom";

import {
  createLabelRule,
  createImportTemplate,
  getHealth,
  listLabelRules,
  listLabels,
  listImportTemplates,
  previewCsv,
  updateImportTemplate,
  type CsvPreviewResponse,
  type HealthResponse,
  type ImportTemplate,
  type ImportTemplateConfig,
  type LabelRule,
  type TemplateTransform,
  type TransactionLabel,
} from "./api/client";
import "./App.css";

const REQUIRED_FIELDS = ["date", "description", "amount", "direction"] as const;
const DEFAULT_TRANSFORMS: Record<(typeof REQUIRED_FIELDS)[number], TemplateTransform> = {
  date: "parse_date",
  description: "copy_column",
  amount: "absolute_numeric",
  direction: "signed_amount_direction",
};

type MappingDraft = Record<(typeof REQUIRED_FIELDS)[number], string>;
type TransformDraft = Record<(typeof REQUIRED_FIELDS)[number], TemplateTransform>;

function createEmptyMappings(): MappingDraft {
  return { date: "", description: "", amount: "", direction: "" };
}

function createDefaultTransforms(): TransformDraft {
  return { ...DEFAULT_TRANSFORMS };
}

function Home() {
  const [apiHealth, setApiHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "new">("new");
  const [templateName, setTemplateName] = useState("");
  const [mappingDraft, setMappingDraft] = useState<MappingDraft>(createEmptyMappings);
  const [transformDraft, setTransformDraft] = useState<TransformDraft>(createDefaultTransforms);
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [labels, setLabels] = useState<TransactionLabel[]>([]);
  const [labelRules, setLabelRules] = useState<LabelRule[]>([]);
  const [labelRuleField, setLabelRuleField] = useState<"merchant" | "description">("description");
  const [labelRulePattern, setLabelRulePattern] = useState("");
  const [labelRuleLabelId, setLabelRuleLabelId] = useState<number | "">("");
  const [labelRuleStatus, setLabelRuleStatus] = useState<string | null>(null);
  const [labelRuleError, setLabelRuleError] = useState<string | null>(null);
  const [labelRuleSaving, setLabelRuleSaving] = useState(false);
  const previewRequestId = useRef(0);

  useEffect(() => {
    let active = true;

    getHealth()
      .then((health) => {
        if (active) {
          setApiHealth(health);
        }
      })
      .catch(() => {
        if (active) {
          setError("API unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    listImportTemplates()
      .then(setTemplates)
      .catch(() => setTemplateError("Could not load import templates."));
  }, []);

  useEffect(() => {
    Promise.all([listLabels(), listLabelRules()])
      .then(([nextLabels, nextRules]) => {
        setLabels(nextLabels);
        setLabelRules(nextRules);
        setLabelRuleLabelId(nextLabels[0]?.id ?? "");
      })
      .catch(() => setLabelRuleError("Could not load transaction labels."));
  }, []);

  function applyTemplateToDraft(template: ImportTemplate) {
    const nextMappings = createEmptyMappings();
    const nextTransforms = createDefaultTransforms();

    for (const field of REQUIRED_FIELDS) {
      const mapping = template.config.mappings[field];
      nextMappings[field] = mapping?.source_column ?? "";
      nextTransforms[field] = mapping?.transform ?? DEFAULT_TRANSFORMS[field];
    }

    setTemplateName(template.name);
    setMappingDraft(nextMappings);
    setTransformDraft(nextTransforms);
  }

  function buildTemplateConfig(): ImportTemplateConfig {
    return {
      mappings: {
        date: { source_column: mappingDraft.date, transform: transformDraft.date },
        description: { source_column: mappingDraft.description, transform: transformDraft.description },
        amount: { source_column: mappingDraft.amount, transform: transformDraft.amount },
        direction: {
          source_column: mappingDraft.direction,
          transform: transformDraft.direction,
          positive_direction: "credit",
          negative_direction: "debit",
        },
      },
    };
  }

  async function handleTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTemplateStatus(null);
    setTemplateError(null);

    if (!templateName.trim()) {
      setTemplateError("Name the template before saving.");
      return;
    }

    const missingField = REQUIRED_FIELDS.find((field) => !mappingDraft[field]);
    if (missingField) {
      setTemplateError(`Map the required ${missingField} field before saving.`);
      return;
    }

    setTemplateSaving(true);
    try {
      const selectedTemplate =
        selectedTemplateId === "new"
          ? null
          : templates.find((template) => template.id === selectedTemplateId) ?? null;
      const payload = { name: templateName, account_id: selectedTemplate?.account_id ?? null, config: buildTemplateConfig() };
      const savedTemplate =
        selectedTemplateId === "new"
          ? await createImportTemplate(payload)
          : await updateImportTemplate(selectedTemplateId, payload);
      setTemplates((currentTemplates) => {
        const withoutSaved = currentTemplates.filter((template) => template.id !== savedTemplate.id);
        return [...withoutSaved, savedTemplate].sort((first, second) => first.name.localeCompare(second.name));
      });
      setSelectedTemplateId(savedTemplate.id);
      setTemplateStatus("Template saved for future imports.");
    } catch {
      setTemplateError("Could not save that template. Check required mappings and transform settings.");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setPreviewError("Choose a CSV file first.");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;

    try {
      const nextPreview = await previewCsv(selectedFile);
      if (requestId === previewRequestId.current) {
        setPreview(nextPreview);
      }
    } catch {
      if (requestId === previewRequestId.current) {
        setPreviewError("Could not parse that CSV. Check the file and try again.");
      }
    } finally {
      if (requestId === previewRequestId.current) {
        setPreviewLoading(false);
      }
    }
  }

  async function handleLabelRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLabelRuleStatus(null);
    setLabelRuleError(null);

    if (!labelRulePattern.trim()) {
      setLabelRuleError("Enter merchant or description text to match.");
      return;
    }
    if (labelRuleLabelId === "") {
      setLabelRuleError("Choose one of the fixed labels.");
      return;
    }

    setLabelRuleSaving(true);
    try {
      const savedRule = await createLabelRule({
        label_id: labelRuleLabelId,
        match_field: labelRuleField,
        pattern: labelRulePattern,
      });
      setLabelRules((currentRules) => [...currentRules, savedRule]);
      setLabelRulePattern("");
      setLabelRuleStatus(`Rule saved. Applied to ${savedRule.applied_count ?? 0} existing transactions.`);
    } catch {
      setLabelRuleError("Could not save that rule. Use a predefined label and valid match text.");
    } finally {
      setLabelRuleSaving(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Personal Finance MVP</p>
        <h1>Import messy CSVs into useful money data.</h1>
        <p className="intro">
          The foundation is running: React on Vite, FastAPI on SQLite, and Docker for local development.
        </p>
        <div className="status-card" aria-label="Frontend Health">
          <span className="status-label">Frontend Health</span>
          <span className="status-value ok">ready</span>
          <span className="status-label">Backend Health</span>
          <span className={error ? "status-value error" : "status-value ok"}>
            {error ?? apiHealth?.status ?? "checking"}
          </span>
        </div>
      </section>
      <section className="upload-panel" aria-labelledby="upload-heading">
        <p className="eyebrow">CSV Upload Preview</p>
        <h2 id="upload-heading">Preview source rows before mapping.</h2>
        <form className="upload-form" onSubmit={handlePreviewSubmit}>
          <label className="file-picker">
            <span>Statement CSV</span>
            <input
              accept=".csv,text/csv"
              disabled={previewLoading}
              type="file"
              onChange={(event) => {
                previewRequestId.current += 1;
                setSelectedFile(event.target.files?.[0] ?? null);
                setPreview(null);
                setPreviewError(null);
                setTemplateStatus(null);
              }}
            />
          </label>
          <button type="submit" disabled={previewLoading}>
            {previewLoading ? "Parsing..." : "Preview CSV"}
          </button>
        </form>
        {previewError ? <p className="preview-error">{previewError}</p> : null}
        {preview ? (
          <div className="preview-results">
            <div>
              <h3>Source Columns</h3>
              <div className="column-list" aria-label="Source columns">
                {preview.source_columns.map((column) => (
                  <span key={column}>{column}</span>
                ))}
              </div>
            </div>
            <form className="template-editor" onSubmit={handleTemplateSubmit}>
              <div className="template-editor-header">
                <div>
                  <h3>Import Template</h3>
                  <p>Map required transaction fields before generating transformed previews.</p>
                </div>
                <label>
                  <span>Template</span>
                  <select
                    value={selectedTemplateId}
                    onChange={(event) => {
                      const value = event.target.value === "new" ? "new" : Number(event.target.value);
                      setSelectedTemplateId(value);
                      setTemplateStatus(null);
                      setTemplateError(null);
                      if (value === "new") {
                        setTemplateName("");
                        setMappingDraft(createEmptyMappings());
                        setTransformDraft(createDefaultTransforms());
                        return;
                      }
                      const template = templates.find((candidate) => candidate.id === value);
                      if (template) {
                        applyTemplateToDraft(template);
                      }
                    }}
                  >
                    <option value="new">New template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="template-name">
                <span>Template name</span>
                <input
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Checking account export"
                />
              </label>
              <div className="mapping-grid">
                {REQUIRED_FIELDS.map((field) => (
                  <div className="mapping-row" key={field}>
                    <strong>{field}</strong>
                    <label>
                      <span>Source column</span>
                      <select
                        value={mappingDraft[field]}
                        onChange={(event) =>
                          setMappingDraft((current) => ({ ...current, [field]: event.target.value }))
                        }
                      >
                        <option value="">Choose column</option>
                        {preview.source_columns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Transform</span>
                      <select
                        value={transformDraft[field]}
                        onChange={(event) =>
                          setTransformDraft((current) => ({
                            ...current,
                            [field]: event.target.value as TemplateTransform,
                          }))
                        }
                      >
                        <option value="copy_column">copy column</option>
                        <option value="parse_date">parse date</option>
                        <option value="parse_numeric">parse numeric</option>
                        <option value="absolute_numeric">absolute numeric</option>
                        <option value="signed_amount_direction">signed amount direction</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
              <p className="template-note">Signed amount direction saves positive as credit and negative as debit.</p>
              {templateError ? <p className="preview-error">{templateError}</p> : null}
              {templateStatus ? <p className="template-status">{templateStatus}</p> : null}
              <button type="submit" disabled={templateSaving}>
                {templateSaving ? "Saving..." : selectedTemplateId === "new" ? "Save Template" : "Update Template"}
              </button>
            </form>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} scope="col">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      {preview.headers.map((header) => (
                        <td key={header}>{row[header] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
      <section className="label-panel" aria-labelledby="label-heading">
        <p className="eyebrow">Transaction Labeling</p>
        <h2 id="label-heading">Save reusable match rules.</h2>
        <p className="label-intro">
          Assign fixed labels by matching merchant or description text. Custom labels are not available in the MVP;
          unmatched transactions stay uncategorized.
        </p>
        <form className="label-rule-form" onSubmit={handleLabelRuleSubmit}>
          <label>
            <span>Match field</span>
            <select value={labelRuleField} onChange={(event) => setLabelRuleField(event.target.value as "merchant" | "description")}>
              <option value="description">Description</option>
              <option value="merchant">Merchant</option>
            </select>
          </label>
          <label>
            <span>Match text</span>
            <input
              value={labelRulePattern}
              onChange={(event) => setLabelRulePattern(event.target.value)}
              placeholder="Target, Payroll, Netflix"
            />
          </label>
          <label>
            <span>Fixed label</span>
            <select
              value={labelRuleLabelId}
              onChange={(event) => setLabelRuleLabelId(event.target.value ? Number(event.target.value) : "")}
            >
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={labelRuleSaving || labels.length === 0}>
            {labelRuleSaving ? "Saving..." : "Save Label Rule"}
          </button>
        </form>
        {labelRuleError ? <p className="preview-error">{labelRuleError}</p> : null}
        {labelRuleStatus ? <p className="template-status">{labelRuleStatus}</p> : null}
        <div className="rule-list" aria-label="Existing label rules">
          {labelRules.length === 0 ? <p>No label rules yet.</p> : null}
          {labelRules.map((rule) => (
            <article key={rule.id}>
              <strong>{rule.label_name}</strong>
              <span>{rule.match_field} contains "{rule.pattern}"</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Link to="/">Back to dashboard</Link>} />
    </Routes>
  );
}
