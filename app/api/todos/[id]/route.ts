import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getTodoById, updateTodo, deleteTodo } from '@/lib/db';
import { ensureDbInitialized } from '@/lib/init';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const todoId = parseInt(id);

    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 });
    }

    // Verify todo belongs to user
    const existingTodo = await getTodoById(todoId);
    if (!existingTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    if (existingTodo.user_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updates = await request.json();

    // Validate updates
    const allowedFields = ['title', 'description', 'priority', 'category', 'completed', 'due_date'];
    const filteredUpdates: any = {};

    for (const key of allowedFields) {
      if (key in updates) {
        if (key === 'title' && (!updates[key] || updates[key].trim().length === 0)) {
          return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
        }
        if (key === 'priority' && !['high', 'medium', 'low'].includes(updates[key])) {
          return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
        }
        if (key === 'completed' && typeof updates[key] === 'boolean') {
          filteredUpdates[key] = updates[key];
          // Set completed_at timestamp when marking as completed
          if (updates[key] === true && !existingTodo.completed) {
            filteredUpdates.completed_at = new Date().toISOString();
          } else if (updates[key] === false) {
            filteredUpdates.completed_at = null;
          }
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    const todo = await updateTodo(todoId, filteredUpdates);

    if (!todo) {
      return NextResponse.json(
        { error: 'Failed to update todo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ todo });
  } catch (error) {
    console.error('Update todo error:', error);
    return NextResponse.json(
      { error: 'An error occurred while updating todo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const session = await getSession();

    if (!session.isLoggedIn || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const todoId = parseInt(id);

    if (isNaN(todoId)) {
      return NextResponse.json({ error: 'Invalid todo ID' }, { status: 400 });
    }

    // Verify todo belongs to user
    const existingTodo = await getTodoById(todoId);
    if (!existingTodo) {
      return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    }

    if (existingTodo.user_id !== session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const success = await deleteTodo(todoId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete todo' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete todo error:', error);
    return NextResponse.json(
      { error: 'An error occurred while deleting todo' },
      { status: 500 }
    );
  }
}
