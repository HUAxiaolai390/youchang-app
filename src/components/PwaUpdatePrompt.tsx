import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type PwaUpdatePromptProps = {
  reloadPage?: () => void;
};

export function PwaUpdatePrompt({ reloadPage = () => window.location.reload() }: PwaUpdatePromptProps) {
  const [updateReady, setUpdateReady] = useState(false);

  useRegisterSW({
    onNeedReload() {
      setUpdateReady(true);
    }
  });

  if (!updateReady) return null;

  return (
    <aside className="pwa-update-prompt" role="status">
      <span>新版本已准备好，点击刷新</span>
      <button type="button" onClick={reloadPage}>刷新应用</button>
    </aside>
  );
}
