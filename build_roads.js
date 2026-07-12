const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'macau_osm_fr.json');
const outputFile = path.join(__dirname, 'macau_roads.json');

const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

const nodes = {};
const ways = [];

data.elements.forEach(el => {
    if (el.type === 'node') {
        nodes[el.id] = [el.lat, el.lon];
    } else if (el.type === 'way' && el.tags && el.tags.highway) {
        ways.push(el);
    }
});

// ── 已包含道路類型 ──
const includeHighways = new Set([
    'motorway', 'motorway_link', 'trunk', 'trunk_link',
    'primary', 'primary_link', 'secondary', 'secondary_link',
    'tertiary', 'tertiary_link',
    'residential', 'unclassified', 'living_street', 'road',
    'service'
]);

// ── 各道路類型預設車道數 ──
const defaultLanesByType = {
    'motorway': 3, 'motorway_link': 1,
    'trunk': 3, 'trunk_link': 1,
    'primary': 2, 'primary_link': 1,
    'secondary': 2, 'secondary_link': 1,
    'tertiary': 2, 'tertiary_link': 1,
    'residential': 1, 'unclassified': 1,
    'living_street': 1, 'road': 1,
    'service': 1
};

// ── 路名排除列表（完整匹配）──
const excludeNames = new Set([
    '横琴', '橫琴', '环岛', '環島', '情侣路', '情侶路', '长隆', '長隆',
    '荣澳', '榮澳', '琴海', '汇通', '匯通', '海翼橋', '海琴桥', '海琴橋',
    '非桥', '非橋', '艺文', '藝文',
    '天羽道', '伯牙', '知音', '宝盛路', '寶盛路', '富祥湾', '富祥灣',
    '屏湾', '屏灣', '会展', '會展', '通航', '银湾路', '銀灣路',
    '大横琴山', '大橫琴山', '福临道', '福臨道', '安临路', '安臨路',
    '吉临路', '吉臨路', '香江路', '粤华路', '粵華路', '顺景路', '順景路',
    '荣港道', '榮港道', '十字门', '十字門',
    '南湾北路', '南灣北路', '南湾南路', '南灣南路', '桂花南路',
    '港澳大道', '港澳大道辅路', '港澳大道輔路',
    '前河东路', '前河東路', '前河西路', '港昌路',
    '侨光路', '僑光路', '昌平路', '湾仔', '灣仔',
    '珠三角环线', '珠三角環線', '拱北湾大桥', '拱北灣大橋',
    '祥澳路', '荣粤道', '榮粤道', '兴澳路', '興澳路',
    '联澳路', '聯澳路', '观澳路', '觀澳路', '海鸣桥', '海鳴橋',
    '珠澳路', '子期', '琴石道', '琴石隧道',
    '海贝桥', '海貝橋', '海韵橋', '海韻橋', '海韻桥',
    '依依桥', '依依橋', '富琴道', '都会道', '都會道',
    '北珠', '岛东路', '島東路', '兴盛三路', '興盛三路', '富城道'
]);

function shouldExclude(name) {
    return excludeNames.has(name);
}

// ── 轉向標記解析（OSM turn:lanes 標籤）──
function parseTurnLanes(value) {
    if (!value) return null;
    const singleMapping = {
        'left': { icon: 'left', label: '左轉' },
        'slight_left': { icon: 'slight_left', label: '左前方' },
        'sharp_left': { icon: 'left', label: '左轉' },
        'through': { icon: 'straight', label: '直走' },
        'right': { icon: 'right', label: '右轉' },
        'slight_right': { icon: 'slight_right', label: '右前方' },
        'sharp_right': { icon: 'right', label: '右轉' },
        'merge_to_left': { icon: 'merge_left', label: '靠左' },
        'merge_to_right': { icon: 'merge_right', label: '靠右' },
        'reverse': { icon: 'u_turn', label: '迴轉' },
        'none': { icon: 'straight', label: '直走' }
    };
    return value.split('|').map(part => {
        const turns = part.split(';').map(t => t.trim()).filter(t => t);
        if (turns.length === 0) return { icon: 'straight', label: '直走' };
        if (turns.length === 1) return singleMapping[turns[0]] || { icon: 'straight', label: '直走' };
        const hasLeft = turns.includes('left') || turns.includes('slight_left') || turns.includes('sharp_left');
        const hasRight = turns.includes('right') || turns.includes('slight_right') || turns.includes('sharp_right');
        const hasThrough = turns.includes('through') || turns.includes('none');
        if (hasLeft && hasThrough) return { icon: 'straight_left', label: '直走 / 左轉' };
        if (hasRight && hasThrough) return { icon: 'straight_right', label: '直走 / 右轉' };
        if (hasLeft && hasRight) return { icon: 'left_right', label: '左轉 / 右轉' };
        return singleMapping[turns[0]] || { icon: 'straight', label: '直走' };
    });
}

