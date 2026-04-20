'use client';

import { useState } from 'react';
import { Mic, Upload, Library, Guitar } from 'lucide-react';
import RealtimeDetector from '@/components/RealtimeDetector';
import ChordifyPlayer from '@/components/ChordifyPlayer';
import SongLibrary from '@/components/SongLibrary';

type Tab = 'realtime' | 'file' | 'library';
type Mode = 'vocal' | 'instrument' | 'both';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('file');
  const [mode, setMode] = useState<Mode>('instrument');
  const [libraryKey, setLibraryKey] = useState(0);

  const tabs = [
    { id: 'realtime' as Tab, label: 'Real-Time', icon: Mic, desc: 'Live dari mic' },
    { id: 'file' as Tab, label: 'Player', icon: Upload, desc: 'Upload & play' },
    { id: 'library' as Tab, label: 'Library', icon: Library, desc: 'Tersimpan' },
  ];

  const modes: { id: Mode; label: string; desc: string }[] = [
    { id: 'instrument', label: 'Instrumen', desc: 'Gitar, piano, dll' },
    { id: 'vocal', label: 'Vokal', desc: 'Nada vokal' },
    { id: 'both', label: 'Keduanya', desc: 'Gabungan' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Background decoration */}
      <div style={{
        position: 'fixed', top: -200, right: -200, width: 600, height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,166,35,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: -100, left: -100, width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,158,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 80px' }}>
        {/* Header */}
        <header style={{ padding: '28px 0 22px', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26 }}>
              {[0.3, 0.6, 1, 0.7, 0.4, 0.8, 0.5].map((h, i) => (
                <div key={i} className="wave-bar" style={{ height: `${h * 26}px`, animationDelay: `${i * 0.12}s`, animationDuration: `${0.8 + i * 0.1}s` }} />
              ))}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 900,
              letterSpacing: '-1px', margin: 0,
              background: 'linear-gradient(135deg, #e8e6e0 0%, var(--color-amber) 100%)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              ChordSense
            </h1>
          </div>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 13, margin: 0 }}>
            Deteksi chord real-time · Disederhanakan untuk alat musik
          </p>
        </header>

        {/* Mode selector */}
        {activeTab !== 'library' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--color-text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, paddingLeft: 2 }}>
              Mode Deteksi
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{
                  padding: '9px 12px', borderRadius: 10,
                  background: mode === m.id ? 'rgba(245,166,35,0.12)' : 'var(--color-surface)',
                  border: `1px solid ${mode === m.id ? 'rgba(245,166,35,0.35)' : 'var(--color-border)'}`,
                  color: mode === m.id ? 'var(--color-amber)' : 'var(--color-text-dim)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)', textAlign: 'left', transition: 'all 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{m.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', background: 'var(--color-surface)', borderRadius: 12,
          padding: 4, marginBottom: 20, border: '1px solid var(--color-border)',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                flex: 1, padding: '10px 8px', borderRadius: 9,
                background: active ? 'rgba(245,166,35,0.12)' : 'transparent',
                border: `1px solid ${active ? 'rgba(245,166,35,0.25)' : 'transparent'}`,
                color: active ? 'var(--color-amber)' : 'var(--color-text-dim)',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.15s',
              }}>
                <Icon size={16} />
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {activeTab === 'realtime' && <RealtimeDetector mode={mode} />}
        {activeTab === 'file' && <ChordifyPlayer mode={mode} />}
        {activeTab === 'library' && <SongLibrary key={libraryKey} />}

        {/* Footer */}
        <footer style={{ textAlign: 'center', marginTop: 40, color: 'var(--color-text-dim)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <Guitar size={13} />
            <span>ChordSense · Web Audio API + Chromagram Analysis</span>
          </div>
          <div style={{ opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            Chord disederhanakan untuk kemudahan bermain instrumen
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
