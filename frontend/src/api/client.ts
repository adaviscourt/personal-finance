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
