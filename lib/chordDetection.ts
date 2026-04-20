// lib/chordDetection.ts
// Core chord detection engine using Web Audio API + FFT analysis

export interface ChordDetectionResult {
  chord: string;
  key: string;
  notes: string[];
  confidence: number;
  frequency: number;
  timestamp: number;
  chordType: string;
  rootNote: string;
}

export interface NoteData {
  note: string;
  octave: number;
  frequency: number;
  magnitude: number;
}

// Note frequencies (A4 = 440Hz)
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Chord patterns (semitone intervals from root)
const CHORD_PATTERNS: Record<string, number[]> = {
  'maj': [0, 4, 7],
  'min': [0, 3, 7],
  'dim': [0, 3, 6],
  'aug': [0, 4, 8],
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  'dim7': [0, 3, 6, 9],
  'half-dim7': [0, 3, 6, 10],
  'maj9': [0, 4, 7, 11, 14],
  'min9': [0, 3, 7, 10, 14],
  '9': [0, 4, 7, 10, 14],
  'sus2': [0, 2, 7],
  'sus4': [0, 5, 7],
  'add9': [0, 4, 7, 14],
  'min(add9)': [0, 3, 7, 14],
  '6': [0, 4, 7, 9],
  'min6': [0, 3, 7, 9],
};

// Guitar-friendly chord voicings (common open/barre chord shapes)
const GUITAR_CHORD_VOICINGS: Record<string, string[]> = {
  'C': ['C', 'E', 'G'],
  'Cm': ['C', 'Eb', 'G'],
  'D': ['D', 'F#', 'A'],
  'Dm': ['D', 'F', 'A'],
  'E': ['E', 'G#', 'B'],
  'Em': ['E', 'G', 'B'],
  'F': ['F', 'A', 'C'],
  'Fm': ['F', 'Ab', 'C'],
  'G': ['G', 'B', 'D'],
  'Gm': ['G', 'Bb', 'D'],
  'A': ['A', 'C#', 'E'],
  'Am': ['A', 'C', 'E'],
  'B': ['B', 'D#', 'F#'],
  'Bm': ['B', 'D', 'F#'],
  'C#': ['C#', 'F', 'G#'],
  'C#m': ['C#', 'E', 'G#'],
  'Eb': ['Eb', 'G', 'Bb'],
  'Ebm': ['Eb', 'Gb', 'Bb'],
  'F#': ['F#', 'A#', 'C#'],
  'F#m': ['F#', 'A', 'C#'],
  'Ab': ['Ab', 'C', 'Eb'],
  'Abm': ['Ab', 'B', 'Eb'],
  'Bb': ['Bb', 'D', 'F'],
  'Bbm': ['Bb', 'Db', 'F'],
};

export function frequencyToNote(frequency: number): { note: string; octave: number; cents: number } {
  const A4 = 440;
  const semitones = 12 * Math.log2(frequency / A4);
  const rounded = Math.round(semitones);
  const noteIndex = ((rounded + 9) % 12 + 12) % 12; // A=9, so offset
  const octave = Math.floor((rounded + 9) / 12) + 4;
  const cents = (semitones - rounded) * 100;
  
  return {
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
  };
}

export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  // Autocorrelation-based pitch detection (YIN-like algorithm)
  const bufferSize = buffer.length;
  const maxLag = Math.floor(sampleRate / 60); // Min 60 Hz
  const minLag = Math.floor(sampleRate / 1200); // Max 1200 Hz
  
  let bestLag = -1;
  let bestCorrelation = 0;
  
  for (let lag = minLag; lag < maxLag; lag++) {
    let correlation = 0;
    for (let i = 0; i < bufferSize - lag; i++) {
      correlation += buffer[i] * buffer[i + lag];
    }
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }
  
  if (bestLag === -1) return 0;
  return sampleRate / bestLag;
}

export function getTopFrequencies(
  analyser: AnalyserNode,
  sampleRate: number,
  topN: number = 8
): NoteData[] {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Float32Array(bufferLength);
  analyser.getFloatFrequencyData(dataArray);
  
  const frequencyResolution = sampleRate / (bufferLength * 2);
  const results: NoteData[] = [];
  
  // Find peaks in frequency spectrum
  for (let i = 2; i < bufferLength - 2; i++) {
    const freq = i * frequencyResolution;
    if (freq < 60 || freq > 1400) continue; // Guitar range roughly
    
    const magnitude = dataArray[i];
    if (magnitude < -80) continue; // Below noise floor
    
    // Check if it's a local peak
    if (
      magnitude > dataArray[i - 1] &&
      magnitude > dataArray[i - 2] &&
      magnitude > dataArray[i + 1] &&
      magnitude > dataArray[i + 2]
    ) {
      const { note, octave } = frequencyToNote(freq);
      results.push({
        note,
        octave,
        frequency: freq,
        magnitude,
      });
    }
  }
  
  // Sort by magnitude (loudest first)
  results.sort((a, b) => b.magnitude - a.magnitude);
  
  // Remove duplicates (same note, different octave) - keep loudest
  const seen = new Set<string>();
  const deduped: NoteData[] = [];
  for (const item of results) {
    if (!seen.has(item.note)) {
      seen.add(item.note);
      deduped.push(item);
    }
    if (deduped.length >= topN) break;
  }
  
  return deduped;
}