function generateDefaultLanes(numLanes) {
    const lanes = [];
    for (let i = 0; i < numLanes; i++) {
        lanes.push({ icon: 'straight', label: '直走' });
    }
    return lanes;
}

// ── Haversine 距離計算（米）──
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const dphi = (lat2 - lat1) * Math.PI / 180;
    const dlambda = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg) { return deg * Math.PI / 180; }
function toDeg(rad) { return rad * 180 / Math.PI; }

// ── 方位角計算（度，0=北，順時針）──
function bearing(lat1, lng1, lat2, lng2) {
    const dLon = toRad(lng2 - lng1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = toDeg(Math.atan2(y, x));
    return ((brng % 360) + 360) % 360;
}

function normalizeAngle(deg) { return ((deg % 360) + 360) % 360; }

// ── 角度差（-180 到 180）──
function angleDiff(b1, b2) {
    let diff = normalizeAngle(b2 - b1);
    if (diff > 180) diff -= 360;
    return diff;
}

// ── 路段長度計算 ──
function segmentLength(p) {
    let len = 0;
    for (let i = 1; i < p.length; i++) {
        len += haversine(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]);
    }
    return len;
}

// ── 判斷兩段車道配置是否相同 ──
function lanesEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].icon !== b[i].icon || a[i].label !== b[i].label) return false;
    }
    return true;
}

// ── 深拷貝車道配置 ──
function cloneLanes(lanes) {
    return lanes.map(l => ({ icon: l.icon, label: l.label }));
}

// ====================================================================
//  交叉路口車道推斷引擎
// ====================================================================

/**
 * 根據交叉路口幾何形狀推斷車道方向。
 *
 * 算法：
 *  1. 計算當前段的到達方位角（路徑最後兩個點的方向）
 *  2. 查找端點附近的「下一段」道路
 *  3. 按角度對每條後續道路進行分類：
 *     angle < -15°  → 左轉
 *     angle > 15°   → 右轉
 *     -15° ~ 15°   → 直行
 *  4. 根據是否有左/右出口分配車道方向：
 *     最左車道：左轉出口 → straight_left；僅左轉 → left
 *     最右車道：右轉出口 → straight_right；僅右轉 → right
 *     中間車道：始終 straight
 */
function inferLaneDirections(segments) {
    if (segments.length === 0) return segments;

    console.log(`正在推斷交叉路口的車道方向（共 ${segments.length} 段）…`);

    // 追蹤統計數據
    let inferredCount = 0;
    let skipNoIntersection = 0;
    let skipNoLanes = 0;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        // ── 推斷前進車道 ──
        if (seg.lanesForward.length > 0) {
            const result = inferForEndpoint(seg, segments, seg.path, 'forward');
            if (result.modified) {
                seg.lanesForward = result.lanes;
                inferredCount++;
            }
        } else {
            skipNoLanes++;
        }

        // ── 推斷反向車道（檢查路徑起點，反向行駛）──
        if (seg.lanesBackward.length > 0) {
            // 反向行駛的路徑：將 path 反轉
            const reversedPath = [...seg.path].reverse();
            const result = inferForEndpoint(seg, segments, reversedPath, 'backward');
            if (result.modified) {
                seg.lanesBackward = result.lanes;
                inferredCount++;
            }
        } else {
            skipNoLanes++;
        }
    }

    console.log(`  ✓ 已更新 ${inferredCount} 組車道配置`);
    console.log(`  ⚠ 略過 ${skipNoLanes} 組（無車道）`);
    return segments;
}

