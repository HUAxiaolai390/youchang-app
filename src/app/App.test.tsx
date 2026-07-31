import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/defaults";
import type { AppRepository } from "../storage/repository";
import { App } from "./App";

describe("App", () => {
  it("shows the product name and slogan", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "有常" })).toBeInTheDocument();
    expect(screen.getByText("日日有常，步步有长。")).toBeInTheDocument();
  });

  it("shows a provider error in an alert and lets the user dismiss it", async () => {
    const repository: AppRepository = {
      load() {
        throw new Error("保存失败，请立即导出备份");
      },
      save() {},
      clear() {
        return createInitialState(new Date(2026, 6, 31, 9));
      }
    };
    const user = userEvent.setup();

    render(<App repository={repository} />);

    expect(screen.getByRole("alert")).toHaveTextContent("保存失败，请立即导出备份");
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
