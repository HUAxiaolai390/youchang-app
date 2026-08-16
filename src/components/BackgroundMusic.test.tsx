import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppStateProvider } from "../app/AppStateProvider";
import { createInitialState } from "../domain/defaults";
import type { AppState } from "../domain/types";
import type { AppRepository } from "../storage/repository";
import { BackgroundMusic, backgroundMusicSource } from "./BackgroundMusic";

class MemoryRepository implements AppRepository {
  state: AppState;
  constructor(state: AppState) { this.state = state; }
  load() { return this.state; }
  save(state: AppState) { this.state = state; }
  clear() {
    this.state = createInitialState(new Date(2026, 7, 4, 9));
    return this.state;
  }
}

function renderMusic(state = createInitialState(new Date(2026, 7, 4, 9))) {
  const repository = new MemoryRepository(state);
  render(<AppStateProvider repository={repository}><BackgroundMusic /></AppStateProvider>);
  return repository;
}

describe("BackgroundMusic", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
      this.dispatchEvent(new Event("pause"));
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("plays, pauses, and loops the extracted track", async () => {
    const user = userEvent.setup();
    renderMusic();
    const audio = screen.getByTestId("background-music-audio");

    expect(audio).toHaveAttribute("src", backgroundMusicSource);
    expect(audio).toHaveAttribute("loop");

    await user.click(screen.getByRole("button", { name: "播放音乐" }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "暂停音乐" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "暂停音乐" }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "播放音乐" })).toBeVisible();
  });

  it("saves volume changes and applies them to the audio element", async () => {
    const repository = renderMusic();
    const audio = screen.getByTestId("background-music-audio") as HTMLAudioElement;
    const slider = screen.getByLabelText("音量");

    expect(slider).toHaveValue("35");
    expect(audio.volume).toBeCloseTo(0.35);

    fireEvent.change(slider, { target: { value: "72" } });

    expect(slider).toHaveValue("72");
    expect(repository.state.settings.musicVolume).toBeCloseTo(0.72);
    await waitFor(() => expect(audio.volume).toBeCloseTo(0.72));
    expect(screen.getByText("72%")).toBeVisible();
  });

  it("uses the safe default for data saved before music settings existed", () => {
    const state = createInitialState(new Date(2026, 7, 4, 9));
    delete state.settings.musicVolume;

    renderMusic(state);

    expect(screen.getByLabelText("音量")).toHaveValue("35");
  });

  it("hides the duplicate controls while keeping the audio player mounted", () => {
    const state = createInitialState(new Date(2026, 7, 4, 9));
    const repository = new MemoryRepository(state);
    render(<AppStateProvider repository={repository}><BackgroundMusic visible={false} /></AppStateProvider>);

    expect(screen.queryByLabelText("背景音乐控制")).not.toBeInTheDocument();
    expect(screen.getByTestId("background-music-audio")).toBeInTheDocument();
  });

  it("explains when the browser rejects playback", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValueOnce(new DOMException("blocked"));
    const user = userEvent.setup();
    renderMusic();

    await user.click(screen.getByRole("button", { name: "播放音乐" }));

    expect(screen.getByRole("alert")).toHaveTextContent("请再点一次播放");
  });
});
