import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000",
});

export type HealthResponse = {
  status: string;
  database: string;
};

export type CsvPreviewResponse = {
  headers: string[];
  rows: Record<string, string | null>[];
  source_columns: string[];
};

export type TemplateTransform =
  | "copy_column"
  | "parse_date"
  | "parse_numeric"
  | "absolute_numeric"
  | "split_amount"
  | "signed_amount_direction"
  | "split_amount_direction"
  | "value_lookup";

export type TemplateFieldMapping = {
  source_column?: string | null;
  transform: TemplateTransform;
  rules?: Record<string, "debit" | "credit"> | null;
  positive_direction?: "debit" | "credit" | null;
  negative_direction?: "debit" | "credit" | null;
  debit_column?: string | null;
  credit_column?: string | null;
};

export type ImportTemplateConfig = {
  mappings: Record<string, TemplateFieldMapping>;
};

export type ImportTemplate = {
  id: number;
  name: string;
  account_id: number;
  config: ImportTemplateConfig;
  created_at: string;
  updated_at: string;
};

export type ImportTemplatePayload = {
  name: string;
  account_id: number;
  config: ImportTemplateConfig;
};

export type Account = {
  id: number;
  name: string;
  institution: string | null;
  account_type: string | null;
  created_at: string;
  transaction_count: number;
};

export type AccountDeleteWarning = {
  id: number;
  transaction_count: number;
  requires_confirmation: boolean;
};

export type UniqueValuesResponse = {
  source_column: string;
  values: string[];
};

export type TransformedPreviewResponse = {
  rows: Record<string, string | null>[];
};

export type DuplicateCandidate = {
  row_number: number;
  existing_transaction_id: number;
  date: string;
  description: string;
  amount: string;
  direction: "debit" | "credit";
};

export type ImportPrepareResponse = {
  upload_file_id: number;
  row_count: number;
  transformed_preview: Record<string, string | null>[];
  duplicate_candidates: DuplicateCandidate[];
};

export type ConfirmImportResponse = {
  upload_file_id: number;
  inserted_count: number;
  duplicate_candidates: DuplicateCandidate[];
};

export type TransactionLabel = {
  id: number;
  slug: string;
  name: string;
  account_id: number | null;
  account_name?: string | null;
  is_controllable: boolean;
};

export type TransactionLabelPayload = {
  name: string;
  account_id?: number | null;
  is_controllable: boolean;
};

export type LabelRule = {
  id: number;
  label_id: number;
  label_slug: string;
  label_name: string;
  label_account_id: number | null;
  label_is_controllable: boolean;
  account_id: number | null;
  account_name?: string | null;
  match_field: "merchant" | "description";
  match_type: "contains" | "regex";
  pattern: string;
  created_at: string;
  applied_count?: number | null;
};

export type LabelRulePayload = {
  label_id: number;
  match_field?: "description";
  match_type: "contains" | "regex";
  pattern: string;
};

export type LabelRuleMatchPreviewRow = {
  id: number;
  transaction_date: string;
  account_name: string;
  description: string;
  merchant: string | null;
  label_name: string | null;
  amount: string;
  direction: "debit" | "credit";
};

export type LabelRuleMatchPreview = {
  total_count: number;
  returned_count: number;
  rows: LabelRuleMatchPreviewRow[];
};

export type DashboardSpendingLabel = {
  label_slug: string;
  label_name: string;
  amount: string;
};

export type DashboardSpendingByLabel = {
  month: string;
  labels: DashboardSpendingLabel[];
};

export type DashboardTransactionAccount = {
  id: number;
  name: string;
};

export type DashboardTransactionLabel = {
  id: number | null;
  slug: string;
  name: string;
  is_controllable: boolean;
};

export type DashboardTransactionRow = {
  id: number;
  transaction_date: string;
  account: DashboardTransactionAccount;
  description: string;
  merchant: string | null;
  label: DashboardTransactionLabel;
  direction: "debit" | "credit";
  amount: string;
  source_type: string | null;
  source_category: string | null;
  check_number: string | null;
};

export type DashboardTransactionList = {
  month: string;
  transactions: DashboardTransactionRow[];
};

export type DashboardTransactionFilters = {
  accountIds?: number[];
  labelIds?: number[];
  labelSlugs?: string[];
};

export async function getHealth(): Promise<HealthResponse> {
  const response = await api.get<HealthResponse>("/health");
  return response.data;
}

export async function previewCsv(file: File): Promise<CsvPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post<CsvPreviewResponse>("/imports/preview", formData);
  return response.data;
}

