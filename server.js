const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 8080;
const ROOT = __dirname;

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pem': 'application/x-pem-file'
};

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function serve(req, res) {
    let filePath = path.join(ROOT, decodeURIComponent(req.url));
    if (filePath.endsWith(path.sep)) {
        filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('404 找不到頁面');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('500 伺服器錯誤');
            }
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    });
}

let httpsServer;
try {
    const key = fs.readFileSync(path.join(__dirname, 'key.pem'));
    const cert = fs.readFileSync(path.join(__dirname, 'cert.pem'));

    httpsServer = https.createServer({ key, cert }, serve);
    httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
        const localIP = getLocalIP();
        console.log('LaneGo HTTPS 伺服器已啟動');
        console.log(`本機 HTTPS： https://127.0.0.1:${HTTPS_PORT}`);
        console.log(`區網 HTTPS：https://${localIP}:${HTTPS_PORT}`);
    });
} catch (e) {
    console.error('無法啟動 HTTPS 伺服器，請先執行 node generate-cert.js 產生憑證');
    console.error(e.message);
}

// HTTP 伺服器：自動導向到 HTTPS
const httpServer = http.createServer((req, res) => {
    const host = req.headers.host ? req.headers.host.split(':')[0] : '127.0.0.1';
    const target = `https://${host}:${HTTPS_PORT}${req.url}`;
    res.writeHead(301, { Location: target });
    res.end();
});

httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP 轉 HTTPS 伺服器已啟動： http://0.0.0.0:${HTTP_PORT} -> https`);
});
