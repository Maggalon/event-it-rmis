import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile, Project } from '@/types/database';
import { ProjectsClient } from './projects-client';

export default async function ProjectsPage() {
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

    console.log('[Projects] user.id:', user.id, 'role:', currentProfile?.role, 'error:', profileError?.message);

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        redirect('/dashboard');
    }

    // Fetch all projects
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    console.log('[Projects] projects count:', projects?.length, 'error:', projectsError?.message);

    return (
        <ProjectsClient
            projects={(projects as Project[]) || []}
            currentUserRole={currentProfile.role}
            currentUserId={currentProfile.id}
        />
    );
}
