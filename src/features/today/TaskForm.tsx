import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RepeatRuleFields } from "../../components/RepeatRuleFields";
import { maximumEstimatedMinutes, normalizeEstimatedMinutes, normalizePlannedStartTime } from "../../domain/planning";
import { normalizeFixedRepeatRule } from "../../domain/repeat";
import { normalizeReminderMinutesBefore, reminderMinuteOptions } from "../../domain/reminders";
import type { Category, DateKey, FixedRepeatRule, ReminderMinutesBefore, TimeKey } from "../../domain/types";

export type TaskFormValues = {
  title: string;
  kind: "fixed" | "scheduled";
  categoryId: string;
  date: DateKey;
  plannedStartTime?: TimeKey;
  reminderMinutesBefore?: ReminderMinutesBefore;
  estimatedMinutes?: number;
  repeatRule?: FixedRepeatRule;
};

type TaskFormDraft = Omit<TaskFormValues, "plannedStartTime" | "reminderMinutesBefore" | "estimatedMinutes"> & {
  plannedStartTime: string;
  reminderMinutesBefore: string;
  estimatedMinutes: string;
  repeatRule: FixedRepeatRule;
};

type TaskFormProps = {
  categories: Category[];
  today: DateKey;
  defaultDate?: DateKey;
  initialValues?: TaskFormValues;
  error?: string;
  onSubmit(values: TaskFormValues): void;
  onCancel(): void;
};

function FormSurface({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canUseNativeDialog = typeof HTMLDialogElement !== "undefined" && "showModal" in HTMLDialogElement.prototype;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (canUseNativeDialog && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (canUseNativeDialog && dialog?.open) dialog.close();
    };
  }, [canUseNativeDialog]);

  if (!canUseNativeDialog) {
    return <section className="task-form-panel" role="dialog" aria-modal="true" aria-labelledby="task-form-title">{children}</section>;
  }

  return <dialog ref={dialogRef} className="task-form-panel" aria-labelledby="task-form-title">{children}</dialog>;
}

