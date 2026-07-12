const fs = require('fs');
const path = require('path');

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const city = process.argv[2] || 'macau';
const roadsFile = path.join(__dirname, 'data', city, 'roads.json');
const overridesFile = path.join(__dirname, 'data', city, 'lane_overrides.json');

if (!fs.existsSync(roadsFile)) {
    console.error(`找不到 roads.json: ${roadsFile}`);
    process.exit(1);
}
if (!fs.existsSync(overridesFile)) {
    console.log('沒有 lane_overrides.json，無需套用。');
    console.log('提示：從 editor.html 匯出 overrides 並放到 data/' + city + '/ 目錄');
    process.exit(0);
}

const roads = JSON.parse(fs.readFileSync(roadsFile, 'utf8'));
const overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));

if (!Array.isArray(overrides) || overrides.length === 0) {
    console.log('lane_overrides.json 是空的，無需套用。');
    process.exit(0);
}

let applied = 0;
overrides.forEach(ov => {
    let best = null, bestDist = Infinity;
    roads.forEach(r => {
        r.path.forEach(pt => {
            const d = haversine(ov.lat, ov.lng, pt[0], pt[1]);
            if (d < bestDist) { bestDist = d; best = r; }
        });
    });
    if (best && bestDist < 250) {
        if (ov.lanesForward && ov.lanesForward.length > 0) best.lanesForward = ov.lanesForward;
        if (ov.lanesBackward && ov.lanesBackward.length > 0) best.lanesBackward = ov.lanesBackward;
        applied++;
        console.log(`  ✓ ${ov.comment || '(無備註)'} → ${best.name} (距離 ${Math.round(bestDist)}m)`);
    } else if (best) {
        console.log(`  ⚠ ${ov.comment || '(無備註)'} 距離太遠 (${Math.round(bestDist)}m)，已跳過`);
    } else {
        console.log(`  ⚠ ${ov.comment || '(無備註)'} 找不到匹配路段`);
    }
});

fs.writeFileSync(roadsFile, JSON.stringify(roads, null, 2), 'utf8');
console.log(`\n已套用 ${applied}/${overrides.length} 條修正 → ${roadsFile}`);
