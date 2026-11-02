// Serves public/ on a free local port the way GitHub Pages does: a directory answers with its index.html,
// a missing path with 404.html and a 404 status, and a Range request with 206. check-csp.js and
// capture-screenshots.js load the built site through it, so they test the minified files that ship.

const fs = require("fs");
const http = require("http");
const path = require("path");
const { publicDir } = require("./lib");

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

function serve() {
  const server = http.createServer((req, res) => {
    let pathname;

    try {
      pathname = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    } catch {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Bad request");
      return;
    }

    let file = path.normalize(path.join(publicDir, pathname));

    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) {
      file = publicDir;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }

    const found = fs.existsSync(file);
    const served = found ? file : path.join(publicDir, "404.html");
    const body = fs.readFileSync(served);
    const headers = {
      "accept-ranges": "bytes",
      "content-type": types[path.extname(served).toLowerCase()] || "application/octet-stream",
    };
    const range = found && req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);   // the videos ask for ranges

    if (range) {
      const start = Number(range[1]);
      const end = Math.min(range[2] ? Number(range[2]) : body.length - 1, body.length - 1);

      if (start > end) {
        res.writeHead(416, { ...headers, "content-range": `bytes */${body.length}` });
        res.end();
        return;
      }

      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": end - start + 1 });
      res.end(body.subarray(start, end + 1));
      return;
    }

    res.writeHead(found ? 200 : 404, headers);
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

module.exports = { publicDir, serve };