export function identifyChord(notes: string[], mode: 'vocal' | 'instrument' | 'both' = 'instrument'): ChordDetectionResult | null {
  if (notes.length < 2) return null;
  
  // Try all possible roots
  let bestMatch: ChordDetectionResult | null = null;
  let bestScore = 0;
  
  for (const rootNote of notes) {
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    if (rootIndex === -1) continue;
    
    for (const [chordType, intervals] of Object.entries(CHORD_PATTERNS)) {
      // Generate expected notes for this chord
      const expectedNotes = intervals.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return NOTE_NAMES[noteIndex];
      });
      
      // Count matching notes
      const noteSet = new Set(notes);
      const matches = expectedNotes.filter(n => noteSet.has(n)).length;
      const score = matches / expectedNotes.length;
      
      if (score > bestScore && matches >= 2) {
        bestScore = score;
        
        let chordName = rootNote;
        if (chordType !== 'maj') {
          chordName += chordType === 'min' ? 'm' : chordType;
        }
        
        const chordDisplayType = formatChordType(chordType);
        
        bestMatch = {
          chord: chordName,
          key: rootNote,
          notes: expectedNotes,
          confidence: score,
          frequency: 0,
          timestamp: Date.now(),
          chordType: chordDisplayType,
          rootNote,
        };
      }
    }
  }
  
  return bestMatch;
}

function formatChordType(type: string): string {
  const typeMap: Record<string, string> = {
    'maj': 'Major',
    'min': 'Minor',
    'dim': 'Diminished',
    'aug': 'Augmented',
    'maj7': 'Major 7th',
    'min7': 'Minor 7th',
    '7': 'Dominant 7th',
    'dim7': 'Diminished 7th',
    'half-dim7': 'Half Diminished',
    'maj9': 'Major 9th',
    'min9': 'Minor 9th',
    '9': 'Dominant 9th',
    'sus2': 'Suspended 2nd',
    'sus4': 'Suspended 4th',
    'add9': 'Add 9th',
    '6': 'Major 6th',
    'min6': 'Minor 6th',
  };
  return typeMap[type] || type;
}

// Key detection from a sequence of chords
export function detectKey(chordSequence: string[]): string {
  // Krumhansl-Schmuckler key-finding algorithm (simplified)
  const majorProfiles: Record<string, number[]> = {};
  const minorProfiles: Record<string, number[]> = {};
  
  // Count note occurrences across all chords
  const noteCounts = new Array(12).fill(0);
  
  for (const chord of chordSequence) {
    const rootNote = chord.replace(/m|maj|min|dim|aug|7|9|sus|add|\d/g, '').trim();
    const rootIndex = NOTE_NAMES.indexOf(rootNote);
    if (rootIndex >= 0) {
      noteCounts[rootIndex]++;
    }
  }
  
  // Find most common note as likely key center
  const maxCount = Math.max(...noteCounts);
  const likelyKey = noteCounts.indexOf(maxCount);
  
  // Determine major vs minor based on chord qualities
  const minorCount = chordSequence.filter(c => c.includes('m') && !c.includes('maj')).length;
  const majorCount = chordSequence.length - minorCount;
  
  const keyNote = NOTE_NAMES[likelyKey];
  const quality = minorCount > majorCount ? 'm' : '';
  
  return `${keyNote}${quality}`;
}

// Analyze an audio buffer for chords (for file upload)
export async function analyzeAudioBuffer(
  audioContext: AudioContext,
  audioBuffer: AudioBuffer,
  mode: 'vocal' | 'instrument' | 'both' = 'instrument',
  onProgress?: (progress: number) => void,
  onChordFound?: (chord: ChordDetectionResult, time: number) => void
): Promise<{ chords: ChordDetectionResult[]; key: string; tempo: number }> {
  const chords: ChordDetectionResult[] = [];
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;
  
  // Analyze in 0.5s windows with 0.25s hop
  const windowSize = Math.floor(sampleRate * 0.5);
  const hopSize = Math.floor(sampleRate * 0.25);
  const numWindows = Math.floor((channelData.length - windowSize) / hopSize);
  
  // Offline audio context for analysis
  const offlineCtx = new OfflineAudioContext(1, audioBuffer.length, sampleRate);
  
  let lastChord = '';
  
  for (let w = 0; w < numWindows; w++) {
    const startSample = w * hopSize;
    const window = channelData.slice(startSample, startSample + windowSize);
    
    // Apply Hanning window
    const windowed = applyHanningWindow(window);
    
    // Compute FFT using Web Audio
    const analyserBuffer = audioContext.createBuffer(1, windowSize, sampleRate);
    analyserBuffer.copyToChannel(new Float32Array(windowed), 0);
    
    // Get frequency peaks using autocorrelation + simplified chromagram
    const chromagram = computeChromagram(windowed, sampleRate);
    const dominantNotes = getTopNotesFromChromagram(chromagram);
    
    if (dominantNotes.length >= 2) {
      const result = identifyChord(dominantNotes, mode);
      const timestamp = (startSample / sampleRate);
      
      if (result && result.chord !== lastChord && result.confidence > 0.6) {
        const chordResult = { ...result, timestamp };
        chords.push(chordResult);
        lastChord = result.chord;
        onChordFound?.(chordResult, timestamp);
      }
    }
    
    if (onProgress) {
      onProgress((w / numWindows) * 100);
    }
    
    // Yield to prevent blocking
    if (w % 20 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
  
  const key = detectKey(chords.map(c => c.chord));
  const tempo = estimateTempo(channelData, sampleRate);
  
  return { chords, key, tempo };
}

function applyHanningWindow(buffer: Float32Array): Float32Array {
  const result = new Float32Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (buffer.length - 1)));
    result[i] = buffer[i] * window;
  }
  return result;
}

