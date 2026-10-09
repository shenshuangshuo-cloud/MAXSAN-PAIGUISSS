---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 321d63d690f3c9be8738872bda43d61f_d1b5251dc2ef11f1884b525400cd780f
    ReservedCode1: A3Gg/4vKR1mebTz6mRh9heiCeA5yYe4T6j2BHhLNBymXv+8STAyiROTGFf5xwaNHCezZqxEdyq9aoeMa7tVaDAvObvSjxGbO00r8xx/rDWuy9dxTnb6rOZ2KH8nQcTbS2fybz2JR9or+9/zpGeMTRxpMXI4vVz/CTRHKcLGFq06DyK3ZiMBOndWOBvw=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 321d63d690f3c9be8738872bda43d61f_d1b5251dc2ef11f1884b525400cd780f
    ReservedCode2: A3Gg/4vKR1mebTz6mRh9heiCeA5yYe4T6j2BHhLNBymXv+8STAyiROTGFf5xwaNHCezZqxEdyq9aoeMa7tVaDAvObvSjxGbO00r8xx/rDWuy9dxTnb6rOZ2KH8nQcTbS2fybz2JR9or+9/zpGeMTRxpMXI4vVz/CTRHKcLGFq06DyK3ZiMBOndWOBvw=
---

# 排柜工具 · 云端同步版

多人共用一套物料资料库的在线排柜工具。任何人对资料库的修改，其他人打开或在线时都会自动同步看到。

## 项目结构

```
paigui-sync/
├── main.py            # 后端服务（FastAPI + PostgreSQL + SSE 实时推送）
├── requirements.txt   # 依赖清单
├── render.yaml        # Render 一键部署配置（可选）
└── public/
    └── index.html     # 前端排柜工具（已含云端同步逻辑）
```

## 本地运行（可选）

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

浏览器打开 `http://localhost:8000` 即可。未配置数据库时自动使用本地 SQLite。

## 部署到 Render（一次性，约 10 分钟）

### 第 1 步：把代码推送到 GitHub

1. 在 GitHub 网页新建一个仓库（Public 或 Private 都可以），名字随意，例如 `paigui-sync`，**不要勾选**任何初始化选项。
2. 在电脑上把本文件夹提交并推送到该仓库（命令见下，把 `你的用户名` 和 `paigui-sync` 换成实际值）：

```bash
cd paigui-sync
git init
git add .
git commit -m "排柜工具云端同步版"
git branch -M main
git remote add origin https://github.com/你的用户名/paigui-sync.git
git push -u origin main
```

> 若电脑上未安装 git，可在 https://git-scm.com 下载安装；首次 push 会要求登录 GitHub 账号授权。

### 第 2 步：创建数据库（PostgreSQL）

1. 打开 Render 控制台（https://dashboard.render.com）。
2. 点击 **New +** → **PostgreSQL**。
3. 名称随意，例如 `paigui-db`；Region 选离自己近的（如 Singapore）；实例类型选免费或最低规格即可。
4. 点击 **Create Database**，等待创建完成。
5. 进入数据库详情页，找到 **Internal Database URL**（形如 `postgres://...`），**复制**它。

### 第 3 步：创建 Web Service

1. Render 控制台点击 **New +** → **Web Service**。
2. 选择 **Connect 你刚建的 GitHub 仓库**（首次会引导授权 GitHub）。
3. 填表：
   - Name：`paigui-sync`
   - Region：与数据库同区域
   - Branch：`main`
   - Runtime：`Python 3`
   - Build Command：`pip install -r requirements.txt`
   - Start Command：`uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Instance Type：Free 或最低规格
4. 展开 **Advanced** → **Environment Variables**，添加：
   - Key：`DATABASE_URL`
   - Value：粘贴第 2 步复制的 **Internal Database URL**
5. 点击 **Create Web Service**，等 3~5 分钟部署完成。
6. 打开页面顶部的 `https://paigui-sync.onrender.com` 即可使用。

## 日常使用

- 把部署后的网址（如 `https://paigui-sync.onrender.com`）发给同事，大家打开都是同一套资料库。
- 修改资料库后会自动上传云端，其他人约 1 秒内看到更新（右下角状态标：绿色=已同步，蓝色=同步中，红色=同步失败）。
- 订单录入、转换系数仍保存在各自电脑浏览器本地，互不干扰。

## 免费层注意事项

- Render 免费实例闲置 15 分钟会休眠，再次访问时首次加载约 30 秒（冷启动），之后正常。
- 免费实例每月有一定免费时长，用量小可长期零成本使用。
- 数据库建议选免费额度实例（如 Neon 免费版 0.5GB 足够放整套资料库）；若用 Render 自带 PostgreSQL，请选免费/最低规格。
*（内容由AI生成，仅供参考）*
