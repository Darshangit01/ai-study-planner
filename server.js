/* Zero-dependency static file server for the AI Study Planner.
   Run: node server.js  →  http://localhost:5173
   This serves the front-end only. No secrets are stored or exposed here.
   To add real AI planning, create a separate authenticated route that keeps
   your API key server-side and set window.STUDY_AI_ENDPOINT to point at it. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // Prevent path traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safe);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

// Start on PORT; if it's busy, automatically try the next few ports so
// re-running the server never crashes with EADDRINUSE.
function start(port, attemptsLeft) {
  server.once('error', err => {
    if (err.code === 'EADDRINUSE') {
      if (attemptsLeft > 0) {
        console.log('Port ' + port + ' is in use, trying ' + (port + 1) + '…');
        start(port + 1, attemptsLeft - 1);
      } else {
        console.error('All candidate ports are in use. A server may already be running — open http://localhost:' + PORT + '/');
        process.exit(1);
      }
    } else {
      throw err;
    }
  });
  server.listen(port, () => {
    console.log('Focus Study Planner running at http://localhost:' + port);
    console.log('Press Ctrl+C to stop.');
  });
}

start(Number(PORT), 10);

