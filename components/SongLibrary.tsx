'use client';

import { useState, useEffect } from 'react';
import { Database, Music, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import GuitarChordDiagram from './GuitarChordDiagram';

interface Song {
  id: string;
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  duration?: number;
  createdAt: string;
  chords: { id: string; name: string; timestamp: number; confidence?: number; position: number }[];
}

export default function SongLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSong, setExpandedSong] = useState<string | null>(null);

  const loadSongs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/songs');
      if (!res.ok) throw new Error('Failed to load songs');
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      setError('Could not load songs. Is the database configured?');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSongs();
  }, []);

  const deleteSong = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this song and all its chord data?')) return;
    try {
      await fetch(`/api/songs/${id}`, { method: 'DELETE' });
      setSongs(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert('Failed to delete song');
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-dim)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14 }}>Loading songs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 24,
          borderRadius: 12,
          background: 'rgba(248,113,113,0.08)',
          border: '1px solid rgba(248,113,113,0.2)',
          textAlign: 'center',
        }}
      >
        <Database size={24} style={{ color: 'rgba(248,113,113,0.6)', margin: '0 auto 12px' }} />
        <div style={{ fontSize: 14, color: 'var(--color-danger)', marginBottom: 8 }}>{error}</div>
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
          Configure DATABASE_URL in .env.local to enable song storage
        </div>
        <button
          onClick={loadSongs}
          style={{
            marginTop: 12,
            padding: '6px 16px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-dim)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-body)',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-dim)' }}>
        <Music size={40} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
        <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', marginBottom: 8 }}>No songs saved yet</div>
        <div style={{ fontSize: 13 }}>Analyze a file and save it to see it here</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {songs.map(song => {
        const isExpanded = expandedSong === song.id;
        const uniqueChords = [...new Set(song.chords.map(c => c.name))];
        
        return (
          <div
            key={song.id}
            style={{
              background: 'var(--color-surface)',
              border: `1px solid ${isExpanded ? 'rgba(245,166,35,0.3)' : 'var(--color-border)'}`,
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'border-color 0.2s',
            }}
          >
            {/* Song header */}
            <button
              onClick={() => setExpandedSong(isExpanded ? null : song.id)}
              style={{
                width: '100%',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'rgba(245,166,35,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Music size={16} style={{ color: 'var(--color-amber)' }} />
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {song.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2 }}>
                  {song.artist && `${song.artist} · `}
                  {song.key && `Key: ${song.key} · `}
                  {song.tempo && `${song.tempo} BPM · `}
                  {formatDate(song.createdAt)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', alignItems: 'center' }}>
                <span>{song.chords.length} chords</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
              
              <button
                onClick={(e) => deleteSong(song.id, e)}
                style={{
                  padding: 6,
                  borderRadius: 6,
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  display: 'flex',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-danger)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
              >
                <Trash2 size={14} />
              </button>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid var(--color-border)', padding: 16 }} className="fade-in-up">
                {/* Chord sequence */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Chord Sequence
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {song.chords.sort((a, b) => a.position - b.position).map((chord, i) => (
                      <span
                        key={chord.id}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: 'rgba(245,166,35,0.08)',
                          border: '1px solid rgba(245,166,35,0.15)',
                          fontSize: 13,
                          fontFamily: 'var(--font-display)',
                          fontWeight: 700,
                          color: 'var(--color-amber)',
                        }}
                      >
                        {chord.name}
                        {chord.timestamp !== undefined && (
                          <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--color-text-dim)', marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
                            {formatTime(chord.timestamp)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Chord diagrams */}
                {uniqueChords.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                      Chord Diagrams
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {uniqueChords.slice(0, 8).map(chord => (
                        <GuitarChordDiagram key={chord} chord={chord} size="sm" />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
