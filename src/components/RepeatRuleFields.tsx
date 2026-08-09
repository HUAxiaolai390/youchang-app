import { formatFixedRepeatRule, weekdayOptions } from "../domain/repeat";
import type { FixedRepeatRule } from "../domain/types";

type RepeatRuleFieldsProps = {
  idPrefix: string;
  value: FixedRepeatRule;
  onChange(value: FixedRepeatRule): void;
};

export function RepeatRuleFields({ idPrefix, value, onChange }: RepeatRuleFieldsProps) {
  let summary = "请完善重复规则";
  try {
    summary = formatFixedRepeatRule(value);
  } catch {
    // 输入框清空后会有一个短暂的未完成状态，保存时再给出具体提示。
  }

  function chooseType(type: FixedRepeatRule["type"]) {
    if (type === "daily") onChange({ type: "daily" });
    if (type === "weekdays") onChange({ type: "weekdays" });
    if (type === "custom-weekdays") onChange({ type: "custom-weekdays", weekdays: [1, 3, 5] });
    if (type === "weekly-count") onChange({ type: "weekly-count", timesPerWeek: 3 });
    if (type === "interval") onChange({ type: "interval", intervalDays: 2 });
  }

  function toggleWeekday(day: number) {
    if (value.type !== "custom-weekdays") return;
    const weekdays = value.weekdays.includes(day)
      ? value.weekdays.filter((item) => item !== day)
      : [...value.weekdays, day];
    onChange({ type: "custom-weekdays", weekdays });
  }

  return (
    <fieldset className="repeat-rule-fields">
      <legend>重复规则</legend>
      <label htmlFor={`${idPrefix}-repeat-type`}>
        <span>重复方式</span>
        <select
          id={`${idPrefix}-repeat-type`}
          className="field-control"
          value={value.type}
          onChange={(event) => chooseType(event.target.value as FixedRepeatRule["type"])}
        >
          <option value="daily">每天</option>
          <option value="weekdays">仅工作日</option>
          <option value="custom-weekdays">自选星期</option>
          <option value="weekly-count">每周完成几次</option>
          <option value="interval">每隔几天一次</option>
        </select>
      </label>

      {value.type === "custom-weekdays" && (
        <div className="repeat-weekdays" role="group" aria-label="选择重复星期">
          {weekdayOptions.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={value.weekdays.includes(option.value)}
                onChange={() => toggleWeekday(option.value)}
              />
              <span>{option.label.replace("周", "")}</span>
            </label>
          ))}
        </div>
      )}

      {value.type === "weekly-count" && (
        <label htmlFor={`${idPrefix}-weekly-count`}>
          <span>每周完成次数</span>
          <input
            id={`${idPrefix}-weekly-count`}
            className="field-control"
            type="number"
            inputMode="numeric"
            min="1"
            max="7"
            value={value.timesPerWeek}
            onChange={(event) => onChange({ type: "weekly-count", timesPerWeek: Number(event.target.value) })}
          />
        </label>
      )}

      {value.type === "interval" && (
        <label htmlFor={`${idPrefix}-interval-days`}>
          <span>间隔天数</span>
          <input
            id={`${idPrefix}-interval-days`}
            className="field-control"
            type="number"
            inputMode="numeric"
            min="2"
            max="30"
            value={value.intervalDays}
            onChange={(event) => onChange({ type: "interval", intervalDays: Number(event.target.value) })}
          />
        </label>
      )}

      <p>当前：{summary}</p>
    </fieldset>
  );
}
