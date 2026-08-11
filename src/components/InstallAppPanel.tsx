import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useInstallPrompt } from "./InstallPromptProvider";

function isAppleMobile(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallAppPanel() {
  const { available, installed, requestInstall } = useInstallPrompt();
  const [message, setMessage] = useState<string>();
  const nativeApp = Capacitor.isNativePlatform();
  const isInstalled = installed || nativeApp;
  const appleMobile = isAppleMobile();
  const secureContext = window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);

  async function install() {
    const choice = await requestInstall();
    if (!choice) return;
    setMessage(choice.outcome === "accepted" ? "正在完成安装" : "已取消安装，之后仍可再次安装");
  }

  return (
    <section className="surface-card settings-section install-app-panel" aria-labelledby="install-app-title">
      <div className="settings-section__heading">
        <div>
          <p className="install-app-panel__eyebrow">INSTALL YOUCHANG</p>
          <h2 id="install-app-title">安装到手机</h2>
          <p className="settings-muted">安装后会像普通 App 一样出现在手机桌面，并可在断网时打开。</p>
        </div>
        <span className={`notification-status notification-status--${isInstalled ? "on" : "off"}`}>
          {isInstalled ? "已安装" : "未安装"}
        </span>
      </div>

      {isInstalled ? (
        <div className="install-app-panel__ready">
          <span aria-hidden="true">✓</span>
          <div><strong>有常已经在这台设备上安装</strong><small>{nativeApp ? "这是独立安卓版本，不需要浏览器或 ChatGPT 账号。" : "以后可以直接从桌面图标打开。"}</small></div>
        </div>
      ) : available ? (
        <button type="button" className="button button--primary" onClick={install}>安装有常</button>
      ) : appleMobile ? (
        <ol className="install-app-panel__steps">
          <li><span>1</span><div><strong>使用 Safari 打开有常</strong><small>其他浏览器通常不会显示 iPhone 的桌面安装入口。</small></div></li>
          <li><span>2</span><div><strong>点击 Safari 的“分享”按钮</strong><small>它通常位于屏幕底部，是带向上箭头的方框。</small></div></li>
          <li><span>3</span><div><strong>选择“添加到主屏幕”</strong><small>确认名称后点击右上角“添加”。</small></div></li>
        </ol>
      ) : secureContext ? (
        <div className="install-app-panel__guide">
          <strong>请打开浏览器菜单，选择“安装应用”或“添加到主屏幕”</strong>
          <p>如果暂时没有这个选项，可以刷新页面或稍后再试。</p>
        </div>
      ) : (
        <div className="install-app-panel__guide install-app-panel__guide--warning">
          <strong>手机安装需要安全链接</strong>
          <p>当前地址只适合电脑本地使用。生成手机可访问的 HTTPS 链接后，安装按钮才会出现。</p>
        </div>
      )}

      {message && <p className="install-app-panel__message" role="status">{message}</p>}
      <p className="settings-muted">注意：任务数据仍保存在安装它的这台设备中。电脑和手机暂时不会自动同步。</p>
    </section>
  );
}
