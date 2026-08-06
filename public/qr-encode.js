// QR 코드를 이 파일 안에서 직접 만든다.
//
// 예전에는 외부 서비스(api.qrserver.com)에서 그림을 받아왔는데, 그러면 인쇄하는 순간
// 인터넷이 없거나 그 사이트가 막혀 있으면 QR 자리가 빈칸으로 나온다. 수련회 현장에서
// 한 장 더 뽑아야 할 때 가장 곤란한 실패라, 바깥에 기대지 않게 옮겨왔다.
//
// 바이트 모드 · 오류정정 Q(약 25%까지 복구)만 다룬다. 담는 건 주소 한 줄뿐이라 다른 모드는
// 필요 없고, 코팅지가 접히거나 비에 젖어도 읽히도록 정정 수준은 넉넉한 쪽으로 고정했다.

/**
 * 판 크기(버전)별 정정 부호 규격. Q 수준 기준.
 * ec = 블록 하나당 정정 부호 개수, g = [블록 수, 블록당 데이터 개수] 묶음.
 */
const EC_Q = {
  1: { ec: 13, g: [[1, 13]] },
  2: { ec: 22, g: [[1, 22]] },
  3: { ec: 18, g: [[2, 17]] },
  4: { ec: 26, g: [[2, 24]] },
  5: { ec: 18, g: [[2, 15], [2, 16]] },
  6: { ec: 24, g: [[4, 19]] },
  7: { ec: 18, g: [[2, 14], [4, 15]] },
  8: { ec: 22, g: [[4, 18], [2, 19]] },
  9: { ec: 20, g: [[4, 16], [4, 17]] },
  10: { ec: 24, g: [[6, 19], [2, 20]] },
};

/** 판마다 정해진 정렬 무늬의 중심 좌표. 1번 판에는 없다. */
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---- GF(256) 산술 ----
// 정정 부호 계산에 쓰는 특수한 곱셈판. 미리 표로 만들어두면 곱셈이 덧셈 한 번으로 끝난다.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** n개짜리 정정 부호를 만들 때 나눌 식. */
function genPoly(n) {
  let p = [1];
  for (let i = 0; i < n; i++) {
    const q = new Array(p.length + 1).fill(0);
    for (let j = 0; j < p.length; j++) {
      q[j] ^= p[j];
      q[j + 1] ^= gmul(p[j], EXP[i]);
    }
    p = q;
  }
  return p;
}

/** 데이터 한 블록에서 정정 부호 n개를 뽑는다(나머지 연산). */
function eccOf(data, n) {
  const gen = genPoly(n);
  const res = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) {
    const c = res[i];
    if (!c) continue;
    for (let j = 0; j < gen.length; j++) res[i + j] ^= gmul(gen[j], c);
  }
  return res.slice(data.length);
}

/** 글자를 바이트 배열로. 주소는 아스키지만 한글이 섞여도 UTF-8로 담긴다. */
function toBytes(text) {
  return Array.from(new TextEncoder().encode(text));
}

/** 담을 수 있는 가장 작은 판을 고른다. 작을수록 같은 종이에서 눈금이 굵어져 잘 읽힌다. */
function pickVersion(len) {
  for (let v = 1; v <= 10; v++) {
    const dataCw = EC_Q[v].g.reduce((s, [n, k]) => s + n * k, 0);
    // 앞머리로 모드 4비트 + 길이(9번 판까지 8비트, 10번부터 16비트)를 먼저 쓴다.
    const cap = dataCw - 2 - (v < 10 ? 0 : 1);
    if (len <= cap) return v;
  }
  return null;
}

