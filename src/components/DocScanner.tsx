import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlayRoot } from './OverlayRoot';
import {
  defaultCorners,
  enhanceDocument,
  loadPhoto,
  makeThumb,
  toJpegUnder,
  warpToRect,
  type Corners,
} from '../lib/docScan';
import type { SheetScope } from '../lib/sync';
import styles from './DocScanner.module.css';

// Firestore 문서 하나에 담을 수 있는 한도는 1MB다. 필드 이름과 문서 자체가 차지하는 몫이 있으니
// 넉넉히 아래로 잡는다 — 여기까지 깎아도 A4 손글씨는 그대로 읽힌다.
const MAX_IMAGE_CHARS = 700_000;
const MAX_THUMB_CHARS = 40_000;
// 손잡이를 끌 때 옆에 띄우는 돋보기의 크기와 배율. 손가락이 정작 맞춰야 할 귀퉁이를 덮기 때문에,
// 이게 없으면 종이 모서리가 아니라 손톱 끝을 보고 맞추게 된다.
const LOUPE_PX = 92;
const LOUPE_ZOOM = 3.5;

const SCOPES: { key: SheetScope; label: string; note: string }[] = [
  { key: 'all', label: '전체', note: '참가자 누구나 볼 수 있어요' },
  { key: 'group', label: '우리 조', note: '같은 조 사람들에게만 보여요' },
  { key: 'me', label: '나만', note: '목록에 뜨지 않고 나만 다시 봐요' },
];

export interface ScanResult {
  image: string;
  thumb: string;
  ratio: number;
  scope: SheetScope;
}

interface Props {
  onClose: () => void;
  onSave: (result: ScanResult) => Promise<void>;
  /** 이미 올린 사진을 다시 찍는 경우, 그때 골랐던 공개 범위로 시작한다. */
  initialScope?: SheetScope;
}

