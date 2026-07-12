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

// ── 已包含道路类型 ──
const includeHighways = new Set([
    'motorway', 'motorway_link', 'trunk', 'trunk_link',
    'primary', 'primary_link', 'secondary', 'secondary_link',
    'tertiary', 'tertiary_link',
    'residential', 'unclassified', 'living_street', 'road',
    'service', 'pedestrian'
]);

const excludeKeywords = [
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
];

function shouldExclude(name) {
    return excludeKeywords.some(kw => name.includes(kw));
}

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

// ── 生成每段道路，每个相邻节点之间切为独立段 ──
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

    // 在每个路径点之间都切分为独立段（最大粒度）
    const segments = [];
    for (let i = 1; i < rawPath.length; i++) {
        segments.push([rawPath[i - 1], rawPath[i]]);
    }

    // 没有路口节点的整条路
    if (segments.length === 0) return;

    const totalLanes = tags.lanes ? parseInt(tags.lanes, 10) : null;
    const forwardCount = tags['lanes:forward'] ? parseInt(tags['lanes:forward'], 10) : null;
    const backwardCount = tags['lanes:backward'] ? parseInt(tags['lanes:backward'], 10) : null;
    const fwdCount = forwardCount || (totalLanes ? Math.max(2, Math.round(totalLanes / 2)) : 2);
    const bwdCount = backwardCount || (totalLanes ? Math.max(2, Math.round(totalLanes / 2)) : 2);

    const forwardLanes = tags['turn:lanes:forward'];
    const backwardLanes = tags['turn:lanes:backward'];
    const bothLanes = tags['turn:lanes'];

    const lanesForward = forwardLanes ? parseTurnLanes(forwardLanes)
                        : (bothLanes && !backwardLanes) ? parseTurnLanes(bothLanes).slice(0, fwdCount)
                        : bothLanes ? parseTurnLanes(bothLanes)
                        : generateDefaultLanes(fwdCount);

    const lanesBackward = backwardLanes ? parseTurnLanes(backwardLanes)
                         : (bothLanes && !forwardLanes) ? parseTurnLanes(bothLanes).slice(-bwdCount)
                         : bothLanes ? parseTurnLanes(bothLanes)
                         : generateDefaultLanes(bwdCount);

    segments.forEach(seg => {
        roadDatabase.push({
            id: `road_${idCounter++}`,
            name: name,
            path: seg,
            lanesForward: lanesForward,
            lanesBackward: lanesBackward
        });
    });
});

fs.writeFileSync(outputFile, JSON.stringify(roadDatabase, null, 2), 'utf8');
console.log(`總道路段數: ${roadDatabase.length}`);
console.log(`已輸出: ${outputFile}`);
