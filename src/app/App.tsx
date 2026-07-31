import { AppStateProvider, useAppState } from "./AppStateProvider";
import type { AppRepository } from "../storage/repository";

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

  return (
    <main>
      <h1>有常</h1>
      <p>日日有常，步步有长。</p>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => dispatch({ type: "error/dismiss" })}>关闭</button>
        </div>
      )}
    </main>
  );
}
