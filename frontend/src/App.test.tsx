import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("renders the frontend health content", () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Frontend Health")).toBeInTheDocument();
    expect(screen.getByText("Personal Finance MVP")).toBeInTheDocument();
  });
});
