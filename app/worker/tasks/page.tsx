import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, ProjectTask, Project } from '@/types/database';
import { WorkerTasksClient, type WorkerTask } from '../worker-tasks-client';

export default async function WorkerTasksPage() {
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

    // Find all schedule_entries where this worker is assigned
    const { data: scheduleEntries } = await supabase
        .from('schedule_entries')
        .select('task_id, assigned_workers, schedule_id');

    // Filter entries where this worker appears
    const myEntries = (scheduleEntries || []).filter((entry) => {
        const workers = entry.assigned_workers as { id: string; name: string; job_title: string }[];
        return workers?.some((w) => w.id === user.id);
    });

    const myTaskIds = [...new Set(myEntries.map((e) => e.task_id as string))];

    let workerTasks: WorkerTask[] = [];

    if (myTaskIds.length > 0) {
        const { data: tasks } = await supabase
            .from('project_tasks')
            .select('*')
            .in('id', myTaskIds);

        if (tasks && tasks.length > 0) {
            // Get the project ids to fetch project details
            const projectIds = [...new Set((tasks as ProjectTask[]).map((t) => t.project_id))];
            const { data: projects } = await supabase
                .from('projects')
                .select('id, name, location, start_date, end_date')
                .in('id', projectIds);

            const projectMap = new Map((projects || []).map((p) => [p.id, p as Pick<Project, 'id' | 'name' | 'location' | 'start_date' | 'end_date'>]));

            workerTasks = (tasks as ProjectTask[]).map((task) => ({
                ...task,
                project: projectMap.get(task.project_id),
            })) as WorkerTask[];
        }
    }

    return <WorkerTasksClient tasks={workerTasks} />;
}