/**
 * 對單一端點進行車道推斷
 * @param {Object} seg - 當前路段
 * @param {Array} allSegments - 所有路段
 * @param {Array} path - 路徑座標（可能需要反轉）
 * @param {string} direction - 'forward' 或 'backward'
 * @returns {{ lanes: Array, modified: boolean }}
 */
function inferForEndpoint(seg, allSegments, path, direction) {
    const INTERSECTION_RADIUS = 15;  // 交叉路口搜尋半徑（米）
    const ANGLE_LEFT = -15;           // 左轉角度閾值
    const ANGLE_RIGHT = 15;           // 右轉角度閾值

    const endpoint = path[path.length - 1];

    // 計算到達方位角（使用最後兩個點）
    let approachBearing;
    if (path.length >= 2) {
        const p1 = path[path.length - 2];
        const p2 = path[path.length - 1];
        approachBearing = bearing(p1[0], p1[1], p2[0], p2[1]);
    } else {
        return { lanes: direction === 'forward' ? seg.lanesForward : seg.lanesBackward, modified: false };
    }

    // 查找從端點附近開始的其他路段（與當前路段不同的下一段）
    const nextSegments = [];
    for (let j = 0; j < allSegments.length; j++) {
        const other = allSegments[j];
        if (other === seg) continue;

        const startPt = other.path[0];
        const dist = haversine(endpoint[0], endpoint[1], startPt[0], startPt[1]);
        if (dist < INTERSECTION_RADIUS) {
            // 計算離開方位角
            let exitBearing;
            if (other.path.length >= 2) {
                exitBearing = bearing(other.path[0][0], other.path[0][1],
                                       other.path[1][0], other.path[1][1]);
            } else {
                exitBearing = bearing(endpoint[0], endpoint[1],
                                       other.path[0][0], other.path[0][1]);
            }
            const diff = angleDiff(approachBearing, exitBearing);
            const isSameRoad = (other.name === seg.name);
            nextSegments.push({
                segment: other,
                angleDiff: diff,
                distance: dist,
                isSameRoad: isSameRoad,
                exitBearing: exitBearing
            });
        }
    }

    if (nextSegments.length === 0) {
        return { lanes: direction === 'forward' ? seg.lanesForward : seg.lanesBackward, modified: false };
    }

    // 分類出口方向
    const hasLeftExit = nextSegments.some(s => s.angleDiff < ANGLE_LEFT && !s.isSameRoad);
    const hasRightExit = nextSegments.some(s => s.angleDiff > ANGLE_RIGHT && !s.isSameRoad);
    const hasStraight = nextSegments.some(s =>
        s.angleDiff >= ANGLE_LEFT && s.angleDiff <= ANGLE_RIGHT &&
        (s.isSameRoad || Math.abs(s.angleDiff) < 10)
    );

    // 如果沒有任何轉彎出口，保持預設直行
    if (!hasLeftExit && !hasRightExit) {
        return { lanes: direction === 'forward' ? seg.lanesForward : seg.lanesBackward, modified: false };
    }

    // 獲取當前的車道配置
    const currentLanes = direction === 'forward' ? seg.lanesForward : seg.lanesBackward;
    const newLanes = cloneLanes(currentLanes);

    if (newLanes.length === 0) {
        return { lanes: newLanes, modified: false };
    }

    let modified = false;

    // 最左車道 → 檢查是否有左轉出口
    if (hasLeftExit && newLanes.length >= 1) {
        if (hasStraight) {
            newLanes[0] = { icon: 'straight_left', label: '直走 / 左轉' };
        } else {
            // 僅有左轉出口（可能是 T 字路口或道路終點）
            newLanes[0] = { icon: 'left', label: '左轉' };
        }
        modified = true;
    }

    // 最右車道 → 檢查是否有右轉出口
    const rightIdx = newLanes.length - 1;
    if (hasRightExit && rightIdx >= 0) {
        if (hasStraight) {
            newLanes[rightIdx] = { icon: 'straight_right', label: '直走 / 右轉' };
        } else {
            newLanes[rightIdx] = { icon: 'right', label: '右轉' };
        }
        modified = true;
    }

    // 如果左右車道都有轉彎，檢查是否需要合併為 left_right（極少見情況）
    if (hasLeftExit && hasRightExit && newLanes.length === 1 && hasStraight) {
        newLanes[0] = { icon: 'left_right', label: '左轉 / 右轉' };
        modified = true;
    }

    return { lanes: newLanes, modified };
}

