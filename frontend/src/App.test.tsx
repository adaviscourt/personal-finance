import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  confirmImport,
  createAccount,
  createLabel,
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
  previewLabelRuleMatches,
  prepareImport,
  renameAccount,
  updateImportTemplate,
} from "./api/client";

vi.mock("./api/client", () => ({
  confirmImport: vi.fn(),
  createAccount: vi.fn(),
  createLabel: vi.fn(),
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
  previewLabelRuleMatches: vi.fn(),
  prepareImport: vi.fn(),
  renameAccount: vi.fn(),
  updateImportTemplate: vi.fn(),
}));

const mockedConfirmImport = vi.mocked(confirmImport);
const mockedCreateAccount = vi.mocked(createAccount);
const mockedCreateLabel = vi.mocked(createLabel);
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
const mockedPreviewLabelRuleMatches = vi.mocked(previewLabelRuleMatches);
const mockedPrepareImport = vi.mocked(prepareImport);
const mockedRenameAccount = vi.mocked(renameAccount);
const mockedUpdateImportTemplate = vi.mocked(updateImportTemplate);

const testStorage = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: (key: string) => testStorage.get(key) ?? null,
    setItem: (key: string, value: string) => testStorage.set(key, value),
    removeItem: (key: string) => testStorage.delete(key),
  },
});

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
    testStorage.clear();
    mockedListLabels.mockResolvedValue([
      { id: 1, slug: "uncategorized", name: "Uncategorized", account_id: null, account_name: null, is_controllable: false },
      { id: 2, slug: "dining", name: "Dining", account_id: null, account_name: null, is_controllable: true },
    ]);
    mockedListLabelRules.mockResolvedValue([]);
    mockedListAccounts.mockResolvedValue([
      {
        id: 1,
        name: "Checking Account",
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
    mockedPreviewLabelRuleMatches.mockReset();
    mockedCreateLabelRule.mockReset();
    mockedCreateLabel.mockReset();
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
    mockedPreviewLabelRuleMatches.mockResolvedValue({ total_count: 0, returned_count: 0, rows: [] });
  });

  it("renders primary module navigation and a dashboard-only home route", async () => {
    renderApp();

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Labeling" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.queryByText("Frontend Health")).not.toBeInTheDocument();
    expect(screen.queryByText("Backend Health")).not.toBeInTheDocument();
    expect(screen.getByText("Personal Finance")).toBeInTheDocument();
    expect(await screen.findByText("Monthly transaction review")).toBeInTheDocument();
    expect(screen.queryByText("Import transactions in guided order")).not.toBeInTheDocument();
    expect(screen.queryByText("Transaction labeling rules")).not.toBeInTheDocument();
    expect(screen.queryByText("Manage import accounts")).not.toBeInTheDocument();
  });

  it("marks non-dashboard modules as current", () => {
    renderApp("/import");

    expect(screen.getByRole("link", { name: "Import" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Import transactions in guided order")).toBeInTheDocument();
  });

  it("presents import steps and contextual validation before preparing", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });

    renderApp("/import");

    expect(screen.getByText("1. Account")).toBeInTheDocument();
    expect(screen.getByText("2. Source file")).toBeInTheDocument();
    expect(screen.getByText("3. Mappings")).toBeInTheDocument();
    expect(screen.getByText("4. Review")).toBeInTheDocument();
    expect(screen.getByText("5. Confirm")).toBeInTheDocument();
    expect(await screen.findByLabelText("Import account")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(screen.getByText("Choose a source CSV file first.")).toBeInTheDocument();
    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Next: update transform preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update transform preview" })).toBeDisabled();
  });

  it("sends users to accounts before import when no accounts exist", async () => {
    mockedListAccounts.mockResolvedValueOnce([]);

    renderApp("/import");

    expect(await screen.findByText("Create an account before importing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to accounts" })).toHaveAttribute("href", "/accounts");
    expect(screen.queryByLabelText("Statement CSV")).not.toBeInTheDocument();
  });

  it("uploads a CSV and renders source columns with raw preview rows", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });

    renderApp("/import");

    const input = await screen.findByLabelText("Statement CSV") as HTMLInputElement;
    const file = new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv", {
      type: "text/csv",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("CSV preview")).toBeInTheDocument();
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
        {
          id: 11,
          transaction_date: "2026-01-05",
          account: { id: 1, name: "Checking Account" },
          description: "Payroll deposit",
          merchant: "Payroll",
          label: { id: 1, slug: "income", name: "Income" },
          direction: "credit",
          amount: "1800.00",
          source_type: null,
          source_category: null,
          check_number: null,
        },
      ],
    });

    renderApp();

    expect(await screen.findByText("Monthly transaction review")).toBeInTheDocument();
    expect(await screen.findByText("Local Market")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Label" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Direction" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
    expect(screen.getByText("Debit activity")).toBeInTheDocument();
    expect(screen.getByText("1 debit row(s)")).toBeInTheDocument();
    expect(screen.getByText("Credit activity")).toBeInTheDocument();
    expect(screen.getByText("1 credit row(s)")).toBeInTheDocument();
    expect(screen.getByText("$1800.00")).toBeInTheDocument();
    expect(screen.getByText("Net activity")).toBeInTheDocument();
    expect(screen.getByText("credits minus debits")).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === "▲$1774.75")).toHaveClass("net-positive");
    expect((await screen.findAllByText("Groceries")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$25.25").length).toBeGreaterThan(0);
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
        account: { id: 1, name: "Checking Account" },
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
        account: { id: 1, name: "Checking Account" },
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

  it("persists the selected dashboard month across page refreshes", async () => {
    renderApp();

    fireEvent.change(await screen.findByLabelText("Dashboard month"), { target: { value: "2026-04" } });
    await waitFor(() => {
      expect(window.localStorage.getItem("personal-finance.dashboardMonth")).toBe("2026-04");
    });
    cleanup();

    renderApp();

    expect(await screen.findByLabelText("Dashboard month")).toHaveValue("2026-04");
  });

  it("persists dashboard account and label filters across page refreshes", async () => {
    renderApp();

    expect((await screen.findAllByText("Travel Card")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Checking Account" }));
    fireEvent.change(screen.getByLabelText("Dashboard label"), { target: { value: "dining" } });

    await waitFor(() => {
      expect(window.localStorage.getItem("personal-finance.dashboardAccountIds")).toBe("[42]");
      expect(window.localStorage.getItem("personal-finance.dashboardLabelSlug")).toBe("dining");
    });
    cleanup();

    renderApp();

    expect(await screen.findByLabelText("Dashboard label")).toHaveValue("dining");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Checking Account" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Travel Card" })).toBeChecked();
  });

  it("filters dashboard transactions by selected accounts and label", async () => {
    renderApp();

    expect((await screen.findAllByText("Travel Card")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Checking Account" }));
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

    expect(await screen.findByText("Manage import accounts")).toBeInTheDocument();
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
      account_id: 1,
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
    fireEvent.change(await screen.findByLabelText("Statement CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

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

  it("keeps a newly saved template when an older template load resolves later", async () => {
    let resolveTemplateLoad: (templates: Awaited<ReturnType<typeof listImportTemplates>>) => void = () => {};
    const staleTemplateLoad = new Promise<Awaited<ReturnType<typeof listImportTemplates>>>((resolve) => {
      resolveTemplateLoad = resolve;
    });
    mockedListImportTemplates.mockReturnValueOnce(staleTemplateLoad);
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedCreateImportTemplate.mockResolvedValue({
      id: 10,
      name: "Checking export",
      account_id: 1,
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
    });

    renderApp("/import");

    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Checking export" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Template" }));

    expect(await screen.findByText("Template saved for future imports.")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Checking export" })).toBeInTheDocument();
    resolveTemplateLoad([]);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Checking export" })).toBeInTheDocument();
    });
  });

  it("uses a selected template to update the transform preview without editing mappings", async () => {
    mockedListImportTemplates.mockResolvedValue([
      {
        id: 7,
        name: "Account export",
        account_id: 1,
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
    mockedPrepareImport.mockResolvedValue({
      upload_file_id: 22,
      row_count: 1,
      transformed_preview: [{ date: "2026-01-01", description: "Coffee", amount: "4.50", direction: "debit" }],
      duplicate_candidates: [],
    });

    renderApp("/import");

    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Amount\n2026-01-01,Coffee,-4.50\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Update transform preview" }));

    expect(await screen.findByText("Transform preview updated for 1 row(s). Review before confirming.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Template name")).not.toBeInTheDocument();
    expect(mockedUpdateImportTemplate).not.toHaveBeenCalled();
    expect(mockedPrepareImport).toHaveBeenCalledWith(expect.any(File), 1, expect.any(Object));
  });

  it("uses optional debit and credit mappings for split templates", async () => {
    mockedListImportTemplates.mockResolvedValue([
      {
        id: 8,
        name: "Checking",
        account_id: 1,
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: "2026-01-01T00:00:00+00:00",
        config: {
          mappings: {
            date: { source_column: "Date", transform: "parse_date" },
            description: { source_column: "Description", transform: "copy_column" },
            amount: { transform: "split_amount", debit_column: "Debit", credit_column: "Credit" },
            direction: { transform: "split_amount_direction", debit_column: "Debit", credit_column: "Credit" },
          },
        },
      },
    ]);
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Debit", "Credit"],
      source_columns: ["Date", "Description", "Debit", "Credit"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Debit: "4.50", Credit: "" }],
    });
    mockedPrepareImport.mockResolvedValue({
      upload_file_id: 22,
      row_count: 1,
      transformed_preview: [{ date: "2026-01-01", description: "Coffee", amount: "4.50", direction: "debit" }],
      duplicate_candidates: [],
    });

    renderApp("/import");

    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Debit,Credit\n2026-01-01,Coffee,4.50,\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "8" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Update transform preview" })).not.toBeDisabled();
    });
    const updateButton = screen.getByRole("button", { name: "Update transform preview" });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mockedPrepareImport).toHaveBeenCalled();
    });
    expect(await screen.findByText("Transform preview updated for 1 row(s). Review before confirming.")).toBeInTheDocument();
    expect(mockedPrepareImport).toHaveBeenCalledWith(expect.any(File), 1, {
      mappings: {
        date: { source_column: "Date", transform: "parse_date" },
        description: { source_column: "Description", transform: "copy_column" },
        amount: { transform: "split_amount", debit_column: "Debit", credit_column: "Credit" },
        direction: { transform: "split_amount_direction", debit_column: "Debit", credit_column: "Credit" },
      },
    });
  });

  it("shows prepare errors before transformed preview exists", async () => {
    mockedListImportTemplates.mockResolvedValue([
      {
        id: 8,
        name: "Checking",
        account_id: 1,
        created_at: "2026-01-01T00:00:00+00:00",
        updated_at: "2026-01-01T00:00:00+00:00",
        config: {
          mappings: {
            date: { source_column: "Date", transform: "parse_date" },
            description: { source_column: "Description", transform: "copy_column" },
            amount: { transform: "split_amount", debit_column: "Debit", credit_column: "Credit" },
            direction: { transform: "split_amount_direction", debit_column: "Debit", credit_column: "Credit" },
          },
        },
      },
    ]);
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Debit", "Credit"],
      source_columns: ["Date", "Description", "Debit", "Credit"],
      rows: [{ Date: "2026-01-01", Description: "Coffee", Debit: "", Credit: "" }],
    });
    mockedPrepareImport.mockRejectedValue({ response: { data: { detail: "Row 1 missing required field: amount" } } });

    renderApp("/import");

    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Debit,Credit\n2026-01-01,Coffee,,\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Update transform preview" }));

    expect(await screen.findByText("Row 1 missing required field: amount")).toBeInTheDocument();
  });

  it("creates scoped regex label rules and previews matches", async () => {
    mockedListLabelRules.mockResolvedValue([
      {
        id: 3,
        label_id: 2,
        label_slug: "dining",
        label_name: "Dining",
        label_account_id: null,
        label_is_controllable: true,
        account_id: null,
        account_name: null,
        match_field: "description",
        match_type: "contains",
        pattern: "Cafe",
        created_at: "2026-01-01T00:00:00+00:00",
      },
    ]);
    mockedListLabels.mockResolvedValue([
      { id: 1, slug: "uncategorized", name: "Uncategorized", account_id: null, account_name: null, is_controllable: false },
      { id: 2, slug: "dining", name: "Dining", account_id: null, account_name: null, is_controllable: true },
      { id: 8, slug: "travel-dining-42", name: "Travel Dining", account_id: 42, account_name: "Travel Card", is_controllable: true },
    ]);
    mockedCreateLabelRule.mockResolvedValue({
      id: 4,
      label_id: 8,
      label_slug: "travel-dining-42",
      label_name: "Travel Dining",
      label_account_id: 42,
      label_is_controllable: true,
      account_id: 42,
      account_name: "Travel Card",
      match_field: "description",
      match_type: "regex",
      pattern: "Bistro",
      created_at: "2026-01-02T00:00:00+00:00",
      applied_count: 2,
    });
    mockedPreviewLabelRuleMatches.mockResolvedValue({
      total_count: 1,
      returned_count: 1,
      rows: [{ id: 7, transaction_date: "2026-01-04", account_name: "Travel Card", description: "Bistro dinner", merchant: "Bistro", label_name: "Uncategorized", amount: "19.00", direction: "debit" }],
    });

    renderApp("/labeling");

    expect(await screen.findByText("Transaction labels and rules")).toBeInTheDocument();
    expect(screen.getByLabelText("Current labels")).toHaveTextContent("Dining");
    expect(screen.getByLabelText("Current labels")).toHaveTextContent("Global");
    expect(screen.getByText('Global rule - description contains "Cafe"')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Label"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Match type"), { target: { value: "regex" } });
    fireEvent.change(screen.getByLabelText("Match pattern"), { target: { value: "Bistro" } });
    expect(await screen.findByText("1 match(es), showing 1")).toBeInTheDocument();
    expect(screen.getByText("Bistro dinner")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Label Rule" }));

    expect(await screen.findByText("Rule saved. Applied to 2 existing transactions.")).toBeInTheDocument();
    expect(mockedCreateLabelRule).toHaveBeenCalledWith({ label_id: 8, match_field: "description", match_type: "regex", pattern: "Bistro" });
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
    fireEvent.change(await screen.findByLabelText("Import account"), { target: { value: "42" } });
    fireEvent.change(await screen.findByLabelText("Statement CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Update transform preview" }));

    expect(await screen.findByText("Transform preview updated for 1 row(s). Review before confirming.")).toBeInTheDocument();
    expect(screen.getAllByText("debit").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText("Imported 1 transaction(s).")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review January 2026 imports on dashboard" })).toBeInTheDocument();
    expect(mockedPrepareImport).toHaveBeenCalledWith(file, 42, expect.any(Object));
    expect(mockedConfirmImport).toHaveBeenCalledWith(22, expect.any(Object));
  });

  it("hands off successful imports to dashboard review for imported month", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-03-15", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedPrepareImport.mockResolvedValue({
      upload_file_id: 22,
      row_count: 1,
      transformed_preview: [{ date: "2026-03-15", description: "Coffee", amount: "4.50", direction: "debit" }],
      duplicate_candidates: [],
    });
    mockedConfirmImport.mockResolvedValue({ upload_file_id: 22, inserted_count: 1, duplicate_candidates: [] });

    renderApp("/import");

    const file = new File(["Date,Description,Amount\n2026-03-15,Coffee,-4.50\n"], "statement.csv", {
      type: "text/csv",
    });
    fireEvent.change(await screen.findByLabelText("Import account"), { target: { value: "42" } });
    fireEvent.change(await screen.findByLabelText("Statement CSV"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Update transform preview" }));
    expect(await screen.findByText("Transform preview updated for 1 row(s). Review before confirming.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    const reviewLink = await screen.findByRole("link", { name: "Review March 2026 imports on dashboard" });
    fireEvent.click(reviewLink);

    expect(await screen.findByText("Monthly transaction review")).toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard month")).toHaveValue("2026-03");
    await waitFor(() => {
      expect(mockedGetDashboardTransactions).toHaveBeenLastCalledWith("2026-03", { accountIds: [42], labelSlugs: [] });
    });
  });

  it("does not show dashboard handoff when duplicate warnings block inserts", async () => {
    mockedPreviewCsv.mockResolvedValue({
      headers: ["Date", "Description", "Amount"],
      source_columns: ["Date", "Description", "Amount"],
      rows: [{ Date: "2026-03-15", Description: "Coffee", Amount: "-4.50" }],
    });
    mockedPrepareImport.mockResolvedValue({
      upload_file_id: 22,
      row_count: 1,
      transformed_preview: [{ date: "2026-03-15", description: "Coffee", amount: "4.50", direction: "debit" }],
      duplicate_candidates: [],
    });
    mockedConfirmImport.mockResolvedValue({
      upload_file_id: 22,
      inserted_count: 0,
      duplicate_candidates: [{ row_number: 1, existing_transaction_id: 9, date: "2026-03-15", description: "Coffee", amount: "4.50", direction: "debit" }],
    });

    renderApp("/import");

    fireEvent.change(await screen.findByLabelText("Import account"), { target: { value: "42" } });
    fireEvent.change(await screen.findByLabelText("Statement CSV"), {
      target: { files: [new File(["Date,Description,Amount\n2026-03-15,Coffee,-4.50\n"], "statement.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("Import Template")).toBeInTheDocument();
    fireEvent.change(screen.getAllByLabelText("Source column")[0], { target: { value: "Date" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[1], { target: { value: "Description" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[2], { target: { value: "Amount" } });
    fireEvent.change(screen.getAllByLabelText("Source column")[3], { target: { value: "Amount" } });
    fireEvent.click(screen.getByRole("button", { name: "Update transform preview" }));
    expect(await screen.findByText("Transform preview updated for 1 row(s). Review before confirming.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm Import" }));

    expect(await screen.findByText("Duplicate warning found; no transactions inserted.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /imports on dashboard/i })).not.toBeInTheDocument();
  });
});
