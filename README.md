# LaneGo

LaneGo 是一個專注於「車道級導航」的輕量網頁應用，目前以澳門道路為初始資料，未來目標是支援全球各地的車道導航。

## 線上即點即用

👉 **https://你的帳號.github.io/LaneGo/**

> 請將 `你的帳號` 換成你的 GitHub 使用者名稱，並在 GitHub Repo 的 **Settings → Pages** 啟用 GitHub Pages（Source 選擇 `GitHub Actions`）。

## 主要功能

- 依據 GPS 位置自動判斷最近道路與行車方向
- 即時顯示目前車道可執行的轉向（左轉、右轉、直走等）
- 裝置方向感應 / 指南針輔助
- 地圖標誌過濾：保留醫療、停車場、加油站等駕駛相關 POI，隱藏商店與巴士站
- 響應式排版，適合手機直向與橫向使用

## 本地開發

本專案前端為純靜態網頁，後端僅提供一個簡易 HTTPS 伺服器方便手機測試定位。

```bash
npm install
node generate-cert.js   # 產生 localhost HTTPS 憑證
node server.js          # 啟動 https://127.0.0.1:8443
```

若只需要靜態預覽，也可以直接用任何靜態伺服器掛載根目錄，例如：

```bash
npx serve .
```

## 資料來源

- 地圖底圖：[OpenFreeMap](https://openfreemap.org/)
- 向量圖磚 schema：[OpenMapTiles](https://openmaptiles.org/)
- 道路資料：OpenStreetMap

## License

本專案採用 [MIT License](LICENSE)。

> 請將 `LICENSE` 檔案裡的 `[你的姓名]` 換成你的名字。
