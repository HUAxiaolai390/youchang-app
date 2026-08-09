import { useEffect, useRef, useState } from "react";
import type { CatDecor, CatOutfit, CatRoom, CatSpecialAction } from "../domain/types";

export type MascotBaseState = "idle" | "sleep";
export type MascotState = MascotBaseState | "celebrate";
export type CatMascotProps = {
  baseState: MascotBaseState;
  celebrationKey: number;
  customization?: {
    outfit?: CatOutfit;
    decor?: CatDecor;
    specialAction?: CatSpecialAction;
    room?: CatRoom;
  };
};

export const mascotIdleVariants = [
  "02", "03", "04", "05", "06", "08", "09", "10", "11",
  "12", "13", "14", "15", "16", "17", "18", "19", "20"
] as const;

type MascotIdleVariant = (typeof mascotIdleVariants)[number];

const defaultIdleVariant: MascotIdleVariant = "19";
const celebrationDuration = 2080;
export const mascotAutoSwitchInterval = 15_000;
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

export function CatMascot({ baseState, celebrationKey, customization }: CatMascotProps) {
  const [temporaryState, setTemporaryState] = useState<"celebrate" | null>(null);
  const [selectedIdleVariant, setSelectedIdleVariant] = useState<MascotIdleVariant | null>(null);
  const [playbackKey, setPlaybackKey] = useState(0);
  const lastCelebrationKey = useRef(celebrationKey);
  const temporaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const specialActionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [specialActionPlaying, setSpecialActionPlaying] = useState(false);
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

  function playSpecialAction() {
    if (!customization?.specialAction || prefersReducedMotion) return;
    if (specialActionTimer.current !== null) clearTimeout(specialActionTimer.current);
    setSpecialActionPlaying(false);
    window.requestAnimationFrame(() => setSpecialActionPlaying(true));
    specialActionTimer.current = setTimeout(() => {
      specialActionTimer.current = null;
      setSpecialActionPlaying(false);
    }, 1100);
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

  useEffect(() => () => {
    clearTemporaryTimer();
    if (specialActionTimer.current !== null) clearTimeout(specialActionTimer.current);
  }, []);

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
      className={`cat-mascot${customization?.room ? ` cat-mascot--room-${customization.room}` : ""}${specialActionPlaying && customization?.specialAction ? ` cat-mascot--action-${customization.specialAction}` : ""}`}
      aria-label="和小猫互动"
      title="点击切换小猫待机动作"
      data-mascot-state={state}
      data-mascot-idle-variant={idleVariant ?? undefined}
      data-cat-outfit={customization?.outfit}
      data-cat-decor={customization?.decor}
      data-cat-special-action={customization?.specialAction}
      data-cat-room={customization?.room}
      onClick={() => {
        if (state !== "celebrate") {
          playSpecialAction();
          selectNextIdleVariant();
        }
      }}
    >
      {customization?.room && <span className={`cat-mascot__room cat-mascot__room--${customization.room}`} aria-hidden="true" />}
      {customization?.decor && <span className={`cat-mascot__decor cat-mascot__decor--${customization.decor}`} aria-hidden="true" />}
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
      {customization?.outfit && <span className={`cat-mascot__outfit cat-mascot__outfit--${customization.outfit}`} aria-hidden="true" />}
      {specialActionPlaying && customization?.specialAction && <span className="cat-mascot__special-effect" aria-hidden="true">✦</span>}
    </button>
  );
}
