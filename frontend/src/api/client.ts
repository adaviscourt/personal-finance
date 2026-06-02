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
