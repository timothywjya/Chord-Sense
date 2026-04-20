// lib/chordSimplifier.ts
// Menyederhanakan chord kompleks menjadi chord yang mudah dimainkan

// Pemetaan chord kompleks → chord sederhana
// Prioritas: mudah dimainkan sebagai open chord atau barre sederhana
const SIMPLIFICATION_MAP: Record<string, string> = {
  // 7th chords → Major/Minor
  'Cmaj7': 'C', 'Cmin7': 'Cm', 'C7': 'C', 'Cdim7': 'Cdim', 'Cm7': 'Cm',
  'Dmaj7': 'D', 'Dmin7': 'Dm', 'D7': 'D', 'Ddim7': 'Ddim', 'Dm7': 'Dm',
  'Emaj7': 'E', 'Emin7': 'Em', 'E7': 'E', 'Edim7': 'Edim', 'Em7': 'Em',
  'Fmaj7': 'F', 'Fmin7': 'Fm', 'F7': 'F', 'Fm7': 'Fm',
  'Gmaj7': 'G', 'Gmin7': 'Gm', 'G7': 'G', 'Gm7': 'Gm',
  'Amaj7': 'A', 'Amin7': 'Am', 'A7': 'A', 'Adim7': 'Adim', 'Am7': 'Am',
  'Bmaj7': 'B', 'Bmin7': 'Bm', 'B7': 'B', 'Bdim7': 'Bdim', 'Bm7': 'Bm',

  // 9th chords → 7th or Major/Minor
  'Cmaj9': 'C', 'Cmin9': 'Cm', 'C9': 'C',
  'Dmaj9': 'D', 'Dmin9': 'Dm', 'D9': 'D',
  'Emaj9': 'E', 'Emin9': 'Em', 'E9': 'E',
  'Fmaj9': 'F', 'Fmin9': 'Fm', 'F9': 'F',
  'Gmaj9': 'G', 'Gmin9': 'Gm', 'G9': 'G',
  'Amaj9': 'A', 'Amin9': 'Am', 'A9': 'A',
  'Bmaj9': 'B', 'Bmin9': 'Bm', 'B9': 'B',

  // Sus chords → Major (close enough for strumming)
  'Csus2': 'C', 'Csus4': 'C',
  'Dsus2': 'D', 'Dsus4': 'D',
  'Esus2': 'E', 'Esus4': 'E',
  'Fsus2': 'F', 'Fsus4': 'F',
  'Gsus2': 'G', 'Gsus4': 'G',
  'Asus2': 'A', 'Asus4': 'A',
  'Bsus2': 'B', 'Bsus4': 'B',

  // Add chords → Major
  'Cadd9': 'C', 'Dadd9': 'D', 'Eadd9': 'E',
  'Fadd9': 'F', 'Gadd9': 'G', 'Aadd9': 'A', 'Badd9': 'B',

  // 6th chords → Major
  'C6': 'C', 'D6': 'D', 'E6': 'E', 'F6': 'F',
  'G6': 'G', 'A6': 'A', 'B6': 'B',
  'Cm6': 'Cm', 'Dm6': 'Dm', 'Em6': 'Em',
  'Fm6': 'Fm', 'Gm6': 'Gm', 'Am6': 'Am', 'Bm6': 'Bm',

  // Augmented → Major
  'Caug': 'C', 'Daug': 'D', 'Eaug': 'E',
  'Faug': 'F', 'Gaug': 'G', 'Aaug': 'A', 'Baug': 'B',

  // Diminished → Minor (easier to play)
  'Cdim': 'Cm', 'Ddim': 'Dm', 'Edim': 'Em',
  'Fdim': 'Fm', 'Gdim': 'Gm', 'Adim': 'Am', 'Bdim': 'Bm',

  // Half-dim → Minor
  'Chalf-dim7': 'Cm', 'Dhalf-dim7': 'Dm', 'Ehalf-dim7': 'Em',
  'Fhalf-dim7': 'Fm', 'Ghalf-dim7': 'Gm', 'Ahalf-dim7': 'Am',

  // Flat/Sharp enharmonic normalization
  'Db': 'C#', 'Dbm': 'C#m',
  'Gb': 'F#', 'Gbm': 'F#m',
  'Ab': 'Ab', 'Abm': 'Abm', // Ab is common enough
  'Eb': 'Eb', 'Ebm': 'Ebm',
  'Bb': 'Bb', 'Bbm': 'Bbm',
};

