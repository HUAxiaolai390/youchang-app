import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Category, DateKey } from "../../domain/types";

export type TaskFormValues = {
  title: string;
  kind: "fixed" | "scheduled";
  categoryId: string;
  date: DateKey;
};

type TaskFormProps = {
  categories: Category[];
  today: DateKey;
  initialValues?: TaskFormValues;
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

export function TaskForm({ categories, today, initialValues, onSubmit, onCancel }: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>(initialValues ?? {
    title: "",
    kind: "scheduled",
    categoryId: "study",
    date: today
  });
  const [formError, setFormError] = useState<string>();
  const isEditing = Boolean(initialValues);

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
    onSubmit({ ...values, title: values.title.trim() });
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
          aria-describedby={formError ? "task-form-error" : undefined}
          autoFocus
        />
        <fieldset className="choice-group">
          <legend>计划方式</legend>
          <label><input type="radio" name="task-kind" checked={values.kind === "fixed"} onChange={() => setValues((current) => ({ ...current, kind: "fixed" }))} /> 每日固定</label>
          <label><input type="radio" name="task-kind" checked={values.kind === "scheduled"} onChange={() => setValues((current) => ({ ...current, kind: "scheduled" }))} /> 临时任务</label>
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
        {formError && <p id="task-form-error" role="alert" className="form-error">{formError}</p>}
        <div className="task-form__actions">
          <button type="button" className="button" onClick={onCancel}>取消</button>
          <button type="submit" className="button button--primary">{isEditing ? "保存修改" : "保存任务"}</button>
        </div>
      </form>
    </FormSurface>
  );
}
