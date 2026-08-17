import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type StartupGateProps = {
  children: ReactNode;
  minimumVisibleMs?: number;
};

type StartupStyle = CSSProperties & { "--startup-progress": string };

function waitForInstallation(registration: ServiceWorkerRegistration): Promise<void> {
  const worker = registration.installing;
  if (!worker) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (worker.state === "installed" || worker.state === "activated" || worker.state === "redundant") finish();
    };
    const timeout = window.setTimeout(finish, 4500);
    worker.addEventListener("statechange", onStateChange);
  });
}

export function StartupGate({ children, minimumVisibleMs = 1200 }: StartupGateProps) {
  const startedAt = useRef(Date.now());
  const startupOpen = useRef(true);
  const registrationSeen = useRef(false);
  const updateApplying = useRef(false);
  const updateWorker = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined);
  const [progress, setProgress] = useState(8);
  const [status, setStatus] = useState("正在准备今天的计划");
  const [updateChecked, setUpdateChecked] = useState(false);
  const [ready, setReady] = useState(false);

  function applyAvailableUpdate(): Promise<void> {
    if (!startupOpen.current || updateApplying.current) return Promise.resolve();
    updateApplying.current = true;
    setStatus("发现新版本，正在更新");
    const update = updateWorker.current;
    if (!update) {
      setUpdateChecked(true);
      return Promise.resolve();
    }
    return update(true).finally(() => {
      if (startupOpen.current) setUpdateChecked(true);
    });
  }

  const registered = useRegisterSW({
    onRegisteredSW(_workerUrl, registration) {
      registrationSeen.current = true;
      if (!registration || !startupOpen.current) {
        setUpdateChecked(true);
        return;
      }

      setStatus("正在检查应用更新");
      void (async () => {
        try {
          await registration.update();
          await waitForInstallation(registration);
          if (registration.waiting && navigator.serviceWorker.controller && startupOpen.current) {
            await applyAvailableUpdate();
          }
        } catch {
          setStatus("离线也可以继续使用");
        } finally {
          if (startupOpen.current) setUpdateChecked(true);
        }
      })();
    },
    onNeedRefresh() {
      void applyAvailableUpdate();
    },
    onNeedReload() {
      void applyAvailableUpdate();
    },
    onRegisterError() {
      if (!startupOpen.current) return;
      setStatus("离线也可以继续使用");
      setUpdateChecked(true);
    }
  });
  updateWorker.current = registered.updateServiceWorker;

  useEffect(() => {
    startupOpen.current = true;
    const noRegistrationFallback = window.setTimeout(() => {
      if (!registrationSeen.current) setUpdateChecked(true);
    }, 850);
    const maximumWait = window.setTimeout(() => setUpdateChecked(true), 6000);
    return () => {
      startupOpen.current = false;
      window.clearTimeout(noRegistrationFallback);
      window.clearTimeout(maximumWait);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setProgress((current) => {
        const ceiling = updateChecked ? 96 : 86;
        if (current >= ceiling) return current;
        return Math.min(ceiling, current + Math.max(1, Math.round((ceiling - current) * .12)));
      });
    }, 85);
    return () => window.clearInterval(interval);
  }, [updateChecked]);

  useEffect(() => {
    if (!updateChecked) return;
    const remaining = Math.max(0, minimumVisibleMs - (Date.now() - startedAt.current));
    let revealTimer: number | undefined;
    const completeTimer = window.setTimeout(() => {
      setStatus("准备完成，马上开始");
      setProgress(100);
      revealTimer = window.setTimeout(() => {
        startupOpen.current = false;
        setReady(true);
      }, 260);
    }, remaining);
    return () => {
      window.clearTimeout(completeTimer);
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
    };
  }, [minimumVisibleMs, updateChecked]);

  if (ready) return children;

  const catPosition = 6 + progress * .88;
  return (
    <main className="startup-screen" aria-labelledby="startup-title">
      <div className="startup-screen__glow startup-screen__glow--one" aria-hidden="true" />
      <div className="startup-screen__glow startup-screen__glow--two" aria-hidden="true" />
      <section className="startup-card">
        <div className="startup-brand">
          <span className="startup-brand__mark" aria-hidden="true">有</span>
          <div>
            <p>日日有常 · 步步有长</p>
            <h1 id="startup-title">有常 APP</h1>
          </div>
        </div>

        <div className="startup-progress" style={{ "--startup-progress": `${catPosition}%` } as StartupStyle}>
          <div className="startup-progress__lane" aria-hidden="true">
            <img className="startup-progress__cat" src="/mascot/idle/18.gif" alt="" />
          </div>
          <div
            className="startup-progress__track"
            role="progressbar"
            aria-label="应用加载进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="startup-progress__copy">
            <span role="status">{status}</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
