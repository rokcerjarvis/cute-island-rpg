# 文件證據

首次 GitHub snapshot 僅保留以下文件所需證據：

- `milestone-7-showcase.png`：Milestone 7 像素畫面展示。
- `milestone-8-1-party.png`：Milestone 8.1 隊伍管理畫面。
- `milestone-8-1-status.png`：Milestone 8.1 生物狀態畫面。
- `milestone-8-balance.json`：BATTLE_BALANCE_REPORT.md 的合成平衡統計，可由 `npm run simulate:balance` 重建。
- `milestone-8-unforced-boss-manual.json`：Milestone 8 人工 Boss QA 的指令與觀察紀錄，沒有存檔或 browser profile。

其餘歷史 QA 圖片與完整 runtime debug dumps 仍可留在本機，但由 .gitignore 排除。里程碑文件保留當時證據路徑；那些本機檔案不一定存在於新 clone。