// Chord yang dianggap "mudah" untuk pemula/intermediate
const BEGINNER_CHORDS = new Set([
  'C', 'Cm', 'D', 'Dm', 'E', 'Em', 'F', 'Fm',
  'G', 'Gm', 'A', 'Am', 'B', 'Bm',
  'C#', 'C#m', 'Eb', 'Ebm', 'F#', 'F#m',
  'Ab', 'Abm', 'Bb', 'Bbm',
]);

export interface SimplifiedChord {
  original: string;       // Chord asli yang terdeteksi
  simplified: string;     // Chord yang disederhanakan
  isSimplified: boolean;  // Apakah ada penyederhanaan
  difficulty: 'easy' | 'medium' | 'hard';
}

export function simplifyChord(chord: string): SimplifiedChord {
  // Cek langsung di map
  if (SIMPLIFICATION_MAP[chord]) {
    const simplified = SIMPLIFICATION_MAP[chord];
    return {
      original: chord,
      simplified,
      isSimplified: chord !== simplified,
      difficulty: getDifficulty(simplified),
    };
  }

  // Cek apakah sudah sederhana
  if (BEGINNER_CHORDS.has(chord)) {
    return {
      original: chord,
      simplified: chord,
      isSimplified: false,
      difficulty: getDifficulty(chord),
    };
  }

  // Coba parse chord secara dinamis
  // Format: Root + Quality (maj7, min7, 7, dim, aug, sus2, sus4, dll)
  const rootMatch = chord.match(/^([A-G][#b]?)(.*)/);
  if (rootMatch) {
    const root = rootMatch[1];
    const quality = rootMatch[2];

    // Normalisasi enharmonik root
    const normalRoot = normalizeRoot(root);

    // Tentukan simplified berdasarkan quality
    let simplifiedQuality = '';
    if (quality.includes('m') && !quality.includes('maj') && !quality.includes('dim')) {
      simplifiedQuality = 'm'; // Minor
    }
    // Major (semua selain minor) → tidak ada suffix

    const simplified = normalRoot + simplifiedQuality;

    return {
      original: chord,
      simplified: BEGINNER_CHORDS.has(simplified) ? simplified : normalRoot,
      isSimplified: chord !== simplified,
      difficulty: getDifficulty(simplified),
    };
  }

  return {
    original: chord,
    simplified: chord,
    isSimplified: false,
    difficulty: 'hard',
  };
}

function normalizeRoot(root: string): string {
  const enharmonics: Record<string, string> = {
    'Db': 'C#', 'Gb': 'F#', 'Cb': 'B', 'Fb': 'E',
    'E#': 'F', 'B#': 'C', 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab',
  };
  return enharmonics[root] || root;
}

function getDifficulty(chord: string): 'easy' | 'medium' | 'hard' {
  const easy = new Set(['C', 'Am', 'Em', 'G', 'D', 'E', 'A', 'Dm']);
  const medium = new Set(['Cm', 'Gm', 'F', 'Bm', 'B', 'Fm', 'C#m', 'F#m']);
  if (easy.has(chord)) return 'easy';
  if (medium.has(chord)) return 'medium';
  return 'hard';
}

// Warna per tingkat kesulitan
export const DIFFICULTY_COLORS = {
  easy: { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.35)', text: '#4ade80' },
  medium: { bg: 'rgba(245, 166, 35, 0.12)', border: 'rgba(245, 166, 35, 0.35)', text: '#f5a623' },
  hard: { bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.35)', text: '#f87171' },
};

// Simplifikasi sequence chord dan hilangkan duplikat berurutan
export function simplifyChordSequence(
  chords: Array<{ chord: string; timestamp: number; confidence?: number }>
): Array<{ chord: string; simplified: SimplifiedChord; timestamp: number; endTime: number; confidence?: number }> {
  const result: Array<{
    chord: string;
    simplified: SimplifiedChord;
    timestamp: number;
    endTime: number;
    confidence?: number;
  }> = [];

  for (let i = 0; i < chords.length; i++) {
    const current = chords[i];
    const simplified = simplifyChord(current.chord);
    const endTime = chords[i + 1]?.timestamp ?? current.timestamp + 4;

    // Skip jika sama dengan sebelumnya (setelah simplifikasi)
    const last = result[result.length - 1];
    if (last && last.simplified.simplified === simplified.simplified) {
      // Extend durasi chord sebelumnya
      last.endTime = endTime;
      continue;
    }

    result.push({
      chord: current.chord,
      simplified,
      timestamp: current.timestamp,
      endTime,
      confidence: current.confidence,
    });
  }

  return result;
}
