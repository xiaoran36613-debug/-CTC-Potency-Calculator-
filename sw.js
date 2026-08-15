/* CTC Potency Calculator - Service Worker
 * 离线策略:
 *   - 安装时预缓存应用外壳 (index.html / manifest / 图标 / SheetJS CDN)
 *   - 页面导航: 网络优先, 失败或超时回退到缓存 (保证联网时能拿到新版本, 断网时仍可打开)
 *   - 静态资源与 CDN: 缓存优先, 未命中再取网络并写回缓存
 *   - 版本号变更后旧缓存自动清理
 * 注意: 所有计算逻辑都在页面内本地完成, 本 SW 不发起任何携带用户数据的请求。
 */
const CACHE_VERSION = 'ctc-v1.0.0';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-192.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon.png',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];
const CDN_PREFIX = 'https://cdnjs.cloudflare.com/';

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // 逐个缓存, 单个失败(如临时断网)不阻塞安装
        await Promise.allSettled(
            APP_SHELL.map(async (url) => {
                const req = new Request(url, url.startsWith('http') ? { cache: 'reload' } : {});
                await cache.add(req);
            })
        );
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

// 页面主动 postMessage({type:'SKIP_WAITING'}) 时立即启用新版本
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// 带超时的 fetch, 弱网时快速回退缓存
function fetchWithTimeout(request, timeoutMs) {
    return Promise.race([
        fetch(request),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    // 页面导航: 网络优先, 离线/超时回退缓存
    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const fresh = await fetchWithTimeout(request, 5000);
                const cache = await caches.open(CACHE_VERSION);
                cache.put('./index.html', fresh.clone());
                return fresh;
            } catch (e) {
                const cached =
                    (await caches.match(request)) ||
                    (await caches.match('./index.html')) ||
                    (await caches.match('./'));
                return cached || new Response('离线且无缓存', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
            }
        })());
        return;
    }

    // 静态资源 / CDN 脚本: 缓存优先
    event.respondWith((async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
            const response = await fetch(request);
            // 仅缓存同源资源与白名单 CDN 的成功响应
            const url = new URL(request.url);
            if (response.ok && (url.origin === self.location.origin || url.href.startsWith(CDN_PREFIX))) {
                const cache = await caches.open(CACHE_VERSION);
                cache.put(request, response.clone());
            }
            return response;
        } catch (e) {
            return new Response('', { status: 504 });
        }
    })());
});
