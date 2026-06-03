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
  account_id: number | null;
  config: ImportTemplateConfig;
  created_at: string;
  updated_at: string;
};

export type ImportTemplatePayload = {
  name: string;
  account_id: number | null;
  config: ImportTemplateConfig;
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
};

export type LabelRule = {
  id: number;
  label_id: number;
  label_slug: string;
  label_name: string;
  match_field: "merchant" | "description";
  pattern: string;
  created_at: string;
  applied_count?: number | null;
};

export type LabelRulePayload = {
  label_id: number;
  match_field: "merchant" | "description";
  pattern: string;
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

export async function listImportTemplates(): Promise<ImportTemplate[]> {
  const response = await api.get<ImportTemplate[]>("/import-templates");
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

export async function listLabelRules(): Promise<LabelRule[]> {
  const response = await api.get<LabelRule[]>("/transaction-label-rules");
  return response.data;
}

export async function createLabelRule(payload: LabelRulePayload): Promise<LabelRule> {
  const response = await api.post<LabelRule>("/transaction-label-rules", payload);
  return response.data;
}