// ====================================================================
//  主處理邏輯（從 OSM 提取道路）
// ====================================================================

const roadDatabase = [];
let idCounter = 1;

ways.forEach(way => {
    const tags = way.tags || {};
    if (!includeHighways.has(tags.highway)) return;

    const name = tags.name || tags['name:zh'] || tags['name:en'] || tags.ref;
    if (!name || shouldExclude(name)) return;

    const refs = way.refs || way.nodes;
    if (!refs || refs.length < 2) return;

    const rawPath = refs.map(nid => nodes[nid]).filter(c => c);
    if (rawPath.length < 2) return;

    // ── 解析單向屬性 ──
    const isOneway = tags.oneway === 'yes' || tags.oneway === 'true' || tags.oneway === '1';
    const isReverseOneway = tags.oneway === '-1';
    const isRoundabout = tags.junction === 'roundabout';

    // ── 計算車道數 ──
    const totalLanes = tags.lanes ? parseInt(tags.lanes, 10) : null;
    const forwardCount = tags['lanes:forward'] ? parseInt(tags['lanes:forward'], 10) : null;
    const backwardCount = tags['lanes:backward'] ? parseInt(tags['lanes:backward'], 10) : null;

    let fwdCount, bwdCount;
    const defaultLanes = defaultLanesByType[tags.highway] || 1;

    if (isOneway || isRoundabout) {
        fwdCount = totalLanes || defaultLanes;
        bwdCount = 0;
    } else if (isReverseOneway) {
        fwdCount = 0;
        bwdCount = totalLanes || defaultLanes;
    } else {
        if (forwardCount !== null && backwardCount !== null) {
            fwdCount = forwardCount;
            bwdCount = backwardCount;
        } else if (totalLanes !== null) {
            if (forwardCount !== null) {
                fwdCount = forwardCount;
                bwdCount = totalLanes - forwardCount;
            } else if (backwardCount !== null) {
                bwdCount = backwardCount;
                fwdCount = totalLanes - backwardCount;
            } else {
                fwdCount = Math.ceil(totalLanes / 2);
                bwdCount = Math.floor(totalLanes / 2);
            }
        } else {
            fwdCount = defaultLanes;
            bwdCount = defaultLanes;
        }
    }

    fwdCount = Math.max(0, fwdCount);
    bwdCount = Math.max(0, bwdCount);

    // ── 先嘗試從 OSM turn:lanes 獲取精確車道方向 ──
    const forwardLanesTag = tags['turn:lanes:forward'];
    const backwardLanesTag = tags['turn:lanes:backward'];
    const bothLanesTag = tags['turn:lanes'];

    let hasOsmTurnData = false;
    let lanesForward, lanesBackward;

    if (bothLanesTag && !forwardLanesTag && !backwardLanesTag) {
        hasOsmTurnData = true;
        const parsed = parseTurnLanes(bothLanesTag);
        lanesForward = parsed.slice(0, fwdCount);
        lanesBackward = parsed.slice(-bwdCount);
    } else if (forwardLanesTag || backwardLanesTag) {
        hasOsmTurnData = true;
        lanesForward = forwardLanesTag ? parseTurnLanes(forwardLanesTag) : generateDefaultLanes(fwdCount);
        lanesBackward = backwardLanesTag ? parseTurnLanes(backwardLanesTag) : generateDefaultLanes(bwdCount);
    } else {
        // 無 OSM 轉彎資料 → 使用預設直行車道（後續將由交叉路口推斷更新）
        lanesForward = generateDefaultLanes(fwdCount);
        lanesBackward = generateDefaultLanes(bwdCount);
    }

    if (isRoundabout) {
        lanesForward = lanesForward.map(() => ({ icon: 'straight', label: '直走' }));
    }

    // ── 提取額外元數據 ──
    const destinations = [];
    if (tags['destination:lanes']) {
        destinations.push(...tags['destination:lanes'].split('|').map(d => d.trim()).filter(d => d));
    }
    if (tags['destination:lanes:forward']) {
        destinations.push(...tags['destination:lanes:forward'].split('|').map(d => d.trim()).filter(d => d));
    }

    // ── 切分路段 ──
    const segments = [];
    let currentSeg = {
        path: [rawPath[0]],
        lanesForward: lanesForward,
        lanesBackward: lanesBackward,
        hasOsmTurnData: hasOsmTurnData,
        len: 0
    };

    for (let i = 1; i < rawPath.length; i++) {
        const point = rawPath[i];
        const prevPoint = rawPath[i - 1];
        const dist = haversine(prevPoint[0], prevPoint[1], point[0], point[1]);

        currentSeg.path.push(point);
        currentSeg.len += dist;

        const shouldSplit = (i === rawPath.length - 1) || currentSeg.len >= 50;

        if (shouldSplit) {
            segments.push(currentSeg);
            currentSeg = {
                path: [point],
                lanesForward: lanesForward,
                lanesBackward: lanesBackward,
                hasOsmTurnData: hasOsmTurnData,
                len: 0
            };
        }
    }

    // 輸出路段
    segments.forEach(seg => {
        if (seg.len < 3 && segments.length > 1) return;

        const roadData = {
            id: `road_${idCounter++}`,
            name: name,
            path: seg.path,
            lanesForward: seg.lanesForward,
            lanesBackward: seg.lanesBackward,
            highway: tags.highway,
            oneway: isOneway || isReverseOneway || isRoundabout,
            length: Math.round(seg.len * 100) / 100,
            _hasOsmTurnData: seg.hasOsmTurnData || false  // 標記是否來自精確 OSM 數據
        };

        if (destinations.length > 0) {
            roadData.destinations = destinations;
        }
        if (isRoundabout) {
            roadData.junction = 'roundabout';
        }
        if (isReverseOneway) {
            roadData.reversed = true;
        }

        roadDatabase.push(roadData);
    });
});

