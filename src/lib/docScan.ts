// 종이 한 장을 사진으로 찍어 "스캔한 것처럼" 펴고 다듬는 일을 맡는다.
//
// 손으로 든 폰으로 A4를 찍으면 종이가 사다리꼴로 찍힌다. 네 귀퉁이만 알면 그 사다리꼴을
// 직사각형으로 되돌릴 수 있고(원근 보정), 거기에 조명 얼룩을 걷어내면 종이가 하얘진다.
// 라이브러리를 쓰지 않는다 — 여기서 필요한 건 사각형 하나를 펴는 것뿐이고,
// 그 계산은 아래 서른 줄이면 끝난다. 수련회 하루 쓰자고 번들을 몇백 KB 불릴 이유가 없다.

/** 원본 이미지 기준의 좌표. 0~1이라 화면 크기가 바뀌어도 그대로 쓴다. */
export interface Point {
  x: number;
  y: number;
}

/** 네 귀퉁이는 언제나 이 순서다 — 좌상 · 우상 · 우하 · 좌하. */
export type Corners = [Point, Point, Point, Point];

// 원본 사진을 이 크기 아래로 줄여서 들고 있는다. 요즘 폰은 4000px으로 찍는데,
// 펴서 내보낼 크기가 1400px이라 그 이상은 픽셀을 읽는 시간만 늘린다.
const SOURCE_MAX_EDGE = 2400;
// 펴낸 결과의 긴 변. A4 기준 약 120dpi로, 손글씨가 폰에서 또렷이 읽히는 선이다.
const OUTPUT_MAX_EDGE = 1400;
// 목록에 까는 작은 그림의 긴 변.
const THUMB_MAX_EDGE = 320;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new Error('캔버스를 열 수 없어요');
  return g;
}

/**
 * 사진 파일을 캔버스로 읽어온다.
 *
 * 폰 사진에는 "이 사진은 세로다"라는 표시(EXIF)가 따로 붙어 있고, 픽셀 자체는 눕혀서
 * 저장돼 있는 경우가 많다. createImageBitmap에 from-image를 주면 그 표시대로 세워서 준다.
 * 이 옵션을 모르는 브라우저에서는 <img>로 떨어지는데, 요즘 브라우저의 <img>는
 * 기본으로 EXIF를 따르므로 결과가 같다.
 */
export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    src = await loadViaImgTag(file);
  }
  const w = src.width;
  const h = src.height;
  const scale = Math.min(1, SOURCE_MAX_EDGE / Math.max(w, h));
  const canvas = makeCanvas(w * scale, h * scale);
  ctx2d(canvas).drawImage(src, 0, 0, canvas.width, canvas.height);
  if ('close' in src) src.close();
  return canvas;
}

function loadViaImgTag(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 열 수 없어요'));
    };
    img.src = url;
  });
}

/** 처음 띄워줄 네 귀퉁이. 가장자리에서 살짝 안쪽에 둬야 손잡이가 화면 밖으로 나가지 않는다. */
export function defaultCorners(): Corners {
  return [
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.08 },
    { x: 0.92, y: 0.92 },
    { x: 0.08, y: 0.92 },
  ];
}

/**
 * 단위 정사각형 (0,0)(1,0)(1,1)(0,1)을 네 귀퉁이로 보내는 사영변환 계수.
 * 결과를 거꾸로 쓴다 — 펴낸 그림의 각 점이 원본 사진의 어디에서 왔는지를 이걸로 찾는다.
 */
function projection(corners: Corners, srcW: number, srcH: number) {
  const [p0, p1, p2, p3] = corners.map((p) => ({ x: p.x * srcW, y: p.y * srcH }));
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let g = 0;
  let h = 0;
  // 네 귀퉁이가 이미 평행사변형이면 원근이 없다 — 나눗셈 없이 바로 잡는다.
  if (dx3 !== 0 || dy3 !== 0) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (den !== 0) {
      g = (dx3 * dy2 - dx2 * dy3) / den;
      h = (dx1 * dy3 - dx3 * dy1) / den;
    }
  }
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

