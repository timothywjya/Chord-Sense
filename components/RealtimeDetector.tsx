'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings2, Activity } from 'lucide-react';
import GuitarChordDiagram from './GuitarChordDiagram';
import {
  getTopFrequencies,
  identifyChord,
  type ChordDetectionResult,
} from '@/lib/chordDetection';

interface RealtimeDetectorProps {
  mode: 'vocal' | 'instrument' | 'both';
  onChordDetected?: (chord: ChordDetectionResult) => void;
}

const HISTORY_MAX = 8;

export default function RealtimeDetector({ mode, onChordDetected }: RealtimeDetectorProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentChord, setCurrentChord] = useState<ChordDetectionResult | null>(null);
  const [chordHistory, setChordHistory] = useState<ChordDetectionResult[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState(0.55);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastChordRef = useRef<string>('');
  const chordStableCountRef = useRef<number>(0);

  const stopListening = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setVolume(0);
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: mode === 'vocal',
          noiseSuppression: mode === 'vocal',
          autoGainControl: false,
          sampleRate: 44100,
        }
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      
      // For instrument mode, apply high-pass filter to remove low-frequency noise
      if (mode === 'instrument') {
        const highpass = audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 60;
        source.connect(highpass);
        highpass.connect(analyser);
      } else if (mode === 'vocal') {
        // Band-pass for vocal range (80-8000 Hz)
        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 300;
        bandpass.Q.value = 0.5;
        source.connect(bandpass);
        bandpass.connect(analyser);
      } else {
        source.connect(analyser);
      }

      setIsListening(true);

      // Analysis loop
      const timeBuffer = new Float32Array(analyser.fftSize);
      
      const analyze = () => {
        animFrameRef.current = requestAnimationFrame(analyze);
        
        // Get volume
        analyser.getFloatTimeDomainData(timeBuffer);
        let rms = 0;
        for (let i = 0; i < timeBuffer.length; i++) {
          rms += timeBuffer[i] ** 2;
        }
        rms = Math.sqrt(rms / timeBuffer.length);
        setVolume(Math.min(1, rms * 10));

        if (rms < 0.005) {
          // Too quiet, reset stability
          chordStableCountRef.current = 0;
          return;
        }

        // Get dominant frequencies
        const notes = getTopFrequencies(analyser, audioCtx.sampleRate, 6);
        if (notes.length < 2) return;
        
        const noteNames = notes.map(n => n.note);
        const result = identifyChord(noteNames, mode);
        
        if (!result) return;
        
        if (result.confidence < sensitivity) return;

        // Stability check: same chord must appear N times before confirming
        if (result.chord === lastChordRef.current) {
          chordStableCountRef.current++;
        } else {
          chordStableCountRef.current = 1;
          lastChordRef.current = result.chord;
        }

        if (chordStableCountRef.current === 3) {
          setCurrentChord(result);
          setChordHistory(prev => {
            const last = prev[prev.length - 1];
            if (last?.chord === result.chord) return prev;
            const next = [...prev, result];
            return next.slice(-HISTORY_MAX);
          });
          onChordDetected?.(result);
        }
      };

      analyze();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        setError('Could not access audio device. Please check your browser permissions.');
      }
      console.error(err);
    }
  }, [mode, sensitivity, onChordDetected]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  const volumeBars = 12;
  
  return (
    <div className="space-y-6">
      {/* Main detection display */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          minHeight: 280,
        }}
      >
        {/* Animated background when active */}
        {isListening && (
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at 50% 50%, rgba(245, 166, 35, ${volume * 0.08}) 0%, transparent 70%)`,
              transition: 'background 0.1s',
            }}
          />
        )}

        <div className="relative flex flex-col items-center justify-center p-8" style={{ minHeight: 280 }}>
          {/* Chord name */}
          <div className="text-center mb-4">
            {currentChord ? (
              <>
                <div
                  className="chord-badge amber-text-glow"
                  style={{ fontSize: 72, lineHeight: 1, letterSpacing: '-2px' }}
                >
                  {currentChord.chord}
                </div>
                <div style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13, marginTop: 8 }}>
                  {currentChord.chordType} · Root: {currentChord.rootNote}
                </div>
                <div style={{ color: 'var(--color-text-dim)', fontSize: 12, marginTop: 4 }}>
                  Notes: {currentChord.notes.join(' – ')}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--color-text-dim)', fontSize: 18, fontFamily: 'var(--font-display)' }}>
                {isListening ? 'Listening for chords...' : 'Start listening to detect chords'}
              </div>
            )}
          </div>

          {/* Guitar diagram */}
          {currentChord && (
            <div className="fade-in-up" style={{ marginTop: 8 }}>
              <GuitarChordDiagram chord={currentChord.chord} size="lg" />
            </div>
          )}

          {/* Confidence bar */}
          {currentChord && (
            <div className="w-full max-w-xs mt-4">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-dim)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>
                <span>Confidence</span>
                <span>{Math.round(currentChord.confidence * 100)}%</span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  className="progress-bar"
                  style={{ height: '100%', width: `${currentChord.confidence * 100}%`, borderRadius: 2 }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volume indicator & controls */}
      <div className="flex items-center gap-4">
        {/* Volume meter */}
        <div className="flex items-end gap-0.5" style={{ height: 32 }}>
          {Array.from({ length: volumeBars }, (_, i) => {
            const threshold = (i + 1) / volumeBars;
            const active = volume > threshold * 0.8;
            const color = i < volumeBars * 0.6 ? 'var(--color-success)' :
                          i < volumeBars * 0.85 ? 'var(--color-amber)' : 'var(--color-danger)';
            return (
              <div
                key={i}
                style={{
                  width: 3,
                  height: 8 + i * 1.8,
                  borderRadius: 2,
                  background: active ? color : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.05s',
                }}
              />
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Settings toggle */}
        <button
          onClick={() => setShowSettings(s => !s)}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            background: showSettings ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.05)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontFamily: 'var(--font-body)',
          }}
        >
          <Settings2 size={14} />
          Settings
        </button>

        {/* Main listen button */}
        <button
          onClick={isListening ? stopListening : startListening}
          className={isListening ? 'pulse-active' : ''}
          style={{
            padding: '10px 24px',
            borderRadius: 12,
            background: isListening
              ? 'rgba(248, 113, 113, 0.15)'
              : 'linear-gradient(135deg, var(--color-amber), var(--color-amber-dim))',
            border: `1px solid ${isListening ? 'rgba(248,113,113,0.3)' : 'transparent'}`,
            color: isListening ? 'var(--color-danger)' : 'var(--color-bg)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
          {isListening ? 'Stop' : 'Start Listening'}
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div
          className="rounded-xl p-4 fade-in-up"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--color-text)' }}>
            Detection Settings
          </div>
          <div className="space-y-3">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                <span>Sensitivity</span>
                <span>{Math.round(sensitivity * 100)}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={90}
                value={Math.round(sensitivity * 100)}
                onChange={e => setSensitivity(Number(e.target.value) / 100)}
                style={{ width: '100%', accentColor: 'var(--color-amber)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                <span>More detections</span>
                <span>Higher accuracy</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--color-danger)', fontSize: 13 }}
        >
          {error}
        </div>
      )}

      {/* Chord history */}
      {chordHistory.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Recent Chords
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {chordHistory.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  background: i === chordHistory.length - 1
                    ? 'rgba(245,166,35,0.15)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${i === chordHistory.length - 1 ? 'rgba(245,166,35,0.3)' : 'var(--color-border)'}`,
                  fontSize: 15,
                  fontFamily: 'var(--font-display)',
                  color: i === chordHistory.length - 1 ? 'var(--color-amber)' : 'var(--color-text-dim)',
                  fontWeight: 700,
                }}
              >
                {c.chord}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
