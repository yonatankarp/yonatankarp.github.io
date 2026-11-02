const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { parsePng } = require("../compare-visual-captures");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

// A PNG of the given rows, each a filter byte followed by its already filtered bytes.
function png(width, height, colorType, rows, { interlace = 0 } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(colorType, 9);
  ihdr.writeUInt8(interlace, 12);
  const raw = Buffer.from(rows.flat());
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "png-")), "test.png");
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
  return file;
}

test("parsePng reads an unfiltered RGB image", () => {
  const file = png(2, 1, 2, [[0, 10, 20, 30, 40, 50, 60]]);
  assert.deepEqual(parsePng(file), { width: 2, height: 1, channels: 3, pixels: Buffer.from([10, 20, 30, 40, 50, 60]) });
});

test("parsePng undoes the Sub, Up, Average and Paeth filters", () => {
  // Grey + alpha, 2 pixels a row; every row decodes to the same bytes [10, 255, 30, 255] under the filter that row names.
  const want = [10, 255, 30, 255];
  const rows = [
    [0, 10, 255, 30, 255],             // None
    [1, 10, 255, 20, 0],               // Sub: each byte less the one a pixel to its left
    [2, 0, 0, 0, 0],                   // Up: less the byte above
    [3, 5, 128, 10, 0],                // Average: less the floor of the mean of left and up
    [4, 0, 0, 0, 0],                   // Paeth: less the nearest of left, up and up-left to left + up - up-left
  ];
  const decoded = parsePng(png(2, rows.length, 4, rows));
  assert.equal(decoded.channels, 2);
  for (let y = 0; y < rows.length; y++) {
    assert.deepEqual([...decoded.pixels.subarray(y * 4, y * 4 + 4)], want, `row ${y}`);
  }
});

test("parsePng gives up on what it cannot decode", () => {
  const notPng = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "png-")), "x.png");
  fs.writeFileSync(notPng, "not a png at all, just text");
  assert.equal(parsePng(notPng), null);
  assert.equal(parsePng(png(1, 1, 3, [[0, 0]])), null);        // a palette image: no channel count
  assert.equal(parsePng(png(1, 1, 0, [[9, 0]])), null);        // an unknown filter
});