/** 펴냈을 때의 가로세로 비. 마주 보는 두 변의 평균 길이로 잡는다. */
function outputRatio(corners: Corners, srcW: number, srcH: number): number {
  const p = corners.map((c) => ({ x: c.x * srcW, y: c.y * srcH }));
  const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const w = (len(p[0], p[1]) + len(p[3], p[2])) / 2;
  const h = (len(p[0], p[3]) + len(p[1], p[2])) / 2;
  return h > 0 ? w / h : 1;
}

/**
 * 사다리꼴로 찍힌 종이를 직사각형으로 편다.
 *
 * 펴낸 그림의 픽셀 하나하나에 대해 "원본의 어느 자리에서 왔는가"를 되짚어 색을 가져온다
 * (앞에서 뒤로 그리면 빈틈이 생긴다). 가져올 때는 네 이웃을 섞어서(쌍선형) 계단을 없앤다.
 */
export function warpToRect(src: HTMLCanvasElement, corners: Corners): HTMLCanvasElement {
  const srcW = src.width;
  const srcH = src.height;
  const ratio = outputRatio(corners, srcW, srcH);
  const outW = ratio >= 1 ? OUTPUT_MAX_EDGE : Math.round(OUTPUT_MAX_EDGE * ratio);
  const outH = ratio >= 1 ? Math.round(OUTPUT_MAX_EDGE / ratio) : OUTPUT_MAX_EDGE;

  const m = projection(corners, srcW, srcH);
  const sd = ctx2d(src).getImageData(0, 0, srcW, srcH).data;
  const out = makeCanvas(outW, outH);
  const og = ctx2d(out);
  const od = og.createImageData(outW, outH);
  const dd = od.data;

  for (let j = 0; j < outH; j++) {
    const v = (j + 0.5) / outH;
    for (let i = 0; i < outW; i++) {
      const u = (i + 0.5) / outW;
      const w = m.g * u + m.h * v + 1;
      const sx = (m.a * u + m.b * v + m.c) / w;
      const sy = (m.d * u + m.e * v + m.f) / w;
      const o = (j * outW + i) * 4;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= srcW - 1 || y0 >= srcH - 1) {
        // 종이 밖을 가리키는 자리. 흰 여백으로 둔다 — 검게 두면 스캔 가장자리에 그림자가 생긴 듯 보인다.
        dd[o] = 255;
        dd[o + 1] = 255;
        dd[o + 2] = 255;
        dd[o + 3] = 255;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + srcW * 4;
      const i11 = i01 + 4;
      for (let k = 0; k < 3; k++) {
        dd[o + k] = sd[i00 + k] * w00 + sd[i10 + k] * w10 + sd[i01 + k] * w01 + sd[i11 + k] * w11;
      }
      dd[o + 3] = 255;
    }
  }
  og.putImageData(od, 0, 0);
  return out;
}

// 조명 얼룩을 어림잡을 때 쓰는 작은 그림의 긴 변. 이보다 잘게 쪼개면 글씨까지 "얼룩"으로
// 세어버려서 글씨가 같이 지워지고, 너무 성기면 한쪽에 진 그림자를 못 걷어낸다.
const ILLUM_EDGE = 24;
// 종이로 칠 밝기와 잉크로 칠 밝기. 종이가 확실히 하얘지도록 위쪽을 조금 낮춰 잡는다.
const INK_FLOOR = 0.1;
const PAPER_CEIL = 0.94;

/** 큰 그림을 반씩 줄여 내려간다. 한 번에 확 줄이면 얼룩 대신 격자무늬가 남는다. */
function downscale(src: HTMLCanvasElement, tw: number, th: number): HTMLCanvasElement {
  let cur = src;
  let w = src.width;
  let h = src.height;
  while (w > tw * 2 && h > th * 2) {
    w = Math.max(tw, Math.round(w / 2));
    h = Math.max(th, Math.round(h / 2));
    const next = makeCanvas(w, h);
    const g = ctx2d(next);
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, w, h);
    cur = next;
  }
  const out = makeCanvas(tw, th);
  const g = ctx2d(out);
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, tw, th);
  return out;
}

