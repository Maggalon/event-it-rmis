import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile, Skill, ProfileSkill } from '@/types/database';
import { UserManagementClient } from './user-management-client';

export default async function AdminUsersPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Check admin or PM role
    const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    console.log('[AdminUsers] user.id:', user.id, 'role:', currentProfile?.role, 'error:', profileError?.message);

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        console.log('[AdminUsers] REDIRECTING to /dashboard — role check failed');
        redirect('/dashboard');
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    console.log('[AdminUsers] profiles count:', profiles?.length, 'error:', profilesError?.message);

    // Fetch all skills (master catalog)
    const { data: skills } = await supabase
        .from('skills')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    // Fetch all profile_skills with joined skill data
    const { data: profileSkills } = await supabase
        .from('profile_skills')
        .select('*, skill:skills(*)');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
                        Create and manage user accounts and roles
                    </p>
                </div>
            </div>

            <UserManagementClient
                profiles={(profiles as Profile[]) || []}
                skills={(skills as Skill[]) || []}
                profileSkills={(profileSkills as ProfileSkill[]) || []}
                currentUserRole={currentProfile.role}
            />
        </div>
    );
}
