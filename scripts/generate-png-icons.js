import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);
  const crcVal = zlib.crc32(typeAndData);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal >>> 0, 0);
  return Buffer.concat([len, typeAndData, crcBuf]);
}

function generatePngBuffer(width, height, drawPixelFn) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth
  ihdr[9] = 6; // Color type (RGBA)
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method
  const ihdrChunk = createPngChunk('IHDR', ihdr);

  // IDAT - Raw scanlines (1 filter byte + 4 bytes per pixel)
  const scanlineSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineSize);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineSize;
    rawData[rowOffset] = 0; // None filter
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawPixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createPngChunk('IDAT', compressedData);

  // IEND
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Color definitions
const EMERALD = [4, 120, 87, 255];   // #047857
const WARM_IVORY = [250, 248, 245, 255]; // #FAF8F5
const TRANSPARENT = [0, 0, 0, 0];

function drawBricojobIcon(x, y, width, height, isMaskable = false) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = width / 512;

  // Background shape
  let inBackground = false;
  if (isMaskable) {
    // Full bleed square for Android maskable icon
    inBackground = true;
  } else {
    // Rounded rectangle for standard icon
    const cornerRadius = 110 * scale;
    const dx = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
    const dy = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
    inBackground = (dx * dx + dy * dy) <= (cornerRadius * cornerRadius);
  }

  if (!inBackground) return TRANSPARENT;

  // House Roof geometry
  const roofTopY = cy - 120 * scale;
  const roofBaseY = cy - 20 * scale;
  const roofHalfWidth = 120 * scale;

  // Wall geometry
  const wallLeftX = cx - 100 * scale;
  const wallRightX = cx + 100 * scale;
  const wallBottomY = cy + 130 * scale;

  // Door / Notch geometry
  const doorLeftX = cx - 40 * scale;
  const doorRightX = cx + 40 * scale;
  const doorTopY = cy + 40 * scale;

  // Check Roof (Triangle)
  let inRoof = false;
  if (y >= roofTopY && y <= roofBaseY) {
    const progress = (y - roofTopY) / (roofBaseY - roofTopY);
    const currentHalfW = progress * roofHalfWidth;
    if (Math.abs(x - cx) <= currentHalfW) {
      inRoof = true;
    }
  }

  // Check Main Wall
  let inWall = false;
  if (y >= roofBaseY && y <= wallBottomY && x >= wallLeftX && x <= wallRightX) {
    // Cut out inner door / notch
    if (!(x >= doorLeftX && x <= doorRightX && y >= doorTopY)) {
      inWall = true;
    }
  }

  // Check Inner Circle in house
  const circleRadius = 30 * scale;
  const distToCircleCenter = Math.hypot(x - cx, y - (cy - 30 * scale));
  const inCircle = distToCircleCenter <= circleRadius;

  if (inCircle) {
    return EMERALD;
  }

  if (inRoof || inWall) {
    return WARM_IVORY;
  }

  return EMERALD;
}

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PNG icons...');

// 1. icon-192.png
const icon192 = generatePngBuffer(192, 192, (x, y, w, h) => drawBricojobIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('✓ Created /public/icon-192.png (192x192, ' + icon192.length + ' bytes)');

// 2. icon-512.png
const icon512 = generatePngBuffer(512, 512, (x, y, w, h) => drawBricojobIcon(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('✓ Created /public/icon-512.png (512x512, ' + icon512.length + ' bytes)');

// 3. icon-512-maskable.png
const icon512Maskable = generatePngBuffer(512, 512, (x, y, w, h) => drawBricojobIcon(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'icon-512-maskable.png'), icon512Maskable);
console.log('✓ Created /public/icon-512-maskable.png (512x512 maskable, ' + icon512Maskable.length + ' bytes)');
