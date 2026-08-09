import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppStateProvider } from "../../app/AppStateProvider";
import { catExperiencePerLevel } from "../../domain/cat-growth";
import { createInitialState } from "../../domain/defaults";
import type { AppState } from "../../domain/types";
import type { AppRepository } from "../../storage/repository";
import { CatWardrobe } from "./CatWardrobe";

class MemoryRepository implements AppRepository {
  state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() { return this.state; }
}

describe("CatWardrobe", () => {
  it("previews ten fixed rewards and equips an unlocked item", async () => {
    const state = createInitialState(new Date(2026, 7, 9, 9));
    state.catGrowth!.experience = catExperiencePerLevel;
    const repository = new MemoryRepository(state);
    const user = userEvent.setup();

    render(<AppStateProvider repository={repository}><CatWardrobe /></AppStateProvider>);
    await user.click(screen.getByRole("button", { name: "打开衣橱" }));

    expect(screen.getByLabelText("小猫衣橱").querySelectorAll("article")).toHaveLength(10);
    expect(screen.getByText("元气领巾")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "佩戴领巾" }));
    expect(repository.state.catGrowth?.outfit).toBe("scarf");
    expect(screen.getByRole("button", { name: "取消使用" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps future rewards visible but disabled", async () => {
    const user = userEvent.setup();
    render(<AppStateProvider repository={new MemoryRepository(createInitialState(new Date()))}><CatWardrobe /></AppStateProvider>);
    await user.click(screen.getByRole("button", { name: "打开衣橱" }));

    expect(screen.getByText("星光相伴")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Lv.10 解锁" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Lv.10 解锁" })[0]).toBeDisabled();
  });
});
