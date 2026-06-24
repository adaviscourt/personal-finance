import type {
  Account,
  AccountDeleteWarning,
  AppConfig,
  ConfirmImportResponse,
  CsvPreviewResponse,
  DashboardSpendingByLabel,
  DashboardTransactionFilters,
  DashboardTransactionList,
  DashboardTransactionRow,
  HealthResponse,
  ImportPrepareResponse,
  ImportTemplate,
  ImportTemplatePayload,
  ImportUploadDeleteResponse,
  ImportUploadSummary,
  LabelRule,
  LabelRuleMatchPreview,
  LabelRulePayload,
  TransactionLabel,
  TransactionLabelPayload,
  TransformedPreviewResponse,
  UniqueValuesResponse,
} from "./client";

const DEMO_DEFAULT_MONTH = import.meta.env.VITE_DEMO_DEFAULT_MONTH ?? "2026-06";
const CREATED_AT = "2026-06-20T00:00:00Z";

const accounts: Account[] = [
  { id: 1, name: "Demo Checking", institution: "Demo Credit Union", account_type: "checking", created_at: CREATED_AT, transaction_count: 24 },
  { id: 2, name: "Demo Savings", institution: "Demo Credit Union", account_type: "savings", created_at: CREATED_AT, transaction_count: 3 },
  { id: 3, name: "Demo Rewards Card", institution: "Demo Card Bank", account_type: "credit card", created_at: CREATED_AT, transaction_count: 27 },
];

let labels: TransactionLabel[] = [
  { id: 1, slug: "uncategorized", name: "Uncategorized", account_id: null, is_controllable: true },
  { id: 2, slug: "housing", name: "Housing", account_id: null, is_controllable: false },
  { id: 3, slug: "auto", name: "Auto", account_id: null, is_controllable: true },
  { id: 4, slug: "groceries", name: "Groceries", account_id: null, is_controllable: true },
  { id: 5, slug: "paychecks", name: "Paychecks", account_id: null, is_controllable: false },
  { id: 6, slug: "life", name: "Life", account_id: null, is_controllable: true },
  { id: 7, slug: "utilities", name: "Utilities", account_id: null, is_controllable: true },
  { id: 8, slug: "dining", name: "Dining", account_id: null, is_controllable: true },
  { id: 9, slug: "subscriptions", name: "Subscriptions", account_id: null, is_controllable: true },
  { id: 10, slug: "transfers", name: "Transfers", account_id: null, is_controllable: false },
  { id: 11, slug: "demo-rent", name: "Rent", account_id: null, is_controllable: false },
  { id: 12, slug: "demo-insurance", name: "Insurance", account_id: null, is_controllable: false },
  { id: 13, slug: "demo-travel", name: "Travel", account_id: null, is_controllable: true },
  { id: 14, slug: "demo-fitness", name: "Fitness", account_id: null, is_controllable: true },
  { id: 15, slug: "demo-hobbies", name: "Hobbies", account_id: null, is_controllable: true },
  { id: 16, slug: "demo-savings", name: "Savings", account_id: 2, account_name: "Demo Savings", is_controllable: false },
];

let labelRules: LabelRule[] = [
  {
    id: 1,
    label_id: 4,
    label_slug: "groceries",
    label_name: "Groceries",
    label_account_id: null,
    label_is_controllable: true,
    account_id: 3,
    account_name: "Demo Rewards Card",
    match_field: "description",
    match_type: "contains",
    pattern: "Grocery",
    created_at: CREATED_AT,
    applied_count: 3,
  },
];

const upload: ImportUploadSummary = {
  id: 1,
  original_filename: "demo-seeded-checking.csv",
  account_id: 1,
  account_name: "Demo Checking",
  status: "imported",
  row_count: 81,
  imported_transaction_count: 54,
  min_transaction_date: "2026-04-01",
  max_transaction_date: "2026-06-27",
  created_at: CREATED_AT,
};

function label(slug: string): DashboardTransactionRow["label"] {
  const nextLabel = labels.find((candidate) => candidate.slug === slug) ?? labels[0];
  return { id: nextLabel.id, slug: nextLabel.slug, name: nextLabel.name, is_controllable: nextLabel.is_controllable };
}

function account(id: number): DashboardTransactionRow["account"] {
  const nextAccount = accounts.find((candidate) => candidate.id === id) ?? accounts[0];
  return { id: nextAccount.id, name: nextAccount.name };
}

