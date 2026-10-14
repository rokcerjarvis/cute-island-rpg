# GitHub Initial Snapshot — Milestone 8.1

日期：2026-10-14。範圍僅 repository hygiene、首次 commit 與 private GitHub snapshot；不開始 Milestone 9。

## Preflight 與驗證

- 專案根目錄：此 repository 根目錄，含 package.json、src、public、tests。
- 初始 Git 狀態：master 尚無 commit；origin 未設定；遊戲與文件均為 untracked。沒有既有 history 可被改寫。
- Unit：`npm test`，9 files、425/425 PASS。
- 完整 Edge：`npm run test:e2e`，72/72 PASS，約 2.4 分鐘；包含 M6/M7/M8 v1 compatibility。
- TypeScript：`npm run build` 內執行 `tsc --noEmit`，0 errors。
- Build：52 modules，成功；JS 1,294.02 kB / gzip 349.67 kB。既有 Phaser chunk 大於 500 kB 警告仍存在。
- Save：schemaVersion 1；save key、internal IDs、scene/asset keys 保持，沒有修改 gameplay、balance、species 或儲存程式。僅移除七個既有檔案末尾的空白行，以通過 Git whitespace check；不改程式內容。

## Hygiene 與安全

- .gitignore 排除 node_modules、dist、coverage、.env/.env.*、logs、OS 檔案、暫存、個人 IDE 設定、cache、browser profile/auth、debug dumps、save exports、credentials/key files。
- 本機沒有 .vscode；其個人設定預設排除。source、public assets、fixtures、再生腳本、package-lock、config 與全部 Milestone reports 保留。
- artifacts 僅保留三張文件展示圖、平衡統計與人工 Boss 指令紀錄；完整 browser runtime dump 與其他 QA screenshots 排除。清單見 artifacts/README.md。
- 候選文字檔掃描 api_key/apikey/token/secret/password/bearer/authorization/private key/BEGIN PRIVATE KEY/client_secret/access_token，以及常見 GitHub/AWS credential patterns。沒有實際 secret；`private key()` 為 TypeScript texture 查找方法，非私鑰。
- 沒有 .env、credential/key 檔、個人 browser/localStorage export。tests/fixtures 的存檔為合成測試資料。原 M8 report 的本機絕對路徑改成 repository 相對描述；候選文件沒有個人 filesystem paths。
- README 已具簡介、Prototype 狀態、TypeScript + Phaser、npm install/dev/test/build、操作、Save、限制，以及私人／非商業第三方 placeholder 聲明。沒有新增 LICENSE 或宣稱第三方 IP ownership。

## Git 與 GitHub 狀態

- Repo name：`rokcerjarvis/cute-island-rpg`，https://github.com/rokcerjarvis/cute-island-rpg 。已確認 owner 為目前登入的個人帳號（User），不是 organization。
- Repo visibility：PRIVATE，已由 GitHub API 與 `gh repo view` 確認。
- Current branch：master。
- Commit author：RockerJarvis（使用者指定；僅設定此 repository）。
- Remote URL：`https://github.com/rokcerjarvis/cute-island-rpg.git`（origin fetch/push）。
- 遊戲 baseline commit：`738a4f1832aa8857cfd84fffec849ef81614d12c`，`Milestone 8.1 - overworld party management and creature status`，135 files。
- 首次 push 時 Local HEAD：`e5685babf8897398b807b6d595eef179a664a434`。
- 首次 push 時 Pushed HEAD：`e5685babf8897398b807b6d595eef179a664a434`，GitHub API 驗證一致。
- GitHub CLI：2.102.0；使用者完成登入後，已確認 active personal account `rokcerjarvis`。憑證由 keyring 管理，不進 repository。
- Push result：PASS — `git push -u origin master` 成功，tracking origin/master；default branch 為 master。
- Working tree clean：首次 push 後已確認 clean；此成功報告以普通 docs commit 追加並 push，最終 HEAD 於交付訊息列出（文件無法包含自身 commit hash）。
- GitHub/local HEAD match：首次 push 一致；報告 commit push 後以 `git rev-parse HEAD`、`git ls-remote origin refs/heads/master` 與 GitHub API 再確認。
- GitHub 檔案確認：src、tests、e2e、public/assets、scripts、README、package.json/package-lock、M7/M8/M8.1 reports、BATTLE_BALANCE_REPORT、ASSET_GUIDE/UI_GUIDE 均存在；沒有 node_modules/dist。

首次 snapshot 使用非破壞性普通 commit/push。沒有 force、history rewrite、tag、Release、Pages 或部署。

## 下一步

完成 private repository first push 後，下一個建議工作為 Milestone 9：先由使用者指定範圍，再延續 M8.1 baseline；本次不實作。
