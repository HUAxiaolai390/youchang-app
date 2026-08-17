import { useEffect, useRef, type ReactNode } from "react";

type HelpCenterDialogProps = {
  onClose(): void;
};

function HelpContent({ onClose }: HelpCenterDialogProps) {
  return <>
    <header className="help-center__header">
      <div>
        <p>QUICK HELP</p>
        <h2 id="help-center-title">使用说明与帮助中心</h2>
        <span>先解决常见问题；以后再单独制作完整使用手册。</span>
      </div>
      <button type="button" onClick={onClose} aria-label="关闭帮助中心">×</button>
    </header>

    <section className="help-center__start" aria-labelledby="help-center-start-title">
      <span aria-hidden="true">1</span>
      <div>
        <h3 id="help-center-start-title">第一次使用，从“今日”开始</h3>
        <p>添加一项任务，完成后点左侧圆圈；需要修改日期、提醒或步骤时，点任务右侧的“编辑”。</p>
      </div>
    </section>

    <div className="help-center__topics">
      <details open>
        <summary>固定任务和当天任务有什么区别？</summary>
        <div>
          <p><strong>固定任务</strong>适合英语单词、锻炼等重复习惯，可以设置每天、工作日、自选星期、每周次数或间隔天数。</p>
          <p><strong>当天任务</strong>只安排在某一天；没完成时可以编辑并改到有空的日期。</p>
        </div>
      </details>

      <details>
        <summary>高中低优先级怎么选？</summary>
        <div className="help-priority-list">
          <p><span className="task-priority-tag task-priority-tag--high">高</span><strong>紧急且重要</strong>：优先处理，例如临近截止的重要任务。</p>
          <p><span className="task-priority-tag task-priority-tag--medium">中</span><strong>紧急或重要</strong>：需要安排，但不一定马上完成。</p>
          <p><span className="task-priority-tag task-priority-tag--low">低</span><strong>不紧急且影响较小</strong>：有空时完成，可以灵活改期。</p>
        </div>
      </details>

      <details>
        <summary>怎样设置任务提醒？</summary>
        <div>
          <p>新增或编辑任务时先填写开始时间，再选择准时提醒或提前提醒。</p>
          <p>安卓手机还需要在“设置 → 通知权限”中开启系统通知；若熄屏后提醒延迟，可把有常的电池使用设为不限制。</p>
        </div>
      </details>

      <details>
        <summary>倒计时、正计时和实际用时</summary>
        <div>
          <p>倒计时适合番茄钟，结束后会提醒休息；正计时适合不知道要做多久的任务。</p>
          <p>结束计时后可以把时间记到任务；也可以直接点任务旁的“用时”，补填实际花费的分钟数。</p>
        </div>
      </details>

      <details>
        <summary>计划、改期和补记完成</summary>
        <div>
          <p>“计划”页可以按周或按月查看任务。当天没做完的临时任务可以“改到”其他日期。</p>
          <p>忘记点完成时，进入原日期后仍可补记完成；完成记录会计入成长统计。</p>
        </div>
      </details>

      <details>
        <summary>成长、勋章和长期目标</summary>
        <div>
          <p>“成长”页汇总完成率、坚持热力图、实际用时、专注记录和每周复盘。</p>
          <p>在“成长”页顶部点“管理长期目标”可以新增、编辑或删除目标，任务创建后也可以关联目标。</p>
          <p>解锁的勋章最多选择三枚展示在今日首页。</p>
        </div>
      </details>

      <details>
        <summary>数据保存在哪里？怎样备份？</summary>
        <div>
          <p>数据保存在当前电脑浏览器或手机应用中，不会自动上传，也不会自动在设备之间同步。</p>
          <p>换设备、重装或清理数据前，请先在“设置 → 备份与恢复”中导出备份；导入时先核对摘要再确认。</p>
        </div>
      </details>
    </div>

    <footer className="help-center__footer">
      <p>没有找到答案时，可以先记下来，后续统一补进完整使用手册。</p>
      <button type="button" className="button button--primary" onClick={onClose}>知道了</button>
    </footer>
  </>;
}

function HelpFallback({ children }: { children: ReactNode }) {
  return <div className="help-center-backdrop"><section className="help-center-dialog" role="dialog" aria-modal="true" aria-labelledby="help-center-title">{children}</section></div>;
}

export function HelpCenterDialog({ onClose }: HelpCenterDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canUseNativeDialog = typeof HTMLDialogElement !== "undefined" && "showModal" in HTMLDialogElement.prototype;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (canUseNativeDialog && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (canUseNativeDialog && dialog?.open) dialog.close();
    };
  }, [canUseNativeDialog]);

  const content = <HelpContent onClose={onClose} />;
  if (!canUseNativeDialog) return <HelpFallback>{content}</HelpFallback>;

  return <dialog ref={dialogRef} className="help-center-dialog" aria-labelledby="help-center-title" onCancel={onClose}>{content}</dialog>;
}