type Stage = 'pick' | 'edit' | 'working' | 'preview';

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// 종이를 찍어 올리는 자리.
//
// 실시간 인식이 필요한 QR과 달리 여기서는 폰 기본 카메라를 그대로 부른다 — 초점도 해상도도
// 그쪽이 훨씬 좋고, 종이 한 장은 한 번 잘 찍으면 끝나는 일이라 화면 안에 카메라를 둘 이유가 없다.
export default function DocScanner({ onClose, onSave, initialScope = 'all' }: Props) {
  const overlayRoot = useOverlayRoot();
  const camRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);

  const [stage, setStage] = useState<Stage>('pick');
  const [err, setErr] = useState<string | null>(null);
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [corners, setCorners] = useState<Corners>(defaultCorners);
  const [dragging, setDragging] = useState<number | null>(null);
  const [enhanced, setEnhanced] = useState(true);
  const [scope, setScope] = useState<SheetScope>(initialScope);
  const [saving, setSaving] = useState(false);
  // 편 결과를 보정 전후로 하나씩 들고 있는다. 토글할 때마다 다시 계산하면 손이 한 박자씩 멈춘다.
  // 그림(canvas)과 화면에 띄울 주소(url)를 한 덩어리로 묶어둔다 — 따로 두면 화면에는 미리보기가
  // 떠 있는데 올릴 그림은 비어 있는, 눈으로는 알 수 없는 어긋남이 생길 수 있다.
  const [preview, setPreview] = useState<{
    plain: HTMLCanvasElement;
    fixed: HTMLCanvasElement;
    plainUrl: string;
    fixedUrl: string;
  } | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setErr(null);
    setStage('working');
    try {
      const canvas = await loadPhoto(file);
      setSrc(canvas);
      setSrcUrl(canvas.toDataURL('image/jpeg', 0.85));
      setCorners(defaultCorners());
      setStage('edit');
    } catch {
      setErr('사진을 열지 못했어요. 다른 사진으로 다시 해볼까요?');
      setStage('pick');
    }
  };

  // 무거운 계산(픽셀을 한 장 통째로 훑는다)이라 그대로 부르면 "펴는 중" 글자가 뜨기도 전에
  // 화면이 굳는다. 한 프레임 뒤로 미뤄서 안내를 먼저 그리게 한다.
  const flatten = () => {
    if (!src) return;
    setStage('working');
    setTimeout(() => {
      try {
        const plain = warpToRect(src, corners);
        const fixed = enhanceDocument(plain);
        setPreview({
          plain,
          fixed,
          plainUrl: plain.toDataURL('image/jpeg', 0.8),
          fixedUrl: fixed.toDataURL('image/jpeg', 0.8),
        });
        setStage('preview');
      } catch {
        setErr('사진을 펴지 못했어요. 네 모서리를 다시 잡아볼까요?');
        setStage('edit');
      }
    }, 30);
  };

  const save = () => {
    if (!preview) return;
    setSaving(true);
    // 그림을 JPEG로 짜내는 일도 한 장을 통째로 훑는 계산이다. 그대로 이어서 하면
    // "올리는 중…"으로 바뀌기 전에 화면이 굳어, 누른 게 먹혔는지 알 수 없는 순간이 생긴다.
    setTimeout(async () => {
      try {
        const chosen = enhanced ? preview.fixed : preview.plain;
        await onSave({
          image: toJpegUnder(chosen, MAX_IMAGE_CHARS),
          thumb: toJpegUnder(makeThumb(chosen), MAX_THUMB_CHARS),
          ratio: chosen.width / chosen.height,
          scope,
        });
      } finally {
        setSaving(false);
      }
    }, 30);
  };

  const moveCorner = (index: number, clientX: number, clientY: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    setCorners((prev) => prev.map((p, i) => (i === index ? { x, y } : p)) as Corners);
  };

  // 끌고 있는 귀퉁이를 확대해서 옆에 띄운다. 원본 캔버스에서 바로 잘라오므로
  // 화면에 줄여 놓은 그림이 아니라 사진 원래의 결이 보인다.
  useEffect(() => {
    const canvas = loupeRef.current;
    if (dragging === null || !src || !canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    const span = LOUPE_PX / LOUPE_ZOOM;
    const cx = corners[dragging].x * src.width;
    const cy = corners[dragging].y * src.height;
    g.fillStyle = '#000';
    g.fillRect(0, 0, LOUPE_PX, LOUPE_PX);
    g.drawImage(src, cx - span / 2, cy - span / 2, span, span, 0, 0, LOUPE_PX, LOUPE_PX);
    g.strokeStyle = '#ec93a3';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(LOUPE_PX / 2, 0);
    g.lineTo(LOUPE_PX / 2, LOUPE_PX);
    g.moveTo(0, LOUPE_PX / 2);
    g.lineTo(LOUPE_PX, LOUPE_PX / 2);
    g.stroke();
  }, [dragging, corners, src]);

  const quad = corners.map((p) => `${p.x * 100},${p.y * 100}`).join(' ');
  const scopeNote = SCOPES.find((s) => s.key === scope)?.note ?? '';

  const overlay = (
    <div className={styles.overlay}>
      <div className={styles.bar}>
        <button className={styles.iconBtn} onClick={onClose} aria-label="닫기">
          <CloseIcon />
        </button>
        <span className={styles.barTitle}>
          {stage === 'edit' ? '네 모서리를 종이 끝에 맞춰주세요' : stage === 'preview' ? '이대로 올릴까요?' : '자기소개지 찍기'}
        </span>
        <span className={styles.barSpacer} />
      </div>

      {stage === 'pick' && (
        <div className={styles.center}>
          <div className={styles.pickArt} aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M18 8h28l6 6v42H18z" />
              <path d="M26 22h20M26 32h20M26 42h12" strokeLinecap="round" />
            </svg>
          </div>
          <p className={styles.pickLead}>자기소개지를 밝은 곳에 펴 놓고, 종이 전체가 들어오게 찍어주세요.</p>
          {err && <p className={styles.err}>{err}</p>}
          <button className="btn" onClick={() => camRef.current?.click()}>
            카메라로 찍기
          </button>
          <button className={styles.linkBtn} onClick={() => albumRef.current?.click()}>
            앨범에서 고르기
          </button>
        </div>
      )}

      {stage === 'working' && <p className={styles.working}>사진을 다듬는 중…</p>}

      {stage === 'edit' && (
        <>
          <div className={styles.stage}>
            <div
              ref={frameRef}
              className={styles.frame}
              style={src ? { aspectRatio: `${src.width} / ${src.height}` } : undefined}
            >
              <img className={styles.photo} src={srcUrl} alt="찍은 자기소개지" />
              <svg className={styles.quad} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polygon points={quad} />
              </svg>
              {corners.map((p, i) => (
                <button
                  key={i}
                  className={`${styles.handle} ${dragging === i ? styles.handleOn : ''}`}
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  aria-label={['좌상', '우상', '우하', '좌하'][i] + ' 모서리'}
                  onPointerDown={(e) => {
                    // 손가락이 손잡이 밖으로 벗어나도 계속 따라오게 붙잡아 둔다.
                    // 붙잡기가 안 되는 상황(이미 놓친 포인터 등)에도 끄는 것 자체는 되게 둔다.
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      /* 붙잡지 못해도 끌기는 이어진다 */
                    }
                    setDragging(i);
                  }}
                  onPointerMove={(e) => {
                    if (dragging === i) moveCorner(i, e.clientX, e.clientY);
                  }}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                >
                  <span className={styles.handleDot} />
                </button>
              ))}
            </div>
            {/* 끌고 있는 귀퉁이가 위쪽이면 돋보기를 아래로 내린다 — 손이 가는 자리를 피해야 보인다. */}
            <canvas
              ref={loupeRef}
              width={LOUPE_PX}
              height={LOUPE_PX}
              className={`${styles.loupe} ${dragging === null ? styles.loupeOff : ''} ${
                dragging !== null && corners[dragging].y < 0.5 ? styles.loupeLow : ''
              }`}
            />
          </div>
          <div className={styles.actions}>
            <button className="btn ghost" onClick={() => setStage('pick')}>
              다시 찍기
            </button>
            <button className="btn" onClick={flatten}>
              펴기
            </button>
          </div>
        </>
      )}

      {stage === 'preview' && preview && (
        <>
          <div className={styles.stage}>
            <img
              className={styles.result}
              src={enhanced ? preview.fixedUrl : preview.plainUrl}
              alt="펴낸 자기소개지"
            />
          </div>
          <div className={styles.panel}>
            <button
              className={`${styles.toggle} ${enhanced ? styles.toggleOn : ''}`}
              aria-pressed={enhanced}
              onClick={() => setEnhanced((v) => !v)}
            >
              <span className={styles.toggleBox} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M5 12.5l5 5 9-10.5" />
                </svg>
              </span>
              종이 밝게 보정
            </button>

            <div className={styles.scopeLabel}>누가 볼 수 있나요?</div>
            <div className={styles.scopeRow}>
              {SCOPES.map((s) => (
                <button
                  key={s.key}
                  className={`${styles.scopeBtn} ${scope === s.key ? styles.scopeBtnOn : ''}`}
                  aria-pressed={scope === s.key}
                  onClick={() => setScope(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className={styles.scopeNote}>{scopeNote}</p>

            <div className={styles.actions}>
              <button className="btn ghost" disabled={saving} onClick={() => setStage('edit')}>
                모서리 다시
              </button>
              <button className="btn" disabled={saving} onClick={save}>
                {saving ? '올리는 중…' : '올리기'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 같은 파일을 두 번 고를 때도 change가 오도록 값을 비워둔다. */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );

  return overlayRoot ? createPortal(overlay, overlayRoot) : overlay;
}
