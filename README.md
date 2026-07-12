# LaneGo - 澳门车道导航

实时显示澳门当前道路所有车道方向的行车辅助工具。打开 App 即显示脚下道路每条车道的行驶方向（直走 / 左转 / 右转），无需输入目的地。

基于 OpenStreetMap 澳门路网数据，配合浏览器 GPS 定位和方向感应器，自动匹配最近道路段并显示该段车道指引。

## 技术栈

- **前端**：MapLibre GL 地图 + 原生 JS
- **后端**：Node.js 静态 HTTPS 服务器
- **数据**：OpenStreetMap PBF → `build_roads.js` → `macau_roads.json`
  - 从 OSM 提取道路几何 + 交叉路口车向推断 + 手动修正合并
- **图标**：11 个自定义 SVG 车道方向图标

## 快速开始

```bash
npm install
node generate-cert.js   # 生成自签 SSL 证书（GPS 需要 HTTPS）
npm run build           # 从 OSM 数据生成 macau_roads.json（含车向推断）
node server.js          # 启动服务
```

## macau_roads.json 格式说明

JSON 数组，每个元素是一条道路段。

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | ✓ | 唯一标识，如 `"road_1"` |
| `name` | string | ✓ | 道路名称，会显示在 App 顶部卡片 |
| `path` | [lat, lng][] | ✓ | GPS 坐标数组，至少 2 个点，建议每相邻两点为一段 |
| `lanesForward` | Lane[] | ✓ | 顺向车道配置 |
| `lanesBackward` | Lane[] | ✓ | 反向车道配置 |

### Lane 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| `icon` | string | SVG 图标文件名（不含 `.svg`），见下方图标表 |
| `label` | string | 中文标签，显示在图标下方 |

### 可用图标

| icon | 含义 |
|------|------|
| `straight` | 直走 ⬆ |
| `left` | 左转 ⬅ |
| `right` | 右转 ➡ |
| `slight_left` | 左前方 ↖ |
| `slight_right` | 右前方 ↗ |
| `straight_left` | 直走 / 左转 ↑↰ |
| `straight_right` | 直走 / 右转 ↑↱ |
| `left_right` | 左转 / 右转 ↰↱ |
| `u_turn` | 调头 ↩ |
| `merge_left` | 靠左 |
| `merge_right` | 靠右 |

### 完整示例

见 `road-format-example.json`。

### 车道顺序与切分建议

- `lanesForward` / `lanesBackward` 数组从左到右对应屏幕显示从左到右（第 1 车道在最左）
- 每条道路段建议 `path` 只有 **2 个点**（相邻 GPS 点），车道方向跟随 GPS 位置精确切换
- 同一路名不同路口段可以有不同车道配置，系统根据 GPS 最近点自动匹配

## 从 OpenStreetMap 生成数据

### 完整流程

1. 下载澳门 OSM PBF 文件（如 [GeoFabrik](https://download.geofabrik.de/asia/china.html)）
2. 用 `pbf_to_json.js`（需安装 `osm-pbf-parser`）将 PBF 转为 JSON → `macau_osm_fr.json`
3. 运行 `npm run build` 生成 `macau_roads.json`

### build_roads.js 处理流程

```
macau_osm_fr.json
    │
    ├─ 1. 提取道路几何（OSM ways → 坐标 + 元数据）
    │     - 按 highway 类型过滤
    │     - 按路名黑白名单过滤
    │     - 解析 OSM turn:lanes 标签（如有）
    │     - 按 50m 间隔切分路段
    │
    ├─ 2. 交叉路口车向推断（无 OSM turn 数据的路段）
    │     - 在每个路段端点查找 15m 内的交叉道路
    │     - 按方位角分类：左转 (< -15°)、直行、右转 (> 15°)
    │     - 分配车道方向：左车道 → straight_left，右车道 → straight_right
    │
    ├─ 3. 合并相邻相同配置的路段
    │
    └─ 4. 应用 lane_overrides.json 手动修正
         ↓
    macau_roads.json
```

### 手动修正 lane_overrides.json

当交叉路口推断有误时，可在 `lane_overrides.json` 中手动指定特定 GPS 位置的正确车向：

```json
[
  {
    "comment": "路口名称或说明",
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

系统会找到距离指定坐标 30m 内的最近路段并覆盖其车向配置。运行 `npm run build` 后生效。

### 自定义参数

`build_roads.js` 支持自定义：
- `includeHighways` — 道路类型白名单
- `excludeKeywords`（`parse_osm.js`）/ `excludeNames`（`build_roads.js`）— 路名黑名单
- `INTERSECTION_RADIUS`（默认 15m）— 交叉路口搜索半径
- `ANGLE_LEFT` / `ANGLE_RIGHT`（默认 ±15°）— 转向角度阈值
