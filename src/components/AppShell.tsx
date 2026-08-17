import type { ReactNode } from "react";

export type PageKey = "today" | "week" | "growth" | "settings";

type AppShellProps = {
  activePage: PageKey;
  onNavigate(page: PageKey): void;
  children: ReactNode;
};

const navigation = [
  { key: "today", label: "今日", icon: "home" },
  { key: "week", label: "计划", icon: "calendar" },
  { key: "growth", label: "成长", icon: "growth" },
  { key: "settings", label: "设置", icon: "settings" }
] as const;

function NavigationIcon({ name }: { name: (typeof navigation)[number]["icon"] }) {
  if (name === "home") {
    return <svg className="bottom-nav__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 20v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
  }

  if (name === "growth") {
    return <svg className="bottom-nav__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V11m7 7V6m7 12v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="m5 8 7-4 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  }

  if (name === "calendar") {
    return <svg className="bottom-nav__icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M8 3v4m8-4v4M4 10h16M8 14h3m2 0h3m-8 3h3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  }

  return <svg className="bottom-nav__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.06 2.06-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-2.92v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.06-2.06.06-.06A1.7 1.7 0 0 0 7.22 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-2.92h.08A1.7 1.7 0 0 0 7.22 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.88 6l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h2.92v.08A1.7 1.7 0 0 0 15.8 6.4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.06 2.06-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.03h.08v2.92h-.08A1.7 1.7 0 0 0 19.4 15Z" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function AppShell({ activePage, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <header className="app-shell__masthead">
          <img className="app-shell__mark" src="/pwa-192x192.png" alt="" aria-hidden="true" />
          <h1 className="app-shell__brand">有常</h1>
        </header>
        <main className="app-shell__main">{children}</main>
      </div>
      <nav className="bottom-nav" aria-label="主导航">
        <div className="bottom-nav__inner">
          {navigation.map((item) => (
            <button
              key={item.key}
              type="button"
              className="bottom-nav__item"
              aria-current={activePage === item.key ? "page" : undefined}
              onClick={() => onNavigate(item.key)}
            >
              <NavigationIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
