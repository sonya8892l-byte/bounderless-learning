// 本地生成固定 Version 12-L 的 QR Code，足够容纳 367 个 UTF-8 字节。
// 入课凭证不会发往第三方二维码服务。
const VERSION = 12;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 370;
const EC_CODEWORDS_PER_BLOCK = 24;
const DATA_BLOCK_LENGTHS = [92, 92, 93, 93];
const ALIGNMENT_POSITIONS = [6, 32, 58];

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let value = 1, index = 0; index < 255; index += 1) {
  EXP[index] = value;
  LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < EXP.length; index += 1) EXP[index] = EXP[index - 255];

function multiply(left, right) {
  return left && right ? EXP[LOG[left] + LOG[right]] : 0;
}

function generatorPolynomial(degree) {
  let result = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array(result.length + 1).fill(0);
    result.forEach((coefficient, offset) => {
      next[offset] ^= coefficient;
      next[offset + 1] ^= multiply(coefficient, EXP[index]);
    });
    result = next;
  }
  return result;
}

const GENERATOR = generatorPolynomial(EC_CODEWORDS_PER_BLOCK);

function errorCorrection(data) {
  const remainder = new Array(EC_CODEWORDS_PER_BLOCK).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < remainder.length; index += 1) {
      remainder[index] ^= multiply(GENERATOR[index + 1], factor);
    }
  }
  return remainder;
}

function appendBits(bits, value, length) {
  for (let shift = length - 1; shift >= 0; shift -= 1) bits.push((value >>> shift) & 1);
}

function dataCodewords(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const capacityBits = DATA_CODEWORDS * 8;
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));
  if (bits.length > capacityBits) throw new Error('入课链接过长，无法生成二维码。');
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const result = [];
  for (let index = 0; index < bits.length; index += 8) {
    result.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; result.length < DATA_CODEWORDS; pad += 1) result.push(pad % 2 ? 0x11 : 0xec);
  return result;
}

function interleavedCodewords(text) {
  const data = dataCodewords(text);
  const blocks = [];
  let offset = 0;
  for (const length of DATA_BLOCK_LENGTHS) {
    const block = data.slice(offset, offset + length);
    blocks.push({ data: block, correction: errorCorrection(block) });
    offset += length;
  }
  const result = [];
  for (let index = 0; index < Math.max(...DATA_BLOCK_LENGTHS); index += 1) {
    blocks.forEach((block) => { if (index < block.data.length) result.push(block.data[index]); });
  }
  for (let index = 0; index < EC_CODEWORDS_PER_BLOCK; index += 1) {
    blocks.forEach((block) => result.push(block.correction[index]));
  }
  return result;
}

function formatBits(mask) {
  const data = (1 << 3) | mask; // Error correction L = 01.
  let remainder = data;
  for (let index = 0; index < 10; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
}

function versionBits() {
  let remainder = VERSION;
  for (let index = 0; index < 12; index += 1) remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  return (VERSION << 12) | remainder;
}

export function qrCodeMatrix(text) {
  const modules = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const functions = Array.from({ length: SIZE }, () => new Array(SIZE).fill(false));
  const setFunction = (x, y, dark) => {
    modules[y][x] = Boolean(dark);
    functions[y][x] = true;
  };

  const drawFinder = (centerX, centerY) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) continue;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(x, y, distance !== 2 && distance !== 4);
      }
    }
  };

  for (let index = 0; index < SIZE; index += 1) {
    setFunction(6, index, index % 2 === 0);
    setFunction(index, 6, index % 2 === 0);
  }
  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  ALIGNMENT_POSITIONS.forEach((centerY, row) => {
    ALIGNMENT_POSITIONS.forEach((centerX, column) => {
      if ((row === 0 && column === 0)
        || (row === 0 && column === ALIGNMENT_POSITIONS.length - 1)
        || (row === ALIGNMENT_POSITIONS.length - 1 && column === 0)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setFunction(centerX + dx, centerY + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  const format = formatBits(0);
  const bit = (value, index) => ((value >>> index) & 1) !== 0;
  for (let index = 0; index <= 5; index += 1) setFunction(8, index, bit(format, index));
  setFunction(8, 7, bit(format, 6));
  setFunction(8, 8, bit(format, 7));
  setFunction(7, 8, bit(format, 8));
  for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, bit(format, index));
  for (let index = 0; index < 8; index += 1) setFunction(SIZE - 1 - index, 8, bit(format, index));
  for (let index = 8; index < 15; index += 1) setFunction(8, SIZE - 15 + index, bit(format, index));
  setFunction(8, SIZE - 8, true);

  const version = versionBits();
  for (let index = 0; index < 18; index += 1) {
    const dark = bit(version, index);
    const a = SIZE - 11 + (index % 3);
    const b = Math.floor(index / 3);
    setFunction(a, b, dark);
    setFunction(b, a, dark);
  }

  const stream = interleavedCodewords(text).flatMap((byte) => {
    const bits = [];
    appendBits(bits, byte, 8);
    return bits;
  });
  let streamIndex = 0;
  let upward = true;
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (functions[y][x]) continue;
        const dataBit = stream[streamIndex] === 1;
        modules[y][x] = ((x + y) % 2 === 0) ? !dataBit : dataBit;
        streamIndex += 1;
      }
    }
    upward = !upward;
  }
  if (streamIndex !== stream.length) throw new Error('二维码数据编排失败。');
  return modules;
}

export function qrCodeSvg(text, { scale = 5, border = 4 } = {}) {
  const matrix = qrCodeMatrix(text);
  const dimension = (matrix.length + border * 2) * scale;
  const path = [];
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path.push(`M${(x + border) * scale},${(y + border) * scale}h${scale}v${scale}h-${scale}z`);
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dimension} ${dimension}" width="${dimension}" height="${dimension}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path.join('')}" fill="#111"/></svg>`;
}

export function qrCodeDataUrl(text, options) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCodeSvg(text, options))}`;
}
