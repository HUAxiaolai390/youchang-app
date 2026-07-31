import { AppStateProvider } from "./AppStateProvider";
import type { AppRepository } from "../storage/repository";

import { useState } from "react";
import { createLocalRepository } from "../storage/repository";

export function App({ repository }: { repository?: AppRepository }) {
  const [appRepository] = useState(
    () => repository ?? createLocalRepository(window.localStorage, () => new Date())
  );

  return (
    <AppStateProvider repository={appRepository}>
      <main>
        <h1>有常</h1>
        <p>日日有常，步步有长。</p>
      </main>
    </AppStateProvider>
  );
}
