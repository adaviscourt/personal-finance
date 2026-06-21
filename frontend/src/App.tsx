import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";

import {
  confirmImport,
  createAccount,
  createLabel,
  createLabelRule,
  createImportTemplate,
  deleteImportUpload,
  deleteLabelRule,
  deleteAccount,
  getDashboardSpendingByLabel,
  getDashboardTransactions,
  listAccounts,
  listLabelRules,
  listLabels,
  listImportTemplates,
  listImportUploads,
  previewCsv,
  prepareImport,
  previewLabelRuleMatches,
  renameAccount,
  updateLabelRule,
  updateImportTemplate,
  type Account,
  type ConfirmImportResponse,
  type CsvPreviewResponse,
  type DashboardSpendingLabel,
  type DashboardTransactionRow,
  type ImportPrepareResponse,
  type ImportTemplate,
  type ImportTemplateConfig,
  type ImportUploadSummary,
  type LabelRule,
  type LabelRuleMatchPreview,
  type TemplateTransform,
  type TransactionLabel,
} from "./api/client";
import "./App.css";

const REQUIRED_FIELDS = ["date", "description", "amount", "direction"] as const;
const OPTIONAL_SPLIT_FIELDS = ["debit", "credit"] as const;
const DASHBOARD_MONTH_STORAGE_KEY = "personal-finance.dashboardMonth";
const DASHBOARD_ACCOUNT_IDS_STORAGE_KEY = "personal-finance.dashboardAccountIds";
const DASHBOARD_LABEL_SLUG_STORAGE_KEY = "personal-finance.dashboardLabelSlug";
const DEFAULT_TRANSFORMS: Record<(typeof REQUIRED_FIELDS)[number], TemplateTransform> = {
  date: "parse_date",
  description: "copy_column",
  amount: "absolute_numeric",
  direction: "signed_amount_direction",
};
const CHART_COLORS = ["#0850c4", "#063d95", "#5868a8", "#7b5d2a", "#2f7282", "#8a4c82"];
const IMPORT_STEPS: { id: ImportStep; label: string; help: string }[] = [
  { id: "account", label: "Account", help: "Choose where these transactions belong." },
  { id: "source", label: "Source file", help: "Select and preview the CSV rows." },
  { id: "mapping", label: "Mappings", help: "Choose or edit account template mappings." },
  { id: "review", label: "Review", help: "Prepare rows and check duplicate warnings." },
  { id: "confirm", label: "Confirm", help: "Import, then review the month." },
];

type RequiredMappingField = (typeof REQUIRED_FIELDS)[number];
type OptionalSplitField = (typeof OPTIONAL_SPLIT_FIELDS)[number];
type MappingDraft = Record<RequiredMappingField | OptionalSplitField, string>;
type TransformDraft = Record<(typeof REQUIRED_FIELDS)[number], TemplateTransform>;
type AmountMode = "single" | "split";
type ImportStep = "account" | "source" | "mapping" | "review" | "confirm";
type MappingMode = "list" | "new";
type DashboardSortKey = "date" | "account" | "description" | "label" | "direction" | "amount";
type SortDirection = "asc" | "desc";
type DashboardNetPoint = { month: string; amount: number };

const DASHBOARD_SORT_LABELS: Record<DashboardSortKey, string> = {
  date: "Date",
  account: "Account",
  description: "Description",
  label: "Label",
  direction: "Direction",
  amount: "Amount",
};

function createEmptyMappings(): MappingDraft {
  return { date: "", description: "", amount: "", direction: "", debit: "", credit: "" };
}

function createDefaultTransforms(): TransformDraft {
  return { ...DEFAULT_TRANSFORMS };
}

