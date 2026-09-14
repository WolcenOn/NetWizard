#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 4173);
const mime = {
  '.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.ico':'image/x-icon'
};

function resolveRequest(url){
  let pathname;
  try { pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname); }
  catch { return null; }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  return target === root || target.startsWith(root + path.sep) ? target : null;
}

const server = http.createServer((request, response) => {
  const target = resolveRequest(request.url || '/');
  if(!target){ response.writeHead(400).end('Bad request'); return; }
  fs.stat(target, (statError, stat) => {
    const file = !statError && stat.isDirectory() ? path.join(target, 'index.html') : target;
    fs.readFile(file, (readError, body) => {
      if(readError){ response.writeHead(readError.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
      response.writeHead(200, {
        'Content-Type':mime[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff'
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    });
  });
});

server.listen(port, '127.0.0.1', () => console.log(`NetWizard: http://127.0.0.1:${port}`));
