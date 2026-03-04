import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { Profile, Project, ProjectSchedule, ScheduleEntry } from '@/types/database';
import { PickListClient } from './pick-list-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PickListPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check role — only admin and project_manager
    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        redirect('/dashboard');
    }

    // Fetch the project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single<Project>();

    if (!project || projectError) {
        notFound();
    }

    // Fetch the latest schedule
    const { data: latestSchedule } = await supabase
        .from('project_schedules')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single<ProjectSchedule>();

    // Fetch the schedule entries
    let scheduleEntries: ScheduleEntry[] = [];
    if (latestSchedule) {
        const { data: entries } = await supabase
            .from('schedule_entries')
            .select('*')
            .eq('schedule_id', latestSchedule.id);

        scheduleEntries = (entries as ScheduleEntry[]) || [];
    }

    return (
        <PickListClient
            project={project}
            scheduleEntries={scheduleEntries}
            hasSchedule={!!latestSchedule}
        />
    );
}
