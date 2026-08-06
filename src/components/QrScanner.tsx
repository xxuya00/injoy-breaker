import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import jsQR from 'jsqr';
import { useOverlayRoot } from './OverlayRoot';
import styles from './QrScanner.module.css';

interface Props {
  onDetect: (id: string) => void;
  onClose: () => void;
  parse: (text: string) => string | null;
}

// insecure: https가 아닌 주소로 열었을 때. 브라우저가 카메라 API 자체를 주지 않는다.
// 기기 문제가 아니라 주소 문제라서 안내를 따로 둔다.
type CamState = 'starting' | 'ready' | 'denied' | 'insecure' | 'unsupported' | 'error';

// 훑어볼 그림의 최대 한 변. 카메라 원본은 이보다 훨씬 큰데, 그대로 보면 한 프레임에 오래 걸려
// 손이 흔들리는 사이 판을 놓친다. 줄여서 자주 보는 쪽이 결과적으로 더 빨리 잡힌다.
const SCAN_MAX_SIDE = 720;

export default function QrScanner({ onDetect, onClose, parse }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [camState, setCamState] = useState<CamState>('starting');
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRoot = useOverlayRoot();

  // 부모(여정 화면)가 다시 그려질 때마다 onDetect는 새 함수가 된다. 그걸 그대로 아래 effect의
  // 의존성에 두면, 잠금 설정을 60초마다 새로 받을 때나 앱에 돌아올 때마다 카메라가 꺼졌다 켜진다.
  // 숲에서 QR을 맞추는 동안 화면이 까매지고 그 사이 프레임은 통째로 버려지므로,
  // 최신 함수만 ref로 넘겨받고 카메라는 열 때 한 번만 연다.
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const parseRef = useRef(parse);
  parseRef.current = parse;

  useEffect(() => {
    doneRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState(window.isSecureContext === false ? 'insecure' : 'unsupported');
      return;
    }

    let cancelled = false;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string } | null)?.name;
        setCamState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;

      // video는 상태와 상관없이 늘 붙어 있다(아래 render 참고). 예전처럼 'ready'가 된 뒤에
      // 붙이려 하면, 그 시점엔 아직 그려지기 전이라 스트림을 놓치고 화면이 까맣게 남는다.
      const video = videoRef.current;
      if (!video) {
        setCamState('error');
        return;
      }
      video.srcObject = stream;
      setCamState('ready');
      video.play().catch(() => {});
      tick();
    })();

    function tick() {
      if (doneRef.current) return;
      // 다음 프레임을 먼저 걸어둔다. 아직 첫 화면이 안 들어왔을 때 그냥 돌아가버리면
      // 루프가 그대로 끊겨서, 카메라는 켜져 있는데 아무리 대도 인식이 안 된다.
      rafRef.current = requestAnimationFrame(tick);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState < video.HAVE_CURRENT_DATA) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      // 원본 그대로(보통 1920px)를 매 프레임 훑으면 폰에서 한 장에 수백 ms가 걸린다.
      // 화면 가운데 QR 하나 읽는 데는 이 정도면 충분하고, 대신 훨씬 자주 본다.
      const scale = Math.min(1, SCAN_MAX_SIDE / Math.max(vw, vh));
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      const code = jsQR(frame.data, w, h, { inversionAttempts: 'dontInvert' });
      if (!code?.data) return;

      const id = parseRef.current(code.data);
      if (id) {
        doneRef.current = true;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        onDetectRef.current(id);
        return;
      }
      if (!hintTimer.current) {
        setHint('인식은 됐지만 이 여정의 QR이 아니에요');
        hintTimer.current = setTimeout(() => {
          setHint(null);
          hintTimer.current = null;
        }, 1400);
      }
    }

    return () => {
      cancelled = true;
      doneRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // 카메라는 이 덮개가 열릴 때 한 번만 연다(위 ref 설명 참고).
  }, []);

  // 화면 축소(transform) 안쪽이면 position:fixed 기준이 어긋나므로 덮개 전용 자리에 그린다.
  const overlay = (
    <div className={styles.overlay}>
      <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* 카메라를 열기 전에도 자리를 지키고 있어야 스트림을 받아 바로 붙일 수 있다.
          숨길 때도 display:none 대신 투명하게만 둔다 — 아이폰은 감춰진 video를 재생하지 않는다. */}
      <video
        ref={videoRef}
        className={camState === 'ready' ? styles.video : `${styles.video} ${styles.videoHidden}`}
        playsInline
        muted
        autoPlay
        onLoadedMetadata={() => videoRef.current?.play().catch(() => {})}
      />

      {camState === 'ready' && (
        <div className={styles.frameWrap}>
          <div className={styles.scanFrame}>
            <span className={styles.corner} data-pos="tl" />
            <span className={styles.corner} data-pos="tr" />
            <span className={styles.corner} data-pos="bl" />
            <span className={styles.corner} data-pos="br" />
          </div>
          <p className={styles.guide}>QR을 네모 안에 맞춰주세요</p>
          {hint && <p className={styles.hintMsg}>{hint}</p>}
        </div>
      )}

      {camState === 'starting' && <p className={styles.statusMsg}>카메라를 여는 중…</p>}

      {camState === 'denied' && (
        <div className={styles.statusBox}>
          <p className={styles.statusMsg}>카메라 권한이 필요해요</p>
          <p className={styles.statusSub}>브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해주세요.</p>
        </div>
      )}
      {camState === 'insecure' && (
        <div className={styles.statusBox}>
          <p className={styles.statusMsg}>이 주소에서는 카메라를 쓸 수 없어요</p>
          <p className={styles.statusSub}>https 주소로 다시 들어오거나, 폰 기본 카메라로 QR을 찍어주세요.</p>
        </div>
      )}
      {(camState === 'unsupported' || camState === 'error') && (
        <div className={styles.statusBox}>
          <p className={styles.statusMsg}>이 기기에서는 카메라를 열 수 없어요</p>
          <p className={styles.statusSub}>기본 카메라 앱으로 QR을 스캔해도 똑같이 열려요.</p>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.hiddenCanvas} />
    </div>
  );

  return overlayRoot ? createPortal(overlay, overlayRoot) : overlay;
}
