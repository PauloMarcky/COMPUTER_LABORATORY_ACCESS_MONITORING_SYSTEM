import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, XCircle, AlertTriangle, ZoomIn, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../../api';

// Express runs OCR (Python worker), then only accepts students enrolled in this schedule
const SCAN_IMAGE_URL = `${API_BASE_URL}/attendance/scan-image`;
const SCAN_INTERVAL_MS = 700;
const WARMUP_MS = 1200; // give the webcam autofocus time to settle before first scan
const COOLDOWN_MS = 2500; // don't re-scan the same ID immediately
const FEEDBACK_MS = 1400; // how long the result overlay stays on screen

interface CameraScannerProps {
  active: boolean;
  scheduleId: string; // the schedule the instructor verified; the server filters by its roster
  activeSessionId: string;
  subject?: string;
  token: string; // instructor JWT
  // return 'duplicate' (+ original timeIn) if already logged, otherwise 'added'
  onMatched: (student: MatchedStudent) => { result: 'added' | 'duplicate'; timeIn?: string } | void;
}

export interface MatchedStudent {
  studentId: string;
  studentName: string;
  formalName?: string;
  course?: string;
  yearLevel?: string;
  timeIn: string;
  attendanceId?: number;
  alreadyLogged?: boolean;
}

type Feedback = {
  type: 'success' | 'duplicate' | 'nomatch' | 'error';
  title: string;
  detail?: string;
  name?: string;
  studentId?: string;
  course?: string;
  timeIn?: string;
};

