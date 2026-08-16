import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export type MascotBaseState = "idle" | "sleep";
export type MascotState = MascotBaseState | "celebrate";
export type CatMascotProps = {
  baseState: MascotBaseState;
  celebrationKey: number;
};

export const mascotIdleVariants = [
  "02", "03", "04", "05", "06", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20"
] as const;

type MascotIdleVariant = (typeof mascotIdleVariants)[number];

const defaultIdleVariant: MascotIdleVariant = "19";
const celebrationDuration = 2080;
export const mascotAutoSwitchInterval = 15_000;
export function CatMascot({ baseState, celebrationKey }: CatMascotProps) {
  const [temporaryState, setTemporaryState] = useState<"celebrate" | null>(null);
  const [selectedIdleVariant, setSelectedIdleVariant] = useState<MascotIdleVariant | null>(null);
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

  function startCelebration() {
    clearTemporaryTimer();
    setTemporaryState("celebrate");
    setPlaybackKey((current) => current + 1);
    temporaryTimer.current = setTimeout(() => {
      temporaryTimer.current = null;
      setTemporaryState(null);
    }, celebrationDuration);
  }

  function selectNextIdleVariant() {
    clearTemporaryTimer();
    setTemporaryState(null);
    setSelectedIdleVariant((current) => {
      const currentVariant = current ?? defaultIdleVariant;
      const currentIndex = mascotIdleVariants.indexOf(currentVariant);
      return mascotIdleVariants[(currentIndex + 1) % mascotIdleVariants.length];
    });
    setPlaybackKey((current) => current + 1);
  }

  function selectRandomIdleVariant() {
    setSelectedIdleVariant((current) => {
      const currentVariant = current ?? defaultIdleVariant;
      const available = mascotIdleVariants.filter((variant) => variant !== currentVariant);
      const randomIndex = Math.min(available.length - 1, Math.floor(Math.random() * available.length));
      return available[randomIndex];
    });
    setPlaybackKey((current) => current + 1);
  }

  useEffect(() => {
    if (celebrationKey === lastCelebrationKey.current) return;

    lastCelebrationKey.current = celebrationKey;
    startCelebration();
  }, [celebrationKey]);

  useEffect(() => {
    setSelectedIdleVariant(null);
  }, [baseState]);

  useEffect(() => {
    if (prefersReducedMotion || temporaryState === "celebrate") return;

    const timer = window.setTimeout(selectRandomIdleVariant, mascotAutoSwitchInterval);
    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion, selectedIdleVariant, temporaryState]);

  useEffect(() => () => clearTemporaryTimer(), []);

  const state: MascotState = temporaryState ?? (selectedIdleVariant ? "idle" : baseState);
  const idleVariant = state === "idle" ? (selectedIdleVariant ?? defaultIdleVariant) : null;
  const extension = prefersReducedMotion ? "png" : "gif";
  const desiredSource = state === "idle" && selectedIdleVariant
    ? `/mascot/idle/${selectedIdleVariant}.${extension}`
    : `/mascot/${state}.${extension}`;
  const fallbackSource = `/mascot/idle.${extension}`;
  const displayedSource = failedSources.has(desiredSource) ? fallbackSource : desiredSource;

  return (
    <button
      type="button"
      className="cat-mascot"
      aria-label="和小猫互动"
      title="点击切换小猫待机动作"
      data-mascot-state={state}
      data-mascot-idle-variant={idleVariant ?? undefined}
      onClick={() => {
        if (state !== "celebrate") selectNextIdleVariant();
      }}
    >
      <img
        key={`${displayedSource}-${playbackKey}`}
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
