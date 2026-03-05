# Chrome 账号启动器

> 一款基于 [Tauri 2](https://v2.tauri.app/) 的跨平台桌面应用，用于管理和快速切换本机 Chrome 浏览器的多个登录账号。

## ✨ 功能特性

- **🔍 自动检测 Chrome** — 自动识别本机 Chrome 安装路径，支持手动选择
- **👤 账号列表** — 读取 Chrome 本地配置，自动列出所有已登录的 Google 账号
- **🚀 一键启动** — 选中账号后一键启动对应的 Chrome 配置文件（Profile），支持双击快捷启动
- **🏷️ 标签管理** — 为每个账号添加自定义标签（如"工作"、"个人"），支持快速标签选择和弹窗管理
- **🔎 搜索与筛选** — 支持按邮箱、用户名或标签进行实时搜索，支持标签下拉筛选
- **🌗 主题切换** — 内置亮色 / 暗色主题，偏好自动保存
- **📋 右键菜单** — 右键点击账号行可快速管理标签或启动 Chrome

## 📸 截图

<!-- 如果有截图可以在这里添加 -->
<!-- ![主界面](screenshots/main.png) -->

## 🖥️ 支持平台

| 平台 | 架构 | 安装包格式 |
|------|------|-----------|
| Windows | x86_64 | `.exe` (NSIS) |
| macOS | Apple Silicon (ARM64) | `.dmg` |

## 📦 安装

前往 [Releases](https://github.com/pengxiaopu/chrome-launcher/releases) 页面下载最新版本的安装包。

### Windows

1. 下载 `.exe` 安装文件
2. 双击运行安装程序
3. 按提示完成安装

### macOS

1. 下载 `.dmg` 文件
2. 双击打开，将应用拖入 `Applications` 文件夹
3. 首次打开如果提示 **"应用已损坏，无法打开"**，请打开终端执行：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Chrome Launcher.app"
```

然后重新打开应用即可。

> **为什么会出现这个提示？** 因为应用未经过 Apple 开发者签名，macOS Gatekeeper 安全机制会阻止运行。上面的命令用于移除系统的隔离标记。

## 🛠️ 从源码构建

### 前置要求

- [Node.js](https://nodejs.org/) >= 22
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/pengxiaopu/chrome-launcher.git
cd chrome-launcher

# 安装前端依赖
npm install

# 开发模式运行（热重载）
npm run tauri dev

# 构建生产版本
npm run tauri build
```

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 框架 | [Tauri 2](https://v2.tauri.app/) |
| 后端 | Rust |
| 前端 | HTML + CSS + JavaScript (Vanilla) |
| 字体 | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| CI/CD | GitHub Actions |

## 📁 项目结构

```
chrome-launcher/
├── src/                    # 前端代码
│   ├── index.html          # 主页面
│   ├── main.js             # 应用逻辑
│   └── styles.css          # 样式
├── src-tauri/              # Tauri / Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 核心逻辑（Chrome 检测、配置读取、标签管理）
│   │   └── main.rs         # 入口
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── .github/workflows/      # CI/CD
│   └── build.yml           # 自动构建 & 发布
└── package.json
```

## 📄 License

[MIT](LICENSE)
