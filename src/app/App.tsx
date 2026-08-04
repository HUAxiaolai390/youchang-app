import { AppStateProvider, useAppState } from "./AppStateProvider";
import type { AppRepository } from "../storage/repository";
import { AppShell, type PageKey } from "../components/AppShell";
import { TodayPage } from "../features/today/TodayPage";
import { GrowthPage } from "../features/growth/GrowthPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { PwaUpdatePrompt } from "../components/PwaUpdatePrompt";
import { BackgroundMusic } from "../components/BackgroundMusic";

import { useState } from "react";
import { createLocalRepository } from "../storage/repository";

export function App({ repository }: { repository?: AppRepository }) {
  const [appRepository] = useState(
    () => repository ?? createLocalRepository(window.localStorage, () => new Date())
  );

  return (
    <AppStateProvider repository={appRepository}>
      <AppContents />
    </AppStateProvider>
  );
}

function AppContents() {
  const { dispatch, error } = useAppState();
  const [activePage, setActivePage] = useState<PageKey>("today");

  const pageContent: Record<PageKey, { title: string; description: string }> = {
    today: { title: "今天", description: "日日有常，步步有长。" },
    growth: { title: "成长", description: "慢慢积累，也是一种前进。" },
    settings: { title: "设置", description: "把有常调成更适合你的样子。" }
  };
  const page = pageContent[activePage];

  return (
    <>
      <AppShell activePage={activePage} onNavigate={setActivePage}>
        <section className="surface-card page-intro" aria-labelledby="page-title">
          <h2 id="page-title">{page.title}</h2>
          <p>{page.description}</p>
        </section>
        <BackgroundMusic />
        {activePage === "today" && <TodayPage />}
        {activePage === "growth" && <GrowthPage />}
        {activePage === "settings" && <SettingsPage />}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button onClick={() => dispatch({ type: "error/dismiss" })}>关闭</button>
          </div>
        )}
      </AppShell>
      <PwaUpdatePrompt />
    </>
  );
}
