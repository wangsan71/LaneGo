# LaneGo - 車道導航顯示

實時顯示當前道路所有車道方向的行車輔助工具。開啟網頁即顯示腳下道路每條車道的行駛方向（直走 / 左轉 / 右轉），無需輸入目的地。

基於 OpenStreetMap 路網資料，配合瀏覽器 GPS 定位和方向感應器，自動匹配最近道路段並顯示該段車道指引。

## 技術棧

- **前端**：MapLibre GL 地圖 + 原生 JS
- **後端**：Node.js 靜態 HTTPS 伺服器
- **資料**：OpenStreetMap PBF → `build_roads.js` → `macau_roads.json`
  - 從 OSM 提取道路幾何 + 交叉路口車向推斷 + 手動修正合併
- **圖標**：11 個自訂 SVG 車道方向圖標

## 快速開始

```bash
npm install
node generate-cert.js   # 生成自簽 SSL 證書（GPS 需要 HTTPS）
npm run build           # 從 OSM 資料生成 macau_roads.json（含車向推斷）
node server.js          # 啟動伺服器
```

## 由於目前只有澳門道路的資料，所以用macau_reads.json來説明
## macau_roads.json 格式說明

JSON 陣列，每個元素是一條道路段。

### 欄位說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | string | ✓ | 唯一識別，如 `"road_1"` |
| `name` | string | ✓ | 道路名稱，會顯示在 App 頂部卡片 |
| `path` | [lat, lng][] | ✓ | GPS 座標陣列，至少 2 個點，建議每相鄰兩點為一段 |
| `lanesForward` | Lane[] | ✓ | 順向車道配置 |
| `lanesBackward` | Lane[] | ✓ | 反向車道配置 |

### Lane 物件

| 欄位 | 類型 | 說明 |
|------|------|------|
| `icon` | string | SVG 圖標檔案名稱（不含 `.svg`），見下方圖標表 |
| `label` | string | 中文標籤，顯示在圖標下方 |

### 可用圖標

| icon | 含義 |
|------|------|
| `straight` | 直走 ⬆ |
| `left` | 左轉 ⬅ |
| `right` | 右轉 ➡ |
| `slight_left` | 左前方 ↖ |
| `slight_right` | 右前方 ↗ |
| `straight_left` | 直走 / 左轉 ↑↰ |
| `straight_right` | 直走 / 右轉 ↑↱ |
| `left_right` | 左轉 / 右轉 ↰↱ |
| `u_turn` | 調頭 ↩ |
| `merge_left` | 靠左 |
| `merge_right` | 靠右 |

### 完整範例

詳見 `road-format-example.json`。

### 車道順序與切分建議

- `lanesForward` / `lanesBackward` 陣列從左到右對應螢幕顯示從左到右（第 1 車道在最左）
- 每條道路段建議 `path` 只有 **2 個點**（相鄰 GPS 點），車道方向跟隨 GPS 位置精確切換
- 同一路名不同路口段可以有不同車道配置，系統根據 GPS 最近點自動匹配

## 從 OpenStreetMap 生成資料

### 完整流程

1. 下載 OSM PBF 檔案（如 [GeoFabrik](https://download.geofabrik.de/asia/china.html)）
2. 使用 `pbf_to_json.js`（需安裝 `osm-pbf-parser`）將 PBF 轉為 JSON → `macau_osm_fr.json`
3. 執行 `npm run build` 生成 `macau_roads.json`

### build_roads.js 處理流程

```
macau_osm_fr.json
    │
    ├─ 1. 提取道路幾何（OSM ways → 座標 + 元資料）
    │     - 按 highway 類型過濾
    │     - 按路名黑白名單過濾
    │     - 解析 OSM turn:lanes 標籤（如有）
    │     - 按 50m 間隔切分路段
    │
    ├─ 2. 交叉路口車向推斷（無 OSM turn 資料的路段）
    │     - 在每個路段端點尋找 15m 內的交叉道路
    │     - 按方位角分類：左轉 (< -15°)、直行、右轉 (> 15°)
    │     - 分配車道方向：左車道 → straight_left，右車道 → straight_right
    │
    ├─ 3. 合併相鄰相同配置的路段
    │
    └─ 4. 套用 lane_overrides.json 手動修正
         ↓
    macau_roads.json
```

### 手動修正 lane_overrides.json

當交叉路口推斷有誤時，可在 `lane_overrides.json` 中手動指定特定 GPS 位置的正確車向：

```json
[
  {
    "comment": "路口名稱或說明",
    "lat": 22.20500,
    "lng": 113.54150,
    "lanesForward": [
      { "icon": "straight_left", "label": "直走 / 左轉" },
      { "icon": "straight_right", "label": "直走 / 右轉" }
    ],
    "lanesBackward": []
  }
]
```

系統會找到距離指定座標 30m 內的最近路段並覆蓋其車向配置。執行 `npm run build` 後生效。

### 自訂參數

`build_roads.js` 支援自訂：
- `includeHighways` — 道路類型白名單
- `excludeNames` — 路名黑名單
- `INTERSECTION_RADIUS`（預設 15m）— 交叉路口搜尋半徑
- `ANGLE_LEFT` / `ANGLE_RIGHT`（預設 ±15°）— 轉向角度閾值
