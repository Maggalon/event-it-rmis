'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TaskStatus } from '@/types/database';

export async function updateWorkerTaskStatus(taskId: string, newStatus: TaskStatus) {
    const admin = createAdminClient();

    // Validate status format
    if (!['in_progress', 'completed'].includes(newStatus)) {
        return { error: 'Invalid task status' };
    }

    const { error } = await admin
        .from('project_tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

    if (error) {
        return { error: error.message };
    }

    return { success: true };
}
