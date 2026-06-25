import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.hoisted(() => vi.fn());

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: mockGet,
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

import { getAppConfig, getDashboardTransactions, listAccounts, listLabels } from "./client";

describe("api client", () => {
  beforeEach(() => {
    mockGet.mockReset();
    vi.unstubAllEnvs();
  });

  it("requests dashboard transaction rows with month and optional filters", async () => {
    const dashboardTransactions = {
      month: "2098-06",
      transactions: [
        {
          id: 10,
          transaction_date: "2098-06-02",
          account: { id: 1, name: "Checking" },
          description: "Local Market",
          merchant: "Market Co",
          label: { id: 2, slug: "groceries", name: "Groceries" },
          direction: "debit",
          amount: "10.50",
          source_type: "Card",
          source_category: "Food",
          check_number: null,
        },
      ],
    };
    mockGet.mockResolvedValue({ data: dashboardTransactions });

    const result = await getDashboardTransactions("2098-06", {
      accountIds: [1],
      labelIds: [2],
      labelSlugs: ["groceries"],
      controllability: "controllable",
    });

    expect(mockGet).toHaveBeenCalledWith("/dashboard/transactions", {
      params: {
        month: "2098-06",
        account_ids: [1],
        label_ids: [2],
        label_slugs: ["groceries"],
        controllability: "controllable",
      },
      paramsSerializer: { indexes: null },
    });
    expect(result).toEqual(dashboardTransactions);
  });

  it("keeps account and label list clients available for dashboard/module selectors", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: 1, name: "Checking" }] });
    mockGet.mockResolvedValueOnce({ data: [{ id: 2, slug: "groceries", name: "Groceries", account_id: null, is_controllable: true }] });

    await expect(listAccounts()).resolves.toEqual([{ id: 1, name: "Checking" }]);
    await expect(listLabels()).resolves.toEqual([{ id: 2, slug: "groceries", name: "Groceries", account_id: null, is_controllable: true }]);

    expect(mockGet).toHaveBeenNthCalledWith(1, "/accounts");
    expect(mockGet).toHaveBeenNthCalledWith(2, "/labels");
  });

  it("loads app config for demo mode", async () => {
    mockGet.mockResolvedValue({ data: { demo_mode: true, demo_default_month: "2026-06" } });

    await expect(getAppConfig()).resolves.toEqual({ demo_mode: true, demo_default_month: "2026-06" });

    expect(mockGet).toHaveBeenCalledWith("/config");
  });

  it("serves demo data without network when demo build flag is enabled", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.resetModules();
    const { getAppConfig: getDemoAppConfig, getDashboardTransactions: getDemoDashboardTransactions, listAccounts: listDemoAccounts } = await import("./client");

    await expect(getDemoAppConfig()).resolves.toEqual({ demo_mode: true, demo_default_month: "2026-06" });
    await expect(listDemoAccounts()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: "Demo Checking" })]));
    await expect(getDemoDashboardTransactions("2026-06")).resolves.toEqual(expect.objectContaining({ transactions: expect.arrayContaining([expect.objectContaining({ description: "Demo Payroll Deposit" })]) }));

    expect(mockGet).not.toHaveBeenCalled();
  });
});
