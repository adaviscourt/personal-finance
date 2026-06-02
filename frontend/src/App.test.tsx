import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { createImportTemplate, getHealth, listImportTemplates, previewCsv, updateImportTemplate } from "./api/client";

vi.mock("./api/client", () => ({
  createImportTemplate: vi.fn(),
  getHealth: vi.fn(),
  listImportTemplates: vi.fn(),
  previewCsv: vi.fn(),
  updateImportTemplate: vi.fn(),
}));

const mockedCreateImportTemplate = vi.mocked(createImportTemplate);
const mockedGetHealth = vi.mocked(getHealth);
const mockedListImportTemplates = vi.mocked(listImportTemplates);
const mockedPreviewCsv = vi.mocked(previewCsv);
const mockedUpdateImportTemplate = vi.mocked(updateImportTemplate);

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedGetHealth.mockResolvedValue({ status: "ok", database: "ok" });
    mockedListImportTemplates.mockResolvedValue([]);
    mockedPreviewCsv.mockReset();
    mockedCreateImportTemplate.mockReset();
    mockedUpdateImportTemplate.mockReset();
  });

  it("renders the frontend health content", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Frontend Health")).toBeInTheDocument();
    expect(screen.getByText("Personal Finance MVP")).toBeInTheDocument();
  });

  it("uploads a CSV and renders source columns with raw preview rows", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("Statement CSV") as HTMLInputElement;
    const file = new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv", {
      type: "text/csv",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));

    expect(await screen.findByText("Source Columns")).toBeInTheDocument();
    expect(screen.getAllByText("Date").length).toBeGreaterThan(0);
    expect(screen.getByText("Coffee")).toBeInTheDocument();
    expect(mockedPreviewCsv).toHaveBeenCalledWith(file);
  });

  it("saves a new import template from source column mappings", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedCreateImportTemplate.mockResolvedValue({
      id: 10,
      name: "Checking export",
      account_id: null,
      created_at: "2026-01-01T00:00:00+00:00",
      updated_at: "2026-01-01T00:00:00+00:00",
      config: {
        mappings: {
          date: { source_column: "Date", transform: "parse_date" },
          description: { source_column: "Description", transform: "copy_column" },
          amount: { source_column: "Amount", transform: "absolute_numeric" },
          direction: {
            source_column: "Amount",
            transform: "signed_amount_direction",
            positive_direction: "credit",
            negative_direction: "debit",
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    const file = new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("Statement CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Checking export" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(await screen.findByText("Template saved for future imports.")).toBeInTheDocument();
    expect(mockedCreateImportTemplate).toHaveBeenCalledWith({
      name: "Checking export",
      account_id: null,
      config: {
        mappings: expect.objectContaining({
          date: { source_column: "Date", transform: "parse_date" },
          description: { source_column: "Description", transform: "copy_column" },
          amount: { source_column: "Amount", transform: "absolute_numeric" },
        }),
      },
    });
  });
});