// ====================================================================
//  步驟 1：交叉路口車道推斷（僅處理無 OSM turn 數據的路段）
// ====================================================================

// 分離有/無精確 OSM turn 數據的路段
const osmTurnSegments = roadDatabase.filter(r => r._hasOsmTurnData);
const inferSegments = roadDatabase.filter(r => !r._hasOsmTurnData);

console.log(`\n已從 OSM 提取 ${roadDatabase.length} 個路段`);
console.log(`  有精確 turn 數據: ${osmTurnSegments.length} 段（跳過推斷）`);
console.log(`  無 turn 數據: ${inferSegments.length} 段（將進行推斷）`);

// 對無 turn 數據的路段進行推斷
inferLaneDirections(inferSegments);

// 合併回去
const allSegments = [...osmTurnSegments, ...inferSegments];

// ====================================================================
//  步驟 2：合併相鄰相同配置的路段
// ====================================================================

function mergeSegments(roads) {
    if (roads.length === 0) return roads;

    const merged = [roads[0]];

    for (let i = 1; i < roads.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = roads[i];

        const canMerge =
            prev.name === curr.name &&
            prev.highway === curr.highway &&
            prev.oneway === curr.oneway &&
            prev.reversed === curr.reversed &&
            lanesEqual(prev.lanesForward, curr.lanesForward) &&
            lanesEqual(prev.lanesBackward, curr.lanesBackward) &&
            JSON.stringify(prev.destinations || []) === JSON.stringify(curr.destinations || []) &&
            prev._hasOsmTurnData === curr._hasOsmTurnData;

        if (canMerge &&
            prev.path[prev.path.length - 1][0] === curr.path[0][0] &&
            prev.path[prev.path.length - 1][1] === curr.path[0][1]) {
            prev.path = prev.path.concat(curr.path.slice(1));
            prev.length = Math.round((prev.length + curr.length) * 100) / 100;
        } else {
            merged.push(curr);
        }
    }

    return merged;
}

