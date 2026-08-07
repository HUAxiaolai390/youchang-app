import { AppStateProvider, useAppState } from "./AppStateProvider";
import type { AppRepository } from "../storage/repository";
import { AppShell, type PageKey } from "../components/AppShell";
import { TodayPage } from "../features/today/TodayPage";
import { GrowthPage } from "../features/growth/GrowthPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { WeekPage } from "../features/week/WeekPage";
import { PwaUpdatePrompt } from "../components/PwaUpdatePrompt";
import { BackgroundMusic } from "../components/BackgroundMusic";
import { getDailyQuote } from "../domain/daily-quotes";

import { useEffect, useState } from "react";
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
  const [dailyQuote, setDailyQuote] = useState(() => getDailyQuote(new Date()));

  useEffect(() => {
    let midnightTimer = 0;

    const refreshQuote = () => setDailyQuote(getDailyQuote(new Date()));
    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      midnightTimer = window.setTimeout(() => {
        refreshQuote();
        scheduleMidnightRefresh();
      }, nextDay.getTime() - now.getTime());
    };
    const refreshAfterSleep = () => {
      if (!document.hidden) refreshQuote();
    };

    scheduleMidnightRefresh();
    document.addEventListener("visibilitychange", refreshAfterSleep);
    return () => {
      window.clearTimeout(midnightTimer);
      document.removeEventListener("visibilitychange", refreshAfterSleep);
    };
  }, []);

  const pageContent: Record<PageKey, { title: string; description: string }> = {
    today: { title: "今天", description: "日日有常，步步有长。" },
    week: { title: "计划", description: "把任务放进合适的时间里。" },
    growth: { title: "成长", description: "慢慢积累，也是一种前进。" },
    settings: { title: "设置", description: "把有常调成更适合你的样子。" }
  };
  const page = pageContent[activePage];

  return (
    <>
      <AppShell activePage={activePage} onNavigate={setActivePage}>
        {activePage === "growth" ? (
          <section className="surface-card page-intro page-intro--quote" aria-labelledby="page-title">
            <div className="daily-quote__heading">
              <h2 id="page-title">{page.title}</h2>
              <span>每日一句 · Daily Quote</span>
            </div>
            <blockquote className="daily-quote">
              <p className="daily-quote__zh">“{dailyQuote.zh}”</p>
              <p className="daily-quote__en" lang="en">“{dailyQuote.en}”</p>
              <footer>
                <span>— {dailyQuote.authorZh}</span>
                <span lang="en">{dailyQuote.authorEn}</span>
              </footer>
            </blockquote>
          </section>
        ) : activePage !== "today" ? (
          <section className="surface-card page-intro" aria-labelledby="page-title">
            <h2 id="page-title">{page.title}</h2>
            <p>{page.description}</p>
          </section>
        ) : null}
        <BackgroundMusic compact={activePage === "today"} />
        {activePage === "today" && <TodayPage onOpenAchievements={() => setActivePage("growth")} />}
        {activePage === "week" && <WeekPage />}
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
