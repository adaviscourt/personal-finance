import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getHealth, previewCsv } from "./api/client";

vi.mock("./api/client", () => ({
  getHealth: vi.fn(),
  previewCsv: vi.fn(),
}));

const mockedGetHealth = vi.mocked(getHealth);
const mockedPreviewCsv = vi.mocked(previewCsv);

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockedGetHealth.mockResolvedValue({ status: "ok", database: "ok" });
    mockedPreviewCsv.mockReset();
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
});
