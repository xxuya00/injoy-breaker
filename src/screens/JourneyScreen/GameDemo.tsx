import type { ComboCard } from '../../data/comboGame';
import type { LockType } from '../../types';
import { ComboShape, ShapeIcon } from './icons';
import styles from './JourneyScreen.module.css';

// 인트로 화면에서 텍스트 설명만으로는 감이 안 오니, 고정된 예시 상황을 CSS 루프로 반복 재생해
// "이런 식으로 진행된다"를 짧게 보여준다. 실제 랜덤 로직과는 무관한 순수 연출용.
//
// 미리보기와 실제 판이 조금이라도 다르면, 안내를 읽고 들어온 사람이 처음 보는 화면 앞에서 한 번 더
// 헤맨다. 그래서 판 모양(3x3 아홉 장, 숫자패드, 단어 한 장씩)은 실제 게임 그대로 축소해서 쓴다.
//
// 실제 판과 똑같이 아홉 장을 3x3으로 깔고, 그 위에서 결합 네 개를 차례로 찾아간다.
// 결합이 성립하는 네 가지 경우(셋 다 다름 / 색만 같음 / 모양만 같음 / 모양·배경이 같고 색만 다름)를
// 한 판 안에서 모두 보여줘야, 한 가지 유형만 눈에 익어 나머지를 지나치는 일이 없다.
// 이 아홉 장에 성립하는 결합은 정확히 이 넷뿐이라, 마지막에 "결"을 누르는 것까지 그대로 맞는 흐름이다.
//
// 판을 고를 때 실제 판에서 늘 일어나는 두 가지를 같이 담았다 — ①한 장이 결합 두 개에 겹쳐 쓰이고
// ②아무 결합에도 안 들어가는 장이 남는다(5번). 이 둘이 빠진 판을 예시로 들면 "한 장은 한 결합에만,
// 아홉 장을 남김없이" 쓰는 게임으로 잘못 배우고 들어와서, 이미 쓴 카드를 아예 후보에서 지워버린다.
const COMBO_DEMO_BOARD: ComboCard[] = [
  { id: 'cbx0', shape: 1, color: 2, bg: 1 },
  { id: 'cbx1', shape: 0, color: 1, bg: 0 },
  { id: 'cbx2', shape: 0, color: 2, bg: 0 },
  { id: 'cbx3', shape: 2, color: 2, bg: 1 },
  { id: 'cbx4', shape: 1, color: 1, bg: 2 },
  { id: 'cbx5', shape: 0, color: 1, bg: 1 },
  { id: 'cbx6', shape: 0, color: 0, bg: 0 },
  { id: 'cbx7', shape: 1, color: 0, bg: 0 },
  { id: 'cbx8', shape: 1, color: 2, bg: 2 },
];
// 찾아가는 순서대로의 결합 넷. 아래 캡션과 순서가 같고, "찾은 결합" 줄에도 이 순서로 쌓인다.
const COMBO_DEMO_SETS: [number, number, number][] = [
  [3, 4, 6],
  [2, 3, 8],
  [0, 4, 7],
  [1, 2, 6],
];
// 카드마다 언제 선택 표시가 켜지는지가 다 달라서, 칸 번호로 클래스를 하나씩 짚어준다.
// 2·3·4·6번은 결합 두 개에 걸쳐 있어 선택 구간이 두 번이라 전용 클래스를 쓴다.
const COMBO_DEMO_MARK: string[] = [
  styles.demoCbx0,
  styles.demoCbx1,
  styles.demoCbx2,
  styles.demoCbx3,
  styles.demoCbx4,
  // 5번은 어느 결합에도 안 들어간다 — 한 바퀴 내내 아무 표시도 붙지 않는 게 맞다.
  '',
  styles.demoCbx6,
  styles.demoCbx7,
  styles.demoCbx8,
];
const COMBO_DEMO_CAPTIONS = [
  '모양·색·배경이 셋 다 달라요',
  '색이 셋 다 같아요',
  '모양이 셋 다 같아요',
  '모양·배경이 같고 색만 달라요 · 앞서 쓴 카드도 다시 써요',
];
// 실제 판처럼 한 칸씩 차례로 켜지는 걸 보여줘야 해서, 안전한 칸을 집합이 아니라 순서대로 들고 있는다.
const MAZE_DEMO_PATH = [0, 3, 4, 5, 8];
const MAZE_DEMO_STEP_S = 0.35;
const RX_DEMO_HIT: Record<number, string> = { 4: styles.demoRxHit1, 1: styles.demoRxHit2, 7: styles.demoRxHit3 };
// 두 번 탭해서 실제로 전부 꺼지는 것(=클리어)까지 보여준다.
// 점등 {0,4,5,7} → 가운데(4) 탭 → {0,1,3} → 좌상단(0) 탭 → 전부 꺼짐.
// 칸마다 "켜짐/꺼짐"이 세 단계로 어떻게 바뀌는지에 따라 A~C 세 패턴으로 나뉜다.
const LO_DEMO_CELL: Record<number, 'demoLoTap2' | 'demoLoB' | 'demoLoTap1' | 'demoLoC'> = {
  0: 'demoLoTap2', // 켜짐 → 켜짐 → 꺼짐 (두 번째 탭 위치)
  1: 'demoLoB', // 꺼짐 → 켜짐 → 꺼짐
  3: 'demoLoB',
  4: 'demoLoTap1', // 켜짐 → 꺼짐 → 꺼짐 (첫 번째 탭 위치)
  5: 'demoLoC',
  7: 'demoLoC',
};
// 1~9를 한 번씩 쓴 배치. 오른쪽엔 행 합, 아래엔 열 합이 붙는 실제 판과 같은 모양.
// 빈칸은 두 개(5와 4)를 두고 차례로 채운다 — 한 칸만 채우면 "골라서 → 눌러서 → 줄이 초록으로"라는
// 한 바퀴가 한 번밖에 안 돌아, 무엇이 무엇을 바꾼 건지 눈이 못 따라간다.
const CM_DEMO_CELLS = [1, 5, 9, 8, 2, 4, 3, 7, 6];
const CM_DEMO_BLANKS = [1, 5];
const CM_DEMO_ROW_SUMS = [15, 14, 16];
const CM_DEMO_COL_SUMS = [12, 14, 19];
// 처음부터 초록인 줄은 2개(3행·1열 — 이미 다 채워져 있다), 첫 칸을 채우면 4개, 둘째 칸까지 채우면 6개.
const CM_DEMO_COUNTS = [2, 4, 6];
// 각 칸이 몇 번째 단계에서 초록으로 굳는지. 0은 처음부터.
const CM_DEMO_CELL_STEP = [0, 1, 1, 0, 1, 2, 0, 0, 0];

