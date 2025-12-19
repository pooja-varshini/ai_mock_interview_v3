import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

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

  const updateStatus = useCallback(
    (next) => {
      setStatus(next);
      if (typeof onStatusChange === 'function') {
        onStatusChange(next);
      }
    },
    [onStatusChange],
  );

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
        if (typeof onReady === 'function') {
          onReady();
        }
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
    };
  }, [facingMode, onReady, onError, updateStatus]);

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
    statusLabel = 'Camera ready';
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
