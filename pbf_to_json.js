const fs = require('fs');
const path = require('path');
const osmParser = require('osm-pbf-parser');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || inputFile.replace(/\.(osm\.)?pbf$/, '') + '_osm_fr.json';

if (!inputFile) {
    console.log('用法: node pbf_to_json.js <input.osm.pbf> [output.json]');
    console.log('範例: node pbf_to_json.js macau.osm.pbf macau_osm_fr.json');
    process.exit(1);
}

if (!fs.existsSync(inputFile)) {
    console.error('找不到檔案:', inputFile);
    process.exit(1);
}

console.log(`讀取 PBF 檔案: ${inputFile}`);

const fileStream = fs.createReadStream(inputFile);
const parser = osmParser();

const elements = [];
const nodeMap = {};

parser.on('data', (items) => {
    items.forEach((item) => {
        if (item.type === 'node') {
            nodeMap[item.id] = [item.lat, item.lon];
            elements.push({
                type: 'node',
                id: item.id,
                lat: item.lat,
                lon: item.lon
            });
        } else if (item.type === 'way' && item.tags && item.tags.highway) {
            elements.push({
                type: 'way',
                id: item.id,
                nodes: item.refs,
                tags: item.tags
            });
        }
    });
});

parser.on('error', (err) => {
    console.error('解析 PBF 時發生錯誤:', err.message);
    process.exit(1);
});

parser.on('end', () => {
    console.log(`已解析 ${elements.length} 個元素 (nodes + ways)`);

    const output = {
        version: 0.6,
        generator: 'pbf_to_json.js',
        osm3s: {
            timestamp_osm_base: new Date().toISOString().replace('T', ' ').slice(0, 19) + 'Z',
            copyright: 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.'
        },
        elements: elements
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
    console.log(`已輸出: ${outputFile} (${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(1)} MB)`);
});

fileStream.pipe(parser);
