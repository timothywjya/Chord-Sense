'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, Volume2, VolumeX,
  Music, Loader2, FileAudio, ChevronLeft, ChevronRight,
  Zap, Eye, EyeOff,
} from 'lucide-react';
import GuitarChordDiagram from './GuitarChordDiagram';
import { analyzeAudioBuffer, type ChordDetectionResult } from '@/lib/chordDetection';
import { simplifyChordSequence, simplifyChord, DIFFICULTY_COLORS, type SimplifiedChord } from '@/lib/chordSimplifier';

interface ChordifyPlayerProps {
  mode: 'vocal' | 'instrument' | 'both';
}

interface ChordSegment {
  chord: string;
  simplified: SimplifiedChord;
  timestamp: number;
  endTime: number;
  confidence?: number;
}

interface AnalysisResult {
  segments: ChordSegment[];
  key: string;
  tempo: number;
  duration: number;
}

// Berapa bar ditampilkan di layar sekaligus
const VISIBLE_BARS = 4;
const BEATS_PER_BAR = 4;

export default function ChordifyPlayer({ mode }: ChordifyPlayerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // UI state
  const [showSimplified, setShowSimplified] = useState(true);
  const [showDiagram, setShowDiagram] = useState(true);
  const [activeChordIdx, setActiveChordIdx] = useState(0);
  const [viewOffset, setViewOffset] = useState(0); // untuk scroll manual

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  // Temukan chord aktif berdasarkan waktu
  const findActiveChord = useCallback((time: number, segments: ChordSegment[]) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (time >= segments[i].timestamp) return i;
    }
    return 0;
  }, []);

  // Update state setiap frame
  const tick = useCallback(() => {
    if (!audioRef.current || !result) return;
    const t = audioRef.current.currentTime;
    setCurrentTime(t);
    const idx = findActiveChord(t, result.segments);
    setActiveChordIdx(idx);
    animRef.current = requestAnimationFrame(tick);
  }, [result, findActiveChord]);

  useEffect(() => {
    if (isPlaying) {
      animRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(animRef.current);
    }
    return () => cancelAnimationFrame(animRef.current);
  }, [isPlaying, tick]);

  // Auto-scroll timeline mengikuti chord aktif
  useEffect(() => {
    if (!timelineRef.current || !result) return;
    const el = timelineRef.current;
    const cardW = el.scrollWidth / result.segments.length;
    const targetScroll = Math.max(0, activeChordIdx * cardW - el.clientWidth / 2 + cardW / 2);
    el.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [activeChordIdx, result]);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('audio/')) return;
    setFile(f);
    setResult(null);
    setIsAnalyzing(true);
    setProgress(0);
    setCurrentTime(0);
    setActiveChordIdx(0);

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(f);
    audioUrlRef.current = url;
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }

    try {
      const audioCtx = new AudioContext();
      const arrayBuffer = await f.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const raw = await analyzeAudioBuffer(
        audioCtx,
        audioBuffer,
        mode,
        (p) => setProgress(p),
      );

      const segments = simplifyChordSequence(
        raw.chords.map(c => ({ chord: c.chord, timestamp: c.timestamp, confidence: c.confidence }))
      );

      setResult({
        segments,
        key: raw.key,
        tempo: raw.tempo,
        duration: audioBuffer.duration,
      });

      audioCtx.close();
    } catch (err) {
      console.error(err);
      alert('Gagal menganalisis audio. Coba file yang berbeda.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setActiveChordIdx(0);
  };

  const seekToChord = (idx: number) => {
    if (!audioRef.current || !result) return;
    const t = result.segments[idx].timestamp;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
    setActiveChordIdx(idx);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !result) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = pct * result.duration;
    audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const changeRate = (r: number) => {
    setPlaybackRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) audioRef.current.volume = next ? 0 : volume;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Chord aktif saat ini
  const activeChord = result?.segments[activeChordIdx];
  const activeSimplified = activeChord ? (showSimplified ? activeChord.simplified.simplified : activeChord.chord) : null;

  // Progress dalam chord saat ini (0-1), untuk "beat indicator"
  const chordProgress = useMemo(() => {
    if (!activeChord) return 0;
    const dur = activeChord.endTime - activeChord.timestamp;
    if (dur <= 0) return 0;
    return Math.min(1, (currentTime - activeChord.timestamp) / dur);
  }, [currentTime, activeChord]);

  // Hitung "beat" (ketukan) dalam chord saat ini
  const currentBeat = result
    ? Math.floor(((currentTime / (60 / result.tempo)) % BEATS_PER_BAR))
    : 0;

  return (
    <div className="space-y-0">
      {/* Audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Drop zone (saat belum ada file) */}
      {!file && (
        <div
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-amber)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 20,
            padding: '72px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(245,166,35,0.04)' : 'var(--color-surface)',
            transition: 'all 0.2s',
          }}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} style={{ display: 'none' }} />
          <FileAudio size={48} style={{ color: 'var(--color-amber)', margin: '0 auto 20px', opacity: 0.7 }} />
          <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--color-text)', marginBottom: 8, fontWeight: 700 }}>
            Upload Lagu
          </div>
          <div style={{ fontSize: 14, color: 'var(--color-text-dim)', lineHeight: 1.6 }}>
            Drag & drop atau klik untuk pilih file<br />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>MP3 · WAV · FLAC · OGG · M4A</span>
          </div>
        </div>
      )}

      {/* Analyzing progress */}
      {isAnalyzing && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 20,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <Loader2 size={20} style={{ color: 'var(--color-amber)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--color-text)' }}>
                Menganalisis Chord...
              </span>
            </div>
            {/* Animated waveform bars */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 40, marginBottom: 20 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <div
                  key={i}
                  className="wave-bar"
                  style={{
                    width: 4,
                    animationDelay: `${i * 0.06}s`,
                    animationDuration: `${0.6 + (i % 5) * 0.15}s`,
                    opacity: 0.6 + (i % 3) * 0.2,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', maxWidth: 400, margin: '0 auto 12px' }}>
            <div className="progress-bar" style={{ height: '100%', width: `${progress}%`, borderRadius: 3, transition: 'width 0.15s' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-dim)' }}>
            {Math.round(progress)}% · Mendeteksi chord dengan chromagram analysis
          </div>
        </div>
      )}

      {/* MAIN PLAYER (setelah analisis selesai) */}
      {result && !isAnalyzing && (
        <div style={{ borderRadius: 20, overflow: 'hidden', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

          {/* ── TOP BAR: Info lagu + controls ── */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file?.name.replace(/\.[^.]+$/, '')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Key: <span style={{ color: 'var(--color-amber)' }}>{result.key}</span>
                &nbsp;·&nbsp;{result.tempo} BPM
                &nbsp;·&nbsp;{result.segments.length} chord
                &nbsp;·&nbsp;{formatTime(result.duration)}
              </div>
            </div>

            {/* Toggle simplified */}
            <button
              onClick={() => setShowSimplified(s => !s)}
              title={showSimplified ? 'Tampilkan chord asli' : 'Sederhanakan chord'}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: showSimplified ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showSimplified ? 'rgba(74,222,128,0.3)' : 'var(--color-border)'}`,
                color: showSimplified ? '#4ade80' : 'var(--color-text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Zap size={12} />
              {showSimplified ? 'Simplified' : 'Original'}
            </button>

            {/* Toggle diagram */}
            <button
              onClick={() => setShowDiagram(s => !s)}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {showDiagram ? <Eye size={12} /> : <EyeOff size={12} />}
              Diagram
            </button>

            {/* Change file */}
            <button
              onClick={() => { setFile(null); setResult(null); setIsPlaying(false); }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-dim)',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}
            >
              Ganti File
            </button>
          </div>

          {/* ── ACTIVE CHORD DISPLAY (Fokus utama) ── */}
          <div
            style={{
              padding: '28px 24px 20px',
              display: 'flex',
              gap: 24,
              alignItems: 'center',
              justifyContent: 'center',
              background: activeChord
                ? `radial-gradient(ellipse at 50% 0%, rgba(245,166,35,${0.04 + chordProgress * 0.05}) 0%, transparent 70%)`
                : 'transparent',
              minHeight: 220,
              transition: 'background 0.3s',
            }}
          >
            {/* Diagram gitar */}
            {showDiagram && activeSimplified && (
              <div
                key={activeSimplified}
                className="fade-in-up"
                style={{ flexShrink: 0 }}
              >
                <GuitarChordDiagram chord={activeSimplified} size="lg" />
              </div>
            )}

            {/* Chord name + info */}
            <div style={{ textAlign: showDiagram ? 'left' : 'center' }}>
              {/* Chord sebelumnya (kecil) */}
              {activeChordIdx > 0 && (
                <div style={{ fontSize: 13, color: 'var(--color-text-dim)', fontFamily: 'var(--font-display)', marginBottom: 4, opacity: 0.5 }}>
                  ← {showSimplified
                    ? result.segments[activeChordIdx - 1].simplified.simplified
                    : result.segments[activeChordIdx - 1].chord}
                </div>
              )}

              {/* Chord aktif BESAR */}
              <div
                key={(activeSimplified || "") + activeChordIdx}
                className="chord-badge fade-in-up"
                style={{
                  fontSize: showDiagram ? 64 : 96,
                  lineHeight: 1,
                  fontWeight: 900,
                  letterSpacing: '-2px',
                  transition: 'font-size 0.2s',
                }}
              >
                {activeSimplified || '—'}
              </div>

              {/* Info chord */}
              {activeChord && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {activeChord.simplified.isSimplified && showSimplified && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
                      Asli: <span style={{ opacity: 0.7 }}>{activeChord.chord}</span>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {formatTime(activeChord.timestamp)} – {formatTime(activeChord.endTime)}
                    &nbsp;·&nbsp;
                    <span style={{ color: DIFFICULTY_COLORS[activeChord.simplified.difficulty].text }}>
                      {activeChord.simplified.difficulty === 'easy' ? '● Easy' : activeChord.simplified.difficulty === 'medium' ? '● Medium' : '● Hard'}
                    </span>
                  </div>
                </div>
              )}

              {/* Chord berikutnya */}
              {activeChordIdx < result.segments.length - 1 && (
                <div style={{ fontSize: 13, color: 'var(--color-text-dim)', fontFamily: 'var(--font-display)', marginTop: 6, opacity: 0.5 }}>
                  Selanjutnya: <span style={{ opacity: 0.9 }}>
                    {showSimplified
                      ? result.segments[activeChordIdx + 1].simplified.simplified
                      : result.segments[activeChordIdx + 1].chord}
                  </span> →
                </div>
              )}
            </div>
          </div>

          {/* ── BEAT INDICATOR ── */}
          <div style={{ padding: '0 24px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Ketukan 1-4 */}
            <div style={{ display: 'flex', gap: 6 }}>
              {Array.from({ length: BEATS_PER_BAR }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: i === currentBeat && isPlaying
                      ? 'var(--color-amber)'
                      : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.05s',
                    boxShadow: i === currentBeat && isPlaying
                      ? '0 0 8px rgba(245,166,35,0.6)'
                      : 'none',
                  }}
                />
              ))}
            </div>

            {/* Progress bar chord saat ini */}
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  background: 'var(--color-amber)',
                  width: `${chordProgress * 100}%`,
                  borderRadius: 2,
                  transition: 'width 0.05s linear',
                  opacity: 0.7,
                }}
              />
            </div>

            {/* Posisi chord */}
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {activeChordIdx + 1} / {result.segments.length}
            </div>
          </div>

          {/* ── CHORD TIMELINE (Chordify-style scroll) ── */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '12px 0' }}>
            <div
              ref={timelineRef}
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                padding: '4px 20px 8px',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {result.segments.map((seg, idx) => {
                const displayChord = showSimplified ? seg.simplified.simplified : seg.chord;
                const isActive = idx === activeChordIdx;
                const isPast = idx < activeChordIdx;
                const difficulty = seg.simplified.difficulty;
                const colors = DIFFICULTY_COLORS[difficulty];
                const duration = seg.endTime - seg.timestamp;

                // Lebar card proporsional dengan durasi chord (min 64px, max 140px)
                const cardWidth = Math.max(64, Math.min(140, duration * 32));

                return (
                  <button
                    key={idx}
                    onClick={() => seekToChord(idx)}
                    style={{
                      flexShrink: 0,
                      width: cardWidth,
                      padding: '10px 8px',
                      borderRadius: 12,
                      background: isActive
                        ? colors.bg
                        : isPast
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${isActive ? colors.border : 'rgba(255,255,255,0.06)'}`,
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Progress fill untuk chord aktif */}
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          height: 3,
                          width: `${chordProgress * 100}%`,
                          background: colors.text,
                          borderRadius: '0 0 0 12px',
                          transition: 'width 0.05s linear',
                        }}
                      />
                    )}

                    {/* Chord name */}
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: isActive ? 20 : 17,
                        fontWeight: 900,
                        color: isActive ? colors.text : isPast ? 'rgba(255,255,255,0.25)' : 'var(--color-text)',
                        lineHeight: 1,
                        transition: 'all 0.15s',
                      }}
                    >
                      {displayChord}
                    </div>

                    {/* Timestamp */}
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: isActive ? colors.text : 'rgba(255,255,255,0.2)',
                        marginTop: 4,
                        opacity: isActive ? 0.8 : 0.6,
                      }}
                    >
                      {formatTime(seg.timestamp)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── PLAYBACK BAR ── */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '14px 20px' }}>
            {/* Seek bar */}
            <div
              onClick={handleSeek}
              style={{
                height: 4,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 2,
                marginBottom: 14,
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              {/* Chord markers pada seekbar */}
              {result.segments.map((seg, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${(seg.timestamp / result.duration) * 100}%`,
                    top: -2,
                    width: 1.5,
                    height: 8,
                    background: 'rgba(245,166,35,0.3)',
                    transform: 'translateX(-50%)',
                  }}
                />
              ))}
              {/* Progress */}
              <div
                style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: `${(currentTime / result.duration) * 100}%`,
                  background: 'linear-gradient(90deg, var(--color-amber-dim), var(--color-amber))',
                  borderRadius: 2,
                }}
              />
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Time */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-dim)', minWidth: 80 }}>
                {formatTime(currentTime)} / {formatTime(result.duration)}
              </div>

              <div style={{ flex: 1 }} />

              {/* Prev chord */}
              <button
                onClick={() => seekToChord(Math.max(0, activeChordIdx - 1))}
                style={btnStyle}
              >
                <ChevronLeft size={18} />
              </button>

              {/* Restart */}
              <button onClick={restart} style={btnStyle}>
                <SkipBack size={16} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-dim))',
                  border: 'none',
                  color: 'var(--color-bg)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(245,166,35,0.35)',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
              >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>

              {/* Next chord */}
              <button
                onClick={() => seekToChord(Math.min(result.segments.length - 1, activeChordIdx + 1))}
                style={btnStyle}
              >
                <ChevronRight size={18} />
              </button>

              <div style={{ flex: 1 }} />

              {/* Speed */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[0.5, 0.75, 1].map(r => (
                  <button
                    key={r}
                    onClick={() => changeRate(r)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      background: playbackRate === r ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${playbackRate === r ? 'rgba(245,166,35,0.3)' : 'var(--color-border)'}`,
                      color: playbackRate === r ? 'var(--color-amber)' : 'var(--color-text-dim)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {r === 1 ? '1×' : `${r}×`}
                  </button>
                ))}
              </div>

              {/* Volume */}
              <button onClick={toggleMute} style={btnStyle}>
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range" min={0} max={1} step={0.05}
                value={isMuted ? 0 : volume}
                onChange={e => changeVolume(Number(e.target.value))}
                style={{ width: 70, accentColor: 'var(--color-amber)' }}
              />
            </div>
          </div>

          {/* ── CHORD LIST (semua chord unik dengan diagram) ── */}
          <div style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-dim)', marginBottom: 12, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Semua Chord dalam Lagu ini
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {[...new Map(result.segments.map(s => [
                showSimplified ? s.simplified.simplified : s.chord,
                s
              ])).values()].map(seg => {
                const displayChord = showSimplified ? seg.simplified.simplified : seg.chord;
                const diff = seg.simplified.difficulty;
                const colors = DIFFICULTY_COLORS[diff];
                return (
                  <div
                    key={displayChord}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      padding: '10px 8px 8px',
                      borderRadius: 12,
                      background: colors.bg,
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      const firstOccurrence = result.segments.findIndex(s =>
                        (showSimplified ? s.simplified.simplified : s.chord) === displayChord
                      );
                      if (firstOccurrence >= 0) seekToChord(firstOccurrence);
                    }}
                  >
                    <GuitarChordDiagram chord={displayChord} size="sm" />
                    <div style={{
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: colors.text,
                      textTransform: 'capitalize',
                    }}>
                      {diff}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div style={{ marginTop: 12, display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {(['easy', 'medium', 'hard'] as const).map(d => (
                <span key={d} style={{ color: DIFFICULTY_COLORS[d].text }}>
                  ● {d === 'easy' ? 'Mudah' : d === 'medium' ? 'Sedang' : 'Sulit'}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-dim)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