let finalDatabase = mergeSegments(allSegments);

// ====================================================================
//  步驟 3：應用手動修正（lane_overrides.json）
// ====================================================================

const overridesFile = path.join(__dirname, 'lane_overrides.json');

function loadOverrides() {
    if (!fs.existsSync(overridesFile)) {
        console.log('\n⚠ 未找到 lane_overrides.json，跳過手動修正');
        return [];
    }
    try {
        const overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
        console.log(`\n已載入 ${overrides.length} 條手動修正`);
        return overrides;
    } catch (e) {
        console.error('\n⚠ 無法解析 lane_overrides.json:', e.message);
        return [];
    }
}

function applyOverrides(roads, overrides) {
    if (overrides.length === 0) return roads;

    let applied = 0;
    overrides.forEach(override => {
        // 按 GPS 座標匹配：找到距離最近的路段
        let bestRoad = null;
        let bestDist = Infinity;

        roads.forEach(road => {
            road.path.forEach(pt => {
                const d = haversine(override.lat, override.lng, pt[0], pt[1]);
                if (d < bestDist) {
                    bestDist = d;
                    bestRoad = road;
                }
            });
        });

        if (bestRoad && bestDist < 30) {  // 30 米內匹配
            if (override.lanesForward) {
                bestRoad.lanesForward = override.lanesForward;
            }
            if (override.lanesBackward) {
                bestRoad.lanesBackward = override.lanesBackward;
            }
            applied++;
            console.log(`  ✓ 已應用修正: ${override.comment || override.name || '(無名稱)'} (距離 ${Math.round(bestDist)}m)`);
        } else if (bestRoad) {
            console.log(`  ⚠ 修正點太遠 (${Math.round(bestDist)}m)，已跳過: ${override.comment || override.name || ''}`);
        } else {
            console.log(`  ⚠ 找不到匹配路段: ${override.comment || override.name || ''}`);
        }
    });

    console.log(`  ✓ 共應用了 ${applied}/${overrides.length} 條手動修正`);
    return roads;
}

const overrides = loadOverrides();
finalDatabase = applyOverrides(finalDatabase, overrides);

// 清理內部標記
finalDatabase.forEach(r => delete r._hasOsmTurnData);

// 重新分配 ID
finalDatabase.forEach((r, idx) => {
    r.id = `road_${idx + 1}`;
});

// ── 統計 ──
const totalSegments = finalDatabase.length;
const withOsmTurn = roadDatabase.filter(r => r._hasOsmTurnData).length;
let inferredLaneSegments = 0;
finalDatabase.forEach(r => {
    const hasInferred = r.lanesForward.some(l => l.icon !== 'straight') ||
                        r.lanesBackward.some(l => l.icon !== 'straight');
    if (hasInferred) inferredLaneSegments++;
});

fs.writeFileSync(outputFile, JSON.stringify(finalDatabase, null, 2), 'utf8');

console.log('\n═══════════════════════════════════');
console.log('  建立完成');
console.log('═══════════════════════════════════');
console.log(`  原始路段數:    ${roadDatabase.length}`);
console.log(`  合併後路段數:  ${finalDatabase.length}`);
console.log(`  有 OSM turn:   ${withOsmTurn}`);
console.log(`  有推斷車道方向: ${inferredLaneSegments}`);
console.log(`  已輸出:        ${outputFile}`);
