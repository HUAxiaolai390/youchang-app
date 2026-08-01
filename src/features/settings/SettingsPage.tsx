import { useState, type ChangeEvent, type FormEvent } from "react";
import { useAppState } from "../../app/AppStateProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { toDateKey } from "../../domain/date";
import type { AppState, Category, FixedTaskTemplate } from "../../domain/types";
import { downloadBackup, parseBackup } from "../../storage/backup";

function backupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "备份文件版本不受支持") return "备份版本不受支持";
  return "备份文件格式不正确";
}

function backupSummary(state: AppState): string {
  return `将导入 ${state.scheduledTasks.length} 个临时任务、${state.fixedTasks.length} 个固定任务和 ${state.categories.length} 个分类`;
}

function categoryName(categories: Category[], categoryId: string): string {
  return categories.find((category) => category.id === categoryId)?.name ?? "其他";
}

export function SettingsPage() {
  const { state, dispatch } = useAppState();
  const [displayName, setDisplayName] = useState(state.settings.displayName);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [categoryIconInput, setCategoryIconInput] = useState("分");
  const [fixedTitle, setFixedTitle] = useState("");
  const [fixedCategoryId, setFixedCategoryId] = useState("study");
  const [editingFixedId, setEditingFixedId] = useState<string>();
  const [editingFixedTitle, setEditingFixedTitle] = useState("");
  const [editingFixedCategoryId, setEditingFixedCategoryId] = useState("study");
  const [pendingBackup, setPendingBackup] = useState<AppState>();
  const [backupError, setBackupError] = useState<string>();
  const [categoryToDelete, setCategoryToDelete] = useState<Category>();
  const [clearPhrase, setClearPhrase] = useState("");
  const [clearArmed, setClearArmed] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  function saveDisplayName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "settings/name", value: displayName.trim() });
  }

  function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dispatch({ type: "category/add", name: categoryNameInput, icon: categoryIconInput.trim() || "分" })) {
      setCategoryNameInput("");
      setCategoryIconInput("分");
    }
  }

  function addFixedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dispatch({
      type: "fixed/add",
      input: { title: fixedTitle, categoryId: fixedCategoryId, activeFrom: toDateKey(new Date()) }
    })) setFixedTitle("");
  }

  function beginEditFixedTask(task: FixedTaskTemplate) {
    setEditingFixedId(task.id);
    setEditingFixedTitle(task.title);
    setEditingFixedCategoryId(task.categoryId);
  }

  function saveFixedTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFixedId) return;
    if (dispatch({ type: "fixed/update", id: editingFixedId, input: { title: editingFixedTitle, categoryId: editingFixedCategoryId } })) {
      setEditingFixedId(undefined);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const imported = parseBackup(await file.text());
      setBackupError(undefined);
      setPendingBackup(imported);
    } catch (error) {
      setPendingBackup(undefined);
      setBackupError(backupErrorMessage(error));
    }
  }

  function confirmImport() {
    if (!pendingBackup) return;
    if (dispatch({ type: "backup/import", state: pendingBackup })) setPendingBackup(undefined);
  }

  const customCategories = state.categories.filter((category) => !category.builtIn);
  const categoryHistory = [
    ...state.scheduledTasks.map((task) => ({ id: task.id, label: "当前任务", title: task.title, categoryId: task.categoryId, originalCategory: task.categoryNameSnapshot })),
    ...state.fixedRecords.map((record) => ({ id: record.id, label: "历史任务", title: record.titleSnapshot, categoryId: record.categoryId, originalCategory: record.categoryNameSnapshot }))
  ].filter((task) => task.originalCategory !== categoryName(state.categories, task.categoryId));

  return (
    <section className="settings-page" aria-label="设置内容">
      <section className="surface-card settings-section" aria-labelledby="profile-settings-title">
        <h2 id="profile-settings-title">个人设置</h2>
        <form className="settings-form" onSubmit={saveDisplayName}>
          <label className="field-label" htmlFor="display-name">我的称呼</label>
          <input id="display-name" className="field-control" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <button className="button button--primary" type="submit">保存称呼</button>
        </form>
      </section>

      <section className="surface-card settings-section" aria-labelledby="fixed-settings-title">
        <h2 id="fixed-settings-title">固定任务管理</h2>
        <form className="settings-form" onSubmit={addFixedTask}>
          <label className="field-label" htmlFor="fixed-title">固定任务名称</label>
          <input id="fixed-title" className="field-control" value={fixedTitle} onChange={(event) => setFixedTitle(event.target.value)} />
          <label className="field-label" htmlFor="fixed-category">固定任务分类</label>
          <select id="fixed-category" className="field-control" value={fixedCategoryId} onChange={(event) => setFixedCategoryId(event.target.value)}>
            {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <button className="button" type="submit">新增固定任务</button>
        </form>
        <ul className="settings-list" aria-label="固定任务列表">
          {state.fixedTasks.length === 0 && <li className="settings-muted">还没有固定任务</li>}
          {state.fixedTasks.map((task) => (
            <li key={task.id} className="settings-list__item">
              <span><strong>{task.title}</strong><small>{categoryName(state.categories, task.categoryId)} · {task.inactiveFrom ? "已停用" : "进行中"}</small></span>
              <span className="settings-inline-actions">
                <button type="button" onClick={() => beginEditFixedTask(task)} aria-label={`编辑固定任务：${task.title}`}>编辑</button>
                <button type="button" onClick={() => dispatch({ type: "fixed/set-active", id: task.id, active: Boolean(task.inactiveFrom) })} aria-label={`${task.inactiveFrom ? "启用" : "停用"}：${task.title}`}>{task.inactiveFrom ? "启用" : "停用"}</button>
              </span>
            </li>
          ))}
        </ul>
        {editingFixedId && <form className="settings-form settings-form--edit" onSubmit={saveFixedTask} aria-label="编辑固定任务">
          <label className="field-label" htmlFor="editing-fixed-title">编辑固定任务名称</label>
          <input id="editing-fixed-title" className="field-control" value={editingFixedTitle} onChange={(event) => setEditingFixedTitle(event.target.value)} />
          <label className="field-label" htmlFor="editing-fixed-category">编辑固定任务分类</label>
          <select id="editing-fixed-category" className="field-control" value={editingFixedCategoryId} onChange={(event) => setEditingFixedCategoryId(event.target.value)}>
            {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <div className="settings-inline-actions"><button className="button" type="button" onClick={() => setEditingFixedId(undefined)}>取消编辑</button><button className="button button--primary" type="submit">保存固定任务</button></div>
        </form>}
      </section>

      <section className="surface-card settings-section" aria-labelledby="category-settings-title">
        <h2 id="category-settings-title">自定义分类</h2>
        <form className="settings-form settings-form--category" onSubmit={addCategory}>
          <label className="field-label" htmlFor="category-name">新分类名称</label>
          <input id="category-name" className="field-control" value={categoryNameInput} onChange={(event) => setCategoryNameInput(event.target.value)} />
          <label className="field-label" htmlFor="category-icon">新分类图标</label>
          <input id="category-icon" className="field-control" value={categoryIconInput} onChange={(event) => setCategoryIconInput(event.target.value)} maxLength={2} />
          <button className="button" type="submit">添加分类</button>
        </form>
        <p className="settings-muted">内置分类不能删除；删除自定义分类后，当前任务会归入“其他”。</p>
        <ul className="settings-list" aria-label="自定义分类列表">
          {customCategories.length === 0 && <li className="settings-muted">还没有自定义分类</li>}
          {customCategories.map((category) => <li key={category.id} className="settings-list__item"><span>{category.icon} {category.name}</span><button type="button" onClick={() => setCategoryToDelete(category)} aria-label={`删除分类：${category.name}`}>删除</button></li>)}
        </ul>
        {categoryHistory.length > 0 && <section className="settings-history" aria-labelledby="category-history-title">
          <h3 id="category-history-title">历史分类记录</h3>
          <ul>{categoryHistory.map((task) => <li key={task.id}>{task.label}：{task.title}（{categoryName(state.categories, task.categoryId)}）<small>原分类：{task.originalCategory}</small></li>)}</ul>
        </section>}
      </section>

      <section className="surface-card settings-section" aria-labelledby="backup-settings-title">
        <h2 id="backup-settings-title">备份与恢复</h2>
        <p className="settings-muted">导出会下载完整备份；导入会先核对内容，确认后才替换当前数据。</p>
        <div className="settings-inline-actions"><button type="button" className="button" onClick={() => downloadBackup(state)}>导出备份</button><label className="button" htmlFor="backup-file">导入备份</label><input id="backup-file" className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} /></div>
        {backupError && <p className="form-error" role="alert">{backupError}</p>}
        {pendingBackup && <div className="backup-preview" role="status"><p>{backupSummary(pendingBackup)}</p><div className="settings-inline-actions"><button className="button" type="button" onClick={() => setPendingBackup(undefined)}>取消导入</button><button className="button button--primary" type="button" onClick={confirmImport}>确认导入</button></div></div>}
      </section>

      <section className="surface-card settings-section settings-section--danger" aria-labelledby="danger-settings-title">
        <h2 id="danger-settings-title">危险操作</h2>
        <p className="settings-muted">清空会移除本机的全部任务、分类和记录，且无法撤销。</p>
        <button type="button" className="button" onClick={() => { setClearPhrase(""); setClearArmed(true); }}>清空所有数据</button>
        {clearArmed && <div className="clear-confirmation"><label className="field-label" htmlFor="clear-phrase">确认清空</label><input id="clear-phrase" className="field-control" value={clearPhrase} onChange={(event) => setClearPhrase(event.target.value)} placeholder="请输入“清空”" /><button className="button" type="button" disabled={clearPhrase !== "清空"} onClick={() => setClearDialogOpen(true)}>确认清空</button></div>}
      </section>

      <p className="settings-version">有常 0.1.0</p>

      {categoryToDelete && <ConfirmDialog title="删除自定义分类" message={`删除“${categoryToDelete.name}”后，当前任务会归入“其他”。`} confirmLabel="删除分类" onCancel={() => setCategoryToDelete(undefined)} onConfirm={() => { dispatch({ type: "category/delete", id: categoryToDelete.id }); setCategoryToDelete(undefined); }} />}
      {clearDialogOpen && <ConfirmDialog title="确认清空所有数据" message="这会清空本机所有数据，且无法恢复。" confirmLabel="我确认清空" onCancel={() => setClearDialogOpen(false)} onConfirm={() => { dispatch({ type: "data/clear" }); setClearDialogOpen(false); setClearArmed(false); setClearPhrase(""); }} />}
    </section>
  );
}
