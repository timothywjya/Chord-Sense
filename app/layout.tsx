import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ChordSense — Real-Time Chord Detection',
  description: 'Identify chords in real-time from your device audio or uploaded audio files',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
