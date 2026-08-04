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

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamState('ready');
        tick();
      })
      .catch((err) => {
        if (cancelled) return;
        setCamState(err?.name === 'NotAllowedError' ? 'denied' : 'error');
      });

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || doneRef.current) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const frame = ctx.getImageData(0, 0, w, h);
            const code = jsQR(frame.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code?.data) {
              const id = parseRef.current(code.data);
              if (id) {
                doneRef.current = true;
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
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
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

      {camState === 'ready' && (
        <>
          <video ref={videoRef} className={styles.video} playsInline muted />
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
        </>
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
