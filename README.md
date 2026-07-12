# LaneGo — 車道導航顯示

即時顯示當前道路所有車道方向的行車輔助工具。開啟網頁即顯示腳下道路每條車道的行駛方向（直走 / 左轉 / 右轉），無需輸入目的地。

基於 OpenStreetMap 路網資料，配合瀏覽器 GPS 定位和方向感應器，自動匹配最近道路段並顯示該段車道指引。

---

## 目錄

- [快速開始](#快速開始)
- [專案結構](#專案結構)
- [OSM 資料處理管線](#osm-資料處理管線)
- [使用方法](#使用方法)
  - [方法一：一鍵管線（推薦）](#方法一一鍵管線推薦)
  - [方法二：逐步手動執行](#方法二逐步手動執行)
  - [方法三：NPM Scripts](#方法三npm-scripts)
- [加入新城市](#加入新城市)
- [程式說明](#程式說明)
  - [pbf_to_json.js — PBF 轉 JSON](#pbf_to_jsonjs--pbf-轉-json)
  - [build_roads.js — 自動切分 OSM 道路](#build_roadsjs--自動切分-osm-道路)
  - [osm_pipeline.js — 統一管線](#osm_pipelinejs--統一管線)
  - [data_editor.js — 資料編輯器](#data_editorjs--資料編輯器)
  - [apply_overrides.js — 套用手動修正](#apply_overridesjs--套用手動修正)
- [自動切分演算法詳解](#自動切分演算法詳解)
- [資料格式說明](#資料格式說明)
- [手動修正車道資料](#手動修正車道資料)
- [啟動伺服器](#啟動伺服器)
- [疑難排解](#疑難排解)
- [技術棧](#技術棧)

---

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 生成 SSL 證書（GPS 定位需要 HTTPS）
node generate-cert.js

# 3. 下載 OSM PBF 檔案（以澳門為例）
#    從 https://download.geofabrik.de/asia/china.html 下載 macau.osm.pbf

# 4. 一鍵處理：PBF → JSON → roads.json
node osm_pipeline.js macau.osm.pbf macau

# 5. 啟動伺服器
node server.js

# 6. 開啟瀏覽器 → https://localhost:포트번호
```

---

## 專案結構

```
LaneGo/
├── build_roads.js         # 自動切分 OSM 道路 + 車道推斷引擎（核心）
├── pbf_to_json.js         # PBF → JSON 轉換器
├── osm_pipeline.js        # 一鍵管線：整合上述兩個程式
├── data_editor.js         # 資料編輯器（查詢/搜尋/手動修正）
├── apply_overrides.js     # 單獨套用手動修正（不重新建置）
├── server.js              # HTTPS 靜態伺服器
├── generate-cert.js       # SSL 自簽證書產生器
├── editor.html            # 視覺化車道編輯器
├── index.html             # 前端導航頁面
├── data/
│   └── macau/             # 城市資料目錄
│       ├── osm_fr.json    # 中間產物：PBF 轉出的 OSM JSON（可刪除）
│       ├── roads.json     # 最終產物：前端使用的道路資料
│       └── lane_overrides.json  # 手動修正檔
├── icons/                 # SVG 車道圖標
└── package.json
```

---

## OSM 資料處理管線

整個處理流程分為三個階段，由 `osm_pipeline.js` 自動串聯：

```
┌─────────────────────────────────────────────────────┐
│               OSM 資料處理管線                         │
├─────────────────────────────────────────────────────┤
│                                                       │
│  xxx.osm.pbf            (從 GeoFabrik 下載)           │
│      │                                                │
│      ▼                                                │
│  ┌──────────────┐                                    │
│  │ pbf_to_json  │  步驟 1：PBF → JSON 轉換            │
│  │    .js       │  解析二進位 PBF，輸出結構化 JSON     │
│  └──────┬───────┘   ← 過濾 highway 標籤的 way         │
│         │                                             │
│         ▼                                             │
│  data/<city>/osm_fr.json    (中間產物)                 │
│      │                                                │
│      ▼                                                │
│  ┌──────────────┐                                    │
│  │ build_roads  │  步驟 2：道路建置 + 自動切分         │
│  │    .js       │  ① 提取道路幾何 + 元資料              │
│  └──────┬───────┘  ② 方向變化 / 長度切分路段           │
│         │          ③ 交叉路口車道推斷                  │
│         │          ④ 合併相鄰相同配置路段              │
│         │          ⑤ 套用手動修正                      │
│         ▼                                             │
│  data/<city>/roads.json    (最終產物 → 前端使用)       │
│                                                       │
│  ※ osm_fr.json 預設會自動刪除以節省空間                │
│    使用 --keep-json 參數可保留                         │
└─────────────────────────────────────────────────────┘
```

---

## 使用方法

### 方法一：一鍵管線（推薦）

最簡單的方式，一條指令完成所有處理：

```bash
node osm_pipeline.js <pbf檔案> <城市名稱> [選項]
```

**參數說明：**

| 參數 | 必填 | 說明 |
|------|------|------|
| `<pbf檔案>` | ✓ | OSM PBF 檔案路徑（支援絕對或相對路徑） |
| `<城市名稱>` | ✓ | 城市代碼，資料輸出到 `data/<城市名稱>/` |
| `--keep-json` | 否 | 保留中間產物 `osm_fr.json`（預設刪除） |
| `-h` / `--help` | 否 | 顯示完整說明 |

**使用範例：**

```bash
# 基本用法：處理澳門
node osm_pipeline.js macau.osm.pbf macau

# 處理香港（保留中間 JSON 以便除錯）
node osm_pipeline.js hongkong.osm.pbf hongkong --keep-json

# 使用絕對路徑
node osm_pipeline.js D:\downloads\tokyo.osm.pbf tokyo

# 查看說明
node osm_pipeline.js --help
```

**執行過程輸出範例：**

```
開始處理城市: macau
PBF 檔案:      C:\...\macau.osm.pbf
輸出目錄:      C:\...\data\macau

[1/3] 建立城市目錄...
  ✓ C:\...\data\macau

[2/3] PBF → JSON 轉換 (pbf_to_json.js)...
讀取 PBF 檔案: C:\...\macau.osm.pbf
已解析 12345 個元素 (nodes + ways)
已輸出: C:\...\data\macau\osm_fr.json (8.3 MB)
  ✓ 完成 (8.3 MB, 3.2s)

[3/3] JSON → roads 建置 (build_roads.js) → macau...

城市: macau
輸入: C:\...\data\macau\osm_fr.json

已從 OSM 提取 2847 個路段
  有精確 turn 數據: 312 段（跳過推斷）
  無 turn 數據: 2535 段（將進行推斷）
正在推斷交叉路口的車道方向（共 2535 段）…
  ✓ 已更新 1842 組車道配置
  ⚠ 略過 693 組（無車道）

已載入 15 條手動修正
  ✓ 已應用修正: 新馬路路口 (距離 8m)
  ✓ 已應用修正: 南灣大馬路 (距離 12m)
  ...

═══════════════════════════════════
  建立完成
═══════════════════════════════════
  原始路段數:    2847
  合併後路段數:  1623
  有 OSM turn:   312
  有推斷車道方向: 1431
  已輸出:        C:\...\data\macau\roads.json

[清理] 已刪除中間檔案 osm_fr.json

═══════════════════════════════════
  全部完成！總耗時: 15.4s
  輸出檔案: C:\...\data\macau\roads.json
═══════════════════════════════════
```

---

### 方法二：逐步手動執行

如果希望對每個步驟有更多控制，可以分步執行：

#### 步驟 1：PBF → JSON 轉換

```bash
node pbf_to_json.js <輸入.pbf> [輸出.json]
```

```bash
# 完整用法
node pbf_to_json.js macau.osm.pbf data/macau/osm_fr.json

# 自動生成輸出檔名（輸入 macau.osm.pbf → 輸出 macau_osm_fr.json）
node pbf_to_json.js macau.osm.pbf
```

#### 步驟 2：道路建置 + 自動切分

```bash
node build_roads.js <城市名稱>
```

```bash
# 建置澳門道路（讀取 data/macau/osm_fr.json → 輸出 data/macau/roads.json）
node build_roads.js macau

# 省略城市名時預設為 macau
node build_roads.js
```

**前置條件：** `data/<城市>/osm_fr.json` 必須存在。

---

### 方法三：NPM Scripts

```bash
# 建置預設城市（macau）
npm run build

# 建置指定城市
npm run build:macau

# 啟動伺服器
npm start

# 執行一鍵管線（需自行帶參數）
npm run pipeline -- macau.osm.pbf macau
```

---

## 加入新城市

完整操作流程：

```bash
# 1. 下載 PBF 檔案
#    前往 https://download.geofabrik.de/ 下載目標地區的 .osm.pbf

# 2. 一鍵處理
node osm_pipeline.js <下載的.pbf> <城市名>

# 3. （可選）建立 lane_overrides.json 進行手動修正
node data_editor.js <城市名> info

# 4. （可選）編輯 build_roads.js 中的 excludeNames
#    將不屬於目標城市的道路名稱加入黑名單

# 5. 啟動伺服器測試
node server.js
```

**手動建立目錄結構（如需）：**

```bash
# 建立城市目錄
mkdir -p data/<城市名>

# 放入 OSM JSON 檔案（手動轉換或複製）
# 然後執行建置
node build_roads.js <城市名>
```

**自訂參數調整：**

在 `build_roads.js` 中可以調整以下參數以適應不同城市的路網特徵：

| 參數 | 預設值 | 說明 |
|------|--------|------|
| `includeHighways` | 見程式碼 | 要納入處理的道路類型白名單 |
| `excludeNames` | 澳門相關路名 | 路名黑名單（完整匹配） |
| `MAX_SEGMENT_LENGTH` | 80m | 路段最大長度，超過自動切分 |
| `MIN_SEGMENT_LENGTH` | 10m | 路段最小長度，少於則丟棄 |
| `BEARING_CHANGE_THRESHOLD` | 35° | 方向變化角度閾值，超過自動切分 |
| `INTERSECTION_RADIUS` | 25m | 交叉路口搜尋半徑 |
| `ANGLE_LEFT` | -25° | 左轉角度判定閾值 |
| `ANGLE_RIGHT` | 25° | 右轉角度判定閾值 |
| `TERMINAL_DISTANCE` | 80m | turn:lanes 資料僅套用於 way 終端距離內 |

---

## 程式說明

### pbf_to_json.js — PBF 轉 JSON

將 OSM 二進位 PBF 格式轉換為結構化 JSON，僅保留道路相關元素。

**功能：**
- 解析 OSM PBF 二進位格式（使用 `osm-pbf-parser`）
- 過濾僅保留 `highway` 標籤的 way（道路）
- 輸出 `data/<城市>/osm_fr.json`（相容 OSM JSON 格式）

**用法：**
```bash
node pbf_to_json.js <input.osm.pbf> [output.json]
```

**輸出格式：**
```json
{
  "version": 0.6,
  "generator": "pbf_to_json.js",
  "elements": [
    { "type": "node", "id": 123, "lat": 22.123, "lon": 113.456 },
    {
      "type": "way",
      "id": 456,
      "nodes": [123, 124, 125],
      "tags": {
        "highway": "primary",
        "name": "新馬路",
        "lanes": "3",
        "turn:lanes:forward": "left|through|through;right"
      }
    }
  ]
}
```

---

### build_roads.js — 自動切分 OSM 道路

從 OSM JSON 提取道路幾何並智慧切分為路段，同時推斷車道方向。

**輸入：** `data/<城市>/osm_fr.json`
**輸出：** `data/<城市>/roads.json`

**處理流程（五步驟）：**

```
步驟 1: 提取道路幾何 + 元資料
  ├─ 按 highway 類型過濾（motorway, primary, secondary...）
  ├─ 按路名黑白名單過濾
  ├─ 解析單向/環島屬性
  ├─ 計算雙向車道數
  └─ 解析 OSM turn:lanes 標籤（如有精確數據）

步驟 2: 方向變化 / 長度切分路段
  ├─ 方向變化 > 35° 時切分（彎道）
  ├─ 路段長度 > 80m 時切分（避免過長）
  ├─ turn:lanes 數據僅套用於 way 起/終端 80m 內
  └─ 路徑點之間直接相鄰時切分為最小單位

步驟 3: 交叉路口車道推斷
  └─ 對「無 OSM turn 數據」的路段端點進行推斷
       ├─ 尋找 25m 內的交叉道路
       ├─ 按方位角分類：左轉 (< -25°) / 直行 / 右轉 (> 25°)
       └─ 分配車道：左車道 → straight_left，右車道 → straight_right

步驟 4: 合併相鄰相同配置的路段
  └─ 相同路名、相同 highway 類型、相同車道配置的相鄰路段自動合併

步驟 5: 套用手動修正
  └─ 讀取 data/<城市>/lane_overrides.json
      └─ 按 GPS 座標匹配（30m 內最近路段）並覆蓋車道配置
```

---

### osm_pipeline.js — 統一管線

整合 `pbf_to_json.js` 和 `build_roads.js` 的一鍵處理腳本。

**功能：**
- 自動建立城市資料目錄
- 串聯 PBF → JSON → roads 完整流程
- 預設自動清理中間產物（`osm_fr.json`）
- 顯示詳細進度和耗時統計

**用法：**
```bash
node osm_pipeline.js <pbf檔案> <城市名稱> [--keep-json]
```

---

### data_editor.js — 資料編輯器

用於查詢、搜尋和手動修正道路資料的 CLI 工具。

**用法：**
```bash
node data_editor.js <城市> <命令> [參數...]
```

**可用命令：**

| 命令 | 說明 | 範例 |
|------|------|------|
| `info` | 顯示城市資料摘要（路段數、總長度、類型等） | `node data_editor.js macau info` |
| `list [關鍵字]` | 列出所有路段，可選名稱篩選 | `node data_editor.js macau list` |
| `search <關鍵字>` | 按名稱搜尋路段 | `node data_editor.js macau search 大馬路` |
| `show <id>` | 顯示指定路段的完整詳細資訊 | `node data_editor.js macau show road_42` |
| `find <lat> <lng>` | 按座標尋找最近路段 | `node data_editor.js macau find 22.20 113.54` |
| `edit <lat> <lng>` | 按座標尋找並顯示路段（含修改提示） | `node data_editor.js macau edit 22.20 113.54` |
| `override <lat> <lng> <備註> [--forward ...] [--backward ...]` | 新增手動修正項目 | 見下方詳細說明 |

**手動修正（override）詳細用法：**

```bash
node data_editor.js <城市> override <lat> <lng> "修正說明" \
  --forward <icon1>,<icon2>,<icon3> \
  --backward <icon1>,<icon2>
```

**可用圖示名稱：**
`straight`, `left`, `right`, `slight_left`, `slight_right`, `straight_left`, `straight_right`, `left_right`, `u_turn`, `merge_left`, `merge_right`

**範例：**
```bash
# 修正某路口的車道配置
node data_editor.js macau override 22.20 113.54 "新馬路/南灣路口" \
  --forward straight_left,straight,straight_right \
  --backward straight,straight

# 僅修正順向車道
node data_editor.js macau override 22.21 113.55 "單行道入口" \
  --forward left,straight_right
```

---

### apply_overrides.js — 套用手動修正

在不重新執行完整建置流程的情況下，將 `lane_overrides.json` 中的手動修正直接套用到現有的 `roads.json`。

**用法：**
```bash
node apply_overrides.js <城市名稱>
```

**使用時機：**
- 修改 `lane_overrides.json` 後不想重新跑完整的 `build_roads.js`
- 只想快速測試修正效果

```bash
# 套用澳門的手動修正
node apply_overrides.js macau
```

---

## 自動切分演算法詳解

`build_roads.js` 的核心是自動切分演算法，將長距離的 OSM way 切割為適合前端顯示的獨立路段。

### 切分策略

| 觸發條件 | 說明 | 預設值 |
|----------|------|--------|
| 方向變化 | 路徑方位角變化超過閾值時切分（彎道） | 35° |
| 最大長度 | 路段超過最大長度時強制切分 | 80m |
| 最小長度 | 路段短於最小長度且非唯一路段時丟棄 | 10m |

### turn:lanes 終端策略

OSM 的 `turn:lanes` 標籤標示的是 way 端點（路口）的車道方向，而非整條 way。為避免將路口車道方向錯誤地套用到道路中間：

- 僅在 way 起點/終點的 `TERMINAL_DISTANCE`（預設 80m）範圍內使用 `turn:lanes` 數據
- 中間路段使用預設直行配置，再經交叉路口推斷更新

### 交叉路口車道推斷演算法

當 OSM 資料中沒有 `turn:lanes` 標籤時，程式會根據交叉路口幾何自動推斷車道方向：

```
對於每個路段的端點：
  1. 計算到達方位角（最後兩個路徑點的方向）
  2. 在 INTERSECTION_RADIUS（25m）內搜尋從此端點出發的其他路段
  3. 對每個找到的後續路段：
     - 計算離開方位角
     - 與到達方位角比較，得到角度差
  4. 分類出口方向：
     - 角度差 < -25° → 左轉出口
     - 角度差 > 25°  → 右轉出口
     - -25° ~ 25°  → 直行
  5. 根據出口分配車道：
     - 有左轉出口 → 最左車道設為 straight_left（直走/左轉）
     - 有右轉出口 → 最右車道設為 straight_right（直走/右轉）
     - 多車道（4+）→ 第二車道也加入對應方向
     - 僅有左轉無直行（T字路口）→ 最左車道設為 left
```

### 合併策略

推斷完成後，相鄰且配置相同的路段會自動合併：

```
合併條件（需全部滿足）：
  - 相同道路名稱
  - 相同 highway 類型
  - 相同單向/雙向屬性
  - lanesForward 配置完全相同
  - lanesBackward 配置完全相同
  - 地理上相鄰（前一段終點 = 後一段起點）
```

---

## 資料格式說明

最終產物 `data/<城市>/roads.json` 是 JSON 陣列，每個元素代表一條道路段。

### 欄位說明

| 欄位 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | string | ✓ | 唯一識別，格式 `"road_1"`, `"road_2"`, ... |
| `name` | string | ✓ | 道路名稱，顯示在 App 頂部導航卡片 |
| `path` | [lat, lng][] | ✓ | GPS 座標陣列，至少 2 個點（[緯度, 經度]） |
| `lanesForward` | Lane[] | ✓ | 順向車道配置，陣列從左到右對應顯示 |
| `lanesBackward` | Lane[] | ✓ | 反向車道配置，陣列從左到右對應顯示 |
| `highway` | string | - | OSM 道路類型（primary, secondary, ...） |
| `oneway` | boolean | - | 是否為單向道路 |
| `length` | number | - | 路段長度（公尺） |
| `junction` | string | - | 環島標記（`"roundabout"`） |
| `destinations` | string[] | - | 車道目的地標示（來自 OSM destination:lanes） |
| `reversed` | boolean | - | 單向逆向標記（oneway=-1） |

### Lane 物件（車道配置）

| 欄位 | 類型 | 說明 |
|------|------|------|
| `icon` | string | 圖示 ID，對應 `icons/` 目錄中的 SVG |
| `label` | string | 中文標籤，顯示在圖示下方 |

### 可用圖示一覽

| icon | 顯示 | 含義 |
|------|------|------|
| `straight` | ⬆ | 直走 |
| `left` | ⬅ | 左轉 |
| `right` | ➡ | 右轉 |
| `slight_left` | ↖ | 左前方 |
| `slight_right` | ↗ | 右前方 |
| `straight_left` | ↑↰ | 直走 / 左轉 |
| `straight_right` | ↑↱ | 直走 / 右轉 |
| `left_right` | ↰↱ | 左轉 / 右轉 |
| `u_turn` | ↩ | 調頭 |
| `merge_left` | ⇤ | 靠左 |
| `merge_right` | ⇥ | 靠右 |

### 完整資料範例

```json
[
  {
    "id": "road_1",
    "name": "新馬路",
    "path": [
      [22.193456, 113.539123],
      [22.193789, 113.539456]
    ],
    "lanesForward": [
      { "icon": "straight_left", "label": "直走 / 左轉" },
      { "icon": "straight", "label": "直走" },
      { "icon": "straight_right", "label": "直走 / 右轉" }
    ],
    "lanesBackward": [
      { "icon": "straight", "label": "直走" },
      { "icon": "straight", "label": "直走" }
    ],
    "highway": "primary",
    "oneway": false,
    "length": 45.32
  },
  {
    "id": "road_2",
    "name": "南灣大馬路",
    "path": [
      [22.190000, 113.540000],
      [22.190050, 113.540100]
    ],
    "lanesForward": [
      { "icon": "left", "label": "左轉" },
      { "icon": "straight", "label": "直走" },
      { "icon": "right", "label": "右轉" }
    ],
    "lanesBackward": [],
    "highway": "secondary",
    "oneway": true,
    "length": 28.15
  }
]
```

---

## 手動修正車道資料

當自動推斷結果有誤時（例如實地路口與 OSM 資料不符），可透過手動修正機制精確調整。

### 修正流程

```bash
# 第 1 步：找到要修正的路段（用座標搜尋）
node data_editor.js macau find 22.20 113.54

# 第 2 步：建立修正項目
node data_editor.js macau override 22.20 113.54 "路口說明" \
  --forward straight_left,straight,straight_right \
  --backward straight,straight

# 第 3 步：重新建置以套用修正
node build_roads.js macau
#    或僅套用修正不重建：
node apply_overrides.js macau
```

### lane_overrides.json 格式

手動修正儲存在 `data/<城市>/lane_overrides.json`，格式如下：

```json
[
  {
    "comment": "新馬路/南灣路口 — 實測左轉車道在最左",
    "lat": 22.19350,
    "lng": 113.53910,
    "lanesForward": [
      { "icon": "straight_left", "label": "直走 / 左轉" },
      { "icon": "straight", "label": "直走" },
      { "icon": "straight_right", "label": "直走 / 右轉" }
    ],
    "lanesBackward": [
      { "icon": "straight", "label": "直走" }
    ]
  }
]
```

**匹配規則：**
- 系統會找到距離指定座標 **30m 內**的最近路段
- 如果超過 30m，該修正會被跳過（顯示警告）
- 建議使用 GPS 實測的準確座標

### 視覺化編輯器

也可以使用 `editor.html` 在瀏覽器中視覺化編輯車道資料（開啟 index.html 後切換至編輯模式）。

---

## 啟動伺服器

```bash
node server.js
```

伺服器啟動後，在瀏覽器中開啟 `https://localhost`（需要先執行 `node generate-cert.js` 生成 SSL 證書）。

**注意：** 瀏覽器 GPS API 需要 HTTPS 環境才能使用，因此必須使用自簽證書的 HTTPS 連線。首次連線時瀏覽器會顯示安全警告，點擊「進階」→「繼續前往」即可。

---

## 疑難排解

### 找不到 OSM JSON 檔案

```
找不到輸入檔案: .../data/macau/osm_fr.json
```

**解決方案：** 先執行 PBF 轉 JSON：
```bash
node pbf_to_json.js macau.osm.pbf data/macau/osm_fr.json
```

### 道路方向推斷不準確

某些路口（如大型圓環、複雜多叉路口）的自動推斷可能與實際不符。

**解決方案：** 使用手動修正機制（見[手動修正車道資料](#手動修正車道資料)）。

### 沒有車道方向（全部顯示直走）

可能原因：
1. OSM 資料中沒有 `turn:lanes` 標籤，且路段周圍沒有交叉路口
2. 路段過短被過濾（`MIN_SEGMENT_LENGTH`）

**解決方案：**
- 降低 `INTERSECTION_RADIUS` 或 `MIN_SEGMENT_LENGTH`
- 使用 `data_editor.js` 手動修正特定路段

### GPS 無法使用

瀏覽器顯示 GPS 無法存取。

**解決方案：**
- 確認使用 HTTPS（非 HTTP）
- 確認瀏覽器權限設定允許位置存取
- 在手機上測試（桌面 GPS 可能不準確）

### PBF 檔案過大導致記憶體不足

**解決方案：**
- 使用較小的地區 PBF（城市級而非國家級）
- 使用 osmium 或 osmosis 工具預先裁切 PBF
- 在 `pbf_to_json.js` 中加入地理邊界過濾

---

## 技術棧

- **前端**：MapLibre GL 地圖 + 原生 JavaScript
- **後端**：Node.js 靜態 HTTPS 伺服器
- **資料處理**：
  - `osm-pbf-parser` — PBF 二進位格式解析
  - Haversine 公式 — GPS 距離計算
  - 方位角演算法 — 交叉路口推斷
- **圖標**：11 個自訂 SVG 車道方向圖標（內嵌於 HTML）
- **SSL**：node-forge 自簽證書
