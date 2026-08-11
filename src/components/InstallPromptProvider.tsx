import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed" };

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type InstallPromptContextValue = {
  available: boolean;
  installed: boolean;
  requestInstall(): Promise<InstallChoice | undefined>;
};

function isStandalone(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches
    || navigatorWithStandalone.standalone === true;
}

const InstallPromptContext = createContext<InstallPromptContextValue>({
  available: false,
  installed: false,
  requestInstall: async () => undefined
});

export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent>();
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function requestInstall(): Promise<InstallChoice | undefined> {
    if (!installPrompt) return undefined;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(undefined);
    return choice;
  }

  return (
    <InstallPromptContext.Provider value={{ available: Boolean(installPrompt), installed, requestInstall }}>
      {children}
    </InstallPromptContext.Provider>
  );
}

export function useInstallPrompt(): InstallPromptContextValue {
  return useContext(InstallPromptContext);
}
