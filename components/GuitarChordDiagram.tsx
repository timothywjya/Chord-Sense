'use client';

import { GUITAR_CHORD_DIAGRAMS } from '@/lib/chordDetection';

interface GuitarChordDiagramProps {
  chord: string;
  size?: 'sm' | 'md' | 'lg';
}

const FRET_COUNT = 5;
const STRING_COUNT = 6;

export default function GuitarChordDiagram({ chord, size = 'md' }: GuitarChordDiagramProps) {
  // Try to find the chord diagram (handle enharmonics)
  const normalizeChord = (c: string) => {
    const enharmonics: Record<string, string> = {
      'Db': 'C#', 'Gb': 'F#', 'Ab': 'Ab', 'Eb': 'Eb', 'Bb': 'Bb',
    };
    for (const [from, to] of Object.entries(enharmonics)) {
      if (c.startsWith(from)) return c.replace(from, to);
    }
    return c;
  };

  const normalized = normalizeChord(chord);
  const diagram = GUITAR_CHORD_DIAGRAMS[normalized] || GUITAR_CHORD_DIAGRAMS[chord];

  const sizes = {
    sm: { width: 90, height: 110, fontSize: 10, dotR: 5 },
    md: { width: 120, height: 145, fontSize: 12, dotR: 6 },
    lg: { width: 160, height: 195, fontSize: 14, dotR: 8 },
  };

  const { width, height, fontSize, dotR } = sizes[size];

  const padding = { top: 28, left: 22, right: 14, bottom: 14 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const stringSpacing = innerW / (STRING_COUNT - 1);
  const fretSpacing = innerH / FRET_COUNT;

  if (!diagram) {
    return (
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width,
          height,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: fontSize,
          color: 'var(--color-text-dim)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <span style={{ textAlign: 'center', padding: 8 }}>
          {chord}<br />
          <span style={{ fontSize: fontSize - 2, opacity: 0.5 }}>No diagram</span>
        </span>
      </div>
    );
  }

  const { frets, barFret } = diagram;
  const minFret = frets.filter(f => f > 0).reduce((a, b) => Math.min(a, b), Infinity);
  const fretOffset = minFret > 3 ? minFret - 1 : 0;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: 'visible' }}
    >
      {/* Chord name */}
      <text
        x={width / 2}
        y={18}
        textAnchor="middle"
        fontSize={fontSize + 2}
        fontFamily="var(--font-display)"
        fontWeight="700"
        fill="var(--color-amber)"
      >
        {chord}
      </text>

      {/* Nut or fret number */}
      {fretOffset === 0 ? (
        <rect
          x={padding.left - 1}
          y={padding.top}
          width={innerW + 2}
          height={4}
          fill="rgba(255,255,255,0.5)"
          rx={2}
        />
      ) : (
        <text
          x={padding.left - 8}
          y={padding.top + fretSpacing / 2 + 4}
          textAnchor="end"
          fontSize={fontSize - 2}
          fontFamily="var(--font-mono)"
          fill="var(--color-text-dim)"
        >
          {fretOffset + 1}
        </text>
      )}

      {/* Fret lines */}
      {Array.from({ length: FRET_COUNT + 1 }, (_, i) => (
        <line
          key={`fret-${i}`}
          x1={padding.left}
          y1={padding.top + (i === 0 ? 4 : 0) + i * fretSpacing}
          x2={padding.left + innerW}
          y2={padding.top + (i === 0 ? 4 : 0) + i * fretSpacing}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={1}
        />
      ))}

      {/* Strings */}
      {Array.from({ length: STRING_COUNT }, (_, i) => (
        <line
          key={`string-${i}`}
          x1={padding.left + i * stringSpacing}
          y1={padding.top + 4}
          x2={padding.left + i * stringSpacing}
          y2={padding.top + FRET_COUNT * fretSpacing}
          stroke="rgba(255,255,255,0.25)"
          strokeWidth={1 + (5 - i) * 0.25}
        />
      ))}

      {/* Barre chord indicator */}
      {barFret && (
        <rect
          x={padding.left - dotR * 0.5}
          y={padding.top + (barFret - fretOffset - 0.5) * fretSpacing - dotR}
          width={innerW + dotR}
          height={dotR * 2}
          fill="rgba(245, 166, 35, 0.6)"
          rx={dotR}
        />
      )}

      {/* Finger dots */}
      {frets.map((fret, stringIdx) => {
        const x = padding.left + (5 - stringIdx) * stringSpacing; // Reverse: high E = right

        if (fret === -1) {
          // Muted string
          return (
            <text
              key={`mute-${stringIdx}`}
              x={x}
              y={padding.top - 8}
              textAnchor="middle"
              fontSize={fontSize}
              fill="rgba(255,255,255,0.3)"
            >
              ×
            </text>
          );
        }

        if (fret === 0) {
          // Open string
          return (
            <circle
              key={`open-${stringIdx}`}
              cx={x}
              cy={padding.top - 9}
              r={dotR - 2}
              stroke="rgba(255,255,255,0.4)"
              strokeWidth={1.5}
              fill="none"
            />
          );
        }

        const adjustedFret = fret - fretOffset;
        const y = padding.top + (adjustedFret - 0.5) * fretSpacing;

        return (
          <circle
            key={`dot-${stringIdx}`}
            cx={x}
            cy={y}
            r={dotR}
            fill="var(--color-amber)"
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
}