/** 데이터 부호를 만들고, 블록으로 나눠 정정 부호를 붙인 뒤 규격 순서대로 섞는다. */
function buildCodewords(bytes, ver) {
  const spec = EC_Q[ver];
  const dataCw = spec.g.reduce((s, [n, k]) => s + n * k, 0);

  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(4, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  // 끝맺음 0 네 개(자리가 모자라면 그만큼만) 뒤, 바이트 경계까지 0으로 채운다.
  for (let i = 0; i < 4 && bits.length < dataCw * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    data.push(b);
  }
  // 남은 자리는 규격이 정한 두 값을 번갈아 채운다.
  for (let i = 0; data.length < dataCw; i++) data.push(i % 2 === 0 ? 0xec : 0x11);

  const blocks = [];
  let pos = 0;
  for (const [count, k] of spec.g) {
    for (let i = 0; i < count; i++) {
      const d = data.slice(pos, pos + k);
      pos += k;
      blocks.push({ d, e: eccOf(d, spec.ec) });
    }
  }

  const out = [];
  const maxK = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxK; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < spec.ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

/** 눈금판을 만들고 고정 무늬(모서리·타이밍·정렬)를 먼저 새긴다. */
function newBoard(ver) {
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r][c] = v;
    fn[r][c] = true;
  };

  // 세 귀퉁이의 큰 네모(파인더)와 그 둘레의 여백.
  for (const [cr, cc] of [[3, 3], [3, size - 4], [size - 4, 3]]) {
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const d = Math.max(Math.abs(dr), Math.abs(dc));
        set(cr + dr, cc + dc, d !== 2 && d !== 4);
      }
    }
  }

  // 가로세로로 한 줄씩 지나는 점선. 판을 읽을 때 눈금 간격의 기준이 된다.
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // 정렬 무늬. 파인더와 겹치는 세 자리는 건너뛴다.
  const ap = ALIGN[ver];
  for (let i = 0; i < ap.length; i++) {
    for (let j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          set(ap[i] + dr, ap[j] + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // 형식 정보가 들어갈 자리를 미리 잡아둔다(값은 마스크를 고른 뒤에 쓴다).
  for (let i = 0; i < 9; i++) {
    set(8, i, false);
    set(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false);
    set(size - 1 - i, 8, false);
  }
  set(size - 8, 8, true); // 항상 검은 한 칸

  // 7번 판부터는 판 번호를 따로 새긴다.
  if (ver >= 7) {
    let d = ver << 12;
    for (let i = 5; i >= 0; i--) if (d & (1 << (i + 12))) d ^= 0x1f25 << i;
    const vb = (ver << 12) | (d & 0xfff);
    for (let i = 0; i < 18; i++) {
      const bit = ((vb >> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(b, a, bit);
      set(a, b, bit);
    }
  }

  return { m, fn, size };
}

/** 남은 빈칸에 데이터를 오른쪽 아래부터 지그재그로 채운다. */
function placeData(board, codewords) {
  const { m, fn, size } = board;
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // 세로 점선이 지나는 칸은 건너뛴다
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        const upward = ((right + 1) & 2) === 0;
        const r = upward ? size - 1 - vert : vert;
        if (fn[r][c] || i >= total) continue;
        m[r][c] = ((codewords[i >> 3] >> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

/** 형식 정보 15비트(정정 수준 Q + 마스크 번호)를 만든다. */
function formatBits(mask) {
  const data = (0b11 << 3) | mask;
  let d = data << 10;
  for (let i = 4; i >= 0; i--) if (d & (1 << (i + 10))) d ^= 0b10100110111 << i;
  return ((data << 10) | (d & 0x3ff)) ^ 0b101010000010010;
}

function drawFormat(m, size, mask) {
  const f = formatBits(mask);
  const bit = (i) => ((f >> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
  m[7][8] = bit(6);
  m[8][8] = bit(7);
  m[8][7] = bit(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
  m[size - 8][8] = true;
}

/**
 * 읽기 나쁜 무늬에 벌점을 매긴다. 같은 색이 길게 이어지거나, 파인더를 닮은 무늬가
 * 데이터 자리에 우연히 생기면 카메라가 헷갈린다. 여덟 가지 마스크 중 벌점이 가장 낮은
 * 것을 골라 쓰기 위한 잣대다.
 */
function penalty(m, size) {
  let score = 0;

  const line = (get) => {
    for (let a = 0; a < size; a++) {
      let run = 1;
      let prev = get(a, 0);
      const hist = [];
      for (let b = 1; b < size; b++) {
        const cur = get(a, b);
        if (cur === prev) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          hist.push(run);
          run = 1;
          prev = cur;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  };
  line((a, b) => m[a][b]);
  line((a, b) => m[b][a]);

  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }

  const P1 = [true, false, true, true, true, false, true, false, false, false, false];
  const P2 = [false, false, false, false, true, false, true, true, true, false, true];
  const match = (get, a, b, pat) => {
    for (let i = 0; i < 11; i++) if (get(a, b + i) !== pat[i]) return false;
    return true;
  };
  for (let a = 0; a < size; a++) {
    for (let b = 0; b <= size - 11; b++) {
      if (match((x, y) => m[x][y], a, b, P1) || match((x, y) => m[x][y], a, b, P2)) score += 40;
      if (match((x, y) => m[y][x], a, b, P1) || match((x, y) => m[y][x], a, b, P2)) score += 40;
    }
  }

  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r][c]) dark++;
  const pct = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return score;
}

/**
 * 글자 한 줄을 QR 눈금판으로. true가 검은 칸이다.
 * 담을 수 없을 만큼 길면 null을 돌려준다(부르는 쪽에서 안내를 띄운다).
 */
export function encodeQr(text) {
  const bytes = toBytes(text);
  const ver = pickVersion(bytes.length);
  if (!ver) return null;

  const codewords = buildCodewords(bytes, ver);
  const base = newBoard(ver);
  placeData(base, codewords);

  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = base.m.map((row) => row.slice());
    for (let r = 0; r < base.size; r++) {
      for (let c = 0; c < base.size; c++) {
        if (!base.fn[r][c] && MASKS[mask](r, c)) m[r][c] = !m[r][c];
      }
    }
    drawFormat(m, base.size, mask);
    const s = penalty(m, base.size);
    if (!best || s < best.score) best = { score: s, m };
  }
  return best.m;
}

/**
 * QR을 그대로 인쇄할 수 있는 SVG 한 덩어리로. 눈금을 벡터로 그리므로 아무리 크게
 * 뽑아도 가장자리가 뭉개지지 않는다.
 */
export function qrSvg(text, px) {
  const mods = encodeQr(text);
  if (!mods) return null;
  const n = mods.length;
  const quiet = 4; // 둘레 여백. 이게 없으면 카메라가 판의 끝을 못 찾는다.
  const total = n + quiet * 2;
  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (mods[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `width="${px}" height="${px}" shape-rendering="crispEdges" role="img">` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}
