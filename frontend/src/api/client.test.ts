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

import { getDashboardTransactions, listAccounts, listLabels } from "./client";

describe("api client", () => {
  beforeEach(() => {
    mockGet.mockReset();
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
    });

    expect(mockGet).toHaveBeenCalledWith("/dashboard/transactions", {
      params: {
        month: "2098-06",
        account_ids: [1],
        label_ids: [2],
        label_slugs: ["groceries"],
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
});
