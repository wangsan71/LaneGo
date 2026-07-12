const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }
function normalizeAngle(deg) { return ((deg % 360) + 360) % 360; }

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const A = px - x1, B = py - y1;
    const C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }

    return haversine(px, py, xx, yy);
}

function findNearestRoad(roads, lat, lng) {
    let best = null, minDist = Infinity;
    roads.forEach(road => {
        for (let i = 0; i < road.path.length - 1; i++) {
            const p1 = road.path[i], p2 = road.path[i + 1];
            const d = pointToSegmentDist(lat, lng, p1[0], p1[1], p2[0], p2[1]);
            if (d < minDist) { minDist = d; best = road; }
        }
    });
    return best ? { road: best, distance: Math.round(minDist) } : null;
}

function loadRoads(city) {
    const file = path.join(DATA_DIR, city, 'roads.json');
    if (!fs.existsSync(file)) {
        console.error(`找不到資料檔: ${file}`);
        console.error(`可用城市: ${listCities().join(', ') || '(無)'}`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadOverrides(city) {
    const file = path.join(DATA_DIR, city, 'lane_overrides.json');
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveOverrides(city, overrides) {
    const file = path.join(DATA_DIR, city, 'lane_overrides.json');
    fs.writeFileSync(file, JSON.stringify(overrides, null, 2), 'utf8');
    console.log(`已儲存到 ${file}`);
}

function listCities() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR).filter(f => {
        const p = path.join(DATA_DIR, f);
        return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'roads.json'));
    });
}

function formatLanes(lanes) {
    if (!lanes || lanes.length === 0) return '  (無車道)';
    return lanes.map((l, i) => `  車道${i + 1}: [${l.icon}] ${l.label}`).join('\n');
}

// ========== 命令處理 ==========

function cmdList(city, filter) {
    const roads = loadRoads(city);
    let filtered = roads;
    if (filter) {
        const kw = filter.toLowerCase();
        filtered = roads.filter(r => r.name.toLowerCase().includes(kw));
    }
    console.log(`${city} - 共 ${filtered.length} 條路段${filter ? ` (篩選: "${filter}")` : ''}:`);
    filtered.forEach(r => {
        const fwd = r.lanesForward.map(l => l.icon).join(',') || '無';
        const bwd = r.lanesBackward.map(l => l.icon).join(',') || '無';
        console.log(`  ${r.id} | ${r.name} | ${r.length}m | 順:[${fwd}] 逆:[${bwd}]`);
    });
}

function cmdFind(city, lat, lng) {
    const roads = loadRoads(city);
    const result = findNearestRoad(roads, lat, lng);
    if (!result || result.distance > 200) {
        console.log(`座標 (${lat}, ${lng}) 200m 內找不到道路`);
        return;
    }
    const r = result.road;
    console.log(`最近道路: ${r.id} | ${r.name}`);
    console.log(`距離: ${result.distance}m | 長度: ${r.length}m`);
    console.log(`順向 (${r.lanesForward.length} 車道):`);
    console.log(formatLanes(r.lanesForward));
    console.log(`反向 (${r.lanesBackward.length} 車道):`);
    console.log(formatLanes(r.lanesBackward));
    console.log(`座標點數: ${r.path.length}`);
    console.log(`完整路徑座標:`);
    r.path.forEach((p, i) => console.log(`  [${i}] ${p[0].toFixed(6)}, ${p[1].toFixed(6)}`));
}

function cmdShow(city, id) {
    const roads = loadRoads(city);
    const r = roads.find(r => r.id === id);
    if (!r) { console.log(`找不到路段: ${id}`); return; }
    console.log(`${r.id} | ${r.name} | ${r.highway || '?'}`);
    console.log(`長度: ${r.length}m | 單向: ${r.oneway ? '是' : '否'}`);
    console.log(`順向 (${r.lanesForward.length} 車道):`);
    console.log(formatLanes(r.lanesForward));
    console.log(`反向 (${r.lanesBackward.length} 車道):`);
    console.log(formatLanes(r.lanesBackward));
}

function cmdSearch(city, keyword) {
    const roads = loadRoads(city);
    const kw = keyword.toLowerCase();
    const results = roads.filter(r => r.name.toLowerCase().includes(kw));
    if (results.length === 0) {
        console.log(`找不到包含 "${keyword}" 的道路`);
        return;
    }
    console.log(`找到 ${results.length} 條匹配道路:`);
    results.forEach(r => {
        console.log(`  ${r.id} | ${r.name} | ${r.length}m | ${r.highway || '?'}`);
    });
}

function parseLaneArg(str) {
    const ICON_NAMES = [
        'straight', 'left', 'right', 'slight_left', 'slight_right',
        'straight_left', 'straight_right', 'left_right', 'u_turn',
        'merge_left', 'merge_right'
    ];
    const LABEL_MAP = {
        straight: '直走', left: '左轉', right: '右轉',
        slight_left: '左前方', slight_right: '右前方',
        straight_left: '直走 / 左轉', straight_right: '直走 / 右轉',
        left_right: '左轉 / 右轉', u_turn: '迴轉',
        merge_left: '靠左', merge_right: '靠右'
    };

    return str.split(',').map(s => s.trim()).filter(s => s).map(icon => {
        if (!ICON_NAMES.includes(icon)) {
            console.error(`無效的圖示名稱: "${icon}"`);
            console.error(`可用: ${ICON_NAMES.join(', ')}`);
            process.exit(1);
        }
        return { icon, label: LABEL_MAP[icon] };
    });
}

