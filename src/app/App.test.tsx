import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the product name and slogan", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "有常" })).toBeInTheDocument();
    expect(screen.getByText("日日有常，步步有长。")).toBeInTheDocument();
  });
});
