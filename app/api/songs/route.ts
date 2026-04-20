import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Try to import prisma - will fail gracefully if DB not configured
let prisma: any = null;
try {
  const { prisma: p } = require('@/lib/prisma');
  prisma = p;
} catch {}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function GET() {
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const songs = await prisma.song.findMany({
      include: {
        chords: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(songs);
  } catch (error) {
    console.error('GET songs error:', error);
    return NextResponse.json({ error: 'Failed to fetch songs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured. Please set DATABASE_URL in .env.local' }, { status: 503 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const artist = formData.get('artist') as string;
    const key = formData.get('key') as string;
    const tempo = formData.get('tempo') as string;
    const duration = formData.get('duration') as string;
    const chordsJson = formData.get('chords') as string;

    if (!file || !title) {
      return NextResponse.json({ error: 'File and title are required' }, { status: 400 });
    }

    // Save file
    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileId = uuidv4();
    const ext = file.name.split('.').pop() || 'audio';
    const fileName = `${fileId}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Parse chords
    const chords = JSON.parse(chordsJson || '[]');

    // Create song in DB
    const song = await prisma.song.create({
      data: {
        title,
        artist: artist || null,
        fileName: file.name,
        filePath: `/uploads/${fileName}`,
        fileSize: file.size,
        duration: duration ? parseFloat(duration) : null,
        key: key || null,
        tempo: tempo ? parseFloat(tempo) : null,
        chords: {
          create: chords.map((c: any) => ({
            name: c.name,
            timestamp: c.timestamp || 0,
            confidence: c.confidence || null,
            position: c.position || 0,
          })),
        },
      },
      include: { chords: true },
    });

    return NextResponse.json(song, { status: 201 });
  } catch (error) {
    console.error('POST song error:', error);
    return NextResponse.json({ error: 'Failed to save song' }, { status: 500 });
  }
}