const transactionTemplates = [
  [1, "01", "Demo Payroll Deposit", "Acme Software Payroll", "4166.67", "credit", "paychecks", "Income"],
  [1, "15", "Demo Payroll Deposit", "Acme Software Payroll", "4166.67", "credit", "paychecks", "Income"],
  [1, "02", "Demo Apartment Rent", "Cedar Street Apartments", "1825.00", "debit", "demo-rent", "Housing"],
  [1, "03", "Demo Electric Utility", "Metro Electric", "96.40", "debit", "utilities", "Utilities"],
  [1, "04", "Demo Fiber Internet", "City Fiber", "65.00", "debit", "utilities", "Utilities"],
  [1, "05", "Demo Transit Pass", "Metro Transit", "88.00", "debit", "auto", "Transportation"],
  [1, "06", "Demo Renters Insurance", "Harbor Mutual", "18.75", "debit", "demo-insurance", "Insurance"],
  [1, "07", "Demo Transfer To Savings", "Demo Credit Union", "700.00", "debit", "demo-savings", "Savings"],
  [2, "07", "Demo Savings Transfer", "Demo Credit Union", "700.00", "credit", "demo-savings", "Savings"],
  [3, "08", "Demo Grocery Run", "Green Basket Market", "142.18", "debit", "groceries", "Groceries"],
  [3, "10", "Demo Phone Bill", "Signal Mobile", "52.00", "debit", "utilities", "Utilities"],
  [3, "12", "Demo Streaming Bundle", "StreamBox", "23.99", "debit", "subscriptions", "Subscriptions"],
  [3, "13", "Demo Gym Membership", "Peak Fitness", "58.00", "debit", "demo-fitness", "Fitness"],
  [3, "14", "Demo Dinner With Friends", "Northside Tacos", "46.25", "debit", "dining", "Dining"],
  [3, "18", "Demo Movie Night", "Riverside Cinema", "31.50", "debit", "life", "Entertainment"],
  [3, "21", "Demo Weekend Trail Gear", "Trailhead Supply", "84.20", "debit", "demo-hobbies", "Hobbies"],
  [3, "24", "Demo Travel Fund Flight", "Sample Airlines", "260.00", "debit", "demo-travel", "Travel"],
  [3, "27", "Demo Corner Shop", "Corner Shop", "19.44", "debit", "uncategorized", "Uncategorized"],
] as const;

const transactions: DashboardTransactionRow[] = ["2026-04", "2026-05", "2026-06"].flatMap((month, monthIndex) =>
  transactionTemplates.map(([accountId, day, description, merchant, amount, direction, labelSlug, sourceCategory], index) => ({
    id: monthIndex * transactionTemplates.length + index + 1,
    transaction_date: `${month}-${day}`,
    account: account(accountId),
    description,
    merchant,
    label: label(labelSlug),
    direction,
    amount,
    source_type: "Demo seed",
    source_category: sourceCategory,
    check_number: null,
  })),
);

let templates: ImportTemplate[] = [];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function demoUploadBlocked(): Error {
  return new Error("Public demo mode does not accept personal CSV uploads. Use seeded synthetic data instead.");
}