function computeChromagram(samples: Float32Array, sampleRate: number): number[] {
  const chromagram = new Array(12).fill(0);
  const N = samples.length;
  
  // Compute DFT for specific frequency bins (notes)
  for (let noteIndex = 0; noteIndex < 12; noteIndex++) {
    for (let octave = 2; octave <= 7; octave++) {
      // Frequency for this note in this octave
      const freq = 16.35 * Math.pow(2, noteIndex / 12 + octave);
      if (freq > sampleRate / 2) continue;
      
      // Goertzel algorithm for single frequency
      const omega = 2 * Math.PI * freq / sampleRate;
      const coeff = 2 * Math.cos(omega);
      let s0 = 0, s1 = 0, s2 = 0;
      
      for (let n = 0; n < Math.min(N, 4096); n++) {
        s0 = samples[n] + coeff * s1 - s2;
        s2 = s1;
        s1 = s0;
      }
      
      const power = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      chromagram[noteIndex] += Math.max(0, power);
    }
  }
  
  // Normalize
  const max = Math.max(...chromagram);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chromagram[i] /= max;
  }
  
  return chromagram;
}

function getTopNotesFromChromagram(chromagram: number[], threshold = 0.4): string[] {
  const notes: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (chromagram[i] >= threshold) {
      notes.push(NOTE_NAMES[i]);
    }
  }
  return notes;
}

function estimateTempo(samples: Float32Array, sampleRate: number): number {
  // Simple energy-based onset detection for tempo estimation
  const hopSize = Math.floor(sampleRate * 0.01); // 10ms hops
  const energies: number[] = [];
  
  for (let i = 0; i < samples.length - hopSize; i += hopSize) {
    let energy = 0;
    for (let j = 0; j < hopSize; j++) {
      energy += samples[i + j] ** 2;
    }
    energies.push(energy / hopSize);
  }
  
  // Find peaks in energy (onsets)
  const onsets: number[] = [];
  const mean = energies.reduce((a, b) => a + b, 0) / energies.length;
  
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > mean * 1.5) {
      onsets.push(i * hopSize / sampleRate);
    }
  }
  
  if (onsets.length < 2) return 120; // Default
  
  // Average interval between onsets
  let totalInterval = 0;
  for (let i = 1; i < onsets.length; i++) {
    totalInterval += onsets[i] - onsets[i - 1];
  }
  const avgInterval = totalInterval / (onsets.length - 1);
  const bpm = 60 / avgInterval;
  
  // Clamp to reasonable range
  return Math.max(60, Math.min(200, Math.round(bpm)));
}

export const GUITAR_CHORD_DIAGRAMS: Record<string, { frets: number[]; fingers: number[]; barFret?: number }> = {
  'C': { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0] },
  'D': { frets: [-1, -1, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2] },
  'E': { frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0] },
  'F': { frets: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barFret: 1 },
  'G': { frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3] },
  'A': { frets: [-1, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0] },
  'B': { frets: [-1, 2, 4, 4, 4, 2], fingers: [0, 1, 2, 3, 4, 1], barFret: 2 },
  'Am': { frets: [-1, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0] },
  'Em': { frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0] },
  'Dm': { frets: [-1, -1, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1] },
  'Fm': { frets: [1, 3, 3, 1, 1, 1], fingers: [1, 3, 4, 1, 1, 1], barFret: 1 },
  'Gm': { frets: [3, 5, 5, 3, 3, 3], fingers: [1, 3, 4, 1, 1, 1], barFret: 3 },
  'Bm': { frets: [-1, 2, 4, 4, 3, 2], fingers: [0, 1, 3, 4, 2, 1], barFret: 2 },
  'Cm': { frets: [-1, 3, 5, 5, 4, 3], fingers: [0, 1, 3, 4, 2, 1], barFret: 3 },
};
