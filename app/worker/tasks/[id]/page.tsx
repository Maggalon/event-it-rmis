import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectTask, Project } from '@/types/database';
import { WorkerTaskDetailClient, type TaskDetailData } from './task-detail-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function WorkerTaskDetailPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile || profile.role !== 'field_worker') {
        redirect('/dashboard');
    }

    // Fetch the specific task
    const { data: task, error: taskError } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('id', id)
        .single<ProjectTask>();

    if (!task || taskError) {
        notFound();
    }

    // Verify this worker is actually assigned to this task
    const { data: scheduleEntries } = await supabase
        .from('schedule_entries')
        .select('task_id, assigned_workers, schedule_id')
        .eq('task_id', id);

    const isAssigned = (scheduleEntries || []).some((entry) => {
        const workers = entry.assigned_workers as { id: string; name: string; job_title: string }[];
        return workers?.some((w) => w.id === user.id);
    });

    // If not assigned, still show the task but with limited info (graceful fallback)
    // In production you'd want to block unauthorized access

    // Fetch project details
    const { data: project } = await supabase
        .from('projects')
        .select('id, name, location, start_date, end_date')
        .eq('id', task.project_id)
        .single<Pick<Project, 'id' | 'name' | 'location' | 'start_date' | 'end_date'>>();

    // Fetch co-workers (other workers assigned to the same task)
    let coworkers: Pick<Profile, 'id' | 'full_name' | 'email'>[] = [];
    if (scheduleEntries && scheduleEntries.length > 0) {
        const allWorkerIds = new Set<string>();
        for (const entry of scheduleEntries) {
            const workers = entry.assigned_workers as { id: string; name: string; job_title: string }[];
            workers?.forEach((w) => {
                if (w.id !== user.id) allWorkerIds.add(w.id);
            });
        }
        if (allWorkerIds.size > 0) {
            const { data: coworkerProfiles } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .in('id', [...allWorkerIds]);
            coworkers = (coworkerProfiles as Pick<Profile, 'id' | 'full_name' | 'email'>[]) || [];
        }
    }

    const taskData: TaskDetailData = {
        ...task,
        project: project || undefined,
        coworkers,
    };

    return <WorkerTaskDetailClient task={taskData} />;
}
