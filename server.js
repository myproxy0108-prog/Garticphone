const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const CF_WORKER_URLS = [
    "https://gartic-phone.nemu0001.workers.dev",
    "https://gartic-phone.myproxy0108.workers.dev",
    "https://gartic-phone.72016.workers.dev"
];

let globalIndex = 0;
const badWorkers = new Set();
const ERROR_COOLDOWN_MS = 6000000; 

function getHealthyWorker() {
    let attempts = 0;
    while (attempts < CF_WORKER_URLS.length) {
        const workerUrl = CF_WORKER_URLS[globalIndex % CF_WORKER_URLS.length];
        globalIndex++;
        
        if (!badWorkers.has(workerUrl)) {
            return workerUrl;
        }
        attempts++;
    }
    return CF_WORKER_URLS[0];
}

function markWorkerAsBad(workerUrl) {
    if (!badWorkers.has(workerUrl)) {
        console.warn(`[Failover] Worker Down: ${workerUrl}`);
        badWorkers.add(workerUrl);
        setTimeout(() => {
            badWorkers.delete(workerUrl);
            console.log(`[Failover] Worker Restored: ${workerUrl}`);
        }, ERROR_COOLDOWN_MS);
    }
}

const proxyOptions = {
    router: () => getHealthyWorker(),
    
    changeOrigin: true,
    ws: true,
    
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Forwarded-Host', req.get('host'));
        proxyReq.setHeader('X-Forwarded-Proto', 'https');
    },
    
    onProxyRes: (proxyRes, req, res) => {
        if (proxyRes.statusCode === 1101 || proxyRes.statusCode >= 500) {
            const failedUrl = proxyRes.req.protocol + "//" + proxyRes.req.host;
            markWorkerAsBad(failedUrl);
        }
        delete proxyRes.headers['content-security-policy'];
        delete proxyRes.headers['x-frame-options'];
        proxyRes.headers['access-control-allow-origin'] = '*';
    },

    onError: (err, req, res) => {
        console.error('[Network Error]', err.message);
        const failedUrl = err.address ? `https://${err.address}` : null;
        if (failedUrl) markWorkerAsBad(failedUrl);

        if (!res.headersSent) {
            res.status(502).send("Connecting to next available server... Please refresh.");
        }
    },

    logLevel: 'silent', 
    proxyTimeout: 30000 
};

app.use('*', createProxyMiddleware(proxyOptions));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--- にっこり ---`);
    console.log(`Active Nodes: ${CF_WORKER_URLS.length}`);
});