// 실제 게임처럼 ①단어가 한 개씩 스쳐 지나가고 ②본 순서 그대로 선택지를 탭하는, 두 단계를 그대로 보여준다.
// 선택지는 정답 4개 + 오답 4개로 실제 첫 세트와 같은 수다.
const FLASH_DEMO_SEQ = ['모세', '다윗', '요셉', '룻'];
const FLASH_DEMO_CHOICES = ['만나', '요셉', '모세', '룻', '언약', '다윗', '광야', '한나'];

// 실제 화면과 같은 순서로 보여준다 — 목표 숫자 → 식이 쌓이는 칸 → 숫자 4개 → 연산자 → 확인.
// 큰 숫자 넷으로 작은 목표에 닿는 판이라, 예시도 나눗셈과 빼기를 쓰는 쪽으로 든다 —
// 여기서 곱셈만 늘어놓으면 실제 판에서 곱하기부터 눌러보다 한참 헤맨다.
const EQ_DEMO_NUMBERS = [18, 6, 5, 4];
const EQ_DEMO_TOKENS = ['18', '÷', '6', '×', '5', '-', '4'];
const EQ_DEMO_TARGET = 11;
// 정답이 4-7-1인 판. 한 줄씩 차례로 떠오르며 S/B를 어떻게 읽는지 보여준다.
const BB_DEMO_ROWS = [
  { digits: [1, 2, 3], result: '1B', note: '1은 있지만 자리가 달라요' },
  { digits: [4, 5, 6], result: '1S', note: '4는 자리까지 맞아요' },
  { digits: [4, 7, 1], result: '3S', note: '전부 맞았어요 · 다음 단계' },
];