/**
 * 종이를 하얗게, 글씨를 또렷하게.
 *
 * 한쪽에 그림자가 진 사진에 "밝기 +30"을 걸면 밝은 쪽만 타고 어두운 쪽은 그대로다.
 * 그래서 먼저 아주 작게 줄인 그림으로 "이 자리의 종이는 원래 얼마나 밝았나"를 어림잡고,
 * 각 픽셀을 그 값으로 나눈다. 나눗셈이라 그림자가 진 자리도 제 몫만큼만 밝아진다.
 * 색깔은 채널마다 따로 나누므로 형광등의 누런 기운도 함께 빠진다 — 색펜은 그대로 남는다.
 */
export function enhanceDocument(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const bw = w >= h ? ILLUM_EDGE : Math.max(2, Math.round((ILLUM_EDGE * w) / h));
  const bh = w >= h ? Math.max(2, Math.round((ILLUM_EDGE * h) / w)) : ILLUM_EDGE;
  const bg = ctx2d(downscale(src, bw, bh)).getImageData(0, 0, bw, bh).data;

  const out = makeCanvas(w, h);
  const og = ctx2d(out);
  const img = ctx2d(src).getImageData(0, 0, w, h);
  const d = img.data;
  const span = PAPER_CEIL - INK_FLOOR;

  for (let j = 0; j < h; j++) {
    // 얼룩 그림의 어느 자리에 해당하는지. 사이 값은 이웃 네 칸을 섞어 부드럽게 잇는다.
    const gy = Math.min(bh - 1.001, Math.max(0, ((j + 0.5) / h) * bh - 0.5));
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    for (let i = 0; i < w; i++) {
      const gx = Math.min(bw - 1.001, Math.max(0, ((i + 0.5) / w) * bw - 0.5));
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const b00 = (y0 * bw + x0) * 4;
      const b10 = b00 + 4;
      const b01 = b00 + bw * 4;
      const b11 = b01 + 4;
      const w00 = (1 - fx) * (1 - fy);
      const w10 = fx * (1 - fy);
      const w01 = (1 - fx) * fy;
      const w11 = fx * fy;
      const o = (j * w + i) * 4;
      for (let k = 0; k < 3; k++) {
        const base = bg[b00 + k] * w00 + bg[b10 + k] * w10 + bg[b01 + k] * w01 + bg[b11 + k] * w11;
        const t = d[o + k] / Math.max(base, 8);
        const v = (t - INK_FLOOR) / span;
        d[o + k] = v <= 0 ? 0 : v >= 1 ? 255 : v * 255;
      }
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

/**
 * 캔버스를 정해진 크기 안에 드는 JPEG 문자열로 만든다.
 *
 * Firestore 문서 하나는 1MB를 넘을 수 없다. 화질을 먼저 낮춰보고, 그래도 안 들면 그림을
 * 줄인다 — 순서가 반대면 글씨가 살아 있는데도 그림만 작아진다.
 */
export function toJpegUnder(src: HTMLCanvasElement, maxChars: number): string {
  let canvas = src;
  for (let round = 0; round < 5; round++) {
    for (const q of [0.78, 0.68, 0.58, 0.48]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= maxChars) return url;
    }
    canvas = downscale(canvas, Math.round(canvas.width * 0.8), Math.round(canvas.height * 0.8));
  }
  return canvas.toDataURL('image/jpeg', 0.4);
}

/** 목록에 까는 작은 그림. */
export function makeThumb(src: HTMLCanvasElement): HTMLCanvasElement {
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(src.width, src.height));
  return downscale(src, Math.round(src.width * scale), Math.round(src.height * scale));
}
