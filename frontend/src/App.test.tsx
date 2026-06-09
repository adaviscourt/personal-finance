import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  confirmImport,
  createAccount,
  createLabelRule,
  createImportTemplate,
  deleteAccount,
  getDashboardSpendingByLabel,
  getDashboardTransactions,
  listAccounts,
  listLabelRules,
  listLabels,
  listImportTemplates,
  previewCsv,
  prepareImport,
  renameAccount,
  updateImportTemplate,
} from "./api/client";

vi.mock("./api/client", () => ({
  confirmImport: vi.fn(),
  createAccount: vi.fn(),
  createLabelRule: vi.fn(),
  createImportTemplate: vi.fn(),
  deleteAccount: vi.fn(),
  getDashboardSpendingByLabel: vi.fn(),
  getDashboardTransactions: vi.fn(),
  listAccounts: vi.fn(),
  listLabelRules: vi.fn(),
  listLabels: vi.fn(),
  listImportTemplates: vi.fn(),
  previewCsv: vi.fn(),
  prepareImport: vi.fn(),
  renameAccount: vi.fn(),
  updateImportTemplate: vi.fn(),
}));

const mockedConfirmImport = vi.mocked(confirmImport);
const mockedCreateAccount = vi.mocked(createAccount);
const mockedCreateLabelRule = vi.mocked(createLabelRule);
const mockedCreateImportTemplate = vi.mocked(createImportTemplate);
const mockedDeleteAccount = vi.mocked(deleteAccount);
const mockedGetDashboardSpendingByLabel = vi.mocked(getDashboardSpendingByLabel);
const mockedGetDashboardTransactions = vi.mocked(getDashboardTransactions);
const mockedListAccounts = vi.mocked(listAccounts);
const mockedListLabelRules = vi.mocked(listLabelRules);
const mockedListLabels = vi.mocked(listLabels);
const mockedListImportTemplates = vi.mocked(listImportTemplates);
const mockedPreviewCsv = vi.mocked(previewCsv);
const mockedPrepareImport = vi.mocked(prepareImport);
const mockedRenameAccount = vi.mocked(renameAccount);
const mockedUpdateImportTemplate = vi.mocked(updateImportTemplate);

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedListLabels.mockResolvedValue([
      { id: 1, slug: "uncategorized", name: "Uncategorized" },
      { id: 2, slug: "dining", name: "Dining" },
    ]);
    mockedListLabelRules.mockResolvedValue([]);
    mockedListAccounts.mockResolvedValue([
      {
        id: 1,
        name: "Default Account",
        institution: "Manual import",
        account_type: "checking",
        created_at: "2026-01-01T00:00:00+00:00",
        transaction_count: 0,
      },
      {
        id: 42,
        name: "Travel Card",
        institution: null,
        account_type: null,
        created_at: "2026-01-01T00:00:00+00:00",
        transaction_count: 2,
      },
    ]);
    mockedListImportTemplates.mockResolvedValue([]);
    mockedPreviewCsv.mockReset();
    mockedCreateLabelRule.mockReset();
    mockedCreateAccount.mockReset();
    mockedDeleteAccount.mockReset();
    mockedCreateImportTemplate.mockReset();
    mockedConfirmImport.mockReset();
    mockedUpdateImportTemplate.mockReset();
    mockedPrepareImport.mockReset();
    mockedRenameAccount.mockReset();
    mockedGetDashboardSpendingByLabel.mockReset();
    mockedGetDashboardTransactions.mockReset();
    mockedGetDashboardSpendingByLabel.mockResolvedValue({ month: "2026-01", labels: [] });
    mockedGetDashboardTransactions.mockResolvedValue({ month: "2026-01", transactions: [] });
  });

  it("renders primary module navigation and a dashboard-only home route", async () => {
    renderApp();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Labeling" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.queryByText("Frontend Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Backend Health")).not.toBeInTheDocument();
    expect(screen.getByText("Personal Finance MVP")).toBeInTheDocument();
    expect(await screen.findByText("Monthly transaction review.")).toBeInTheDocument();
    expect(screen.queryByText("Preview source rows before mapping.")).not.toBeInTheDocument();
    expect(screen.queryByText("Save reusable match rules.")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage import accounts.")).not.toBeInTheDocument();
  });

  it("marks non-dashboard modules as current", () => {
    renderApp("/import");

    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Preview source rows before mapping.")).toBeInTheDocument();
  });

  it("uploads a CSV and renders source columns with raw preview rows", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });

    renderApp("/import");

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

  it("loads dashboard transactions and keeps spending summary secondary", async () => {
    mockedGetDashboardSpendingByLabel.mockResolvedValue({
      month: "2026-01",
      labels: [
        { label_slug: "groceries", label_name: "Groceries", amount: "25.25" },
        { label_slug: "dining", label_name: "Dining", amount: "8.00" },
      ],
    });
    mockedGetDashboardTransactions.mockResolvedValue({
      month: "2026-01",
      transactions: [
        {
          id: 10,
          transaction_date: "2026-01-03",
          account: { id: 42, name: "Travel Card" },
          description: "Local Market weekly groceries",
          merchant: "Local Market",
          label: { id: 3, slug: "groceries", name: "Groceries" },
          direction: "debit",
          amount: "25.25",
          source_type: null,
          source_category: null,
          check_number: null,
        },
      ],
    });

    renderApp();

    expect(await screen.findByText("Monthly transaction review.")).toBeInTheDocument();
    expect(await screen.findByText("Local Market")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Label" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Direction" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
    expect((await screen.findAllByText("Groceries")).length).toBeGreaterThan(0);
    expect(screen.getByText("$25.25")).toBeInTheDocument();
    expect(screen.getByText("Total debit spending: $33.25")).toBeInTheDocument();
    expect(mockedGetDashboardSpendingByLabel).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), []);
    expect(mockedGetDashboardTransactions).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), {
      accountIds: [],
      labelSlugs: [],
    });
  });

  it("updates dashboard data when month changes and shows empty transaction state", async () => {
    mockedGetDashboardSpendingByLabel
      .mockResolvedValueOnce({ month: "2026-01", labels: [{ label_slug: "dining", label_name: "Dining", amount: "8.00" }] })
      .mockResolvedValueOnce({ month: "2026-01", labels: [{ label_slug: "dining", label_name: "Dining", amount: "8.00" }] })
      .mockResolvedValueOnce({ month: "2026-02", labels: [] });
    mockedGetDashboardTransactions
      .mockResolvedValueOnce({ month: "2026-01", transactions: [{
        id: 8,
        transaction_date: "2026-01-04",
        account: { id: 1, name: "Default Account" },
        description: "Cafe",
        merchant: null,
        label: { id: 2, slug: "dining", name: "Dining" },
        direction: "debit",
        amount: "8.00",
        source_type: null,
        source_category: null,
        check_number: null,
      }] })
      .mockResolvedValueOnce({ month: "2026-01", transactions: [{
        id: 8,
        transaction_date: "2026-01-04",
        account: { id: 1, name: "Default Account" },
        description: "Cafe",
        merchant: null,
        label: { id: 2, slug: "dining", name: "Dining" },
        direction: "debit",
        amount: "8.00",
        source_type: null,
        source_category: null,
        check_number: null,
      }] })
      .mockResolvedValueOnce({ month: "2026-02", transactions: [] });

    renderApp();

    expect(await screen.findByText("Cafe")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Dashboard month"), { target: { value: "2026-02" } });

    expect(await screen.findByText("No transactions available for 2026-02 and selected filters.")).toBeInTheDocument();
    expect(mockedGetDashboardSpendingByLabel).toHaveBeenLastCalledWith("2026-02", []);
    expect(mockedGetDashboardTransactions).toHaveBeenLastCalledWith("2026-02", { accountIds: [], labelSlugs: [] });
  });

  it("filters dashboard transactions by selected accounts and label", async () => {
    renderApp();

    expect((await screen.findAllByText("Travel Card")).length).toBeGreaterThan(0);
    const accountFilter = screen.getByRole("listbox", { name: "Dashboard accounts" }) as HTMLSelectElement;
    accountFilter.options[1].selected = true;
    fireEvent.change(accountFilter);
    fireEvent.change(screen.getByLabelText("Dashboard label"), { target: { value: "dining" } });

    expect(mockedGetDashboardSpendingByLabel).toHaveBeenLastCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), [42]);
    expect(mockedGetDashboardTransactions).toHaveBeenLastCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), {
      accountIds: [42],
      labelSlugs: ["dining"],
    });
  });

  it("shows contextual dashboard loading and API error states", async () => {
    mockedGetDashboardTransactions.mockRejectedValue(new Error("offline"));

    renderApp();

    expect(screen.getByRole("status")).toHaveTextContent("Loading dashboard transactions...");
    expect(await screen.findByText("Could not load dashboard transactions for the selected filters.")).toBeInTheDocument();
  });

  it("creates and deletes accounts with transaction confirmation", async () => {
    mockedCreateAccount.mockResolvedValue({
      id: 99,
      name: "Savings",
      institution: null,
      account_type: null,
      created_at: "2026-01-01T00:00:00+00:00",
      transaction_count: 0,
    });
    mockedDeleteAccount.mockResolvedValueOnce({ id: 42, transaction_count: 2, requires_confirmation: true }).mockResolvedValueOnce(null);

    renderApp("/accounts");

    expect(await screen.findByText("Manage import accounts.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New account name"), { target: { value: "Savings" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByText("Created Savings.")).toBeInTheDocument();
    expect(mockedCreateAccount).toHaveBeenCalledWith("Savings");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[1]);

    expect(await screen.findByText("Travel Card has 2 transaction(s). Confirm deletion to remove account and linked import data.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Delete" }));

    expect(mockedDeleteAccount).toHaveBeenLastCalledWith(42, true);
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

    renderApp("/import");

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
      account_id: 1,
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

    renderApp("/import");

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

    renderApp("/labeling");

    expect(await screen.findByText("Transaction Labeling")).toBeInTheDocument();
    expect(screen.getByText('description contains "Cafe"')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /custom label/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Match field"), { target: { value: "merchant" } });
    fireEvent.change(screen.getByLabelText("Match text"), { target: { value: "Bistro" } });
    fireEvent.change(screen.getByLabelText("Fixed label"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Label Rule" }));

    expect(await screen.findByText("Rule saved. Applied to 2 existing transactions.")).toBeInTheDocument();
    expect(mockedCreateLabelRule).toHaveBeenCalledWith({ label_id: 2, match_field: "merchant", pattern: "Bistro" });
    expect(mockedGetDashboardSpendingByLabel).toHaveBeenCalledTimes(3);
    expect(mockedGetDashboardTransactions).toHaveBeenCalledTimes(3);
  });

  it("prepares and confirms an import from mapped preview rows", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedPrepareImport.mockResolvedValue({
      upload_file_id: 22,
      row_count: 1,
      transformed_preview: [{ date: "2026-01-01", description: "Coffee", amount: "4.50", direction: "debit" }],
      duplicate_candidates: [],
    });
    mockedConfirmImport.mockResolvedValue({ upload_file_id: 22, inserted_count: 1, duplicate_candidates: [] });

    renderApp("/import");

    const file = new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("Statement CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Active account"), { target: { value: "42" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Prepare Import" }));

    expect(await screen.findByText("Prepared 1 row(s). Review transformed preview before confirming.")).toBeInTheDocument();
    expect(screen.getByText("debit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText("Imported 1 transaction(s).")).toBeInTheDocument();
    expect(mockedPrepareImport).toHaveBeenCalledWith(file, 42, expect.any(Object));
    expect(mockedConfirmImport).toHaveBeenCalledWith(22, expect.any(Object));
  });
});
