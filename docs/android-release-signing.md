# 安卓正式签名包

正式签名密钥保存在项目根目录的 `signing/` 文件夹中，该目录已加入 `.gitignore`，不会上传到 GitHub。

构建正式 APK：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-android-release.ps1
```

脚本会读取 `signing/youchang-release.jks` 和 `signing/release-password.txt`，并生成：

```text
outputs/youchang-v2.9.5-android-release.apk
```

请把整个 `signing/` 文件夹单独备份到安全位置。以后所有更新都必须继续使用同一份密钥，否则 Android 会把更新识别为不同应用，无法覆盖安装。不要把密钥、密码或未签名的备份上传到公开仓库。
