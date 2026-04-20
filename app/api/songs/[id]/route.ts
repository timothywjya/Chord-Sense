import { NextRequest, NextResponse } from 'next/server';
import { unlink } from 'fs/promises';
import path from 'path';

let prisma: any = null;
try {
  const { prisma: p } = require('@/lib/prisma');
  prisma = p;
} catch {}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const song = await prisma.song.findUnique({
      where: { id: params.id },
      include: {
        chords: { orderBy: { position: 'asc' } },
      },
    });

    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    return NextResponse.json(song);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch song' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!prisma) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const song = await prisma.song.findUnique({ where: { id: params.id } });
    
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    // Delete file
    try {
      const filePath = path.join(process.cwd(), 'public', song.filePath);
      await unlink(filePath);
    } catch {
      // File might not exist, continue
    }

    // Delete from DB (chords cascade deleted)
    await prisma.song.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete song' }, { status: 500 });
  }
}
