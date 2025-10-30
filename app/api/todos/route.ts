import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTodosByUserId, createTodo } from '@/lib/db';
import { ensureDbInitialized } from '@/lib/init';

export async function GET() {
  try {
    await ensureDbInitialized();
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todos = await getTodosByUserId(session.userId);
    return NextResponse.json({ todos });
  } catch (error) {
    console.error('Get todos error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching todos' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, priority, category, dueDate } = await request.json();

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (title.length > 500) {
      return NextResponse.json(
        { error: 'Title must be less than 500 characters' },
        { status: 400 }
      );
    }

    const validPriorities = ['high', 'medium', 'low'];
    const finalPriority = validPriorities.includes(priority) ? priority : 'medium';

    const todo = await createTodo(
      session.userId,
      title.trim(),
      description?.trim() || null,
      finalPriority,
      category?.trim() || null,
      dueDate || null
    );

    if (!todo) {
      return NextResponse.json(
        { error: 'Failed to create todo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    console.error('Create todo error:', error);
    return NextResponse.json(
      { error: 'An error occurred while creating todo' },
      { status: 500 }
    );
  }
}
