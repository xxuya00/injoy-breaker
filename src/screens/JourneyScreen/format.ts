// 경과시간과 시각을 화면에 적는 방식. 게임 시트·순위판·잠금 안내가 모두 여기를 거친다.
export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 순발력 타격은 분 단위가 의미 없고 찰나로 승부가 갈려서, 분:초 대신 초·1/100초로 보여준다.
export function formatPreciseElapsed(ms: number): string {
  const total = Math.max(0, ms);
  const sec = Math.floor(total / 1000);
  const hundredths = Math.floor((total % 1000) / 10);
  return `${sec}.${String(hundredths).padStart(2, '0')}초`;
}

// 이 게임은 초 단위 아래까지 보여준다.
export function isPreciseGame(type: string): boolean {
  return type === 'reflex';
}

export function formatKST(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${m}분`;
}