/* ------------------------------------------------------------------ */
/* Error boundary: a scanner crash must never blank the instructor view */
/* ------------------------------------------------------------------ */
class ScannerBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error('[CameraScanner] crashed:', err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="w-full h-60 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 flex flex-col items-center justify-center p-4 text-center">
          <CameraOff className="w-8 h-8 mb-2 text-rose-400" />
          <span className="text-sm text-rose-600 font-semibold">Scanner unavailable</span>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="mt-2 text-xs text-[#1b325f] underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
const CameraScannerInner: React.FC<CameraScannerProps> = ({ active, scheduleId, activeSessionId, subject, token, onMatched }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const warmupUntilRef = useRef<number>(0);
  const recentRef = useRef<Map<string, number>>(new Map());
  const onMatchedRef = useRef(onMatched);
  onMatchedRef.current = onMatched;

  const [error, setError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState('Align Student ID inside the frame');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamId, setSelectedCamId] = useState<string>(() => {
    try { return localStorage.getItem('clams:cameraId') ?? ''; } catch { return ''; }
  });
  const [zoom, setZoom] = useState(1);
  const [focusSupported, setFocusSupported] = useState<boolean | null>(null);
  const [refocusNonce, setRefocusNonce] = useState(0);
  const feedbackRef = useRef<Feedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = (f: Feedback) => {
    feedbackRef.current = f;
    setFeedback(f);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      feedbackRef.current = null;
      setFeedback(null);
      setStatus('Align Student ID inside the frame');
    }, FEEDBACK_MS);
  };

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const refreshCameras = React.useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setCameras(all.filter((d) => d.kind === 'videoinput'));
    } catch {
      /* enumerateDevices unavailable */
    }
  }, []);

  const pickCamera = React.useCallback((id: string) => {
    setSelectedCamId(id);
    try {
      if (id) localStorage.setItem('clams:cameraId', id);
      else localStorage.removeItem('clams:cameraId');
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Ask the track for continuous autofocus. Returns true only if the driver
  // actually exposes focus control; false means fixed-focus hardware.
  const applyCameraFocus = React.useCallback(async (track: MediaStreamTrack): Promise<boolean> => {
    try {
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (!Array.isArray(caps.focusMode) || caps.focusMode.length === 0) return false;
      const mode = caps.focusMode.includes('continuous') ? 'continuous' : caps.focusMode[0];
      await track.applyConstraints({
        advanced: [{ focusMode: mode } as unknown as MediaTrackConstraintSet],
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Force a fresh autofocus hunt. Prefers single-shot then back to continuous;
  // falls back to restarting the stream for cams that don't expose single-shot.
  const triggerRefocus = React.useCallback(async () => {
    const stream = (videoRef.current?.srcObject as MediaStream | null) ?? null;
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      const caps = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
        focusMode?: string[];
      };
      if (Array.isArray(caps.focusMode) && caps.focusMode.includes('single-shot')) {
        await track.applyConstraints({
          advanced: [{ focusMode: 'single-shot' } as unknown as MediaTrackConstraintSet],
        });
        setTimeout(() => {
          track
            .applyConstraints({
              advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
            })
            .catch(() => { /* ignore */ });
        }, 800);
        return;
      }
    } catch {
      /* fall through to stream restart */
    }
    setRefocusNonce((n) => n + 1);
  }, []);

  // Keep the camera list fresh; labels appear after first permission grant.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md) return;
    refreshCameras();
    const handler = () => refreshCameras();
    md.addEventListener?.('devicechange', handler);
    return () => md.removeEventListener?.('devicechange', handler);
  }, [refreshCameras]);

  // Start / stop camera
  useEffect(() => {
    if (!active) {
      setCameraReady(false);
      return;
    }

    // navigator.mediaDevices is undefined on plain http:// (non-localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(`Camera is blocked on ${window.location.origin}. Open this page via http://localhost:${window.location.port || 80} instead.`);
      return;
    }

    let stream: MediaStream | null = null;
    let cancelled = false;

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
    if (selectedCamId) {
      videoConstraints.deviceId = { exact: selectedCamId };
    }

    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          v.play().catch(() => { });
        }
        setError(null);
        setCameraReady(true);
        warmupUntilRef.current = Date.now() + WARMUP_MS;
        // Ask the camera for continuous autofocus. Silent no-op on fixed-focus
        // hardware that does not expose focus control to the browser.
        const track = s.getVideoTracks()[0];
        applyCameraFocus(track).then(setFocusSupported);
        // Labels become available after the first successful permission grant.
        refreshCameras();
      })
      .catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        // Stale or unplugged camera: clear the saved pick and retry with default.
        if (selectedCamId && (name === 'OverconstrainedError' || name === 'NotFoundError')) {
          pickCamera('');
          return;
        }
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access in the browser.'
            : name === 'NotFoundError'
              ? 'No camera found.'
              : name === 'NotReadableError'
                ? 'Camera is in use by another app.'
                : 'Cannot access camera.'
        );
      });

    return () => {
      cancelled = true;
      setCameraReady(false);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [active, selectedCamId, refocusNonce, applyCameraFocus, refreshCameras, pickCamera]);

  // Scan loop
  useEffect(() => {
    if (!active || !cameraReady) return;

    const tick = async () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || busyRef.current || feedbackRef.current) return;
      // Skip frames while autofocus is still settling after stream start.
      if (Date.now() < warmupUntilRef.current) return;
      busyRef.current = true;

      try {
        if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
        const canvas = canvasRef.current;

        // Crop tracks the on-screen box; zoom > 1 shrinks the ROI around center.
        const halfW = 0.4 / zoom;
        const halfH = 0.3 / zoom;
        const sx = video.videoWidth * (0.5 - halfW);
        const sy = video.videoHeight * (0.5 - halfH);
        const sw = video.videoWidth * (2 * halfW);
        const sh = video.videoHeight * (2 * halfH);
        canvas.width = sw;
        canvas.height = sh;
        canvas.getContext('2d')!.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

        const blob: Blob | null = await new Promise((res) =>
          canvas.toBlob(res, 'image/jpeg', 0.68)
        );
        if (!blob) return;

        // Send the cropped frame to Express (OCR + student lookup happen there)
        let apiRes: Response;
        try {
          apiRes = await fetch(`${SCAN_IMAGE_URL}?scheduleId=${encodeURIComponent(scheduleId)}&sessionId=${encodeURIComponent(activeSessionId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${token}` },
            body: blob,
          });
        } catch {
          showFeedback({
            type: 'error',
            title: 'Server Unreachable',
            detail: 'Express API is offline (port 3000)',
          });
          return;
        }

        if (!apiRes.ok) {
          let serverMsg = '';
          try {
            const body = await apiRes.json();
            serverMsg = body.error || body.message || '';
          } catch {
            /* response was not JSON */
          }
          if (apiRes.status === 401) {
            showFeedback({
              type: 'error',
              title: 'Session Expired',
              detail: 'Please log in again as instructor.',
            });
            return;
          }
          if (apiRes.status === 503) {
            // OCR worker still starting or failed: keep trying quietly
            setStatus(serverMsg ? `Scanner not ready: ${serverMsg}` : 'Scanner starting…');
            return;
          }
          showFeedback({
            type: 'error',
            title: `Server Error (${apiRes.status})`,
            detail:
              serverMsg ||
              (apiRes.status === 404
                ? 'Route /api/attendance/scan-image not found. Check that the backend is running.'
                : 'Could not process the scan'),
          });
          return;
        }

        const data = await apiRes.json();
        if (!data.detected) {
          setStatus(
            data.reason === 'OUTSIDE_SCHEDULE'
              ? 'This class is not in session right now'
              : 'Align Student ID inside the frame'
          );
          return;
        }

        const scannedId: string = data.scannedId;
        const last = recentRef.current.get(scannedId) ?? 0;
        if (Date.now() - last < COOLDOWN_MS) return;
        recentRef.current.set(scannedId, Date.now());

        if (data.matched === true) {
          const student: MatchedStudent = {
            studentId: data.studentId,
            studentName: data.studentName,
            formalName: data.formalName,
            course: data.course,
            yearLevel: data.yearLevel,
            timeIn: data.timeIn,
            attendanceId: data.attendanceId,
            alreadyLogged: data.alreadyLogged,
          };
          const outcome = onMatchedRef.current(student);
          const dup = outcome && outcome.result === 'duplicate';
          showFeedback({
            type: dup ? 'duplicate' : 'success',
            title: dup ? 'Already Logged' : 'Attendance Recorded',
            name: student.studentName,
            studentId: student.studentId,
            course: student.course,
            timeIn: dup && outcome?.timeIn ? outcome.timeIn : student.timeIn,
          });
        } else if (data.reason === 'NOT_ENROLLED') {
          showFeedback({
            type: 'nomatch',
            title: 'Not Enrolled in This Class',
            name: data.studentName,
            studentId: data.studentId,
            detail: subject ? `Not on the ${subject} class list` : 'Not on this class list',
          });
        } else {
          showFeedback({
            type: 'nomatch',
            title: 'ID Not Recognized',
            detail: `${scannedId} is not in the student list`,
          });
        }
      } catch (e) {
        console.error('[CameraScanner] tick error:', e);
      } finally {
        busyRef.current = false;
      }
    };

    const id = setInterval(tick, SCAN_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, cameraReady, scheduleId, token, subject, zoom]);

  if (!active) {
    return (
      <div className="w-full h-60 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 opacity-60 flex flex-col items-center justify-center">
        <CameraOff className="w-8 h-8 mb-2 text-slate-400" />
        <span className="text-sm text-slate-400">
          {activeSessionId ? 'Resume class session to enable scanning' : 'Start a verified session to enable scanning'}
        </span>
      </div>
    );
  }

  return (
    <div>
      {cameras.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
          <Camera className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <label htmlFor="clams-camera-picker" className="font-semibold">Camera:</label>
          <select
            id="clams-camera-picker"
            value={selectedCamId}
            onChange={(e) => pickCamera(e.target.value)}
            className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1b325f]/40"
          >
            <option value="">System default</option>
            {cameras.map((c, i) => (
              <option key={c.deviceId || `cam-${i}`} value={c.deviceId}>
                {c.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="mb-2 flex items-center gap-3 flex-wrap text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <ZoomIn className="w-3.5 h-3.5 shrink-0 text-slate-400" />
          <label htmlFor="clams-zoom" className="font-semibold">Zoom:</label>
          <input
            id="clams-zoom"
            type="range"
            min={1}
            max={3}
            step={0.25}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-[#1b325f]"
          />
          <span className="tabular-nums w-10">{zoom.toFixed(2)}x</span>
        </div>
        <button
          type="button"
          onClick={triggerRefocus}
          className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50"
          title="Force the camera to hunt for focus again"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refocus
        </button>
        <span className="text-[10px] text-slate-400">
          {focusSupported === null ? 'checking focus...' : focusSupported ? 'AF supported' : 'no AF (fixed focus)'}
        </span>
      </div>
      <div className="relative w-full h-60 rounded-xl overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div
          className={`absolute border-2 rounded pointer-events-none transition-colors ${feedback?.type === 'success'
            ? 'border-emerald-400'
            : feedback?.type === 'duplicate'
              ? 'border-amber-400'
              : feedback
                ? 'border-rose-400'
                : 'border-white/70'
            }`}
          style={{ left: `${(0.5 - 0.4 / zoom) * 100}%`, right: `${(0.5 - 0.4 / zoom) * 100}%`, top: `${(0.5 - 0.3 / zoom) * 100}%`, bottom: `${(0.5 - 0.3 / zoom) * 100}%` }}
        />
        {feedback && (
          <div
            className={`absolute inset-x-0 bottom-0 px-4 py-3 flex items-center gap-3 text-white ${feedback.type === 'success'
              ? 'bg-emerald-600/95'
              : feedback.type === 'duplicate'
                ? 'bg-amber-500/95'
                : 'bg-rose-600/95'
              }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-7 h-7 shrink-0" />
            ) : feedback.type === 'duplicate' ? (
              <AlertTriangle className="w-7 h-7 shrink-0" />
            ) : (
              <XCircle className="w-7 h-7 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
                {feedback.title}
              </div>
              {feedback.name && (
                <div className="text-lg font-bold leading-tight truncate">{feedback.name}</div>
              )}
              {feedback.studentId && (
                <div className="text-sm opacity-95 truncate">
                  {feedback.studentId}
                  {feedback.course ? ` · ${feedback.course}` : ''}
                </div>
              )}
              {feedback.timeIn && (
                <div className="text-sm font-semibold mt-0.5">Time In: {feedback.timeIn}</div>
              )}
              {feedback.detail && (
                <div className="text-sm opacity-95 truncate">{feedback.detail}</div>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white p-4 text-center">
            {error}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
        <Camera className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </div>
    </div>
  );
};

export const CameraScanner: React.FC<CameraScannerProps> = (props) => (
  <ScannerBoundary>
    <CameraScannerInner {...props} />
  </ScannerBoundary>
);