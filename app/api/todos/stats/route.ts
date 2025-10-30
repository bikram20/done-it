import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getCompletedTodoStats } from '@/lib/db';
import { ensureDbInitialized } from '@/lib/init';

export async function GET() {
  try {
    await ensureDbInitialized();
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stats = await getCompletedTodoStats(session.userId);
    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching stats' },
      { status: 500 }
    );
  }
}