export const demoBackend = {
  getHealth(): Promise<HealthResponse> {
    return Promise.resolve({ status: "ok", database: "demo" });
  },
  getAppConfig(): Promise<AppConfig> {
    return Promise.resolve({ demo_mode: true, demo_default_month: DEMO_DEFAULT_MONTH });
  },
  previewCsv(): Promise<CsvPreviewResponse> {
    return Promise.reject(demoUploadBlocked());
  },
  listUniqueValues(): Promise<UniqueValuesResponse> {
    return Promise.reject(demoUploadBlocked());
  },
  previewTransformedCsv(): Promise<TransformedPreviewResponse> {
    return Promise.reject(demoUploadBlocked());
  },
  prepareImport(): Promise<ImportPrepareResponse> {
    return Promise.reject(demoUploadBlocked());
  },
  confirmImport(): Promise<ConfirmImportResponse> {
    return Promise.reject(demoUploadBlocked());
  },
  listImportUploads(): Promise<ImportUploadSummary[]> {
    return Promise.resolve([clone(upload)]);
  },
  deleteImportUpload(uploadFileId: number): Promise<ImportUploadDeleteResponse> {
    return Promise.resolve({ upload_file_id: uploadFileId, deleted_transaction_count: 0, status: "demo_locked" });
  },
  listAccounts(): Promise<Account[]> {
    return Promise.resolve(clone(accounts));
  },
  createAccount(name: string): Promise<Account> {
    const nextAccount: Account = { id: Math.max(...accounts.map((item) => item.id)) + 1, name, institution: null, account_type: null, created_at: new Date().toISOString(), transaction_count: 0 };
    accounts.push(nextAccount);
    return Promise.resolve(clone(nextAccount));
  },
  renameAccount(accountId: number, name: string): Promise<Account> {
    const nextAccount = accounts.find((item) => item.id === accountId);
    if (nextAccount) {
      nextAccount.name = name;
    }
    return Promise.resolve(clone(nextAccount ?? accounts[0]));
  },
  deleteAccount(accountId: number): Promise<AccountDeleteWarning | null> {
    return Promise.resolve({ id: accountId, transaction_count: 0, requires_confirmation: false });
  },
  listImportTemplates(accountId?: number): Promise<ImportTemplate[]> {
    return Promise.resolve(clone(accountId ? templates.filter((template) => template.account_id === accountId) : templates));
  },
  createImportTemplate(payload: ImportTemplatePayload): Promise<ImportTemplate> {
    const template: ImportTemplate = { id: templates.length + 1, ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    templates.push(template);
    return Promise.resolve(clone(template));
  },
  updateImportTemplate(templateId: number, payload: ImportTemplatePayload): Promise<ImportTemplate> {
    const template = { id: templateId, ...payload, created_at: CREATED_AT, updated_at: new Date().toISOString() };
    templates = templates.map((candidate) => (candidate.id === templateId ? template : candidate));
    return Promise.resolve(clone(template));
  },
  listLabels(): Promise<TransactionLabel[]> {
    return Promise.resolve(clone(labels));
  },
  createLabel(payload: TransactionLabelPayload): Promise<TransactionLabel> {
    const nextLabel: TransactionLabel = { id: Math.max(...labels.map((item) => item.id)) + 1, slug: `demo-${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`, name: payload.name, account_id: payload.account_id ?? null, is_controllable: payload.is_controllable };
    labels = [...labels, nextLabel];
    return Promise.resolve(clone(nextLabel));
  },
  listLabelRules(): Promise<LabelRule[]> {
    return Promise.resolve(clone(labelRules));
  },
  createLabelRule(payload: LabelRulePayload): Promise<LabelRule> {
    const nextLabel = labels.find((candidate) => candidate.id === payload.label_id) ?? labels[0];
    const rule: LabelRule = { id: Math.max(...labelRules.map((item) => item.id)) + 1, label_id: nextLabel.id, label_slug: nextLabel.slug, label_name: nextLabel.name, label_account_id: nextLabel.account_id, label_is_controllable: nextLabel.is_controllable, account_id: null, match_field: "description", match_type: payload.match_type, pattern: payload.pattern, created_at: new Date().toISOString(), applied_count: 0 };
    labelRules = [...labelRules, rule];
    return Promise.resolve(clone(rule));
  },
  updateLabelRule(ruleId: number, payload: LabelRulePayload): Promise<LabelRule> {
    const nextLabel = labels.find((candidate) => candidate.id === payload.label_id) ?? labels[0];
    const rule: LabelRule = { id: ruleId, label_id: nextLabel.id, label_slug: nextLabel.slug, label_name: nextLabel.name, label_account_id: nextLabel.account_id, label_is_controllable: nextLabel.is_controllable, account_id: null, match_field: "description", match_type: payload.match_type, pattern: payload.pattern, created_at: CREATED_AT, applied_count: 0 };
    labelRules = labelRules.map((candidate) => (candidate.id === ruleId ? rule : candidate));
    return Promise.resolve(clone(rule));
  },
  deleteLabelRule(ruleId: number): Promise<void> {
    labelRules = labelRules.filter((rule) => rule.id !== ruleId);
    return Promise.resolve();
  },
  previewLabelRuleMatches(payload: LabelRulePayload, limit = 25): Promise<LabelRuleMatchPreview> {
    const pattern = payload.pattern.toLowerCase();
    const rows = transactions
      .filter((transaction) => transaction.description.toLowerCase().includes(pattern))
      .slice(0, limit)
      .map((transaction) => ({
        id: transaction.id,
        transaction_date: transaction.transaction_date,
        account_name: transaction.account.name,
        description: transaction.description,
        merchant: transaction.merchant,
        label_name: transaction.label.name,
        amount: transaction.amount,
        direction: transaction.direction,
      }));
    return Promise.resolve({ total_count: rows.length, returned_count: rows.length, rows });
  },
  getDashboardSpendingByLabel(month: string, accountIds: number[] = []): Promise<DashboardSpendingByLabel> {
    const totals = new Map<string, { label_name: string; amount: number }>();
    for (const transaction of transactions) {
      if (transaction.transaction_date.slice(0, 7) !== month || transaction.direction !== "debit") {
        continue;
      }
      if (accountIds.length > 0 && !accountIds.includes(transaction.account.id)) {
        continue;
      }
      const current = totals.get(transaction.label.slug) ?? { label_name: transaction.label.name, amount: 0 };
      current.amount += Number(transaction.amount);
      totals.set(transaction.label.slug, current);
    }
    const nextLabels = [...totals.entries()].map(([label_slug, value]) => ({ label_slug, label_name: value.label_name, amount: value.amount.toFixed(2) })).sort((left, right) => left.label_name.localeCompare(right.label_name));
    return Promise.resolve({ month, labels: nextLabels });
  },
  getDashboardTransactions(month: string, filters: DashboardTransactionFilters = {}): Promise<DashboardTransactionList> {
    const rows = transactions.filter((transaction) => {
      if (transaction.transaction_date.slice(0, 7) !== month) {
        return false;
      }
      if (filters.accountIds?.length && !filters.accountIds.includes(transaction.account.id)) {
        return false;
      }
      if (filters.labelIds?.length && !filters.labelIds.includes(transaction.label.id ?? 0)) {
        return false;
      }
      if (filters.labelSlugs?.length && !filters.labelSlugs.includes(transaction.label.slug)) {
        return false;
      }
      return true;
    });
    return Promise.resolve({ month, transactions: clone(rows) });
  },
};
