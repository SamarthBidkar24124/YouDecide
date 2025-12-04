import { useEffect, useRef, useState } from 'react';
import { Camera, Music, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Song {
  id: string;
  name: string;
  genre?: string;
  uri?: string;
}

export interface MoodEvent {
  id: string;
  userId: string;
  mood: string;
  created_at: string;
  songs: Song[];
}

interface MoodCameraProps {
  onNewMood?: (event: MoodEvent) => void;
}

export default function MoodCamera({ onNewMood }: MoodCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { user } = useAuth();

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastEvent, setLastEvent] = useState<MoodEvent | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.error('Error starting camera', err);
      setError('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const captureAndDetect = async () => {
    if (!user) return;
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context.');
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9)
      );

      if (!blob) {
        throw new Error('Failed to capture image.');
      }

      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
      formData.append('userId', user.id);

      const res = await fetch(`${API_BASE_URL}/mood/detect`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      const data: MoodEvent = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new Error(
          (data as unknown as { detail?: string })?.detail ||
            `Request failed with status ${res.status}`
        );
      }

      setLastEvent(data);
      if (onNewMood) {
        onNewMood(data);
      }
    } catch (err) {
      console.error('Error detecting mood', err);
      setError(
        err instanceof Error ? err.message : 'Something went wrong detecting mood.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-purple-600">
            Camera Mood Detector
          </h2>
          <p className="text-purple-400">
            Use your webcam to detect your mood and get tailored music.
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center text-white shadow-lg">
          <Camera className="w-6 h-6" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black/5 border border-purple-200">
            <video
              ref={videoRef}
              className="w-full h-64 object-cover bg-black/50"
              autoPlay
              playsInline
              muted
            />
            {!isCameraActive && (
              <div className="absolute inset-0 flex items-center justify-center text-purple-300">
                <span>Camera is off</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {!isCameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-purple-600 font-semibold border border-purple-300 shadow-sm hover:bg-purple-50 transition"
              >
                Stop Camera
              </button>
            )}

            <button
              type="button"
              onClick={captureAndDetect}
              disabled={!isCameraActive || loading || !user}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-pink-500 to-red-500 text-white font-semibold shadow-lg hover:shadow-xl disabled:opacity-60 disabled:hover:shadow-none disabled:cursor-not-allowed transform hover:scale-105 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Music className="w-4 h-4" />
                  Capture &amp; Detect Mood
                </>
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {!user && (
            <p className="text-sm text-purple-400">
              Please log in to save your mood history and see graphs.
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl p-5 shadow-inner min-h-[10rem] flex flex-col justify-center">
            {lastEvent ? (
              <>
                <div className="text-sm uppercase tracking-wide text-purple-500 font-semibold mb-1">
                  Detected Mood
                </div>
                <div className="text-3xl font-extrabold text-purple-700 mb-3">
                  {lastEvent.mood}
                </div>
                <div className="text-purple-500 text-sm">
                  Captured at{' '}
                  {new Date(lastEvent.created_at).toLocaleString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>
              </>
            ) : (
              <div className="text-purple-400">
                Capture a photo to see your detected mood here.
              </div>
            )}
          </div>

          <div className="bg-white/80 rounded-2xl p-5 shadow-inner max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-bold text-purple-600">
                  Recommended Tracks
                </h3>
                <p className="text-xs text-purple-400">
                  Based on your latest detected mood
                </p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
                <Music className="w-4 h-4" />
              </div>
            </div>

            {lastEvent && lastEvent.songs.length > 0 ? (
              <ul className="space-y-2">
                {lastEvent.songs.map((song) => (
                  <li
                    key={`${song.id}-${song.uri}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-purple-50 transition"
                  >
                    <div>
                      <div className="font-semibold text-purple-700 text-sm">
                        {song.name}
                      </div>
                      {song.genre && (
                        <div className="text-xs text-purple-400">{song.genre}</div>
                      )}
                    </div>
                    {song.uri && (
                      <a
                        href={song.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-pink-500 hover:text-pink-600"
                      >
                        Play
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-purple-400">
                No recommendations yet. Capture your mood to get some tracks!
              </p>
            )}
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}


