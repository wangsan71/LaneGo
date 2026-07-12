const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
    console.log(`
═══════════════════════════════════════════════════════
  LaneGo OSM 管線 — 一鍵 PBF → JSON → roads.json
═══════════════════════════════════════════════════════

用法:
  node osm_pipeline.js <pbf檔案> <城市名稱> [選項]

參數:
  <pbf檔案>    OSM PBF 檔案路徑（絕對或相對路徑）
  <城市名稱>    城市代碼，輸出到 data/<城市名稱>/

選項:
  --keep-json   保留中間產物 data/<城市>/osm_fr.json
                預設會自動刪除以節省空間
  -h, --help    顯示此說明

範例:
  node osm_pipeline.js macau.osm.pbf macau
  node osm_pipeline.js hongkong.osm.pbf hongkong --keep-json
  node osm_pipeline.js D:\\osm\\tokyo.pbf tokyo

完整流程（自動執行）:
  1. 建立 data/<城市>/ 目錄
  2. PBF → JSON   (pbf_to_json.js)
  3. JSON → roads  (build_roads.js)
  4. 清理中間檔案  (預設刪除 osm_fr.json)
`);
}

const args = process.argv.slice(2);

if (args.length < 2 || args.includes('--help') || args.includes('-h')) {
    usage();
    process.exit(args.length < 2 ? 1 : 0);
}

const pbfFile = path.resolve(args[0]);
const city = args[1];
const keepJson = args.includes('--keep-json');

if (!fs.existsSync(pbfFile)) {
    console.error(`找不到 PBF 檔案: ${pbfFile}`);
    process.exit(1);
}

const cityDir = path.join(__dirname, 'data', city);
const jsonFile = path.join(cityDir, 'osm_fr.json');
const roadsFile = path.join(cityDir, 'roads.json');
const pbfToJson = path.join(__dirname, 'pbf_to_json.js');
const buildRoads = path.join(__dirname, 'build_roads.js');

const startTime = Date.now();
console.log(`\n開始處理城市: ${city}`);
console.log(`PBF 檔案:      ${pbfFile}`);
console.log(`輸出目錄:      ${cityDir}\n`);

try {
    // ── 步驟 1：建立城市目錄 ──
    console.log('[1/3] 建立城市目錄...');
    fs.mkdirSync(cityDir, { recursive: true });
    console.log(`  ✓ ${cityDir}\n`);

    // ── 步驟 2：PBF → JSON ──
    console.log('[2/3] PBF → JSON 轉換 (pbf_to_json.js)...');
    const step2 = Date.now();
    execSync(`node "${pbfToJson}" "${pbfFile}" "${jsonFile}"`, {
        stdio: 'inherit',
        cwd: __dirname
    });
    const jsonSize = (fs.statSync(jsonFile).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ 完成 (${jsonSize} MB, ${((Date.now() - step2) / 1000).toFixed(1)}s)\n`);

    // ── 步驟 3：JSON → roads ──
    console.log(`[3/3] JSON → roads 建置 (build_roads.js) → ${city}...`);
    const step3 = Date.now();
    execSync(`node "${buildRoads}" "${city}"`, {
        stdio: 'inherit',
        cwd: __dirname
    });
    const roadsSize = (fs.statSync(roadsFile).size / 1024 / 1024).toFixed(1);
    console.log(`  ✓ 完成 (${roadsSize} MB, ${((Date.now() - step3) / 1000).toFixed(1)}s)\n`);

    // ── 步驟 4：清理中間檔案 ──
    if (!keepJson) {
        fs.unlinkSync(jsonFile);
        console.log('[清理] 已刪除中間檔案 osm_fr.json');
    } else {
        console.log('[保留] osm_fr.json (--keep-json)');
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n═══════════════════════════════════`);
    console.log(`  全部完成！總耗時: ${totalTime}s`);
    console.log(`  輸出檔案: ${roadsFile}`);
    console.log(`═══════════════════════════════════\n`);

} catch (err) {
    console.error(`\n管線處理失敗: ${err.message}`);
    process.exit(1);
}