export default function GameDemo({ type }: { type: LockType }) {
  switch (type) {
    case 'maze':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMzGrid}>
            {Array.from({ length: 9 }).map((_, i) => {
              const step = MAZE_DEMO_PATH.indexOf(i);
              return (
                <div
                  key={i}
                  className={`${styles.demoMzCell} ${step >= 0 ? styles.demoMzSafe : ''}`}
                  style={step >= 0 ? { animationDelay: `${step * MAZE_DEMO_STEP_S}s` } : undefined}
                />
              );
            })}
            <span className={styles.demoMzFlag} />
            <span className={styles.demoMzDot} />
          </div>
        </div>
      );
    case 'lightsout':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoLoGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`${styles.demoLoCell} ${LO_DEMO_CELL[i] ? styles[LO_DEMO_CELL[i]] : ''}`} />
            ))}
          </div>
          <span className={styles.demoLoTag}>전부 꺼짐 · 클리어</span>
        </div>
      );
    case 'crossmath': {
      // 빈칸 고르기 → 숫자패드 누르기 → 그 줄이 초록으로 굳기, 를 두 번 돌린다.
      // 줄이 하나 완성될 때마다 아래 "맞춘 줄 n/6"도 같이 올라가서, 무엇을 세는 게임인지가 같이 읽힌다.
      const stepClass = [null, styles.demoCmOn1, styles.demoCmOn2];
      const targetStepClass = [null, styles.demoCmTgtOn1, styles.demoCmTgtOn2];
      // 행: 0번은 첫 칸을 채울 때, 1번은 둘째 칸을 채울 때, 2번은 처음부터 완성.
      const rowStep = [1, 2, 0];
      const colStep = [0, 1, 2];
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCmGrid}>
            {Array.from({ length: 4 }).map((_, r) =>
              Array.from({ length: 4 }).map((_, c) => {
                const key = `${r}-${c}`;
                if (r < 3 && c < 3) {
                  const idx = r * 3 + c;
                  const blank = CM_DEMO_BLANKS.indexOf(idx);
                  const step = CM_DEMO_CELL_STEP[idx];
                  const done = step === 0 ? styles.demoCmDone : stepClass[step];
                  if (blank >= 0) {
                    // 빈칸은 고르기 표시와 초록 굳히기를 한 클래스에 묶어둔다(위 done은 안 쓴다).
                    return (
                      <div
                        key={key}
                        className={`${styles.demoCmCell} ${blank === 0 ? styles.demoCmBlank1 : styles.demoCmBlank2}`}
                      >
                        <span className={blank === 0 ? styles.demoCmQ1 : styles.demoCmQ2}>?</span>
                        <span className={blank === 0 ? styles.demoCmFill1 : styles.demoCmFill2}>
                          {CM_DEMO_CELLS[idx]}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className={`${styles.demoCmCell} ${done}`}>
                      {CM_DEMO_CELLS[idx]}
                    </div>
                  );
                }
                if (r < 3 && c === 3) {
                  const step = rowStep[r];
                  return (
                    <div
                      key={key}
                      className={`${styles.demoCmTarget} ${step === 0 ? styles.demoCmTgtDone : targetStepClass[step]}`}
                    >
                      {CM_DEMO_ROW_SUMS[r]}
                    </div>
                  );
                }
                if (r === 3 && c < 3) {
                  const step = colStep[c];
                  return (
                    <div
                      key={key}
                      className={`${styles.demoCmTarget} ${step === 0 ? styles.demoCmTgtDone : targetStepClass[step]}`}
                    >
                      {CM_DEMO_COL_SUMS[c]}
                    </div>
                  );
                }
                return <div key={key} />;
              }),
            )}
          </div>
          {/* 세 문장을 같은 칸에 겹쳐두고 켜고 끄기만 한다 — 글자 수가 달라도 높이가 흔들리지 않는다. */}
          <div className={styles.demoCmCountWrap}>
            {CM_DEMO_COUNTS.map((n, i) => (
              <span key={n} className={`${styles.demoCmCount} ${styles[`demoCmCount${i + 1}`]}`}>
                맞춘 줄 {n} / 6
              </span>
            ))}
          </div>
          {/* 실제 판과 같은 1~9 숫자패드. 이미 판에 올라간 숫자는 눌리지 않는다는 것까지 그대로 보여준다. */}
          <div className={styles.demoCmPad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
              const blank = CM_DEMO_BLANKS.findIndex((idx) => CM_DEMO_CELLS[idx] === n);
              return (
                <div
                  key={n}
                  className={`${styles.demoCmKey} ${
                    blank === 0 ? styles.demoCmKeyTap1 : blank === 1 ? styles.demoCmKeyTap2 : styles.demoCmKeyUsed
                  }`}
                >
                  {n}
                </div>
              );
            })}
          </div>
          <span className={styles.demoCmTag}>여섯 줄 모두 초록 · 클리어</span>
        </div>
      );
    }
    case 'codebreak':
      // ▲+●=12, ■-▲=2 이면 ▲ 값을 몰라도 ●+■는 항상 14로 결정된다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCbList}>
            <div className={styles.demoCbRow}>
              <ShapeIcon shape={1} size={20} />
              <span className={styles.demoCbOp}>+</span>
              <ShapeIcon shape={2} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbNum}>12</span>
            </div>
            <div className={styles.demoCbRow}>
              <ShapeIcon shape={0} size={20} />
              <span className={styles.demoCbOp}>−</span>
              <ShapeIcon shape={1} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbNum}>2</span>
            </div>
            <div className={`${styles.demoCbRow} ${styles.demoCbFinal}`}>
              <ShapeIcon shape={2} size={20} />
              <span className={styles.demoCbOp}>+</span>
              <ShapeIcon shape={0} size={20} />
              <span className={styles.demoCbOp}>=</span>
              <span className={styles.demoCbAnsWrap}>
                <span className={styles.demoCbQ}>?</span>
                <span className={styles.demoCbAns}>14</span>
              </span>
            </div>
          </div>
        </div>
      );
    case 'memory':
      // 실제 게임은 ①큰 글씨 한 장씩 스쳐 지나가기 ②선택지 판에서 본 순서대로 탭하기, 두 화면으로 나뉜다.
      // 두 단계를 같은 칸에 겹쳐두고 번갈아 켠다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoMemStage}>
            <div className={`${styles.demoMemPhase} ${styles.demoMemPhaseShow}`}>
              <span className={styles.demoMemStep}>① 한 개씩 스쳐 지나가요</span>
              <div className={styles.demoMemWordBox}>
                {FLASH_DEMO_SEQ.map((w, i) => (
                  <span key={w} className={`${styles.demoMemWord} ${styles[`demoMemWord${i + 1}`]}`}>
                    {w}
                  </span>
                ))}
              </div>
              <div className={styles.demoMemDots}>
                {FLASH_DEMO_SEQ.map((w, i) => (
                  <span key={w} className={`${styles.demoMemDot} ${styles[`demoMemDot${i + 1}`]}`} />
                ))}
              </div>
            </div>
            <div className={`${styles.demoMemPhase} ${styles.demoMemPhasePick}`}>
              <span className={styles.demoMemStep}>② 본 순서 그대로 탭해요</span>
              <div className={styles.demoMemGrid}>
                {FLASH_DEMO_CHOICES.map((w) => {
                  const order = FLASH_DEMO_SEQ.indexOf(w);
                  return (
                    <span
                      key={w}
                      className={`${styles.demoMemChip} ${order >= 0 ? styles[`demoMemPick${order + 1}`] : ''}`}
                    >
                      {w}
                    </span>
                  );
                })}
              </div>
              <span className={styles.demoMemTag}>{FLASH_DEMO_SEQ.length}개 모두 순서대로 · 다음 세트</span>
            </div>
          </div>
        </div>
      );
    case 'reflex':
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoRxGrid}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className={`${styles.demoRxCell} ${RX_DEMO_HIT[i] ?? ''}`} />
            ))}
          </div>
        </div>
      );
    case 'baseball':
      // 정답이 4-7-1일 때 세 번의 시도가 어떻게 읽히는지 그대로 보여준다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoBbList}>
            {BB_DEMO_ROWS.map((row, i) => (
              <div key={row.digits.join('')} className={`${styles.demoBbRow} ${styles[`demoBbRow${i + 1}`]}`}>
                <span className={styles.demoBbDigits}>
                  {row.digits.map((d, j) => (
                    <span key={j} className={styles.demoBbDigit}>
                      {d}
                    </span>
                  ))}
                </span>
                <span className={styles.demoBbResult}>{row.result}</span>
                <span className={styles.demoBbNote}>{row.note}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case 'combo':
      // 실제 판 그대로 아홉 장을 깔아두고, 그 위에서 결합 넷을 차례로 찾아 마지막에 "결"을 누른다.
      return (
        <div className={styles.introDemo}>
          <div className={styles.demoCbxGrid}>
            {COMBO_DEMO_BOARD.map((card, i) => (
              <div key={card.id} className={`${styles.demoCbxCard} ${styles[`comboCardBg${card.bg}`]} ${COMBO_DEMO_MARK[i]}`}>
                <ComboShape card={card} size={22} />
              </div>
            ))}
          </div>
          {/* 다섯 문장을 같은 칸에 겹쳐두고 차례로 켠다. 판은 그대로 두고 설명만 갈아끼워야
              "같은 아홉 장에서 결합이 여러 개 나온다"가 그림으로 읽힌다. */}
          <div className={styles.demoCbxCapWrap}>
            {COMBO_DEMO_CAPTIONS.map((label, p) => (
              <span key={label} className={`${styles.demoCbxCap} ${styles[`demoCbxCap${p + 1}`]}`}>
                {label}
              </span>
            ))}
            <span className={`${styles.demoCbxCap} ${styles.demoCbxCap5}`}>
              남는 카드가 있어도 더 찾을 합이 없으면 다음 세트
            </span>
          </div>
          <span className={styles.demoCbxPassBtn}>결</span>
          {/* 찾은 결합은 판이 아니라 아래 줄에 쌓인다 — 실제 게임에서 "찾은 결합"이 놓이는 그 자리다.
              판 위에 초록 표시를 남겨두면 넷을 다 찾은 뒤 아홉 장이 통째로 초록이 되어,
              한 장씩 소모해가는 게임처럼 보인다. 아래 줄로 내려두면 같은 카드가 두 칸에 다시 나오는 것도
              그대로 보인다. */}
          <div className={styles.demoCbxFoundRow}>
            <span className={styles.demoCbxFoundLabel}>찾은 합</span>
            {COMBO_DEMO_SETS.map((triple, s) => (
              // 빈 칸 넷은 처음부터 놓여 있고 카드만 나중에 채워진다 — 몇 개를 찾아야 하는 판인지가
              // 첫 화면에서 바로 읽히고, 칸이 늘었다 줄었다 하며 아래를 밀지도 않는다.
              <span key={triple.join('')} className={styles.demoCbxFoundChip}>
                {triple.map((idx) => {
                  const card = COMBO_DEMO_BOARD[idx];
                  return (
                    <span
                      key={idx}
                      className={`${styles.demoCbxFoundSwatch} ${styles[`comboCardBg${card.bg}`]} ${
                        styles[`demoCbxFound${s + 1}`]
                      }`}
                    >
                      <ComboShape card={card} size={11} />
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        </div>
      );
    case 'equation':
      // 실제 화면과 같은 순서로 쌓는다 — 목표 숫자 → 식이 쌓이는 칸 → 숫자 4개 → 연산자 → 확인.
      // 쓴 숫자가 하나씩 흐려지는 것까지 그대로라, "전부 한 번씩만"이 글이 아니라 그림으로 읽힌다.
      return (
        <div className={styles.introDemo}>
          <span className={styles.demoEqTarget}>
            목표 숫자 <b>{EQ_DEMO_TARGET}</b>
          </span>
          <div className={styles.demoEqDisplay}>
            {EQ_DEMO_TOKENS.map((t, i) => (
              <span key={i} className={`${styles.demoEqTok} ${styles[`demoEqTok${i + 1}`]}`}>
                {t}
              </span>
            ))}
            <span className={styles.demoEqEq}>= {EQ_DEMO_TARGET}</span>
          </div>
          <div className={styles.demoEqNumRow}>
            {EQ_DEMO_NUMBERS.map((n, i) => (
              <span key={n} className={`${styles.demoEqNum} ${styles[`demoEqNum${i + 1}`]}`}>
                {n}
              </span>
            ))}
          </div>
          <div className={styles.demoEqOpRow}>
            {['+', '-', '×', '÷'].map((op) => (
              <span
                key={op}
                className={`${styles.demoEqOp} ${
                  op === '×' ? styles.demoEqOpMul : op === '+' ? styles.demoEqOpAdd : ''
                }`}
              >
                {op}
              </span>
            ))}
          </div>
          <span className={styles.demoEqConfirm}>확인</span>
        </div>
      );
    default:
      return null;
  }
}