function cmdOverride(city, lat, lng, comment, forwardArg, backwardArg) {
    const roads = loadRoads(city);
    const result = findNearestRoad(roads, lat, lng);
    if (!result || result.distance > 200) {
        console.log(`座標 (${lat}, ${lng}) 200m 內找不到道路，無法建立修正`);
        return;
    }

    const r = result.road;
    const overrides = loadOverrides(city);

    const entry = {
        comment: comment || `修正 ${r.name} (${r.id})`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        lanesForward: forwardArg ? parseLaneArg(forwardArg) : r.lanesForward,
        lanesBackward: backwardArg ? parseLaneArg(backwardArg) : r.lanesBackward
    };

    overrides.push(entry);
    saveOverrides(city, overrides);

    console.log(`\n已新增修正項目:`);
    console.log(`  位置: (${entry.lat}, ${entry.lng})`);
    console.log(`  路段: ${r.name} (${r.id}) | 距離: ${result.distance}m`);
    console.log(`  備註: ${entry.comment}`);
    if (forwardArg) console.log(`  順向: ${forwardArg}`);
    if (backwardArg) console.log(`  反向: ${backwardArg}`);
    console.log(`\n執行 "npm run build" 即可套用修正。`);
}

function cmdEdit(city, lat, lng) {
    const roads = loadRoads(city);
    const result = findNearestRoad(roads, lat, lng);
    if (!result || result.distance > 200) {
        console.log(`座標 (${lat}, ${lng}) 200m 內找不到道路`);
        return;
    }
    cmdShow(city, result.road.id);
    console.log(`\n要修改此路段，請使用:`);
    console.log(`  node data_editor.js ${city} override ${lat} ${lng} "你的備註" --forward icon1,icon2 --backward icon3`);
}

function cmdInfo(city) {
    const roads = loadRoads(city);
    const overrides = loadOverrides(city);
    const names = [...new Set(roads.map(r => r.name))].sort();
    const types = [...new Set(roads.map(r => r.highway))].sort();
    const oneWay = roads.filter(r => r.oneway).length;
    const totalLen = Math.round(roads.reduce((s, r) => s + r.length, 0));

    console.log(`${city} 資料摘要:`);
    console.log(`  路段總數: ${roads.length}`);
    console.log(`  總長度: ${(totalLen / 1000).toFixed(1)} km`);
    console.log(`  單向路段: ${oneWay}`);
    console.log(`  道路名稱數: ${names.length}`);
    console.log(`  道路類型: ${types.join(', ')}`);
    console.log(`  手動修正: ${overrides.length} 條`);
}

// ========== 主程式 ==========

function printHelp() {
    const cities = listCities().join(', ') || '(無)';
    console.log(`LaneGo 資料編輯器
用法:
  node data_editor.js <城市> <命令> [參數...]

可用城市: ${cities}

命令:
  list [關鍵字]            列出所有路段，可選名稱篩選
  info                     顯示城市資料摘要
  search <關鍵字>           按名稱搜尋路段
  show <id>                顯示指定路段詳細資訊
  find <lat> <lng>         按座標尋找最近路段
  edit <lat> <lng>         按座標尋找並顯示路段（含修改提示）
  override <lat> <lng> <備註> [--forward a,b,c] [--backward d,e]
                           新增手動修正項目到 lane_overrides.json

範例:
  node data_editor.js macau list
  node data_editor.js macau info
  node data_editor.js macau search 大學
  node data_editor.js macau show road_42
  node data_editor.js macau find 22.20 113.54
  node data_editor.js macau override 22.20 113.54 "路口修正" --forward straight_left,straight_right
`);
}

const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
}

const city = args[0];
const cmd = args[1];

if (!listCities().includes(city)) {
    console.error(`未知城市: "${city}"`);
    console.error(`可用: ${listCities().join(', ') || '(無)'}`);
    process.exit(1);
}

try {
    switch (cmd) {
        case 'list':
            cmdList(city, args[2]);
            break;
        case 'info':
            cmdInfo(city);
            break;
        case 'search':
            if (!args[2]) { console.error('請提供搜尋關鍵字'); process.exit(1); }
            cmdSearch(city, args.slice(2).join(' '));
            break;
        case 'show':
            if (!args[2]) { console.error('請提供路段 ID'); process.exit(1); }
            cmdShow(city, args[2]);
            break;
        case 'find':
            if (!args[2] || !args[3]) { console.error('請提供 lat lng'); process.exit(1); }
            cmdFind(city, parseFloat(args[2]), parseFloat(args[3]));
            break;
        case 'edit':
            if (!args[2] || !args[3]) { console.error('請提供 lat lng'); process.exit(1); }
            cmdEdit(city, parseFloat(args[2]), parseFloat(args[3]));
            break;
        case 'override': {
            if (!args[2] || !args[3] || !args[4]) {
                console.error('用法: node data_editor.js <城市> override <lat> <lng> <備註> [--forward ...] [--backward ...]');
                process.exit(1);
            }
            const lat = args[2], lng = args[3];
            let comment = '';
            let forwardArg = null, backwardArg = null;
            for (let i = 4; i < args.length; i++) {
                if (args[i] === '--forward' && i + 1 < args.length) {
                    forwardArg = args[++i];
                } else if (args[i] === '--backward' && i + 1 < args.length) {
                    backwardArg = args[++i];
                } else if (!args[i].startsWith('--')) {
                    comment += (comment ? ' ' : '') + args[i];
                }
            }
            cmdOverride(city, lat, lng, comment || null, forwardArg, backwardArg);
            break;
        }
        default:
            console.error(`未知命令: "${cmd}"`);
            printHelp();
            process.exit(1);
    }
} catch (e) {
    console.error('執行錯誤:', e.message);
    process.exit(1);
}
