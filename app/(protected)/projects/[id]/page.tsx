import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import type { Profile, Project, TaskGroup, ProjectTask, Skill, EquipmentModel } from '@/types/database';
import { ProjectDetailsClient } from './project-details-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ProjectDetailsPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check role — only admin and project_manager
    const { data: currentProfile, error: profileError } = await supabase
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

    // Fetch all skills for the task form dropdown
    const { data: skills } = await supabase
        .from('skills')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    // Fetch all equipment models for the task form dropdown
    const { data: equipmentModels } = await supabase
        .from('equipment_models')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    return (
        <ProjectDetailsClient
            project={project}
            taskGroups={(taskGroups as TaskGroup[]) || []}
            tasks={(tasks as ProjectTask[]) || []}
            currentUserRole={currentProfile.role}
            skills={(skills as Skill[]) || []}
            equipmentModels={(equipmentModels as EquipmentModel[]) || []}
        />
    );
}
