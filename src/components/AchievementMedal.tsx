import { achievementTierLabels, type AchievementProgress } from "../domain/achievements";

export function AchievementMedal({ achievement, compact = false, hideTier = false }: { achievement: AchievementProgress; compact?: boolean; hideTier?: boolean }) {
  return (
    <div className={`achievement-medal achievement-medal--${achievement.tier}${compact ? " achievement-medal--compact" : ""}${achievement.unlocked ? "" : " achievement-medal--locked"}`}>
      <span className="achievement-medal__emblem" aria-hidden="true">
        <span>{achievement.icon}</span>
      </span>
      <span className="achievement-medal__copy">
        <strong>{achievement.name}</strong>
        {!hideTier && <small>{achievementTierLabels[achievement.tier]}</small>}
      </span>
    </div>
  );
}
