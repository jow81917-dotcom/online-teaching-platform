// backend/src/services/webhookService.js
// Centralized webhook sender with retry logic
const https = require('https');
const http  = require('http');

const CLASSROOM_URL = process.env.CLASSROOM_URL || 'http://localhost:3000';

/**
 * Send a webhook to the audio-relay server.
 * @param {string} path     - e.g. '/session-start' or '/session-end'
 * @param {object} payload  - JSON body to send
 * @param {number} retries  - how many times to retry on failure (default 3)
 */
const sendWebhook = (path, payload, retries = 3) => {
  const attempt = (remaining) => {
    try {
      const base       = CLASSROOM_URL.replace(/\/$/, '');
      const postData   = JSON.stringify(payload);
      const parsedUrl  = new URL(`${base}${path}`);
      const lib        = parsedUrl.protocol === 'https:' ? https : http;

      const req = lib.request({
        hostname : parsedUrl.hostname,
        port     : parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path     : parsedUrl.pathname,
        method   : 'POST',
        headers  : {
          'Content-Type'   : 'application/json',
          'Content-Length' : Buffer.byteLength(postData)
        }
      }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[webhook] ${path} ✅ (${res.statusCode})`);
          } else {
            console.warn(`[webhook] ${path} ⚠️ status ${res.statusCode}: ${body}`);
            if (remaining > 0) setTimeout(() => attempt(remaining - 1), 5000);
          }
        });
      });

      req.on('error', (e) => {
        console.warn(`[webhook] ${path} ❌ ${e.message} (${remaining} retries left)`);
        if (remaining > 0) setTimeout(() => attempt(remaining - 1), 5000);
      });

      req.write(postData);
      req.end();
    } catch (e) {
      console.warn(`[webhook] ${path} build error: ${e.message}`);
    }
  };

  attempt(retries);
};

module.exports = { sendWebhook };
