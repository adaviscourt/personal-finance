import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  createLabelRule,
  createImportTemplate,
  getHealth,
  listLabelRules,
  listLabels,
  listImportTemplates,
  previewCsv,
  updateImportTemplate,
} from "./api/client";

vi.mock("./api/client", () => ({
  createLabelRule: vi.fn(),
  createImportTemplate: vi.fn(),
  getHealth: vi.fn(),
  listLabelRules: vi.fn(),
  listLabels: vi.fn(),
  listImportTemplates: vi.fn(),
  previewCsv: vi.fn(),
  updateImportTemplate: vi.fn(),
}));

const mockedCreateLabelRule = vi.mocked(createLabelRule);
const mockedCreateImportTemplate = vi.mocked(createImportTemplate);
const mockedGetHealth = vi.mocked(getHealth);
const mockedListLabelRules = vi.mocked(listLabelRules);
const mockedListLabels = vi.mocked(listLabels);
const mockedListImportTemplates = vi.mocked(listImportTemplates);
const mockedPreviewCsv = vi.mocked(previewCsv);
const mockedUpdateImportTemplate = vi.mocked(updateImportTemplate);

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedGetHealth.mockResolvedValue({ status: "ok", database: "ok" });
    mockedListLabels.mockResolvedValue([
      { id: 1, slug: "uncategorized", name: "Uncategorized" },
      { id: 2, slug: "dining", name: "Dining" },
    ]);
    mockedListLabelRules.mockResolvedValue([]);
    mockedListImportTemplates.mockResolvedValue([]);
    mockedPreviewCsv.mockReset();
    mockedCreateLabelRule.mockReset();
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

  it("preserves account association when updating a selected template", async () => {
    mockedListImportTemplates.mockResolvedValue([
      {
        id: 7,
        name: "Account export",
        account_id: 42,
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: "2026-01-01T00:00:00+00:00",
        config: {
          mappings: {
            date: { source_column: "Date", transform: "parse_date" },
            description: { source_column: "Description", transform: "copy_column" },
            amount: { source_column: "Amount", transform: "absolute_numeric" },
            direction: { source_column: "Amount", transform: "signed_amount_direction" },
          },
        },
      },
    ]);
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedUpdateImportTemplate.mockResolvedValue({
      id: 7,
      name: "Account export",
      account_id: 42,
      created_at: "2026-01-01T00:00:00+00:00",
      updated_at: "2026-01-02T00:00:00+00:00",
      config: {
        mappings: {
          date: { source_column: "Date", transform: "parse_date" },
          description: { source_column: "Description", transform: "copy_column" },
          amount: { source_column: "Amount", transform: "absolute_numeric" },
          direction: { source_column: "Amount", transform: "signed_amount_direction" },
        },
      },
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Update Template" }));

    expect(await screen.findByText("Template saved for future imports.")).toBeInTheDocument();
    expect(mockedUpdateImportTemplate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ account_id: 42 }),
    );
  });

  it("creates label rules with fixed labels and no custom label action", async () => {
    mockedListLabelRules.mockResolvedValue([
      {
        id: 3,
        label_id: 2,
        label_slug: "dining",
        label_name: "Dining",
        match_field: "description",
        pattern: "Cafe",
        created_at: "2026-01-01T00:00:00+00:00",
      },
    ]);
    mockedCreateLabelRule.mockResolvedValue({
      id: 4,
      label_id: 2,
      label_slug: "dining",
      label_name: "Dining",
      match_field: "merchant",
      pattern: "Bistro",
      created_at: "2026-01-02T00:00:00+00:00",
      applied_count: 2,
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Transaction Labeling")).toBeInTheDocument();
    expect(screen.getByText('description contains "Cafe"')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /custom label/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Match field"), { target: { value: "merchant" } });
    fireEvent.change(screen.getByLabelText("Match text"), { target: { value: "Bistro" } });
    fireEvent.change(screen.getByLabelText("Fixed label"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Label Rule" }));

    expect(await screen.findByText("Rule saved. Applied to 2 existing transactions.")).toBeInTheDocument();
    expect(mockedCreateLabelRule).toHaveBeenCalledWith({ label_id: 2, match_field: "merchant", pattern: "Bistro" });
  });
});
