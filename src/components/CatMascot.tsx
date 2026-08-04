import { useEffect, useRef, useState } from "react";

export type MascotBaseState = "idle" | "sleep";
export type MascotState = MascotBaseState | "react" | "celebrate";
export type CatMascotProps = {
  baseState: MascotBaseState;
  celebrationKey: number;
};

const temporaryActionDurations: Record<Extract<MascotState, "react" | "celebrate">, number> = {
  react: 1120,
  celebrate: 2080
};
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(reducedMotionQuery).matches
      : false
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(reducedMotionQuery);
    const updatePreference = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);

    setPrefersReducedMotion(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

export function CatMascot({ baseState, celebrationKey }: CatMascotProps) {
  const [temporaryState, setTemporaryState] = useState<MascotState | null>(null);
  const [playbackKey, setPlaybackKey] = useState(0);
  const lastCelebrationKey = useRef(celebrationKey);
  const temporaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(() => new Set());
  const prefersReducedMotion = usePrefersReducedMotion();

  function clearTemporaryTimer() {
    if (temporaryTimer.current !== null) {
      clearTimeout(temporaryTimer.current);
      temporaryTimer.current = null;
    }
  }

  function startTemporaryState(state: Extract<MascotState, "react" | "celebrate">) {
    clearTemporaryTimer();
    setTemporaryState(state);
    setPlaybackKey((current) => current + 1);
    temporaryTimer.current = setTimeout(() => {
      temporaryTimer.current = null;
      setTemporaryState(null);
    }, temporaryActionDurations[state]);
  }

  useEffect(() => {
    if (celebrationKey === lastCelebrationKey.current) return;

    lastCelebrationKey.current = celebrationKey;
    startTemporaryState("celebrate");
  }, [celebrationKey]);

  useEffect(() => () => clearTemporaryTimer(), []);

  const state = temporaryState ?? baseState;
  const extension = prefersReducedMotion ? "png" : "gif";
  const desiredSource = `/mascot/${state}.${extension}`;
  const fallbackSource = `/mascot/idle.${extension}`;
  const displayedSource = failedSources.has(desiredSource) ? fallbackSource : desiredSource;

  return (
    <button
      type="button"
      className="cat-mascot"
      aria-label="和小猫互动"
      data-mascot-state={state}
      onClick={() => {
        if (state !== "celebrate") startTemporaryState("react");
      }}
    >
      <img
        key={`${state}-${playbackKey}`}
        className="cat-mascot__image"
        src={displayedSource}
        alt=""
        onError={() => {
          if (displayedSource === fallbackSource) return;
          setFailedSources((current) => {
            if (current.has(desiredSource)) return current;
            const next = new Set(current);
            next.add(desiredSource);
            return next;
          });
        }}
      />
    </button>
  );
}
