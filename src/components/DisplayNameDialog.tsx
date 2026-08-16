import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type DisplayNameDialogProps = {
  currentName: string;
  onSave(value: string): void;
  onCancel(): void;
};

export function DisplayNameDialog({ currentName, onSave, onCancel }: DisplayNameDialogProps) {
  const [name, setName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    inputRef.current?.select();

    return () => {
      if (previouslyFocusedRef.current?.isConnected) previouslyFocusedRef.current.focus();
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(name.trim());
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onCancel();
  }

  return (
    <div className="confirm-backdrop">
      <form
        className="confirm-dialog display-name-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="display-name-dialog-title"
        onSubmit={submit}
        onKeyDown={handleKeyDown}
      >
        <h2 id="display-name-dialog-title">修改我的称呼</h2>
        <p>小猫会在首页用这个名字和你打招呼。</p>
        <label className="display-name-dialog__field">
          <span>我的称呼</span>
          <input
            ref={inputRef}
            value={name}
            maxLength={30}
            placeholder="例如：小来"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="confirm-dialog__actions">
          <button type="button" className="button" onClick={onCancel}>取消</button>
          <button type="submit" className="button button--primary">保存称呼</button>
        </div>
      </form>
    </div>
  );
}
