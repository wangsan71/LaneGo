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

function buildPath(way) {
    return way.nodes.map(nodeId => nodes[nodeId]).filter(coord => coord);
}

function parseTurnLanes(value) {
    if (!value) return null;

    // 單一轉向對照
    const singleMapping = {
        'left': { icon: '⬅', label: '左轉' },
        'slight_left': { icon: '↖', label: '左前方' },
        'sharp_left': { icon: '⬅', label: '左轉' },
        'through': { icon: '⬆', label: '直走' },
        'right': { icon: '➡', label: '右轉' },
        'slight_right': { icon: '↗', label: '右前方' },
        'sharp_right': { icon: '➡', label: '右轉' },
        'merge_to_left': { icon: '↖', label: '靠左' },
        'merge_to_right': { icon: '↗', label: '靠右' },
        'reverse': { icon: '↩', label: '迴轉' },
        'none': { icon: '⬆', label: '直走' }
    };

    return value.split('|').map(part => {
        const turns = part.split(';').map(t => t.trim()).filter(t => t);
        if (turns.length === 0) return { icon: '⬆', label: '直走' };
        if (turns.length === 1) return singleMapping[turns[0]] || { icon: '⬆', label: '直走' };

        // 複合轉向：例如 through;left -> 直走+左轉
        const hasLeft = turns.includes('left') || turns.includes('slight_left') || turns.includes('sharp_left');
        const hasRight = turns.includes('right') || turns.includes('slight_right') || turns.includes('sharp_right');
        const hasThrough = turns.includes('through') || turns.includes('none');

        if (hasLeft && hasThrough) {
            return { icon: '↑↰', label: '直走 / 左轉' };
        }
        if (hasRight && hasThrough) {
            return { icon: '↑↱', label: '直走 / 右轉' };
        }
        if (hasLeft && hasRight) {
            return { icon: '↰↱', label: '左轉 / 右轉' };
        }

        // 其他複合狀況取第一個
        return singleMapping[turns[0]] || { icon: '⬆', label: '直走' };
    });
}

function generateDefaultLanes(numLanes) {
    const lanes = [];
    for (let i = 0; i < numLanes; i++) {
        if (numLanes >= 2 && i === 0) {
            // 最左車道：可直走 + 左轉
            lanes.push({ icon: '↑↰', label: '直走 / 左轉' });
        } else if (numLanes >= 2 && i === numLanes - 1) {
            // 最右車道：可直走 + 右轉
            lanes.push({ icon: '↑↱', label: '直走 / 右轉' });
        } else {
            lanes.push({ icon: '⬆', label: '直走' });
        }
    }
    return lanes;
}

function canMerge(end, start) {
    const epsilon = 0.00001;
    return Math.abs(end[0] - start[0]) < epsilon && Math.abs(end[1] - start[1]) < epsilon;
}

function mergePaths(paths) {
    if (paths.length === 0) return [];
    if (paths.length === 1) return paths[0];

    const merged = [...paths[0]];
    const used = new Set([0]);

    while (used.size < paths.length) {
        const last = merged[merged.length - 1];
        let found = false;

        for (let i = 0; i < paths.length; i++) {
            if (used.has(i)) continue;

            if (canMerge(last, paths[i][0])) {
                merged.push(...paths[i].slice(1));
                used.add(i);
                found = true;
                break;
            }
            if (canMerge(last, paths[i][paths[i].length - 1])) {
                merged.push(...[...paths[i]].reverse().slice(1));
                used.add(i);
                found = true;
                break;
            }
        }

        if (!found) break;
    }

    return merged;
}

// 只保留主要道路
const majorHighways = new Set(['motorway', 'trunk', 'primary', 'secondary']);

// 排除橫琴 / 珠海道路關鍵字
const excludeKeywords = [
    '横琴', '环岛', '情侣路', '长隆', '荣澳', '琴海', '汇通', '海翼橋', '海琴桥', '非桥',
    '艺文', '天羽道', '伯牙', '知音', '宝盛路', '富祥湾', '屏湾', '会展', '通航', '银湾路',
    '大横琴山', '福临道', '安临路', '吉临路', '香江路', '粤华路', '顺景路', '荣港道', '十字门',
    '南湾北路', '南湾南路', '桂花南路', '港澳大道'
];

function shouldExclude(name) {
    return excludeKeywords.some(kw => name.includes(kw));
}

const grouped = {};

ways.forEach(way => {
    const tags = way.tags || {};
    if (!majorHighways.has(tags.highway)) return;

    const name = tags.name || tags['name:zh'] || tags['name:en'] || tags.ref;
    if (!name) return;
    if (shouldExclude(name)) return;

    const path = buildPath(way);
    if (path.length < 2) return;

    const lanesCount = tags.lanes ? parseInt(tags.lanes, 10) : 2;
    const forwardLanes = tags['turn:lanes:forward'];
    const backwardLanes = tags['turn:lanes:backward'];
    const bothLanes = tags['turn:lanes'];

    const lanesForward = forwardLanes ? parseTurnLanes(forwardLanes)
                        : bothLanes ? parseTurnLanes(bothLanes)
                        : generateDefaultLanes(lanesCount);

    const lanesBackward = backwardLanes ? parseTurnLanes(backwardLanes)
                         : bothLanes ? parseTurnLanes(bothLanes)
                         : generateDefaultLanes(lanesCount);

    if (!grouped[name]) {
        grouped[name] = { paths: [], lanesForward, lanesBackward };
    }
    grouped[name].paths.push(path);
});

const roadDatabase = [];
let idCounter = 1;

Object.entries(grouped).forEach(([name, info]) => {
    const merged = mergePaths(info.paths);
    if (merged.length < 2) return;

    roadDatabase.push({
        id: `road_${idCounter++}`,
        name: name,
        path: merged,
        lanesForward: info.lanesForward,
        lanesBackward: info.lanesBackward
    });
});

fs.writeFileSync(outputFile, JSON.stringify(roadDatabase, null, 2), 'utf8');

console.log(`總道路數：${roadDatabase.length}`);
console.log(`已輸出：${outputFile}`);
console.log('道路列表：');
roadDatabase.forEach(r => {
    console.log(`- ${r.name} (${r.path.length} 點, 順向 ${r.lanesForward.length} 車道)`);
});
