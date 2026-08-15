// 本地静态服务器（用于 PWA 测试）：node scripts/serve.js [端口]
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8124;
const DIR = __dirname + '/..';
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.md': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
    const rel = req.url === '/' ? '/index.html' : req.url.replace(/\?.*/, '');
    const fp = path.normalize(path.join(DIR, rel));
    if (!fp.startsWith(path.normalize(DIR)) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('not found: ' + rel);
        return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
}).listen(PORT, () => {
    console.log(`PWA 测试服务: http://localhost:${PORT}/  (根目录: ${DIR})`);
});