function createDefaultDescriptionParts(): string[] {
  return [""];
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function readStoredDashboardMonth(): string | null {
  try {
    return window.localStorage?.getItem?.(DASHBOARD_MONTH_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function readStoredDashboardAccountIds(): number[] {
  try {
    const storedIds = window.localStorage?.getItem?.(DASHBOARD_ACCOUNT_IDS_STORAGE_KEY);
    const parsedIds: unknown = storedIds ? JSON.parse(storedIds) : [];
    return Array.isArray(parsedIds) ? parsedIds.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function readStoredDashboardLabelSlugs(): string[] {
  let storedSlug = "";
  try {
    storedSlug = window.localStorage?.getItem?.(DASHBOARD_LABEL_SLUG_STORAGE_KEY) ?? "";
    if (!storedSlug) {
      return [];
    }
    const parsedSlugs: unknown = JSON.parse(storedSlug);
    if (Array.isArray(parsedSlugs)) {
      return parsedSlugs.filter((slug): slug is string => typeof slug === "string" && slug.length > 0);
    }
    return typeof parsedSlugs === "string" && parsedSlugs.length > 0 ? [parsedSlugs] : [];
  } catch {
    return storedSlug ? [storedSlug] : [];
  }
}

function writeStoredValue(key: string, value: string) {
  try {
    window.localStorage?.setItem?.(key, value);
  } catch {
    // Storage can be unavailable in private mode or test environments.
  }
}

function initialDashboardMonth(): string {
  const storedMonth = readStoredDashboardMonth();
  return storedMonth && /^\d{4}-\d{2}$/.test(storedMonth) ? storedMonth : currentMonth();
}

function importReviewMonth(preparedImport: ImportPrepareResponse | null): string | null {
  const datedRow = preparedImport?.transformed_preview.find((row) => {
    const value = row.date;
    return typeof value === "string" && /^\d{4}-\d{2}/.test(value);
  });
  const date = datedRow?.date;
  return typeof date === "string" ? date.slice(0, 7) : null;
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const monthName = new Date(Number(year), Number(monthNumber) - 1, 1).toLocaleString("en-US", { month: "long" });
  return `${monthName} ${year}`;
}

function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + offset, 1)).toISOString().slice(0, 7);
}

function surroundingMonths(month: string): string[] {
  return Array.from({ length: 7 }, (_, index) => shiftMonth(month, index - 3));
}

function netTransactionAmount(transactions: DashboardTransactionRow[]): number {
  return transactions.reduce((total, transaction) => {
    const amount = Number(transaction.amount);
    return total + (transaction.direction === "credit" ? amount : -amount);
  }, 0);
}

function apiErrorDetail(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("response" in error)) {
    return null;
  }
  const response = (error as { response?: { data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;
  return typeof detail === "string" ? detail : null;
}

function dashboardSortValue(transaction: DashboardTransactionRow, key: DashboardSortKey): string | number {
  if (key === "date") {
    return transaction.transaction_date;
  }
  if (key === "account") {
    return transaction.account.name;
  }
  if (key === "description") {
    return transaction.merchant || transaction.description;
  }
  if (key === "label") {
    return transaction.label.name;
  }
  if (key === "direction") {
    return transaction.direction;
  }
  return Number(transaction.amount);
}

function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | "new">("new");
  const [mappingMode, setMappingMode] = useState<MappingMode>("list");
  const [templateName, setTemplateName] = useState("");
  const [mappingDraft, setMappingDraft] = useState<MappingDraft>(createEmptyMappings);
  const [transformDraft, setTransformDraft] = useState<TransformDraft>(createDefaultTransforms);
  const [amountMode, setAmountMode] = useState<AmountMode>("single");
  const [descriptionParts, setDescriptionParts] = useState<string[]>(createDefaultDescriptionParts);
  const [templateStatus, setTemplateStatus] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
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
  const [importStep, setImportStep] = useState<ImportStep>("account");
  const [importUploads, setImportUploads] = useState<ImportUploadSummary[]>([]);
  const [importUploadsLoading, setImportUploadsLoading] = useState(false);
  const [importUploadsError, setImportUploadsError] = useState<string | null>(null);
  const [confirmingDeleteUploadId, setConfirmingDeleteUploadId] = useState<number | null>(null);
  const [deletingUploadId, setDeletingUploadId] = useState<number | null>(null);
  const [labels, setLabels] = useState<TransactionLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelAccountId, setNewLabelAccountId] = useState<number | "">("");
  const [newLabelIsControllable, setNewLabelIsControllable] = useState(true);
  const [labelSaving, setLabelSaving] = useState(false);
  const [labelRules, setLabelRules] = useState<LabelRule[]>([]);
  const [labelRuleMatchType, setLabelRuleMatchType] = useState<"contains" | "regex">("contains");
  const [labelRulePattern, setLabelRulePattern] = useState("");
  const [labelRuleLabelId, setLabelRuleLabelId] = useState<number | "">("");
  const [labelMatchPreview, setLabelMatchPreview] = useState<LabelRuleMatchPreview | null>(null);
  const [labelMatchPreviewLoading, setLabelMatchPreviewLoading] = useState(false);
  const [labelMatchPreviewError, setLabelMatchPreviewError] = useState<string | null>(null);
  const [labelRuleStatus, setLabelRuleStatus] = useState<string | null>(null);
  const [labelRuleError, setLabelRuleError] = useState<string | null>(null);
  const [labelRuleSaving, setLabelRuleSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editingRuleMatchType, setEditingRuleMatchType] = useState<"contains" | "regex">("contains");
  const [editingRulePattern, setEditingRulePattern] = useState("");
  const [editingRuleLabelId, setEditingRuleLabelId] = useState<number | "">("");
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(initialDashboardMonth);
  const [dashboardAccountIds, setDashboardAccountIds] = useState<number[]>(readStoredDashboardAccountIds);
  const [dashboardLabelSlugs, setDashboardLabelSlugs] = useState<string[]>(readStoredDashboardLabelSlugs);
  const [dashboardLabels, setDashboardLabels] = useState<DashboardSpendingLabel[]>([]);
  const [dashboardTransactions, setDashboardTransactions] = useState<DashboardTransactionRow[]>([]);
  const [dashboardNetSeries, setDashboardNetSeries] = useState<DashboardNetPoint[]>([]);
  const [dashboardSort, setDashboardSort] = useState<{ key: DashboardSortKey; direction: SortDirection }>({ key: "date", direction: "desc" });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const previewRequestId = useRef(0);
  const templateRequestId = useRef(0);

  useEffect(() => {
    refreshAccounts();
    refreshImportUploads();
  }, []);

  useEffect(() => {
    if (activeAccountId === "") {
      templateRequestId.current += 1;
      setTemplates([]);
      setMappingMode("list");
      return;
    }

    setSelectedTemplateId("new");
    setMappingMode("list");
      setTemplateName("");
      setMappingDraft(createEmptyMappings());
      setTransformDraft(createDefaultTransforms());
      setAmountMode("single");
      setDescriptionParts(createDefaultDescriptionParts());
      setPreparedImport(null);
    setImportResult(null);
    const requestId = templateRequestId.current + 1;
    templateRequestId.current = requestId;
    setTemplateError(null);
    listImportTemplates(activeAccountId)
      .then((nextTemplates) => {
        if (requestId === templateRequestId.current) {
          setTemplates(nextTemplates);
        }
      })
      .catch(() => {
        if (requestId === templateRequestId.current) {
          setTemplateError("Could not load import templates.");
        }
      });
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
    const pattern = labelRulePattern.trim();
    if (pattern.length < 2) {
      setLabelMatchPreview(null);
      setLabelMatchPreviewError(null);
      setLabelMatchPreviewLoading(false);
      return;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      setLabelMatchPreviewLoading(true);
      setLabelMatchPreviewError(null);
      previewLabelRuleMatches({
        label_id: labelRuleLabelId === "" ? 0 : labelRuleLabelId,
        match_field: "description",
        match_type: labelRuleMatchType,
        pattern,
      })
        .then((previewMatches) => {
          if (active) {
            setLabelMatchPreview(previewMatches);
          }
        })
        .catch(() => {
          if (active) {
            setLabelMatchPreview(null);
            setLabelMatchPreviewError("No preview available. Check regex syntax or try a narrower pattern.");
          }
        })
        .finally(() => {
          if (active) {
            setLabelMatchPreviewLoading(false);
          }
        });
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [labelRuleLabelId, labelRuleMatchType, labelRulePattern]);

  useEffect(() => {
    writeStoredValue(DASHBOARD_MONTH_STORAGE_KEY, selectedMonth);
    writeStoredValue(DASHBOARD_ACCOUNT_IDS_STORAGE_KEY, JSON.stringify(dashboardAccountIds));
    writeStoredValue(DASHBOARD_LABEL_SLUG_STORAGE_KEY, JSON.stringify(dashboardLabelSlugs));

    let active = true;
    setDashboardError(null);
    setDashboardLoading(true);

    const netMonths = surroundingMonths(selectedMonth);
    const comparisonNetMonths = netMonths.filter((month) => month !== selectedMonth);

    Promise.all([
      getDashboardSpendingByLabel(selectedMonth, dashboardAccountIds),
      getDashboardTransactions(selectedMonth, {
        accountIds: dashboardAccountIds,
        labelSlugs: dashboardLabelSlugs,
      }),
      Promise.all(comparisonNetMonths.map((month) => getDashboardTransactions(month, {
        accountIds: dashboardAccountIds,
        labelSlugs: dashboardLabelSlugs,
      }))),
    ])
      .then(([spendingDashboard, transactionDashboard, netDashboards]) => {
        if (active) {
          setDashboardLabels(spendingDashboard.labels);
          setDashboardTransactions(transactionDashboard.transactions);
          const netByMonth = new Map(comparisonNetMonths.map((month, index) => [month, netTransactionAmount(netDashboards[index].transactions)]));
          netByMonth.set(selectedMonth, netTransactionAmount(transactionDashboard.transactions));
          setDashboardNetSeries(netMonths.map((month) => ({ month, amount: netByMonth.get(month) ?? 0 })));
        }
      })
      .catch(() => {
        if (active) {
          setDashboardLabels([]);
          setDashboardTransactions([]);
          setDashboardNetSeries([]);
          setDashboardError("Could not load dashboard transactions for the selected filters.");
        }
      })
      .finally(() => {
        if (active) {
          setDashboardLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedMonth, dashboardAccountIds, dashboardLabelSlugs]);

  const filteredDashboardLabels = dashboardLabelSlugs.length > 0
    ? dashboardLabels.filter((label) => dashboardLabelSlugs.includes(label.label_slug))
    : dashboardLabels;
  const sortedDashboardTransactions = [...dashboardTransactions].sort((first, second) => {
    const firstValue = dashboardSortValue(first, dashboardSort.key);
    const secondValue = dashboardSortValue(second, dashboardSort.key);
    const directionMultiplier = dashboardSort.direction === "asc" ? 1 : -1;
    if (typeof firstValue === "number" && typeof secondValue === "number") {
      return (firstValue - secondValue) * directionMultiplier;
    }
    return String(firstValue).localeCompare(String(secondValue), undefined, { numeric: true, sensitivity: "base" }) * directionMultiplier;
  });
  const labelsByScope = labels.reduce<Array<{ scope: string; labels: TransactionLabel[] }>>((groups, label) => {
    const scope = label.account_name ?? "Global";
    const group = groups.find((currentGroup) => currentGroup.scope === scope);
    if (group) {
      group.labels.push(label);
    } else {
      groups.push({ scope, labels: [label] });
    }
    return groups;
  }, []);
  const dashboardChartData = filteredDashboardLabels
    .map((label) => ({
      name: label.label_name,
      value: Number(label.amount),
      amount: label.amount,
    }))
    .sort((first, second) => second.value - first.value || first.name.localeCompare(second.name));
  const dashboardTotal = dashboardChartData.reduce((total, item) => total + item.value, 0);
  const dashboardKpis = dashboardTransactions.reduce(
    (totals, transaction) => {
      const amount = Number(transaction.amount);
      if (transaction.direction === "credit") {
        return {
          ...totals,
          creditAmount: totals.creditAmount + amount,
          creditCount: totals.creditCount + 1,
        };
      }
      const debitBucket = transaction.label.is_controllable ? "controllable" : "nonControllable";
      return {
        ...totals,
        debitAmount: totals.debitAmount + amount,
        debitCount: totals.debitCount + 1,
        [debitBucket]: {
          amount: totals[debitBucket].amount + amount,
          count: totals[debitBucket].count + 1,
        },
      };
    },
    {
      creditAmount: 0,
      creditCount: 0,
      debitAmount: 0,
      debitCount: 0,
      controllable: { amount: 0, count: 0 },
      nonControllable: { amount: 0, count: 0 },
    },
  );
  const dashboardNetAmount = dashboardKpis.creditAmount - dashboardKpis.debitAmount;
  const dashboardNetTone = dashboardNetAmount > 0 ? "positive" : dashboardNetAmount < 0 ? "negative" : "neutral";
  const dashboardNetArrow = dashboardNetAmount > 0 ? "▲" : dashboardNetAmount < 0 ? "▼" : "•";
  const dashboardMaxAmount = Math.max(...dashboardChartData.map((item) => item.value), 1);
  const dashboardNetValues = dashboardNetSeries.map((point) => point.amount);
  const dashboardNetMin = Math.min(...dashboardNetValues, 0);
  const dashboardNetMax = Math.max(...dashboardNetValues, 0);
  const dashboardNetRange = Math.max(dashboardNetMax - dashboardNetMin, 1);
  const dashboardNetPolyline = dashboardNetSeries.map((point, index) => {
    const x = dashboardNetSeries.length === 1 ? 150 : (index / (dashboardNetSeries.length - 1)) * 300;
    const y = 130 - ((point.amount - dashboardNetMin) / dashboardNetRange) * 110;
    return `${x},${y}`;
  }).join(" ");
  const dashboardNetZeroY = 130 - ((0 - dashboardNetMin) / dashboardNetRange) * 110;
  const allDashboardAccountsSelected = dashboardAccountIds.length === 0 || dashboardAccountIds.length === accounts.length;
  const allDashboardLabelsSelected = dashboardLabelSlugs.length === 0 || dashboardLabelSlugs.length === labels.length;
  const dashboardAccountSummary =
    accounts.length === 0
      ? "No accounts"
      : allDashboardAccountsSelected
        ? "All accounts"
        : `${dashboardAccountIds.length} selected`;
  const dashboardLabelSummary =
    labels.length === 0
      ? "No labels"
      : allDashboardLabelsSelected
        ? "All labels"
        : `${dashboardLabelSlugs.length} selected`;
  const activeAccount = activeAccountId === "" ? null : accounts.find((account) => account.id === activeAccountId) ?? null;
  const hasPreview = Boolean(preview);
  const showMappingStep = hasPreview && mappingMode === "new";
  const selectedTemplate = selectedTemplateId === "new" ? null : templates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedDescriptionParts = descriptionParts.filter((part) => part.trim());
  const missingMappingFields = [
    mappingDraft.date ? null : "date",
    selectedDescriptionParts.length > 0 ? null : "description",
    amountMode === "single" && !mappingDraft.amount ? "amount" : null,
    amountMode === "split" && !mappingDraft.debit ? "debit" : null,
    amountMode === "split" && !mappingDraft.credit ? "credit" : null,
  ].filter((field): field is string => Boolean(field));
  const importValidationItems = [
    selectedFile ? null : "Choose a source CSV file.",
    activeAccountId === "" ? "Choose the account receiving this import." : null,
    missingMappingFields.length > 0 ? `Map required field(s): ${missingMappingFields.join(", ")}.` : null,
  ].filter((item): item is string => Boolean(item));
  const reviewMonth = importReviewMonth(preparedImport) ?? selectedMonth;

  function refreshDashboard() {
    setDashboardError(null);
    setDashboardLoading(true);
    const netMonths = surroundingMonths(selectedMonth);
    const comparisonNetMonths = netMonths.filter((month) => month !== selectedMonth);
    Promise.all([
      getDashboardSpendingByLabel(selectedMonth, dashboardAccountIds),
      getDashboardTransactions(selectedMonth, {
        accountIds: dashboardAccountIds,
        labelSlugs: dashboardLabelSlugs,
      }),
      Promise.all(comparisonNetMonths.map((month) => getDashboardTransactions(month, {
        accountIds: dashboardAccountIds,
        labelSlugs: dashboardLabelSlugs,
      }))),
    ])
      .then(([spendingDashboard, transactionDashboard, netDashboards]) => {
        setDashboardLabels(spendingDashboard.labels);
        setDashboardTransactions(transactionDashboard.transactions);
        const netByMonth = new Map(comparisonNetMonths.map((month, index) => [month, netTransactionAmount(netDashboards[index].transactions)]));
        netByMonth.set(selectedMonth, netTransactionAmount(transactionDashboard.transactions));
        setDashboardNetSeries(netMonths.map((month) => ({ month, amount: netByMonth.get(month) ?? 0 })));
      })
      .catch(() => {
        setDashboardLabels([]);
        setDashboardTransactions([]);
        setDashboardNetSeries([]);
        setDashboardError("Could not load dashboard transactions for the selected filters.");
      })
      .finally(() => {
        setDashboardLoading(false);
      });
  }

  function refreshImportUploads() {
    setImportUploadsLoading(true);
    setImportUploadsError(null);
    return listImportUploads()
      .then((uploads) => setImportUploads(uploads))
      .catch(() => {
        setImportUploads([]);
        setImportUploadsError("Could not load imported files.");
      })
      .finally(() => setImportUploadsLoading(false));
  }

  async function handleDeleteImportUpload(upload: ImportUploadSummary) {
    setImportUploadsError(null);
    setDeletingUploadId(upload.id);
    try {
      const result = await deleteImportUpload(upload.id);
      setConfirmingDeleteUploadId(null);
      setImportStatus(
        result.deleted_transaction_count > 0
          ? `Removed ${result.deleted_transaction_count} transaction(s) from ${upload.original_filename}.`
          : `Discarded ${upload.original_filename}.`,
      );
      await refreshImportUploads();
      refreshDashboard();
    } catch {
      setImportUploadsError("Could not remove transactions for that file upload.");
    } finally {
      setDeletingUploadId(null);
    }
  }

  function formatDisplayDate(value: string | null): string {
    if (!value) {
      return "Not imported";
    }
    return value;
  }

  function formatUploadDateRange(upload: ImportUploadSummary): string {
    if (!upload.min_transaction_date || !upload.max_transaction_date) {
      return "Not imported";
    }
    if (upload.min_transaction_date === upload.max_transaction_date) {
      return upload.min_transaction_date;
    }
    return `${upload.min_transaction_date} to ${upload.max_transaction_date}`;
  }

  function importStepIndex(step: ImportStep): number {
    return IMPORT_STEPS.findIndex((candidate) => candidate.id === step);
  }

  function canVisitImportStep(step: ImportStep): boolean {
    if (step === "account") {
      return true;
    }
    if (step === "source") {
      return activeAccountId !== "";
    }
    if (step === "mapping") {
      return Boolean(preview);
    }
    if (step === "review") {
      return Boolean(preparedImport);
    }
    return Boolean(preparedImport);
  }

  function goToImportStep(step: ImportStep) {
    if (canVisitImportStep(step)) {
      setImportStep(step);
    }
  }

  function previousImportStep(): ImportStep | null {
    const index = importStepIndex(importStep);
    return index > 0 ? IMPORT_STEPS[index - 1].id : null;
  }

  function nextImportStep(): ImportStep | null {
    const index = importStepIndex(importStep);
    return index >= 0 && index < IMPORT_STEPS.length - 1 ? IMPORT_STEPS[index + 1].id : null;
  }

  async function handleImportStepNext() {
    if (importStep === "mapping") {
      const prepared = await handlePrepareImport();
      if (prepared) {
        setImportStep("review");
      }
      return;
    }
    const nextStep = nextImportStep();
    if (nextStep) {
      goToImportStep(nextStep);
    }
  }

  function canGoToNextImportStep(): boolean {
    if (importStep === "account") {
      return activeAccountId !== "";
    }
    if (importStep === "source") {
      return Boolean(preview);
    }
    if (importStep === "mapping") {
      return importValidationItems.length === 0 && !importLoading;
    }
    if (importStep === "review") {
      return Boolean(preparedImport);
    }
    return false;
  }

  function formatTransactionAmount(transaction: DashboardTransactionRow): string {
    const amount = Number(transaction.amount);
    const sign = transaction.direction === "credit" ? "+" : "-";
    return `${sign}$${amount.toFixed(2)}`;
  }

  function formatCurrency(amount: number): string {
    return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toFixed(2)}`;
  }

  function toggleDashboardAccount(accountId: number, checked: boolean) {
    const selectedIds = allDashboardAccountsSelected ? accounts.map((account) => account.id) : dashboardAccountIds;
    const nextIds = checked ? [...selectedIds, accountId] : selectedIds.filter((id) => id !== accountId);
    const uniqueIds = Array.from(new Set(nextIds));
    setDashboardAccountIds(uniqueIds.length === accounts.length ? [] : uniqueIds);
  }

  function toggleDashboardLabel(labelSlug: string, checked: boolean) {
    const selectedSlugs = allDashboardLabelsSelected ? labels.map((label) => label.slug) : dashboardLabelSlugs;
    const nextSlugs = checked ? [...selectedSlugs, labelSlug] : selectedSlugs.filter((slug) => slug !== labelSlug);
    const uniqueSlugs = Array.from(new Set(nextSlugs));
    setDashboardLabelSlugs(uniqueSlugs.length === labels.length ? [] : uniqueSlugs);
  }

  function toggleDashboardSort(key: DashboardSortKey) {
    setDashboardSort((currentSort) => ({
      key,
      direction: currentSort.key === key && currentSort.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updateDescriptionPart(index: number, value: string) {
    setDescriptionParts((currentParts) => currentParts.map((part, currentIndex) => (currentIndex === index ? value : part)));
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
  }

  function moveDescriptionPart(index: number, direction: -1 | 1) {
    setDescriptionParts((currentParts) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= currentParts.length) {
        return currentParts;
      }
      const nextParts = [...currentParts];
      [nextParts[index], nextParts[nextIndex]] = [nextParts[nextIndex], nextParts[index]];
      return nextParts;
    });
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
  }

  function removeDescriptionPart(index: number) {
    setDescriptionParts((currentParts) => currentParts.length === 1 ? [""] : currentParts.filter((_part, currentIndex) => currentIndex !== index));
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
  }

  function resetPreparedImportState() {
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
  }

  function renderDashboardSortHeader(key: DashboardSortKey) {
    const isActive = dashboardSort.key === key;
    const sortLabel = DASHBOARD_SORT_LABELS[key];
    return (
      <th scope="col" aria-sort={isActive ? (dashboardSort.direction === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="sort-button" onClick={() => toggleDashboardSort(key)}>
          <span>{sortLabel}</span>
          {isActive ? <b aria-hidden="true">{dashboardSort.direction === "asc" ? "▲" : "▼"}</b> : null}
        </button>
      </th>
    );
  }

  function refreshAccounts() {
    setAccountsLoaded(false);
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
      .catch(() => setAccountError("Could not load accounts."))
      .finally(() => setAccountsLoaded(true));
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
    const splitMapping = [template.config.mappings.amount, template.config.mappings.direction].find(
      (mapping) => mapping?.debit_column || mapping?.credit_column,
    );
    nextMappings.debit = splitMapping?.debit_column ?? "";
    nextMappings.credit = splitMapping?.credit_column ?? "";
    const descriptionMapping = template.config.mappings.description;
    const nextDescriptionParts = descriptionMapping?.description_parts?.length
      ? descriptionMapping.description_parts
      : [descriptionMapping?.source_column ?? ""];

    setTemplateName(template.name);
    setMappingDraft(nextMappings);
    setTransformDraft(nextTransforms);
    setAmountMode(splitMapping ? "split" : "single");
    setDescriptionParts(nextDescriptionParts.length > 0 ? nextDescriptionParts : createDefaultDescriptionParts());
  }

  function startNewTemplate() {
    setSelectedTemplateId("new");
    setMappingMode("new");
    setTemplateName("");
    setMappingDraft(createEmptyMappings());
    setTransformDraft(createDefaultTransforms());
    setAmountMode("single");
    setDescriptionParts(createDefaultDescriptionParts());
    setTemplateStatus(null);
    setTemplateError(null);
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
  }

  async function handleTemplateChoice(template: ImportTemplate) {
    setSelectedTemplateId(template.id);
    setMappingMode("list");
    setTemplateStatus(null);
    setTemplateError(null);
    setPreparedImport(null);
    setImportResult(null);
    setImportStatus(null);
    applyTemplateToDraft(template);
    if (!selectedFile) {
      setImportError("Choose a source CSV file before updating the transform preview.");
      return;
    }
    if (activeAccountId === "") {
      setImportError("Choose the account receiving this import before updating the transform preview.");
      return;
    }
    setImportError(null);
    setImportLoading(true);
    try {
      const prepared = await prepareImport(selectedFile, activeAccountId, template.config);
      setPreparedImport(prepared);
      setImportStatus(`Transform preview updated for ${prepared.row_count} row(s). Review before confirming.`);
      setImportStep("review");
    } catch (error) {
      setImportError(apiErrorDetail(error) ?? "Could not update transform preview. Check account id, mappings, and transform settings.");
    } finally {
      setImportLoading(false);
    }
  }

  function buildTemplateConfig(): ImportTemplateConfig {
    const splitColumns = {
      debit_column: mappingDraft.debit,
      credit_column: mappingDraft.credit,
    };
    const descriptionColumns = descriptionParts.map((part) => part.trim()).filter(Boolean);
    const descriptionMapping = descriptionColumns.length > 1
      ? { transform: "compose_description" as TemplateTransform, description_parts: descriptionColumns }
      : { source_column: descriptionColumns[0] ?? "", transform: "copy_column" as TemplateTransform };

    return {
      mappings: {
        date: { source_column: mappingDraft.date, transform: transformDraft.date },
        description: descriptionMapping,
        amount:
          amountMode === "split"
            ? { transform: "split_amount" as TemplateTransform, ...splitColumns }
            : { source_column: mappingDraft.amount, transform: transformDraft.amount },
        direction:
          amountMode === "split"
            ? { transform: "split_amount_direction" as TemplateTransform, ...splitColumns }
            : {
                source_column: mappingDraft.amount,
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
    if (activeAccountId === "") {
      setTemplateError("Choose the account for this template before saving.");
      return;
    }

    const missingField = missingMappingFields[0];
    if (missingField) {
      setTemplateError(`Map the required ${missingField} field before saving.`);
      return;
    }

    setTemplateSaving(true);
    const saveRequestId = templateRequestId.current + 1;
    templateRequestId.current = saveRequestId;
    try {
      const selectedTemplate =
        selectedTemplateId === "new"
          ? null
          : templates.find((template) => template.id === selectedTemplateId) ?? null;
      const payload = { name: templateName, account_id: selectedTemplate?.account_id ?? activeAccountId, config: buildTemplateConfig() };
      const savedTemplate =
        selectedTemplateId === "new"
          ? await createImportTemplate(payload)
          : await updateImportTemplate(selectedTemplateId, payload);
      if (saveRequestId === templateRequestId.current) {
        setTemplates((currentTemplates) => {
          const withoutSaved = currentTemplates.filter((template) => template.id !== savedTemplate.id);
          return [...withoutSaved, savedTemplate].sort((first, second) => first.name.localeCompare(second.name));
        });
        setSelectedTemplateId(savedTemplate.id);
        setMappingMode("list");
        setTemplateStatus("Template saved for future imports.");
        const prepared = await handlePrepareImport();
        if (prepared) {
          setImportStep("review");
        }
      }
    } catch {
      setTemplateError("Could not save that template. Check required mappings and transform settings.");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function handlePrepareImport(): Promise<boolean> {
    setImportError(null);
    setImportStatus(null);
    setImportResult(null);
    if (!selectedFile) {
      setImportError("Choose a source CSV file before updating the transform preview.");
      return false;
    }
    if (activeAccountId === "") {
      setImportError("Choose the account receiving this import before updating the transform preview.");
      return false;
    }
    const missingField = missingMappingFields[0];
    if (missingField) {
      setImportError(`Map the required ${missingField} field before updating the transform preview.`);
      return false;
    }
    setImportLoading(true);
    try {
      const prepared = await prepareImport(selectedFile, activeAccountId, buildTemplateConfig());
      setPreparedImport(prepared);
      setImportStatus(`Transform preview updated for ${prepared.row_count} row(s). Review before confirming.`);
      return true;
    } catch (error) {
      setImportError(apiErrorDetail(error) ?? "Could not update transform preview. Check account id, mappings, and transform settings.");
      return false;
    } finally {
      setImportLoading(false);
    }
  }

  async function handlePreviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeAccountId === "") {
      setPreviewError("Choose the account before previewing a CSV.");
      return;
    }
    if (!selectedFile) {
      setPreviewError("Choose a source CSV file first.");
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

  async function handleLabelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLabelRuleStatus(null);
    setLabelRuleError(null);

    if (!newLabelName.trim()) {
      setLabelRuleError("Enter a label name.");
      return;
    }

    setLabelSaving(true);
    try {
      const savedLabel = await createLabel({
        name: newLabelName,
        account_id: newLabelAccountId === "" ? null : newLabelAccountId,
        is_controllable: newLabelIsControllable,
      });
      setLabels((currentLabels) => [...currentLabels, savedLabel].sort((first, second) => first.name.localeCompare(second.name)));
      setLabelRuleLabelId(savedLabel.id);
      setNewLabelName("");
      setLabelRuleStatus("Label saved. Add match rules when you are ready.");
    } catch {
      setLabelRuleError("Could not save that label. Check for duplicate names with the same scope and control type.");
    } finally {
      setLabelSaving(false);
    }
  }

  async function handleLabelRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLabelRuleStatus(null);
    setLabelRuleError(null);

    if (!labelRulePattern.trim()) {
      setLabelRuleError("Enter description text to match.");
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
        match_field: "description",
        match_type: labelRuleMatchType,
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

  function beginEditRule(rule: LabelRule) {
    setEditingRuleId(rule.id);
    setEditingRuleMatchType(rule.match_type);
    setEditingRulePattern(rule.pattern);
    setEditingRuleLabelId(rule.label_id);
    setLabelRuleStatus(null);
    setLabelRuleError(null);
  }

  async function handleUpdateLabelRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLabelRuleStatus(null);
    setLabelRuleError(null);

    if (editingRuleId === null) {
      return;
    }
    if (!editingRulePattern.trim()) {
      setLabelRuleError("Enter description text to match.");
      return;
    }
    if (editingRuleLabelId === "") {
      setLabelRuleError("Choose one of the fixed labels.");
      return;
    }

    setLabelRuleSaving(true);
    try {
      const savedRule = await updateLabelRule(editingRuleId, {
        label_id: editingRuleLabelId,
        match_field: "description",
        match_type: editingRuleMatchType,
        pattern: editingRulePattern,
      });
      setLabelRules((currentRules) => currentRules.map((rule) => (rule.id === savedRule.id ? savedRule : rule)));
      setEditingRuleId(null);
      setLabelRuleStatus(`Rule updated. Applied to ${savedRule.applied_count ?? 0} existing transactions.`);
      refreshDashboard();
    } catch {
      setLabelRuleError("Could not update that rule. Use a predefined label and valid match text.");
    } finally {
      setLabelRuleSaving(false);
    }
  }

  async function handleDeleteLabelRule(rule: LabelRule) {
    setLabelRuleStatus(null);
    setLabelRuleError(null);
    setDeletingRuleId(rule.id);
    try {
      await deleteLabelRule(rule.id);
      setLabelRules((currentRules) => currentRules.filter((currentRule) => currentRule.id !== rule.id));
      if (editingRuleId === rule.id) {
        setEditingRuleId(null);
      }
      setLabelRuleStatus("Rule deleted. Matching labels it applied were removed.");
      refreshDashboard();
    } catch {
      setLabelRuleError("Could not delete that rule.");
    } finally {
      setDeletingRuleId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="app-title">Personal Finance</p>
          <h1>Review monthly transactions</h1>
          <p className="intro">Start with the month, confirm what changed, then use guided modules for imports, labels, and accounts.</p>
        </div>
        <nav className="app-nav" aria-label="Primary app modules">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/import">Import</NavLink>
          <NavLink to="/labeling">Labeling</NavLink>
          <NavLink to="/accounts">Accounts</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={(
          <section className="dashboard-panel" aria-labelledby="dashboard-heading">
        <div className="dashboard-header">
          <div>
            <h2 id="dashboard-heading">Monthly transaction review</h2>
            <p className="dashboard-help">Filter first, then scan transactions. Spending totals stay secondary.</p>
          </div>
          <label className="month-picker">
            <span>Month</span>
            <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
          </label>
          <div className="account-filter">
            <span>Accounts</span>
            <details className="account-dropdown">
              <summary aria-label="Accounts">{dashboardAccountSummary}</summary>
              <div className="account-dropdown-menu" role="group" aria-label="Account options">
                <button type="button" onClick={() => setDashboardAccountIds([])}>
                  Select all accounts
                </button>
                {accounts.map((account) => (
                  <label key={account.id}>
                    <input
                      type="checkbox"
                      checked={allDashboardAccountsSelected || dashboardAccountIds.includes(account.id)}
                      onChange={(event) => toggleDashboardAccount(account.id, event.target.checked)}
                    />
                    <span>{account.name}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
          <div className="label-filter">
            <span>Labels</span>
            <details className="account-dropdown">
              <summary aria-label="Labels">{dashboardLabelSummary}</summary>
              <div className="account-dropdown-menu" role="group" aria-label="Label options">
                <button type="button" onClick={() => setDashboardLabelSlugs([])}>
                  Select all labels
                </button>
                {labels.map((label) => (
                  <label key={label.id}>
                    <input
                      type="checkbox"
                      checked={allDashboardLabelsSelected || dashboardLabelSlugs.includes(label.slug)}
                      onChange={(event) => toggleDashboardLabel(label.slug, event.target.checked)}
                    />
                    <span>{label.name}{label.account_name ? ` (${label.account_name})` : ""}</span>
                  </label>
                ))}
              </div>
            </details>
          </div>
        </div>
        {dashboardError ? <p className="preview-error">{dashboardError}</p> : null}
        {dashboardLoading ? (
          <div className="dashboard-empty" role="status">Loading dashboard transactions...</div>
        ) : dashboardTransactions.length === 0 ? (
          <div className="dashboard-empty">No transactions available for {selectedMonth} and selected filters.</div>
        ) : (
          <div className="dashboard-transactions">
            <div className="dashboard-kpis" aria-label="Credit and debit summary">
              <article>
                <span>Debit activity</span>
                <strong>{formatCurrency(dashboardKpis.debitAmount)}</strong>
                <em>{dashboardKpis.debitCount} debit row(s)</em>
                <div className="credit-split" aria-label="Debit activity split">
                  <div>
                    <span>Controllable</span>
                    <b>{formatCurrency(dashboardKpis.controllable.amount)}</b>
                    <em>{dashboardKpis.controllable.count} row(s)</em>
                  </div>
                  <div>
                    <span>Non-controllable</span>
                    <b>{formatCurrency(dashboardKpis.nonControllable.amount)}</b>
                    <em>{dashboardKpis.nonControllable.count} row(s)</em>
                  </div>
                </div>
              </article>
              <article>
                <span>Credit activity</span>
                <strong>{formatCurrency(dashboardKpis.creditAmount)}</strong>
                <em>{dashboardKpis.creditCount} credit row(s)</em>
              </article>
              <article>
                <span>Net activity</span>
                <strong className={`net-${dashboardNetTone}`}>
                  <b aria-hidden="true">{dashboardNetArrow}</b>
                  {formatCurrency(Math.abs(dashboardNetAmount))}
                </strong>
                <em>credits minus debits</em>
              </article>
            </div>
            <div className="dashboard-table-header">
              <h3>Transactions</h3>
              <span>{dashboardTransactions.length} row(s)</span>
            </div>
            <div className="table-wrap dashboard-table-wrap">
              <table className="transaction-table">
                <thead>
                  <tr>
                    {renderDashboardSortHeader("date")}
                    {renderDashboardSortHeader("account")}
                    {renderDashboardSortHeader("description")}
                    {renderDashboardSortHeader("label")}
                    {renderDashboardSortHeader("direction")}
                    {renderDashboardSortHeader("amount")}
                  </tr>
                </thead>
                <tbody>
                  {sortedDashboardTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{transaction.transaction_date}</td>
                      <td>{transaction.account.name}</td>
                      <td>
                        <strong>{transaction.merchant || transaction.description}</strong>
                        {transaction.merchant ? <span>{transaction.description}</span> : null}
                      </td>
                      <td>{transaction.label.name}</td>
                      <td className={`direction-${transaction.direction}`}>{transaction.direction}</td>
                      <td className="amount-cell">{formatTransactionAmount(transaction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {filteredDashboardLabels.length === 0 ? null : (
            <div className="dashboard-grid">
              <div className="chart-card" aria-label="Spending by label summary">
                <h3>Spending summary</h3>
                <div className="spending-bars">
                  {dashboardChartData.map((item, index) => (
                    <div key={item.name}>
                      <span>{item.name}</span>
                      <em>{formatCurrency(item.value)}</em>
                      <i
                        aria-hidden="true"
                        style={{
                        background: CHART_COLORS[index % CHART_COLORS.length],
                        inlineSize: `${Math.max((item.value / dashboardMaxAmount) * 100, 4)}%`,
                      }}
                    />
                  </div>
                  ))}
                </div>
              <strong>Total debit spending: {formatCurrency(dashboardTotal)}</strong>
            </div>
            <div className="net-activity-card" aria-label="Net activity trend">
              <div className="net-activity-header">
                <h3>Net activity</h3>
                <span>{formatMonthLabel(shiftMonth(selectedMonth, -3))} to {formatMonthLabel(shiftMonth(selectedMonth, 3))}</span>
              </div>
              <svg className="net-activity-chart" viewBox="0 0 300 150" role="img" aria-label="Net activity over seven months">
                <line x1="0" x2="300" y1={dashboardNetZeroY} y2={dashboardNetZeroY} />
                <polyline points={dashboardNetPolyline} />
                {dashboardNetSeries.map((point, index) => {
                  const x = dashboardNetSeries.length === 1 ? 150 : (index / (dashboardNetSeries.length - 1)) * 300;
                  const y = 130 - ((point.amount - dashboardNetMin) / dashboardNetRange) * 110;
                  const tooltipX = Math.min(Math.max(x - 43, 2), 212);
                  const tooltipY = Math.max(y - 33, 2);
                  return (
                    <g key={point.month} className="net-activity-point" tabIndex={0} aria-label={`${formatMonthLabel(point.month)}: ${formatCurrency(point.amount)}`}>
                      <circle className="net-activity-hit-area" cx={x} cy={y} r="12" />
                      <circle cx={x} cy={y} r={point.month === selectedMonth ? 4.5 : 3.5} />
                      <g className="net-activity-tooltip" aria-hidden="true">
                        <rect x={tooltipX} y={tooltipY} width="86" height="24" rx="4" />
                        <text x={tooltipX + 43} y={tooltipY + 16}>{formatCurrency(point.amount)}</text>
                      </g>
                    </g>
                  );
                })}
              </svg>
              <div className="net-activity-labels">
                {dashboardNetSeries.map((point) => (
                  <span key={point.month} aria-label={`${formatMonthLabel(point.month)} net ${formatCurrency(point.amount)}`}>
                    {point.month.slice(5)}
                  </span>
                ))}
              </div>
              <strong>{formatCurrency(dashboardNetMin)} to {formatCurrency(dashboardNetMax)}</strong>
            </div>
          </div>
        )}
      </section>
        )} />
        <Route path="/accounts" element={(
          <section className="account-panel" aria-labelledby="accounts-heading">
        <h2 id="accounts-heading">Manage import accounts</h2>
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
        )} />
        <Route path="/import" element={(
          <section className="upload-panel" aria-labelledby="upload-heading">
            <div className="import-landing-header">
              <div>
                <h2 id="upload-heading">Imported files</h2>
                <p>Review source uploads, then remove every transaction from a mistaken file in one step.</p>
              </div>
              <Link className="dashboard-review-link" to="/import/new" onClick={() => setImportStep("account")}>Upload transactions</Link>
            </div>
            {importUploadsError ? <p className="preview-error">{importUploadsError}</p> : null}
            {importStatus ? <p className="template-status">{importStatus}</p> : null}
            {importUploadsLoading ? (
              <div className="import-empty" role="status">Loading imported files...</div>
            ) : importUploads.length === 0 ? (
              <div className="import-empty" role="status">
                <h3>No imported files yet</h3>
                <p>Uploaded files will appear here with account, transaction count, and imported date range.</p>
                <Link className="dashboard-review-link" to="/import/new" onClick={() => setImportStep("account")}>Upload transactions</Link>
              </div>
            ) : (
              <div className="table-wrap import-upload-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">File</th>
                      <th scope="col">Account</th>
                      <th scope="col">Status</th>
                      <th scope="col">Transactions</th>
                      <th scope="col">Date range</th>
                      <th scope="col">Uploaded</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importUploads.map((upload) => (
                      <tr key={upload.id} className={upload.status === "removed" ? "upload-row-removed" : undefined}>
                        <td><strong>{upload.original_filename}</strong></td>
                        <td>{upload.account_name ?? "No account"}</td>
                        <td><span className="upload-status">{upload.status.replace("_", " ")}</span></td>
                        <td>{upload.imported_transaction_count}</td>
                        <td>{formatUploadDateRange(upload)}</td>
                        <td>{formatDisplayDate(upload.created_at.slice(0, 10))}</td>
                        <td>
                          {confirmingDeleteUploadId === upload.id ? (
                            <span className="inline-confirmation">
                              <button type="button" className="danger-action" disabled={deletingUploadId === upload.id} onClick={() => handleDeleteImportUpload(upload)}>
                                {deletingUploadId === upload.id ? "Removing..." : upload.imported_transaction_count > 0 ? "Confirm remove" : "Confirm discard"}
                              </button>
                              <button type="button" className="secondary-action" onClick={() => setConfirmingDeleteUploadId(null)}>Cancel</button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="danger-action"
                              disabled={upload.status === "removed"}
                              onClick={() => setConfirmingDeleteUploadId(upload.id)}
                            >
                              {upload.imported_transaction_count > 0 ? "Remove transactions" : "Discard upload"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )} />
        <Route path="/import/new" element={(
          <section className="upload-panel" aria-labelledby="upload-flow-heading">
        <div className="import-landing-header">
          <div>
            <h2 id="upload-flow-heading">Import transactions in guided order</h2>
            <p>Move forward one focused step at a time. Use Back to review prior choices.</p>
          </div>
          <Link className="secondary-action" to="/import">Back to imported files</Link>
        </div>
        <ol className="workflow-steps" aria-label="Import workflow order">
          {IMPORT_STEPS.map((step, index) => {
            const currentIndex = importStepIndex(importStep);
            const state = index === currentIndex ? "current" : index < currentIndex ? "complete" : canVisitImportStep(step.id) ? "ready" : "blocked";
            return (
              <li key={step.id} data-step-state={state} aria-current={state === "current" ? "step" : undefined}>
                <strong>{index + 1}. {step.label}</strong><span>{step.help}</span>
              </li>
            );
          })}
        </ol>
        {!accountsLoaded ? (
          <div className="import-empty" role="status">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="import-empty" role="status">
            <h3>Create an account before importing</h3>
            <p>Imports and templates are tied to an account. Add one account, then return here to upload a CSV.</p>
            <Link className="dashboard-review-link" to="/accounts">Go to accounts</Link>
          </div>
        ) : (
          <div className="import-flow-step">
            {importStep === "account" ? (
              <div className="import-account-step">
                <label>
                  <span>Import account</span>
                  <select
                    aria-label="Import account"
                    value={activeAccountId}
                    onChange={(event) => {
                      setActiveAccountId(event.target.value ? Number(event.target.value) : "");
                        setSelectedFile(null);
                        setPreview(null);
                        setPreviewError(null);
                        setMappingMode("list");
                        setPreparedImport(null);
                      setImportResult(null);
                      setImportStatus(null);
                    }}
                  >
                    <option value="">Choose account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                  <small>Templates shown later are tied to this account.</small>
                </label>
              </div>
            ) : null}
            {importStep === "source" ? (
              <div className="preview-results">
                <form className="upload-form progressive-step" onSubmit={handlePreviewSubmit}>
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
                        setMappingMode("list");
                        setTemplateStatus(null);
                        setPreparedImport(null);
                        setImportResult(null);
                        setImportStatus(null);
                      }}
                    />
                  </label>
                  <button type="submit" disabled={previewLoading}>{previewLoading ? "Uploading..." : "Upload"}</button>
                </form>
                {previewError ? <p className="preview-error">{previewError}</p> : null}
                {preview ? (
                  <section className="csv-preview" aria-labelledby="csv-preview-heading">
                    <div className="section-header-row"><div><h3 id="csv-preview-heading">CSV preview</h3><p>Uploaded rows appear here before mappings or imports run.</p></div><span>{preview.rows.length} preview row(s)</span></div>
                    <div className="table-wrap"><table><thead><tr>{preview.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.headers.map((header) => <td key={header}>{row[header] ?? ""}</td>)}</tr>)}</tbody></table></div>
                  </section>
                ) : null}
              </div>
            ) : null}
            {importStep === "mapping" && preview ? (
              <form className="template-editor" onSubmit={handleTemplateSubmit}>
              <div className="template-editor-header">
                <div>
                  <h3>Import Template</h3>
                  <p>Select a saved template, or add a new one when this CSV layout is unfamiliar.</p>
                </div>
                <button type="button" className="secondary-action" onClick={startNewTemplate}>+ New template</button>
              </div>
              {!showMappingStep ? <div className="template-choice-list" aria-label="Import templates">
                {templates.length > 0 ? templates.map((template) => {
                  const isSelected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={importLoading}
                      onClick={() => void handleTemplateChoice(template)}
                    >
                      <strong>{template.name}</strong>
                      <span>{isSelected ? "Selected" : "Use this template"}</span>
                    </button>
                  );
                }) : (
                  <p>No templates saved for {activeAccount?.name ?? "this account"} yet.</p>
                )}
              </div> : null}
              {!showMappingStep && selectedTemplate ? (
                <div className="selected-template-summary">
                  <strong>{selectedTemplate.name}</strong>
                  <span>Template ready. Use next to review normalized rows before import.</span>
                </div>
              ) : null}
              {showMappingStep ? (
              <div className="mapping-section">
                <section className="csv-preview" aria-labelledby="mapping-csv-preview-heading">
                  <div className="section-header-row"><div><h3 id="mapping-csv-preview-heading">CSV preview</h3><p>Use these uploaded headers and sample rows while choosing source columns.</p></div><span>{preview.rows.length} preview row(s)</span></div>
                  <div className="table-wrap"><table><thead><tr>{preview.headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={index}>{preview.headers.map((header) => <td key={header}>{row[header] ?? ""}</td>)}</tr>)}</tbody></table></div>
                </section>
                <label className="template-name">
                  <span>Template name</span>
                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="Checking account export"
                  />
                </label>
                <div className="mapping-grid">
                  <div className="mapping-row mapping-row-compact">
                    <strong>Date</strong>
                    <label>
                      <span>Source column</span>
                      <select
                        aria-label="Date source column"
                        value={mappingDraft.date}
                        onChange={(event) => {
                          setMappingDraft((current) => ({ ...current, date: event.target.value }));
                          resetPreparedImportState();
                        }}
                      >
                        <option value="">Choose date column</option>
                        {preview.source_columns.map((column) => (
                          <option key={column} value={column}>{column}</option>
                        ))}
                      </select>
                    </label>
                    <span className="template-note">Parsed as transaction date.</span>
                  </div>

                  <div className="mapping-card">
                    <div>
                      <strong>Description</strong>
                      <p>Choose one or more columns. Import joins non-empty values with one space.</p>
                    </div>
                    <div className="description-parts">
                      {descriptionParts.map((part, index) => (
                        <div className="description-part" key={index}>
                          <span>{index + 1}</span>
                          <label>
                            <span>Description source column {index + 1}</span>
                            <select
                              aria-label={`Description source column ${index + 1}`}
                              value={part}
                              onChange={(event) => updateDescriptionPart(index, event.target.value)}
                            >
                              <option value="">Choose column</option>
                              {preview.source_columns.map((column) => (
                                <option key={column} value={column}>{column}</option>
                              ))}
                            </select>
                          </label>
                          <div className="description-part-actions" aria-label={`Reorder description source column ${index + 1}`}>
                            <button type="button" disabled={index === 0} onClick={() => moveDescriptionPart(index, -1)}>Move up</button>
                            <button type="button" disabled={index === descriptionParts.length - 1} onClick={() => moveDescriptionPart(index, 1)}>Move down</button>
                            <button type="button" onClick={() => removeDescriptionPart(index)}>Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setDescriptionParts((currentParts) => [...currentParts, ""]);
                        resetPreparedImportState();
                      }}
                    >
                      Add description field
                    </button>
                  </div>

                  <div className="mapping-card">
                    <div>
                      <strong>Amount layout</strong>
                      <p>Pick the statement format. Split mode derives both amount and debit/credit direction.</p>
                    </div>
                    <div className="amount-mode-group" role="radiogroup" aria-label="Amount layout">
                      <label>
                        <input
                          type="radio"
                          name="amount-mode"
                          checked={amountMode === "single"}
                          onChange={() => {
                            setAmountMode("single");
                            resetPreparedImportState();
                          }}
                        />
                        <span>Single amount column</span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="amount-mode"
                          checked={amountMode === "split"}
                          onChange={() => {
                            setAmountMode("split");
                            resetPreparedImportState();
                          }}
                        />
                        <span>Separate debit and credit columns</span>
                      </label>
                    </div>
                    {amountMode === "single" ? (
                      <label className="mapping-inline-control">
                        <span>Amount source column</span>
                        <select
                          aria-label="Amount source column"
                          value={mappingDraft.amount}
                          onChange={(event) => {
                            setMappingDraft((current) => ({ ...current, amount: event.target.value, direction: event.target.value }));
                            resetPreparedImportState();
                          }}
                        >
                          <option value="">Choose amount column</option>
                          {preview.source_columns.map((column) => (
                            <option key={column} value={column}>{column}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="split-column-grid">
                        {OPTIONAL_SPLIT_FIELDS.map((field) => (
                          <label key={field}>
                            <span>{field === "debit" ? "Debit amount column" : "Credit amount column"}</span>
                            <select
                              aria-label={field === "debit" ? "Debit amount column" : "Credit amount column"}
                              value={mappingDraft[field]}
                              onChange={(event) => {
                                setMappingDraft((current) => ({ ...current, [field]: event.target.value }));
                                resetPreparedImportState();
                              }}
                            >
                              <option value="">Choose {field} column</option>
                              {preview.source_columns.map((column) => (
                                <option key={column} value={column}>{column}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              ) : null}
              {templateError ? <p className="preview-error">{templateError}</p> : null}
              {templateStatus ? <p className="template-status">{templateStatus}</p> : null}
              <div className="import-actions">
                {showMappingStep ? (
                  <button type="submit" disabled={templateSaving}>
                    {templateSaving ? "Saving..." : "Save Template"}
                  </button>
                ) : null}
              </div>
              {importError ? <p className="preview-error">{importError}</p> : null}
            </form>
            ) : null}
            {importStep === "review" && preparedImport ? (
            <div className="import-confirmation" aria-label="Transformed import review">
              <div>
                <h3>Transformed Preview</h3>
                <p>Normalized rows for {activeAccount?.name ?? "the selected account"}. Review dates, amounts, and directions before confirming.</p>
              </div>
              {importValidationItems.length > 0 ? (
                <div className="import-validation" aria-label="Import requirements">
                  <strong>Before preparing</strong>
                  <ul>
                    {importValidationItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importStatus ? <p className="template-status">{importStatus}</p> : null}
              {preparedImport.duplicate_candidates.length ? (
                <p className="preview-error">{preparedImport.duplicate_candidates.length} duplicate candidate(s) found before import.</p>
              ) : null}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(preparedImport.transformed_preview[0] ?? {}).map((header) => (
                        <th key={header} scope="col">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preparedImport.transformed_preview.map((row, index) => (
                      <tr key={index}>{Object.keys(preparedImport.transformed_preview[0] ?? {}).map((header) => <td key={header}>{row[header] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            ) : null}
            {importStep === "confirm" && preparedImport ? (
            <div className="import-confirmation" aria-label="Import confirmation">
              <div>
                <h3>Confirm import</h3>
                <p>Import {preparedImport.row_count} row(s) from {selectedFile?.name ?? "the selected CSV"} into {activeAccount?.name ?? "the selected account"}.</p>
              </div>
              <div className="import-actions">
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
                      refreshImportUploads();
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
              {importResult && importStatus ? <p className="template-status">{importStatus}</p> : null}
              {importResult && importResult.inserted_count > 0 ? (
                <Link
                  className="dashboard-review-link"
                  to="/"
                  onClick={() => {
                    setSelectedMonth(reviewMonth);
                    setDashboardAccountIds(activeAccountId === "" ? [] : [activeAccountId]);
                    setDashboardLabelSlugs([]);
                  }}
                >
                  Review {formatMonthLabel(reviewMonth)} imports on dashboard
                </Link>
              ) : null}
              {preparedImport?.duplicate_candidates.length ? (
                <p className="preview-error">{preparedImport.duplicate_candidates.length} duplicate candidate(s) found before import.</p>
              ) : null}
              {importResult?.duplicate_candidates.length ? (
                <p className="preview-error">{importResult.duplicate_candidates.length} duplicate candidate(s) blocked insert.</p>
              ) : null}
            </div>
            ) : null}
            <div className="import-step-nav" aria-label="Import step navigation">
              {previousImportStep() ? (
                <button
                  type="button"
                  className="step-arrow step-arrow-back"
                  aria-label="Back"
                  onClick={() => goToImportStep(previousImportStep() ?? "account")}
                >
                  ←
                </button>
              ) : <span />}
              {nextImportStep() ? (
                <button
                  type="button"
                  className="step-arrow step-arrow-next"
                  aria-label={importStep === "mapping" ? "Next: review" : `Next: ${nextImportStep()}`}
                  disabled={!canGoToNextImportStep()}
                  onClick={handleImportStepNext}
                >
                  {importStep === "mapping" && importLoading ? "..." : "→"}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </section>
        )} />
        <Route path="/labeling" element={(
          <section className="label-panel" aria-labelledby="label-heading">
        <h2 id="label-heading">Transaction labels and rules</h2>
        <p className="label-intro">
          Create global or account-specific labels, then match transactions with plain text or regex. Preview is debounced and limited to keep large tables responsive.
        </p>
        <section className="label-section" aria-labelledby="create-label-heading">
        <div className="label-section-header">
          <h3 id="create-label-heading">Create label</h3>
          <p>Global labels apply everywhere. Account labels keep overloaded categories separate.</p>
        </div>
        <form className="label-rule-form label-create-form" onSubmit={handleLabelSubmit}>
          <label>
            <span>Label name</span>
            <input value={newLabelName} onChange={(event) => setNewLabelName(event.target.value)} placeholder="Loan Payment" />
          </label>
          <label>
            <span>Label scope</span>
            <select value={newLabelAccountId} onChange={(event) => setNewLabelAccountId(event.target.value ? Number(event.target.value) : "")}>
              <option value="">Global</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Control type</span>
            <select value={newLabelIsControllable ? "controllable" : "non-controllable"} onChange={(event) => setNewLabelIsControllable(event.target.value === "controllable")}>
              <option value="controllable">Controllable</option>
              <option value="non-controllable">Non-controllable</option>
            </select>
          </label>
          <button type="submit" disabled={labelSaving}>{labelSaving ? "Saving..." : "Save Label"}</button>
        </form>
        <div className="label-pill-summary" aria-label="Current labels">
          <div className="label-legend" aria-label="Label controllability legend">
            <span><i className="legend-dot controllable" />Controllable</span>
            <span><i className="legend-dot non-controllable" />Non-controllable</span>
          </div>
          {labelsByScope.map((group) => (
            <div className="label-scope-group" key={group.scope}>
              <strong>{group.scope}</strong>
              <div className="label-pill-list">
                {group.labels.map((label) => (
                  <span className={`label-pill ${label.is_controllable ? "controllable" : "non-controllable"}`} key={label.id}>
                    {label.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        </section>
        <section className="label-section" aria-labelledby="create-rule-heading">
        <div className="label-section-header">
          <h3 id="create-rule-heading">Create match rule</h3>
          <p>Rules always match transaction descriptions. Scope comes from the selected label.</p>
        </div>
        <form className="label-rule-form label-match-form" onSubmit={handleLabelRuleSubmit}>
          <label>
            <span>Match type</span>
            <select value={labelRuleMatchType} onChange={(event) => setLabelRuleMatchType(event.target.value as "contains" | "regex")}>
              <option value="contains">Contains</option>
              <option value="regex">Regex</option>
            </select>
          </label>
          <label>
            <span>Match pattern</span>
            <input
              value={labelRulePattern}
              onChange={(event) => setLabelRulePattern(event.target.value)}
              placeholder={labelRuleMatchType === "regex" ? "^SAFEWAY(?! GAS)" : "Target, Payroll, Netflix"}
            />
          </label>
          <label>
            <span>Label</span>
            <select
              value={labelRuleLabelId}
              onChange={(event) => setLabelRuleLabelId(event.target.value ? Number(event.target.value) : "")}
            >
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}{label.account_name ? ` (${label.account_name})` : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={labelRuleSaving || labels.length === 0}>
            {labelRuleSaving ? "Saving..." : "Save Label Rule"}
          </button>
        </form>
        </section>
        <div className="match-preview" aria-live="polite">
          <div>
            <strong>Pattern preview</strong>
            <span>{labelMatchPreviewLoading ? "Checking matches..." : labelMatchPreview ? `${labelMatchPreview.total_count} match(es), showing ${labelMatchPreview.returned_count}` : "Type at least 2 characters to preview matches."}</span>
          </div>
          {labelMatchPreviewError ? <p className="preview-error">{labelMatchPreviewError}</p> : null}
          {labelMatchPreview?.rows.length ? (
            <div className="match-preview-table">
              <table>
                <thead>
                  <tr><th>Date</th><th>Account</th><th>Description</th><th>Current label</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {labelMatchPreview.rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.transaction_date}</td>
                      <td>{row.account_name}</td>
                      <td>{row.description}</td>
                      <td>{row.label_name ?? "Uncategorized"}</td>
                      <td>{row.direction === "credit" ? "+" : "-"}${row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
        {labelRuleError ? <p className="preview-error">{labelRuleError}</p> : null}
        {labelRuleStatus ? <p className="template-status">{labelRuleStatus}</p> : null}
        <div className="rule-list" aria-label="Existing label rules">
          {labelRules.length === 0 ? <p>No label rules yet.</p> : null}
          {labelRules.map((rule) => (
            <article key={rule.id}>
              {editingRuleId === rule.id ? (
                <form className="rule-edit-form" onSubmit={handleUpdateLabelRule}>
                  <label>
                    <span>Match type</span>
                    <select value={editingRuleMatchType} onChange={(event) => setEditingRuleMatchType(event.target.value as "contains" | "regex")}>
                      <option value="contains">Contains</option>
                      <option value="regex">Regex</option>
                    </select>
                  </label>
                  <label>
                    <span>Match pattern</span>
                    <input value={editingRulePattern} onChange={(event) => setEditingRulePattern(event.target.value)} />
                  </label>
                  <label>
                    <span>Label</span>
                    <select value={editingRuleLabelId} onChange={(event) => setEditingRuleLabelId(event.target.value ? Number(event.target.value) : "")}>
                      {labels.map((label) => (
                        <option key={label.id} value={label.id}>
                          {label.name}{label.account_name ? ` (${label.account_name})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" disabled={labelRuleSaving}>Save</button>
                  <button type="button" className="secondary-action" onClick={() => setEditingRuleId(null)}>Cancel</button>
                </form>
              ) : (
                <>
                  <strong>{rule.label_name}</strong>
                  <span>{rule.account_name ?? "Global rule"} - description {rule.match_type === "regex" ? "matches regex" : "contains"} "{rule.pattern}"</span>
                  <span>{rule.label_is_controllable ? "Controllable" : "Non-controllable"}</span>
                  <span className="rule-actions">
                    <button type="button" onClick={() => beginEditRule(rule)}>Edit</button>
                    <button
                      type="button"
                      className="danger-action"
                      disabled={deletingRuleId === rule.id}
                      onClick={() => handleDeleteLabelRule(rule)}
                    >
                      {deletingRuleId === rule.id ? "Deleting..." : "Delete"}
                    </button>
                  </span>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
        )} />
        <Route path="*" element={<Link to="/">Back to dashboard</Link>} />
      </Routes>
    </main>
  );
}

export default function App() {
  return <Home />;
}
