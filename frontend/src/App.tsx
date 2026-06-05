import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import {
  confirmImport,
  createAccount,
  createLabelRule,
  createImportTemplate,
  deleteAccount,
  getDashboardSpendingByLabel,
  getHealth,
  listAccounts,
  listLabelRules,
  listLabels,
  listImportTemplates,
  previewCsv,
  prepareImport,
  renameAccount,
  updateImportTemplate,
  type Account,
  type ConfirmImportResponse,
  type CsvPreviewResponse,
  type DashboardSpendingLabel,
  type HealthResponse,
  type ImportPrepareResponse,
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
const CHART_COLORS = ["#426b35", "#7b5d2a", "#5868a8", "#b55c3d", "#2f7282", "#8a4c82"];

type MappingDraft = Record<(typeof REQUIRED_FIELDS)[number], string>;
type TransformDraft = Record<(typeof REQUIRED_FIELDS)[number], TemplateTransform>;

function createEmptyMappings(): MappingDraft {
  return { date: "", description: "", amount: "", direction: "" };
}

function createDefaultTransforms(): TransformDraft {
  return { ...DEFAULT_TRANSFORMS };
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | "">("");
  const [newAccountName, setNewAccountName] = useState("");
  const [renamingAccountId, setRenamingAccountId] = useState<number | null>(null);
  const [renamingAccountName, setRenamingAccountName] = useState("");
  const [confirmingDeleteAccountId, setConfirmingDeleteAccountId] = useState<number | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [preparedImport, setPreparedImport] = useState<ImportPrepareResponse | null>(null);
  const [importResult, setImportResult] = useState<ConfirmImportResponse | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [labels, setLabels] = useState<TransactionLabel[]>([]);
  const [labelRules, setLabelRules] = useState<LabelRule[]>([]);
  const [labelRuleField, setLabelRuleField] = useState<"merchant" | "description">("description");
  const [labelRulePattern, setLabelRulePattern] = useState("");
  const [labelRuleLabelId, setLabelRuleLabelId] = useState<number | "">("");
  const [labelRuleStatus, setLabelRuleStatus] = useState<string | null>(null);
  const [labelRuleError, setLabelRuleError] = useState<string | null>(null);
  const [labelRuleSaving, setLabelRuleSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dashboardAccountIds, setDashboardAccountIds] = useState<number[]>([]);
  const [dashboardLabels, setDashboardLabels] = useState<DashboardSpendingLabel[]>([]);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
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
    refreshAccounts();
  }, []);

  useEffect(() => {
    if (activeAccountId === "") {
      setTemplates([]);
      return;
    }
    listImportTemplates(activeAccountId)
      .then(setTemplates)
      .catch(() => setTemplateError("Could not load import templates."));
  }, [activeAccountId]);

  useEffect(() => {
    Promise.all([listLabels(), listLabelRules()])
      .then(([nextLabels, nextRules]) => {
        setLabels(nextLabels);
        setLabelRules(nextRules);
        setLabelRuleLabelId(nextLabels[0]?.id ?? "");
      })
      .catch(() => setLabelRuleError("Could not load transaction labels."));
  }, []);

  useEffect(() => {
    let active = true;
    setDashboardError(null);

    getDashboardSpendingByLabel(selectedMonth, dashboardAccountIds)
      .then((dashboard) => {
        if (active) {
          setDashboardLabels(dashboard.labels);
        }
      })
      .catch(() => {
        if (active) {
          setDashboardLabels([]);
          setDashboardError("Could not load dashboard spending data.");
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMonth, dashboardAccountIds]);

  const dashboardChartData = dashboardLabels.map((label) => ({
    name: label.label_name,
    value: Number(label.amount),
    amount: label.amount,
  }));
  const dashboardTotal = dashboardChartData.reduce((total, item) => total + item.value, 0);
  const activeAccount = activeAccountId === "" ? null : accounts.find((account) => account.id === activeAccountId) ?? null;

  function refreshDashboard() {
    setDashboardError(null);
    getDashboardSpendingByLabel(selectedMonth, dashboardAccountIds)
      .then((dashboard) => setDashboardLabels(dashboard.labels))
      .catch(() => {
        setDashboardLabels([]);
        setDashboardError("Could not load dashboard spending data.");
      });
  }

  function refreshAccounts() {
    return listAccounts()
      .then((nextAccounts) => {
        setAccounts(nextAccounts);
        setActiveAccountId((currentId) => {
          if (currentId !== "" && nextAccounts.some((account) => account.id === currentId)) {
            return currentId;
          }
          return nextAccounts[0]?.id ?? "";
        });
        setDashboardAccountIds((currentIds) => currentIds.filter((id) => nextAccounts.some((account) => account.id === id)));
      })
      .catch(() => setAccountError("Could not load accounts."));
  }

  async function handleCreateAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError(null);
    setAccountStatus(null);
    if (!newAccountName.trim()) {
      setAccountError("Enter an account name.");
      return;
    }
    try {
      const account = await createAccount(newAccountName);
      setNewAccountName("");
      setAccountStatus(`Created ${account.name}.`);
      await refreshAccounts();
      setActiveAccountId(account.id);
    } catch {
      setAccountError("Could not create account. Use a unique name.");
    }
  }

  async function handleRenameAccount(accountId: number) {
    setAccountError(null);
    setAccountStatus(null);
    if (!renamingAccountName.trim()) {
      setAccountError("Enter an account name.");
      return;
    }
    try {
      const account = await renameAccount(accountId, renamingAccountName);
      setRenamingAccountId(null);
      setRenamingAccountName("");
      setAccountStatus(`Renamed account to ${account.name}.`);
      await refreshAccounts();
    } catch {
      setAccountError("Could not rename account. Use a unique name.");
    }
  }

  async function handleDeleteAccount(account: Account, confirmed = false) {
    setAccountError(null);
    setAccountStatus(null);
    try {
      const warning = await deleteAccount(account.id, confirmed);
      if (warning?.requires_confirmation) {
        setConfirmingDeleteAccountId(account.id);
        setAccountError(`${account.name} has ${warning.transaction_count} transaction(s). Confirm deletion to remove account and linked import data.`);
        return;
      }
      setConfirmingDeleteAccountId(null);
      setAccountStatus(`Deleted ${account.name}.`);
      await refreshAccounts();
    } catch {
      setAccountError("Could not delete account.");
    }
  }

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
      const payload = { name: templateName, account_id: selectedTemplate?.account_id ?? (activeAccountId || null), config: buildTemplateConfig() };
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
      refreshDashboard();
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
      <section className="account-panel" aria-labelledby="accounts-heading">
        <p className="eyebrow">Accounts</p>
        <h2 id="accounts-heading">Manage import accounts.</h2>
        <form className="account-create-form" onSubmit={handleCreateAccount}>
          <label>
            <span>New account name</span>
            <input value={newAccountName} onChange={(event) => setNewAccountName(event.target.value)} placeholder="Everyday checking" />
          </label>
          <button type="submit">Create Account</button>
        </form>
        {accountError ? <p className="preview-error">{accountError}</p> : null}
        {accountStatus ? <p className="template-status">{accountStatus}</p> : null}
        <div className="account-list" aria-label="Accounts">
          {accounts.length === 0 ? <p>No accounts yet. Create one before importing transactions.</p> : null}
          {accounts.map((account) => (
            <article key={account.id}>
              <div>
                <strong>{account.name}</strong>
                <span>{account.transaction_count} transaction(s)</span>
              </div>
              {renamingAccountId === account.id ? (
                <label>
                  <span>Rename account</span>
                  <input value={renamingAccountName} onChange={(event) => setRenamingAccountName(event.target.value)} />
                </label>
              ) : null}
              <div className="account-actions">
                {renamingAccountId === account.id ? (
                  <button type="button" onClick={() => handleRenameAccount(account.id)}>Save Rename</button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingAccountId(account.id);
                      setRenamingAccountName(account.name);
                    }}
                  >
                    Rename
                  </button>
                )}
                <button type="button" onClick={() => handleDeleteAccount(account)}>Delete</button>
                {confirmingDeleteAccountId === account.id ? (
                  <button type="button" onClick={() => handleDeleteAccount(account, true)}>
                    Confirm Delete
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="dashboard-panel" aria-labelledby="dashboard-heading">
        <div className="dashboard-header">
          <div>
            <p className="eyebrow">Finance Dashboard</p>
            <h2 id="dashboard-heading">Monthly spending by label.</h2>
          </div>
          <label className="month-picker">
            <span>Dashboard month</span>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </label>
          <label className="account-filter">
            <span>Dashboard accounts</span>
            <select
              aria-label="Dashboard accounts"
              multiple
              value={dashboardAccountIds.map(String)}
              onChange={(event) => {
                const values = Array.from(event.target.selectedOptions, (option) => Number(option.value));
                setDashboardAccountIds(values);
              }}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <small>Leave blank for all accounts.</small>
          </label>
        </div>
        {dashboardError ? <p className="preview-error">{dashboardError}</p> : null}
        {dashboardLabels.length === 0 ? (
          <div className="dashboard-empty">No spending data available for {selectedMonth} and selected accounts.</div>
        ) : (
          <div className="dashboard-grid">
            <div className="chart-card" aria-label="Spending by label pie chart">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={dashboardChartData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={3}>
                    {dashboardChartData.map((item, index) => (
                      <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
              <strong>Total debit spending: ${dashboardTotal.toFixed(2)}</strong>
            </div>
            <div className="dashboard-legend" aria-label="Spending by label totals">
              {dashboardLabels.map((label, index) => (
                <div key={label.label_slug}>
                  <span style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
                  <strong>{label.label_name}</strong>
                  <em>${Number(label.amount).toFixed(2)}</em>
                </div>
              ))}
            </div>
          </div>
        )}
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
                setPreparedImport(null);
                setImportResult(null);
                setImportStatus(null);
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
            <div className="import-confirmation" aria-label="Import confirmation">
              <div>
                <h3>Transformed Preview</h3>
                <p>Select an existing account before preparing an import.</p>
              </div>
              <label>
                <span>Active account</span>
                <select
                  value={activeAccountId}
                  onChange={(event) => {
                    setActiveAccountId(event.target.value ? Number(event.target.value) : "");
                    setPreparedImport(null);
                    setImportResult(null);
                  }}
                >
                  <option value="">Choose account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              {activeAccount ? <p>Templates are scoped to {activeAccount.name}; global templates also appear.</p> : null}
              <div className="import-actions">
                <button
                  type="button"
                  disabled={importLoading || !selectedFile}
                  onClick={async () => {
                    setImportError(null);
                    setImportStatus(null);
                    setImportResult(null);
                    if (!selectedFile || activeAccountId === "") {
                      setImportError("Choose a CSV file and active account before preparing import.");
                      return;
                    }
                    const missingField = REQUIRED_FIELDS.find((field) => !mappingDraft[field]);
                    if (missingField) {
                      setImportError(`Map the required ${missingField} field before preparing import.`);
                      return;
                    }
                    setImportLoading(true);
                    try {
                      const prepared = await prepareImport(selectedFile, activeAccountId, buildTemplateConfig());
                      setPreparedImport(prepared);
                      setImportStatus(`Prepared ${prepared.row_count} row(s). Review transformed preview before confirming.`);
                    } catch {
                      setImportError("Could not prepare import. Check account id, mappings, and transform settings.");
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                >
                  {importLoading ? "Preparing..." : "Prepare Import"}
                </button>
                <button
                  type="button"
                  disabled={importLoading || !preparedImport}
                  onClick={async () => {
                    if (!preparedImport) {
                      return;
                    }
                    setImportError(null);
                    setImportLoading(true);
                    try {
                      const confirmed = await confirmImport(preparedImport.upload_file_id, buildTemplateConfig());
                      setImportResult(confirmed);
                      setImportStatus(
                        confirmed.inserted_count > 0
                          ? `Imported ${confirmed.inserted_count} transaction(s).`
                          : "Duplicate warning found; no transactions inserted.",
                      );
                      refreshDashboard();
                    } catch {
                      setImportError("Could not confirm import. Review duplicate warnings and mappings.");
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                >
                  {importLoading ? "Confirming..." : "Confirm Import"}
                </button>
              </div>
              {importError ? <p className="preview-error">{importError}</p> : null}
              {importStatus ? <p className="template-status">{importStatus}</p> : null}
              {preparedImport?.duplicate_candidates.length ? (
                <p className="preview-error">{preparedImport.duplicate_candidates.length} duplicate candidate(s) found before import.</p>
              ) : null}
              {importResult?.duplicate_candidates.length ? (
                <p className="preview-error">{importResult.duplicate_candidates.length} duplicate candidate(s) blocked insert.</p>
              ) : null}
              {preparedImport ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(preparedImport.transformed_preview[0] ?? {}).map((header) => (
                          <th key={header} scope="col">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preparedImport.transformed_preview.map((row, index) => (
                        <tr key={index}>
                          {Object.keys(preparedImport.transformed_preview[0] ?? {}).map((header) => (
                            <td key={header}>{row[header] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
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
