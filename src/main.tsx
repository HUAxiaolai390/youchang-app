import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { StartupGate } from "./components/StartupGate";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StartupGate><App /></StartupGate>
  </StrictMode>
);
