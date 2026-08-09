import { useState } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { CatMascot } from "../../components/CatMascot";
import {
  calculateCatGrowthProgress,
  catExperiencePerLevel,
  catLevelRewards,
  catMaximumLevel,
  getCatCustomization,
  getCatLevel,
  getCatLevelExperience,
  type CatRewardItem
} from "../../domain/cat-growth";

function isEquipped(progress: ReturnType<typeof calculateCatGrowthProgress>, item: CatRewardItem) {
  return progress[item.slot] === item.value;
}

export function CatWardrobe() {
  const { state, dispatch } = useAppState();
  const [open, setOpen] = useState(false);
  const progress = calculateCatGrowthProgress(state);
  const level = getCatLevel(progress.experience);
  const levelExperience = getCatLevelExperience(progress.experience);
  const customization = getCatCustomization(state);
  const atMaximumLevel = level >= catMaximumLevel;

  return (
    <section className="surface-card cat-growth-card" aria-labelledby="cat-growth-title">
      <div className="cat-growth-card__summary">
        <div className="cat-growth-card__preview">
          <CatMascot baseState="idle" celebrationKey={0} customization={customization} />
        </div>
        <div className="cat-growth-card__copy">
          <span>CAT COMPANION</span>
          <h2 id="cat-growth-title">小猫成长 · Lv.{level}</h2>
          <p>{atMaximumLevel ? "已经解锁全部成长奖励" : `再获得 ${catExperiencePerLevel - levelExperience} 点成长值升级`}</p>
          <div className="cat-growth-card__bar" aria-label={atMaximumLevel ? "小猫已满级" : `本级成长 ${levelExperience}/${catExperiencePerLevel}`}>
            <span style={{ width: `${atMaximumLevel ? 100 : levelExperience / catExperiencePerLevel * 100}%` }} />
          </div>
        </div>
        <button type="button" className="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? "收起衣橱" : "打开衣橱"}
        </button>
      </div>

      {open && <div className="cat-wardrobe" aria-label="小猫衣橱">
        <p>完成任务、专注和记录时间都会获得成长值。已解锁内容可以随时切换，不会因为哪天休息而失去。</p>
        <div className="cat-reward-grid">
          {catLevelRewards.map((reward) => {
            const unlocked = reward.level <= level;
            return (
              <article className={`cat-reward-card${unlocked ? " cat-reward-card--unlocked" : " cat-reward-card--locked"}`} key={reward.level}>
                <div className="cat-reward-card__topline">
                  <span>Lv.{reward.level}</span>
                  <strong>{unlocked ? "已解锁" : "未解锁"}</strong>
                </div>
                <div className="cat-reward-card__icon" aria-hidden="true">{reward.icon}</div>
                <h3>{reward.name}</h3>
                <p>{reward.description}</p>
                {reward.items.length === 0 ? (
                  <span className="cat-reward-card__owned">初始拥有</span>
                ) : (
                  <div className="cat-reward-card__actions">
                    {reward.items.map((item) => {
                      const equipped = isEquipped(progress, item);
                      return (
                        <button
                          type="button"
                          key={`${item.slot}:${item.value}`}
                          disabled={!unlocked}
                          aria-pressed={equipped}
                          onClick={() => dispatch({ type: "cat/equip", item })}
                        >
                          {!unlocked ? `Lv.${reward.level} 解锁` : equipped ? "取消使用" : item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>}
    </section>
  );
}
