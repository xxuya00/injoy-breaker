// 무언가 걸리고 열리는 순간에 손끝과 귀에 함께 주는 신호.
// DAY 3 다이얼에서 시작했지만, DAY 1에서 자물쇠를 깨 글자가 드러나는 순간도 같은 곳을 쓴다.
//
// 어느 쪽도 모든 기기에서 오지 않는다:
//  - 진동(navigator.vibrate)은 안드로이드 크롬·파이어폭스만 지원한다. iOS 사파리엔 API 자체가 없다.
//  - 소리(웹오디오)는 어디서나 나지만, 아이폰은 무음 스위치가 켜져 있으면 웹오디오까지 같이 막힌다.
// 그래서 둘 다 "되는 기기에서만 얹히는 것"으로 두고, 걸리는 느낌 자체는 화면이 책임진다
// (링이 목표 각도를 살짝 지나쳤다 되돌아오며 멈추는 연출 — TimeDial.module.css).

function buzz(pattern: number | number[]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // 기기에서 진동을 꺼뒀거나 제스처 밖에서 불린 경우. 없어도 그만이라 조용히 넘어간다.
  }
}

let ctx: AudioContext | null = null;

/**
 * 오디오는 사용자가 화면을 건드린 뒤에야 켤 수 있다(브라우저 자동재생 정책).
 * 여기서 나는 소리는 전부 손가락이 다이얼을 돌리는 도중에 울리므로 그 조건을 이미 만족한다.
 */
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Tone {
  /** 시작 주파수(Hz) */
  from: number;
  /** 여기까지 미끄러진다. 없으면 음이 고정된다. */
  to?: number;
  /** 길이(초) */
  dur: number;
  gain: number;
  type?: OscillatorType;
  /** 울릴 절대 시각. 없으면 지금. */
  at?: number;
}

function tone(o: Tone) {
  const ac = audio();
  if (!ac) return;
  const t = o.at ?? ac.currentTime;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.from, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  // 소리를 뚝 끊으면 "틱" 하는 잡음이 따라붙는다. 아주 짧게 올렸다가 지수로 내려 없앤다.
  // (지수 곡선은 0을 목표로 못 잡아서 0 대신 아주 작은 값을 쓴다.)
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(o.gain, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

let nextTickAt = 0;

/** 한 칸 걸릴 때. 높은 데서 뚝 떨어지는 짧고 마른 소리라 "톡" 하고 끊긴다. */
export function tapTick() {
  buzz(8);
  const ac = audio();
  if (!ac) return;
  // 손가락을 빠르게 그으면 한 번에 여러 칸이 넘어간다. 같은 시각에 겹쳐 울리면 한 덩어리로
  // 뭉개지므로 최소 간격을 두고 줄을 세운다. 그래야 다다닥 하고 각각 들린다.
  const at = Math.max(ac.currentTime, nextTickAt);
  nextTickAt = at + 0.022;
  tone({ from: 2100, to: 900, dur: 0.035, gain: 0.05, type: 'triangle', at });
}

/** 표식 셋이 열두 시에 모인 순간. 걸리는 소리와 겹치지 않도록 길고 맑게 올라간다. */
export function unlockChime() {
  buzz([14, 45, 28]);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // 도 - 솔 - 도. 5도와 옥타브만 써서 "열렸다"로 곧장 읽히게 한다.
  [523.25, 783.99, 1046.5].forEach((hz, i) => {
    tone({ from: hz, dur: 0.42, gain: 0.075, at: t + i * 0.085 });
  });
}

/**
 * DAY 1에서 자물쇠 하나가 깨지고 BACKTOGOD의 글자 한 자가 드러나는 순간.
 * 아홉 번 울리는 소리라 짧고 가볍게 두 음만 올린다 — 뒤에 나올 아홉 글자 완성음에 자리를 남겨둔다.
 */
export function letterChime() {
  buzz([12, 35, 20]);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // 미 - 시. 한 음 안에서 끝나지 않고 위로 열려 있어서 "하나 더 남았다"로 들린다.
  [659.25, 987.77].forEach((hz, i) => {
    tone({ from: hz, dur: 0.32, gain: 0.07, at: t + i * 0.07 });
  });
}

/** 아홉 글자가 모두 드러나 단어가 완성된 순간. 세 번 열리는 자리가 아니라서 길고 넓게 편다. */
export function wordChime() {
  buzz([16, 40, 24, 40, 40]);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // 아래에 깔리는 한 음이 다섯 음을 하나로 묶어준다 — 글자 하나가 아니라 단어가 끝났다는 무게.
  tone({ from: 174.61, dur: 1.3, gain: 0.08, type: 'triangle', at: t });
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((hz, i) => {
    tone({ from: hz, dur: 0.68, gain: 0.065, at: t + 0.05 + i * 0.09 });
  });
}

/** 원이 깨지고 열세 번째 칸이 나오는 순간. 마지막 한 번이라 낮은 음을 깔고 네 음으로 올라간다. */
export function breakChime() {
  buzz([18, 50, 30, 60, 45]);
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  // 아래에 깔리는 한 음. 앞의 "열림"과 확실히 다른 무게를 준다.
  tone({ from: 130.81, dur: 1.1, gain: 0.09, type: 'triangle', at: t });
  [523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
    tone({ from: hz, dur: 0.75, gain: 0.07, at: t + 0.06 + i * 0.1 });
  });
}
