const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const CF_WORKER_URLS = [
    "https://gartic-phone.nemu0001.workers.dev",
    "https://gartic-phone.myproxy0108.workers.dev",
    "https://gartic-phone.72016.workers.dev"
];

function getWorkerForUser(ip) {
    let hash = 0;
    for (let i = 0; i < ip.length; i++) {
        hash = ip.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % CF_WORKER_URLS.length;
    return CF_WORKER_URLS[index];
}

// 通信安定化エージェント
const proxyAgent = new https.Agent({ 
    keepAlive: true, 
    maxSockets: 512, 
    timeout: 60000 
});


app.use('/', createProxyMiddleware({
    router: (req) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        return getWorkerForUser(ip);
    },
    changeOrigin: true,
    ws: true, 持
    agent: proxyAgent,
    
    onProxyReq: (proxyReq, req, res) => {
     
        proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
        proxyReq.setHeader('Accept-Encoding', 'identity');
    },
    
    onProxyRes: (proxyRes, req, res) => {
        delete proxyRes.headers['content-security-policy'];
        delete proxyRes.headers['x-frame-options'];
        proxyRes.headers['access-control-allow-origin'] = '*';
        
        // Content-Lengthを消すことで、「途中で表示が切れるバグ」を防ぐ
        delete proxyRes.headers['content-length'];
    },
    
    logLevel: 'error' // ログの出すぎを防ぐ
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stable Cluster Proxy running on port ${PORT}`));