export async function listUniqueValues(file: File, sourceColumn: string): Promise<UniqueValuesResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("source_column", sourceColumn);

  const response = await api.post<UniqueValuesResponse>("/imports/unique-values", formData);
  return response.data;
}

export async function previewTransformedCsv(
  file: File,
  templateConfig: ImportTemplateConfig,
): Promise<TransformedPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("template_config", JSON.stringify(templateConfig));

  const response = await api.post<TransformedPreviewResponse>("/imports/transformed-preview", formData);
  return response.data;
}

export async function prepareImport(
  file: File,
  accountId: number,
  templateConfig: ImportTemplateConfig,
): Promise<ImportPrepareResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("account_id", String(accountId));
  formData.append("template_config", JSON.stringify(templateConfig));

  const response = await api.post<ImportPrepareResponse>("/imports/prepare", formData);
  return response.data;
}

export async function confirmImport(
  uploadFileId: number,
  templateConfig: ImportTemplateConfig,
  allowDuplicates = false,
): Promise<ConfirmImportResponse> {
  const response = await api.post<ConfirmImportResponse>("/imports/confirm", {
    upload_file_id: uploadFileId,
    template_config: templateConfig,
    allow_duplicates: allowDuplicates,
  });
  return response.data;
}

export async function listAccounts(): Promise<Account[]> {
  const response = await api.get<Account[]>("/accounts");
  return response.data;
}

export async function createAccount(name: string): Promise<Account> {
  const response = await api.post<Account>("/accounts", { name });
  return response.data;
}

export async function renameAccount(accountId: number, name: string): Promise<Account> {
  const response = await api.put<Account>(`/accounts/${accountId}`, { name });
  return response.data;
}

export async function deleteAccount(accountId: number, confirmed = false): Promise<AccountDeleteWarning | null> {
  const response = await api.delete<AccountDeleteWarning | undefined>(`/accounts/${accountId}`, {
    params: { confirmed },
    validateStatus: (status) => (status >= 200 && status < 300) || status === 409,
  });
  return response.data ?? null;
}

export async function listImportTemplates(accountId?: number): Promise<ImportTemplate[]> {
  const response = await api.get<ImportTemplate[]>("/import-templates", { params: accountId ? { account_id: accountId } : undefined });
  return response.data;
}

export async function createImportTemplate(payload: ImportTemplatePayload): Promise<ImportTemplate> {
  const response = await api.post<ImportTemplate>("/import-templates", payload);
  return response.data;
}

export async function updateImportTemplate(
  templateId: number,
  payload: ImportTemplatePayload,
): Promise<ImportTemplate> {
  const response = await api.put<ImportTemplate>(`/import-templates/${templateId}`, payload);
  return response.data;
}

export async function listLabels(): Promise<TransactionLabel[]> {
  const response = await api.get<TransactionLabel[]>("/labels");
  return response.data;
}

export async function createLabel(payload: TransactionLabelPayload): Promise<TransactionLabel> {
  const response = await api.post<TransactionLabel>("/labels", payload);
  return response.data;
}

export async function listLabelRules(): Promise<LabelRule[]> {
  const response = await api.get<LabelRule[]>("/transaction-label-rules");
  return response.data;
}

export async function createLabelRule(payload: LabelRulePayload): Promise<LabelRule> {
  const response = await api.post<LabelRule>("/transaction-label-rules", payload);
  return response.data;
}

export async function previewLabelRuleMatches(payload: LabelRulePayload, limit = 25): Promise<LabelRuleMatchPreview> {
  const response = await api.get<LabelRuleMatchPreview>("/transaction-label-rules/matches", {
    params: {
      match_field: payload.match_field,
      match_type: payload.match_type,
      pattern: payload.pattern,
      label_id: payload.label_id || undefined,
      limit,
    },
  });
  return response.data;
}

export async function getDashboardSpendingByLabel(month: string, accountIds: number[] = []): Promise<DashboardSpendingByLabel> {
  const response = await api.get<DashboardSpendingByLabel>("/dashboard/spending-by-label", {
    params: { month, account_ids: accountIds },
    paramsSerializer: { indexes: null },
  });
  return response.data;
}

export async function getDashboardTransactions(
  month: string,
  filters: DashboardTransactionFilters = {},
): Promise<DashboardTransactionList> {
  const response = await api.get<DashboardTransactionList>("/dashboard/transactions", {
    params: {
      month,
      account_ids: filters.accountIds ?? [],
      label_ids: filters.labelIds ?? [],
      label_slugs: filters.labelSlugs ?? [],
    },
    paramsSerializer: { indexes: null },
  });
  return response.data;
}
