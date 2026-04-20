'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Music, Play, Pause, Save, FileAudio, Loader2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import GuitarChordDiagram from './GuitarChordDiagram';
import { analyzeAudioBuffer, type ChordDetectionResult } from '@/lib/chordDetection';

interface FileAnalyzerProps {
  mode: 'vocal' | 'instrument' | 'both';
  onSaveComplete?: (songId: string) => void;
}

interface AnalysisResult {
  chords: ChordDetectionResult[];
  key: string;
  tempo: number;
  duration: number;
}

export default function FileAnalyzer({ mode, onSaveComplete }: FileAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedChord, setSelectedChord] = useState<ChordDetectionResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [playingChord, setPlayingChord] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'chords' | 'diagrams' | null>('chords');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioUrlRef = useRef<string | null>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.type.startsWith('audio/')) {
      alert('Please upload an audio file (MP3, WAV, FLAC, OGG, etc.)');
      return;
    }

    setFile(f);
    setResult(null);
    setSelectedChord(null);
    setSaveSuccess(false);
    setSongTitle(f.name.replace(/\.[^.]+$/, ''));

    // Create audio element for playback
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(f);
    audioUrlRef.current = url;
    if (audioRef.current) {
      audioRef.current.src = url;
    }

    // Start analysis
    setIsAnalyzing(true);
    setProgress(0);

    try {
      const audioCtx = new AudioContext();
      const arrayBuffer = await f.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const foundChords: ChordDetectionResult[] = [];

      const analysisResult = await analyzeAudioBuffer(
        audioCtx,
        audioBuffer,
        mode,
        (p) => setProgress(p),
        (chord) => foundChords.push(chord)
      );

      setResult({
        ...analysisResult,
        duration: audioBuffer.duration,
      });
      
      if (analysisResult.chords.length > 0) {
        setSelectedChord(analysisResult.chords[0]);
      }

      audioCtx.close();
    } catch (err) {
      console.error('Analysis error:', err);
      alert('Failed to analyze audio. Please try a different file.');
    } finally {
      setIsAnalyzing(false);
    }
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrlRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekToChord = (timestamp: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timestamp;
    }
  };

  const handleSave = async () => {
    if (!result || !file) return;
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', songTitle || file.name);
      formData.append('artist', songArtist);
      formData.append('key', result.key);
      formData.append('tempo', String(result.tempo));
      formData.append('duration', String(result.duration));
      formData.append('chords', JSON.stringify(result.chords.map((c, i) => ({
        name: c.chord,
        timestamp: c.timestamp,
        confidence: c.confidence,
        position: i,
      }))));

      const res = await fetch('/api/songs', { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setSaveSuccess(true);
        setShowSaveForm(false);
        onSaveComplete?.(data.id);
      } else {
        alert(data.error || 'Failed to save song');
      }
    } catch (err) {
      alert('Failed to save. Is the database configured?');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const uniqueChords = result ? [...new Set(result.chords.map(c => c.chord))] : [];

  return (
    <div className="space-y-6">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={e => setCurrentTime((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Drop zone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--color-amber)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 16,
            padding: '60px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(245,166,35,0.05)' : 'var(--color-surface)',
            transition: 'all 0.2s',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <FileAudio size={40} style={{ color: 'var(--color-amber)', margin: '0 auto 16px', opacity: 0.8 }} />
          <div style={{ fontSize: 18, fontFamily: 'var(--font-display)', color: 'var(--color-text)', marginBottom: 8 }}>
            Drop your audio file here
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
            Supports MP3, WAV, FLAC, OGG, M4A · Click to browse
          </div>
        </div>
      )}

      {/* File loaded state */}
      {file && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Music size={20} style={{ color: 'var(--color-amber)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {file.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)' }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
              {result && ` · ${formatTime(result.duration)}`}
            </div>
          </div>
          <button
            onClick={() => {
              setFile(null);
              setResult(null);
              setSelectedChord(null);
              setIsPlaying(false);
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-dim)',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'var(--font-body)',
            }}
          >
            Change
          </button>
        </div>
      )}

      {/* Analysis progress */}
      {isAnalyzing && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Loader2 size={16} style={{ color: 'var(--color-amber)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: 14, color: 'var(--color-text)' }}>Analyzing audio...</span>
            <span style={{ fontSize: 13, color: 'var(--color-amber)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div className="progress-bar" style={{ height: '100%', width: `${progress}%`, borderRadius: 2, transition: 'width 0.1s' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 8 }}>
            Detecting chords using chromagram analysis · Mode: {mode}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div className="space-y-4 fade-in-up">
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Key', value: result.key, icon: '🎵' },
              { label: 'Tempo', value: `${result.tempo} BPM`, icon: '🥁' },
              { label: 'Chords Found', value: uniqueChords.length, icon: '🎸' },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '14px 16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-amber)' }}>
                  {value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Playback bar */}
          {audioUrlRef.current && (
            <div
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                onClick={togglePlayback}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--color-amber)',
                  border: 'none',
                  color: 'var(--color-bg)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', minWidth: 40 }}>
                {formatTime(currentTime)}
              </div>
              <div
                style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = (e.clientX - rect.left) / rect.width;
                  if (audioRef.current) audioRef.current.currentTime = pct * result.duration;
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: 0, top: 0, bottom: 0,
                    width: `${(currentTime / result.duration) * 100}%`,
                    background: 'var(--color-amber)',
                    borderRadius: 2,
                  }}
                />
                {/* Chord markers */}
                {result.chords.map((c, i) => (
                  <div
                    key={i}
                    onClick={e => { e.stopPropagation(); seekToChord(c.timestamp); }}
                    title={c.chord}
                    style={{
                      position: 'absolute',
                      left: `${(c.timestamp / result.duration) * 100}%`,
                      top: -3,
                      width: 2,
                      height: 10,
                      background: 'rgba(245,166,35,0.6)',
                      transform: 'translateX(-50%)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'right' }}>
                {formatTime(result.duration)}
              </div>
            </div>
          )}

          {/* Chord timeline */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === 'chords' ? null : 'chords')}
              style={{
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                borderBottom: expandedSection === 'chords' ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Chord Timeline ({result.chords.length} detected)</span>
              {expandedSection === 'chords' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {expandedSection === 'chords' && (
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: 12 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.chords.map((chord, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedChord(chord);
                        seekToChord(chord.timestamp);
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: selectedChord?.chord === chord.chord && selectedChord?.timestamp === chord.timestamp
                          ? 'rgba(245,166,35,0.2)'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${selectedChord?.chord === chord.chord && selectedChord?.timestamp === chord.timestamp ? 'rgba(245,166,35,0.4)' : 'var(--color-border)'}`,
                        color: selectedChord?.chord === chord.chord && selectedChord?.timestamp === chord.timestamp
                          ? 'var(--color-amber)'
                          : 'var(--color-text)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-display)',
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all 0.15s',
                      }}
                    >
                      {chord.chord}
                      <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', opacity: 0.6, fontWeight: 400 }}>
                        {formatTime(chord.timestamp)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Unique chords diagrams */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setExpandedSection(expandedSection === 'diagrams' ? null : 'diagrams')}
              style={{
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'none',
                border: 'none',
                borderBottom: expandedSection === 'diagrams' ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Chord Diagrams ({uniqueChords.length} unique)</span>
              {expandedSection === 'diagrams' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {expandedSection === 'diagrams' && (
              <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {uniqueChords.map(chord => (
                  <div key={chord} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <GuitarChordDiagram chord={chord} size="md" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected chord detail */}
          {selectedChord && (
            <div
              className="fade-in-up"
              style={{
                background: 'rgba(245,166,35,0.06)',
                border: '1px solid rgba(245,166,35,0.2)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start',
              }}
            >
              <GuitarChordDiagram chord={selectedChord.chord} size="md" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 32, fontFamily: 'var(--font-display)', fontWeight: 900, color: 'var(--color-amber)' }}>
                  {selectedChord.chord}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 4 }}>{selectedChord.chordType}</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Notes', selectedChord.notes.join(', ')],
                    ['Root', selectedChord.rootNote],
                    ['Time', formatTime(selectedChord.timestamp)],
                    ['Confidence', `${Math.round(selectedChord.confidence * 100)}%`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--color-text-dim)', width: 70, fontFamily: 'var(--font-mono)' }}>{label}</span>
                      <span style={{ color: 'var(--color-text)' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Save to DB section */}
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {saveSuccess ? (
              <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />
                <span style={{ fontSize: 14, color: 'var(--color-success)' }}>Saved to database successfully!</span>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowSaveForm(s => !s)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  <Save size={16} style={{ color: 'var(--color-amber)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Save to Database</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginLeft: 4 }}>(Optional · Requires PostgreSQL)</span>
                  {showSaveForm ? <ChevronUp size={14} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={14} style={{ marginLeft: 'auto' }} />}
                </button>
                
                {showSaveForm && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--color-border)' }}>
                    <div style={{ paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Song Title', value: songTitle, setter: setSongTitle, placeholder: 'Enter song title...' },
                        { label: 'Artist', value: songArtist, setter: setSongArtist, placeholder: 'Enter artist name...' },
                      ].map(({ label, value, setter, placeholder }) => (
                        <div key={label}>
                          <label style={{ fontSize: 12, color: 'var(--color-text-dim)', display: 'block', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                            {label}
                          </label>
                          <input
                            value={value}
                            onChange={e => setter(e.target.value)}
                            placeholder={placeholder}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-text)',
                              fontFamily: 'var(--font-body)',
                              fontSize: 13,
                              outline: 'none',
                            }}
                          />
                        </div>
                      ))}
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                          padding: '10px 20px',
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, var(--color-amber), var(--color-amber-dim))',
                          border: 'none',
                          color: 'var(--color-bg)',
                          cursor: isSaving ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 600,
                          fontSize: 14,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          opacity: isSaving ? 0.6 : 1,
                          alignSelf: 'flex-start',
                          marginTop: 4,
                        }}
                      >
                        {isSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                        {isSaving ? 'Saving...' : 'Save Song & Chords'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
