import { useState, type FormEvent } from "react";
import { maximumActualMinutes } from "../domain/time";

type TimeEntryDialogProps = {
  taskTitle: string;
  currentMinutes?: number;
  onSave(minutes: number): void;
  onCancel(): void;
};

export function TimeEntryDialog({ taskTitle, currentMinutes, onSave, onCancel }: TimeEntryDialogProps) {
  const [minutes, setMinutes] = useState(String(currentMinutes ?? 0));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(Number(minutes));
  }

  return (
    <div className="confirm-backdrop">
      <form className="confirm-dialog time-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="time-entry-title" onSubmit={submit}>
        <h2 id="time-entry-title">记录实际用时</h2>
        <p>“{taskTitle}”实际花了多长时间？之后也可以随时修改。</p>
        <label className="time-entry-dialog__field">
          <span>实际用时（分钟）</span>
          <input
            type="number"
            aria-label="实际用时（分钟）"
            min="0"
            max={maximumActualMinutes}
            step="1"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
          <small>填写 0 可以清除这条用时记录</small>
        </label>
        <div className="confirm-dialog__actions">
          <button type="button" className="button" onClick={onCancel}>取消</button>
          <button type="submit" className="button button--primary">保存用时</button>
        </div>
      </form>
    </div>
  );
}
