import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const SUPPORTED_MIME_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4',
];

function getSupportedMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    return null;
  }
  return SUPPORTED_MIME_TYPES.find((type) => {
    try {
      return window.MediaRecorder.isTypeSupported(type);
    } catch (error) {
      return false;
    }
  }) || null;
}

const VideoRecorder = forwardRef(function VideoRecorder(
  {
    onReady,
    onError,
    onStatusChange,
    onFaceDetected,
    facingMode = 'user',
    muted = true,
    showStatusText = true,
  },
  ref,
) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const stopPromiseRef = useRef(null);
  const [status, setStatus] = useState('idle');
  const [permissionError, setPermissionError] = useState(null);
  const permissionCheckIntervalRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const [faceDetected, setFaceDetected] = useState(false);

  const updateStatus = useCallback(
    (next) => {
      setStatus(next);
      if (typeof onStatusChange === 'function') {
        onStatusChange(next);
      }
    },
    [onStatusChange],
  );

  // Initialize face detector
  useEffect(() => {
    let cancelled = false;

    const initFaceDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'
        );
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
        });
        if (!cancelled) {
          faceDetectorRef.current = detector;
        }
      } catch (error) {
        console.error('Failed to initialize face detector:', error);
      }
    };

    initFaceDetector();

    return () => {
      cancelled = true;
      if (faceDetectorRef.current) {
        faceDetectorRef.current.close();
        faceDetectorRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initCamera = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const unsupportedError = new Error('Camera is not supported in this browser.');
        setPermissionError(unsupportedError);
        updateStatus('error');
        if (typeof onError === 'function') {
          onError(unsupportedError);
        }
        return;
      }

      updateStatus('requesting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        updateStatus('ready');
        setPermissionError(null);
        if (typeof onReady === 'function') {
          onReady();
        }
        // Start face detection once camera is ready
        startFaceDetection();
      } catch (error) {
        setPermissionError(error);
        updateStatus('error');
        if (typeof onError === 'function') {
          onError(error);
        }
      }
    };

    initCamera();

    return () => {
      cancelled = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      stopFaceDetection();
    };
  }, [facingMode, onReady, onError, updateStatus]);

  const startFaceDetection = useCallback(() => {
    if (faceDetectionIntervalRef.current) {
      return;
    }

    const detectFace = () => {
      if (!faceDetectorRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      try {
        const detections = faceDetectorRef.current.detectForVideo(videoRef.current, performance.now());
        const hasFace = detections.detections && detections.detections.length > 0;
        
        setFaceDetected(hasFace);
        if (typeof onFaceDetected === 'function') {
          onFaceDetected(hasFace);
        }
      } catch (error) {
        console.error('Face detection error:', error);
      }
    };

    // Run face detection every 500ms
    faceDetectionIntervalRef.current = setInterval(detectFace, 500);
  }, [onFaceDetected]);

  const stopFaceDetection = useCallback(() => {
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    setFaceDetected(false);
  }, []);

  // Monitor camera track state to detect permission changes
  useEffect(() => {
    if (!streamRef.current) {
      return;
    }

    const checkTrackState = () => {
      if (!streamRef.current) {
        return;
      }

      const videoTracks = streamRef.current.getVideoTracks();
      if (videoTracks.length === 0) {
        return;
      }

      const track = videoTracks[0];
      if (track.readyState === 'ended' || !track.enabled) {
        // Camera was disabled or permission revoked
        setPermissionError(new Error('Camera access was revoked'));
        updateStatus('error');
        if (typeof onError === 'function') {
          onError(new Error('Camera access was revoked'));
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
    };

    // Check immediately
    checkTrackState();

    // Set up interval to monitor track state
    permissionCheckIntervalRef.current = setInterval(checkTrackState, 1000);

    return () => {
      if (permissionCheckIntervalRef.current) {
        clearInterval(permissionCheckIntervalRef.current);
        permissionCheckIntervalRef.current = null;
      }
    };
  }, [status, onError, updateStatus]);

  const stopRecorderAndCollect = useCallback(async () => {
    if (!recorderRef.current) {
      return null;
    }

    const stopPromise = stopPromiseRef.current;
    if (recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopPromiseRef.current = null;

    if (!stopPromise) {
      return null;
    }

    const blob = await stopPromise;
    updateStatus(streamRef.current ? 'ready' : 'idle');
    return blob;
  }, [updateStatus]);

  const startNewSegment = useCallback(async () => {
    if (!streamRef.current) {
      throw new Error('Camera stream is not ready.');
    }

    if (recorderRef.current && recorderRef.current.state === 'recording') {
      await stopRecorderAndCollect();
    }

    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
    } catch (error) {
      updateStatus('error');
      if (typeof onError === 'function') {
        onError(error);
      }
      throw error;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    stopPromiseRef.current = new Promise((resolve) => {
      recorder.onstop = () => {
        const recordedMimeType = mimeType || recorder.mimeType || 'video/webm';
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recordedMimeType })
          : null;
        resolve(blob);
      };
    });

    recorder.onerror = (event) => {
      updateStatus('error');
      if (typeof onError === 'function') {
        onError(event.error);
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    updateStatus('recording');
    return true;
  }, [onError, stopRecorderAndCollect, updateStatus]);

  const stopAndGetBlob = useCallback(async () => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      if (recorderRef.current) {
        recorderRef.current = null;
      }
      const blob = stopPromiseRef.current ? await stopPromiseRef.current : null;
      stopPromiseRef.current = null;
      return blob;
    }

    return stopRecorderAndCollect();
  }, [stopRecorderAndCollect]);

  useImperativeHandle(
    ref,
    () => ({
      startNewSegment,
      stopAndGetBlob,
      isReady: () => Boolean(streamRef.current),
      isRecording: () => Boolean(recorderRef.current && recorderRef.current.state === 'recording'),
    }),
    [startNewSegment, stopAndGetBlob],
  );

  let statusLabel = 'Initializing camera…';
  if (status === 'ready') {
    if (faceDetected) {
      statusLabel = 'Face detected - Ready to start';
    } else {
      statusLabel = 'Position your face in the camera';
    }
  } else if (status === 'recording') {
    statusLabel = 'Recording in progress';
  } else if (status === 'error') {
    statusLabel = permissionError ? 'Camera permission denied' : 'Camera unavailable';
  } else if (status === 'requesting') {
    statusLabel = 'Requesting camera access…';
  }

  return (
    <div className="video-recorder">
      <div className={`video-recorder__preview video-recorder__preview--${status}`}>
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
        />
        {status !== 'recording' && (
          <div className="video-recorder__overlay">
            <span>{statusLabel}</span>
          </div>
        )}
      </div>
      {showStatusText && (
        <p className="video-recorder__status">{statusLabel}</p>
      )}
      {permissionError && (
        <p className="video-recorder__error">Please allow camera access to continue. Refresh the page if needed.</p>
      )}
    </div>
  );
});

export default VideoRecorder;