export function TaskForm({ categories, today, defaultDate, initialValues, error, onSubmit, onCancel }: TaskFormProps) {
  const [values, setValues] = useState<TaskFormDraft>(() => ({
    title: initialValues?.title ?? "",
    kind: initialValues?.kind ?? "scheduled",
    categoryId: initialValues?.categoryId ?? "study",
    date: initialValues?.date ?? defaultDate ?? today,
    plannedStartTime: initialValues?.plannedStartTime ?? "",
    reminderMinutesBefore: initialValues?.reminderMinutesBefore?.toString() ?? "",
    estimatedMinutes: initialValues?.estimatedMinutes?.toString() ?? "",
    repeatRule: initialValues?.repeatRule ?? { type: "daily" }
  }));
  const [formError, setFormError] = useState<string>();
  const isEditing = Boolean(initialValues);
  const displayedError = formError ?? error;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!values.title.trim()) {
      setFormError("请输入任务名称");
      return;
    }
    if (!categories.some((category) => category.id === values.categoryId)) {
      setFormError("请选择有效分类");
      return;
    }
    try {
      const estimatedValue = values.estimatedMinutes.trim();
      const plannedStartTime = normalizePlannedStartTime(values.plannedStartTime);
      if (!plannedStartTime && values.reminderMinutesBefore !== "") {
        setFormError("设置提醒前，请先填写开始时间");
        return;
      }
      onSubmit({
        title: values.title.trim(),
        kind: values.kind,
        categoryId: values.categoryId,
        date: values.date,
        plannedStartTime,
        reminderMinutesBefore: plannedStartTime
          ? normalizeReminderMinutesBefore(values.reminderMinutesBefore)
          : undefined,
        estimatedMinutes: normalizeEstimatedMinutes(estimatedValue === "" ? undefined : Number(estimatedValue)),
        repeatRule: values.kind === "fixed" ? normalizeFixedRepeatRule(values.repeatRule) : undefined
      });
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "请检查计划时间");
    }
  }

  return (
    <FormSurface>
      <form className="task-form" onSubmit={submit} noValidate>
        <div className="task-form__heading">
          <h2 id="task-form-title">{isEditing ? "编辑任务" : "添加任务"}</h2>
          <button type="button" className="task-form__close" aria-label="关闭表单" onClick={onCancel}>×</button>
        </div>
        <label className="field-label" htmlFor="task-title">任务名称</label>
        <input
          id="task-title"
          className="field-control"
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          aria-describedby={displayedError ? "task-form-error" : undefined}
          autoFocus
        />
        <fieldset className="choice-group">
          <legend>计划方式</legend>
          <label><input type="radio" name="task-kind" checked={values.kind === "fixed"} disabled={isEditing} onChange={() => setValues((current) => ({ ...current, kind: "fixed" }))} /> 固定任务</label>
          <label><input type="radio" name="task-kind" checked={values.kind === "scheduled"} disabled={isEditing} onChange={() => setValues((current) => ({ ...current, kind: "scheduled" }))} /> 临时任务</label>
          {isEditing && <p className="task-form__kind-note">编辑时不能更改计划方式。</p>}
        </fieldset>
        <fieldset className="choice-group">
          <legend>任务分类</legend>
          <div className="category-options">
            {categories.map((category) => (
              <label key={category.id} className="category-option">
                <input type="radio" name="task-category" checked={values.categoryId === category.id} onChange={() => setValues((current) => ({ ...current, categoryId: category.id }))} />
                <span aria-hidden="true">{category.icon}</span>{category.name}
              </label>
            ))}
          </div>
        </fieldset>
        {values.kind === "scheduled" && <>
          <label className="field-label" htmlFor="task-date">执行日期</label>
          <input id="task-date" className="field-control" type="date" value={values.date} onChange={(event) => setValues((current) => ({ ...current, date: event.target.value as DateKey }))} />
        </>}
        {values.kind === "fixed" && (
          <RepeatRuleFields
            idPrefix="task"
            value={values.repeatRule}
            onChange={(repeatRule) => setValues((current) => ({ ...current, repeatRule }))}
          />
        )}
        <div className="task-form__planning">
          <label htmlFor="task-start-time">
            <span>开始时间（选填）</span>
            <input
              id="task-start-time"
              className="field-control"
              type="time"
              value={values.plannedStartTime}
              onChange={(event) => setValues((current) => ({ ...current, plannedStartTime: event.target.value }))}
            />
          </label>
          <label htmlFor="task-estimated-minutes">
            <span>预计用时（分钟，选填）</span>
            <input
              id="task-estimated-minutes"
              className="field-control"
              type="number"
              inputMode="numeric"
              min="1"
              max={maximumEstimatedMinutes}
              placeholder="例如 30"
              value={values.estimatedMinutes}
              onChange={(event) => setValues((current) => ({ ...current, estimatedMinutes: event.target.value }))}
            />
          </label>
          <label className="task-form__reminder" htmlFor="task-reminder">
            <span>任务提醒</span>
            <select
              id="task-reminder"
              className="field-control"
              value={values.reminderMinutesBefore}
              onChange={(event) => setValues((current) => ({ ...current, reminderMinutesBefore: event.target.value }))}
            >
              <option value="">不提醒</option>
              {reminderMinuteOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <p className="task-form__planning-note">填写开始时间后，可以选择准时或提前提醒；不确定时也可以之后再补上。</p>
        {displayedError && <p id="task-form-error" role="alert" className="form-error">{displayedError}</p>}
        <div className="task-form__actions">
          <button type="button" className="button" onClick={onCancel}>取消</button>
          <button type="submit" className="button button--primary">{isEditing ? "保存修改" : "保存任务"}</button>
        </div>
      </form>
    </FormSurface>
  );
}
