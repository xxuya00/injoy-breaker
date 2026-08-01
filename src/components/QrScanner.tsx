import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import styles from './QrScanner.module.css';

interface Props {
  onDetect: (id: string) => void;
  onClose: () => void;
  parse: (text: string) => string | null;
}

type CamState = 'starting' | 'ready' | 'denied' | 'unsupported' | 'error';

export default function QrScanner({ onDetect, onClose, parse }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [camState, setCamState] = useState<CamState>('starting');
  const [hint, setHint] = useState<string | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    doneRef.current = false;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState('unsupported');
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
              const id = parse(code.data);
              if (id) {
                doneRef.current = true;
                onDetect(id);
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
  }, [onDetect, parse]);

  return (
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
      {(camState === 'unsupported' || camState === 'error') && (
        <div className={styles.statusBox}>
          <p className={styles.statusMsg}>이 기기에서는 카메라를 열 수 없어요</p>
          <p className={styles.statusSub}>기본 카메라 앱으로 QR을 스캔해도 똑같이 열려요.</p>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.hiddenCanvas} />
    </div>
  );
}
