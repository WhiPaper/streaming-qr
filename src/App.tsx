import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarcodeFormat,
  BrowserMultiFormatReader,
  DecodeHintType,
  NotFoundException,
  Result
} from '@zxing/library';

interface FrameSample {
  text: string;
  receivedAt: number;
}

interface StreamDigest {
  streamId?: string;
  lastSequence?: number;
  expectedTotal?: number;
  receivedCount: number;
  completedBlocks: number;
  lastCompletedPayload?: string;
}

const MAX_SAMPLE_COUNT = 6;
const FPS_SMOOTHING = 0.25;

const initialDigest: StreamDigest = {
  receivedCount: 0,
  completedBlocks: 0
};

type ScannerControls = {
  stop?: () => Promise<void> | void;
};

function tryParseFrame(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || Array.isArray(parsed) || !parsed) {
      return null;
    }
    if (
      typeof parsed.sequence === 'number' ||
      typeof parsed.frame === 'number'
    ) {
      return {
        streamId: typeof parsed.streamId === 'string' ? parsed.streamId : undefined,
        sequence:
          typeof parsed.sequence === 'number'
            ? parsed.sequence
            : (parsed.frame as number),
        total:
          typeof parsed.total === 'number'
            ? parsed.total
            : typeof parsed.of === 'number'
              ? parsed.of
              : undefined,
        payload:
          typeof parsed.payload === 'string'
            ? parsed.payload
            : typeof parsed.data === 'string'
              ? parsed.data
              : undefined
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const animationState = useRef({ lastStamp: 0, fps: 0 });
  const digestRef = useRef<StreamDigest>({ ...initialDigest });

  const [status, setStatus] = useState<'boot' | 'ready' | 'streaming' | 'error'>('boot');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [samples, setSamples] = useState<FrameSample[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [digest, setDigest] = useState<StreamDigest>({ ...initialDigest });

  const hints = useMemo(() => {
    const map = new Map();
    map.set(DecodeHintType.TRY_HARDER, true);
    map.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    return map;
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function boot() {
      setStatus('boot');
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Camera access is unavailable in this environment.');
        setStatus('error');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const node = videoRef.current;
        if (!node) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        node.srcObject = stream;
        await node.play();
        setStatus('ready');

        readerRef.current = new BrowserMultiFormatReader(hints);
        const controls = await readerRef.current.decodeFromVideoDevice(
          undefined,
          node,
          (result: Result | undefined, err: unknown) => {
            if (isCancelled) {
              return;
            }

            const now = performance.now();
            const { lastStamp, fps: prevFps } = animationState.current;
            const delta = now - lastStamp;
            const instantFps = delta > 0 ? 1000 / delta : prevFps;
            animationState.current = {
              lastStamp: now,
              fps: prevFps + (instantFps - prevFps) * FPS_SMOOTHING
            };
            setFps(Math.round(animationState.current.fps * 10) / 10);

            if (result) {
              setStatus('streaming');
              const text = result.getText();
              setSamples((current: FrameSample[]) => [{ text, receivedAt: Date.now() }, ...current].slice(0, MAX_SAMPLE_COUNT));

              const parsed = tryParseFrame(text);
              if (parsed) {
                const working = digestRef.current;
                const isNewStream = parsed.streamId && parsed.streamId !== working.streamId;
                if (isNewStream) {
                  digestRef.current = {
                    streamId: parsed.streamId,
                    lastSequence: undefined,
                    expectedTotal: parsed.total,
                    receivedCount: 0,
                    completedBlocks: 0,
                    lastCompletedPayload: undefined
                  };
                }

                const state = digestRef.current;
                const sequence = parsed.sequence ?? 0;
                const progressed =
                  typeof state.lastSequence === 'number' ? sequence > state.lastSequence : true;
                if (progressed) {
                    state.lastSequence = sequence;
                    state.receivedCount += 1;
                  if (sequence + 1 === parsed.total && parsed.payload) {
                    state.completedBlocks += 1;
                    state.lastCompletedPayload = parsed.payload;
                  }
                  if (typeof parsed.total === 'number') {
                    state.expectedTotal = parsed.total;
                  }
                  digestRef.current = { ...state };
                  setDigest({ ...state });
                }
              }
            } else if (err && !(err instanceof NotFoundException)) {
              let message = 'QR decoder error.';
              if (typeof err === 'object' && err && 'message' in err) {
                const possible = (err as { message?: unknown }).message;
                if (typeof possible === 'string') {
                  message = possible;
                }
              } else if (typeof err === 'string') {
                message = err;
              }
              setErrorMessage(message);
              setStatus('error');
            }
          }
        );

  controlsRef.current = controls as unknown as ScannerControls;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start camera preview.';
        setErrorMessage(message);
        setStatus('error');
      }
    }

    boot();

    return () => {
      isCancelled = true;
      try {
        const activeControls = controlsRef.current;
        if (activeControls && typeof activeControls === 'object' && 'stop' in activeControls) {
          // stop() is async in @zxing/browser; fire-and-forget is sufficient here
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (activeControls as any).stop?.();
        }
      } catch (error) {
        console.warn('Failed to stop ZXing controls', error);
      }

      readerRef.current?.reset();

      const tracks = videoRef.current?.srcObject instanceof MediaStream
        ? videoRef.current.srcObject.getTracks()
        : [];
  tracks.forEach((track: MediaStreamTrack) => track.stop());
    };
  }, [hints]);

  const latestSample = samples[0];

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Streaming QR Prototype</h1>
        <div className="status-chip" data-state={status}>
          {status === 'boot' && 'Starting camera…'}
          {status === 'ready' && 'Camera ready'}
          {status === 'streaming' && 'Streaming'}
          {status === 'error' && 'Error'}
        </div>
        <div className="fps-chip">{Number.isFinite(fps) ? `${fps} fps` : '—'}</div>
      </header>

      <main>
        <section className="preview">
          <div className="video-frame">
            <video ref={videoRef} playsInline muted autoPlay className="video-feed" />
            <div className="reticle" />
          </div>
          <aside className="stream-digest">
            <h2>Stream Digest</h2>
            <dl>
              <div>
                <dt>Stream ID</dt>
                <dd>{digest.streamId ?? '—'}</dd>
              </div>
              <div>
                <dt>Last Sequence</dt>
                <dd>
                  {typeof digest.lastSequence === 'number' ? digest.lastSequence : '—'}
                </dd>
              </div>
              <div>
                <dt>Received Frames</dt>
                <dd>{digest.receivedCount}</dd>
              </div>
              <div>
                <dt>Expected Total</dt>
                <dd>{typeof digest.expectedTotal === 'number' ? digest.expectedTotal : '—'}</dd>
              </div>
              <div>
                <dt>Completed Blocks</dt>
                <dd>{digest.completedBlocks}</dd>
              </div>
              <div>
                <dt>Last Completed Payload</dt>
                <dd className="payload">
                  {digest.lastCompletedPayload ?? '—'}
                </dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="readouts">
          <h2>Recent Frames</h2>
          {samples.length === 0 ? (
            <p className="empty">No frames decoded yet.</p>
          ) : (
            <ul>
              {samples.map((sample) => (
                <li key={`${sample.receivedAt}-${sample.text}`}>
                  <time>
                    {new Date(sample.receivedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </time>
                  <span>{sample.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {errorMessage && (
          <section className="error-block">
            <strong>Camera error:</strong> {errorMessage}
          </section>
        )}

        {latestSample && (
          <section className="payload-detail">
            <h2>Current Payload</h2>
            <pre>{latestSample.text}</pre>
          </section>
        )}
      </main>
    </div>
  );
}
