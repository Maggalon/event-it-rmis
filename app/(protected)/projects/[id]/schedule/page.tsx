import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { Profile, Project, TaskGroup, ProjectTask, TeamMember, Equipment } from '@/types/database';
import { ScheduleClient } from './schedule-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export interface ScheduleEntry {
    id: string;
    schedule_id: string;
    task_id: string;
    assigned_workers: { id: string; name: string; job_title: string }[];
    assigned_equipment: { id: string; asset_tag: string; model_name: string }[];
    missing_skills: string[];
    missing_equipment: string[];
    has_gap: boolean;
    created_at: string;
}

export interface ProjectSchedule {
    id: string;
    project_id: string;
    generated_at: string;
    generated_by: string | null;
    has_gaps: boolean;
    notes: string;
    created_at: string;
}

export default async function SchedulePage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        redirect('/dashboard');
    }

    // Fetch project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single<Project>();

    if (!project || projectError) {
        notFound();
    }

    // Fetch task groups
    const { data: taskGroups } = await supabase
        .from('task_groups')
        .select('*')
        .eq('project_id', id)
        .order('sort_order', { ascending: true });

    // Fetch tasks
    const { data: tasks } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', id)
        .order('sort_order', { ascending: true });

    // Fetch team members (with their skills)
    const { data: teamMembers } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_available', true);

    // Fetch profiles with their skills (for workers registered in system)
    const { data: profiles } = await supabase
        .from('profiles')
        .select('*, profile_skills(skill_id, skill:skills(id, name))')
        .eq('role', 'field_worker')
        .eq('is_active', true);

    // Fetch equipment with model info
    const { data: equipment } = await supabase
        .from('equipment')
        .select('*, model:equipment_models(*)')
        .eq('status', 'available');

    // Fetch latest schedule for this project
    const { data: latestSchedule } = await supabase
        .from('project_schedules')
        .select('*')
        .eq('project_id', id)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single<ProjectSchedule>();

    // Fetch schedule entries if schedule exists
    let scheduleEntries: ScheduleEntry[] = [];
    if (latestSchedule) {
        const { data: entries } = await supabase
            .from('schedule_entries')
            .select('*')
            .eq('schedule_id', latestSchedule.id);
        scheduleEntries = (entries as ScheduleEntry[]) || [];
    }

    return (
        <ScheduleClient
            project={project}
            taskGroups={(taskGroups as TaskGroup[]) || []}
            tasks={(tasks as ProjectTask[]) || []}
            teamMembers={(teamMembers as TeamMember[]) || []}
            profiles={(profiles as Profile[]) || []}
            equipment={(equipment as Equipment[]) || []}
            currentUserId={user.id}
            latestSchedule={latestSchedule || null}
            scheduleEntries={scheduleEntries}
        />
    );
}
