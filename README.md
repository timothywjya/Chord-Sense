# 🎸 ChordSense — Real-Time Chord Detection App

Aplikasi web Next.js untuk mendeteksi chord secara real-time dari audio device maupun file audio yang diupload. Dilengkapi dengan diagram chord gitar, analisis key/tempo, dan penyimpanan opsional ke PostgreSQL.

---

## ✨ Fitur Utama

### 🎙️ Real-Time Detection
- **Deteksi chord langsung** dari mikrofon atau audio device
- Identifikasi kunci/chord secara instan menggunakan Web Audio API + Chromagram Analysis
- Indikator volume dan confidence level
- Riwayat chord yang terdeteksi
- Diagram chord gitar otomatis

### 📁 File Analysis
- Upload file audio (MP3, WAV, FLAC, OGG, M4A)
- Analisis seluruh lagu dan deteksi semua chord
- Timeline chord dengan timestamp
- Playback audio dengan marker chord
- Deteksi key dan tempo otomatis

### 🎛️ Mode Detection
- **Instrument Mode** — Dioptimalkan untuk gitar, piano, dll. (high-pass filter)
- **Vocal Mode** — Deteksi nada pada vokal (band-pass filter)
- **Both Mode** — Kombinasi keduanya

### 💾 Penyimpanan PostgreSQL (Opsional)
- Simpan lagu beserta file audio
- Simpan semua chord dengan timestamp
- Library untuk melihat lagu yang tersimpan
- Delete lagu dan file audio

---

## 🚀 Cara Menjalankan

### Prerequisites
- Node.js 18+
- npm atau yarn
- PostgreSQL (opsional, untuk fitur save)

### 1. Install Dependencies

```bash
cd chord-detector
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Wajib jika ingin fitur save ke database:
DATABASE_URL="postgresql://postgres:password@localhost:5432/chordsense"
```

### 3. Setup Database (Opsional)

Jika ingin menggunakan fitur penyimpanan PostgreSQL:

```bash
# Buat database
createdb chordsense

# Push schema
npx prisma db push

# (Opsional) Buka Prisma Studio untuk lihat data
npx prisma studio
```

### 4. Jalankan Aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Struktur Proyek

```
chord-detector/
├── app/
│   ├── globals.css          # Styling global (dark theme, animasi)
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Halaman utama (tab navigation)
│   └── api/
│       └── songs/
│           ├── route.ts     # GET semua lagu, POST lagu baru
│           └── [id]/
│               └── route.ts # GET, DELETE lagu by ID
├── components/
│   ├── RealtimeDetector.tsx # Komponen deteksi real-time
│   ├── FileAnalyzer.tsx     # Komponen analisis file audio
│   ├── SongLibrary.tsx      # Library lagu tersimpan
│   └── GuitarChordDiagram.tsx # SVG diagram chord gitar
├── lib/
│   ├── chordDetection.ts    # Core algoritma deteksi chord
│   └── prisma.ts            # Prisma client singleton
├── prisma/
│   └── schema.prisma        # Schema database
├── .env.example
└── package.json
```

---

## 🧠 Cara Kerja Algoritma

### Real-Time Detection
1. **Audio Capture** — Web Audio API menangkap audio dari mikrofon
2. **FFT Analysis** — AnalyserNode melakukan Fast Fourier Transform (8192 bins)
3. **Peak Detection** — Mencari puncak frekuensi dalam spectrum
4. **Note Identification** — Konversi frekuensi → nama not (A, B, C, dst)
5. **Chord Matching** — Mencocokkan kumpulan not dengan pola chord (major, minor, 7th, dll)
6. **Stability Check** — Chord harus muncul 3x berturut-turut sebelum dikonfirmasi

### File Analysis
1. **Decode Audio** — AudioBuffer dari file
2. **Windowed Analysis** — Analisis per 0.5 detik dengan hop 0.25 detik
3. **Chromagram** — Hanning window + Goertzel algorithm per nada
4. **Chord Detection** — Identifikasi chord dari chromagram
5. **Key Detection** — Krumhansl-Schmuckler algorithm (disederhanakan)
6. **Tempo Estimation** — Energy onset detection

### Chord Patterns yang Dikenali
- Major, Minor, Diminished, Augmented
- Major 7th, Minor 7th, Dominant 7th
- Diminished 7th, Half Diminished
- Major 9th, Minor 9th, Dominant 9th
- Suspended 2nd/4th, Add 9th, 6th chords

---

## 🗄️ Schema Database

```prisma
model Song {
  id        String   @id @default(uuid())
  title     String
  artist    String?
  fileName  String
  filePath  String
  fileSize  Int
  duration  Float?
  key       String?
  tempo     Float?
  createdAt DateTime @default(now())
  chords    Chord[]
}

model Chord {
  id         String   @id @default(uuid())
  songId     String
  name       String
  timestamp  Float
  confidence Float?
  position   Int
}
```

---

## 🌐 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/songs` | Ambil semua lagu |
| `POST` | `/api/songs` | Simpan lagu baru (multipart/form-data) |
| `GET` | `/api/songs/:id` | Ambil lagu by ID |
| `DELETE` | `/api/songs/:id` | Hapus lagu |

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| UI | React + Tailwind CSS |
| Audio | Web Audio API |
| Pitch Detection | Autocorrelation + Chromagram (Goertzel) |
| Icons | Lucide React |
| Database | PostgreSQL + Prisma ORM |
| File Storage | Local filesystem (`public/uploads/`) |
| Styling | Custom CSS Variables + Glassmorphism |

---

## 💡 Tips Penggunaan

### Real-Time Detection
- Gunakan **Instrument mode** untuk gitar/piano → filter noise lebih baik
- **Sensitivity** 55-70% umumnya paling baik
- Mainkan chord dengan bersih dan sustain cukup lama (~1 detik)
- Kurangi kebisingan latar belakang untuk hasil lebih akurat

### File Analysis
- Format **WAV/FLAC** memberikan hasil lebih akurat dari MP3
- Lagu dengan instrumen dominan (bukan full mix) lebih akurat
- Chord di awal/tengah lagu lebih mudah terdeteksi
- Klik pada chord di timeline untuk jump ke timestamp tersebut

---

## 🔧 Troubleshooting

**Mikrofon tidak terdeteksi:**
- Pastikan browser mendapat izin akses mikrofon
- Coba refresh dan allow permission kembali
- Chrome/Firefox direkomendasikan

**Database error:**
- Pastikan PostgreSQL berjalan
- Cek `DATABASE_URL` di `.env.local`
- Jalankan `npx prisma db push` setelah mengubah schema

**Chord tidak terdeteksi:**
- Naikkan volume atau kurangi sensitivity
- Pastikan instrumen dalam tune yang benar
- Coba mode "Both" untuk deteksi lebih luas

---

## 📄 Lisensi

MIT License — Free to use and modify.
