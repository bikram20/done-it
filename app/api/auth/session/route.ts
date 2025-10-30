import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ isLoggedIn: false });
    }

    return NextResponse.json({
      isLoggedIn: true,
      user: {
        id: session.userId,
        username: session.username,
      },
    });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ isLoggedIn: false });
  }
}
