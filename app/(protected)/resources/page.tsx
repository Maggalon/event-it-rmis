import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Profile, Equipment, EquipmentModel, ProfileSkill } from '@/types/database';
import { ResourcesClient } from './resources-client';

export default async function ResourcesPage() {
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

    console.log('[Resources] user.id:', user.id, 'role:', currentProfile?.role, 'error:', profileError?.message);

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        redirect('/dashboard');
    }

    // Fetch all equipment models
    const { data: equipmentModels } = await supabase
        .from('equipment_models')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });

    // Fetch all equipment items with joined model and assigned profile
    const { data: equipment } = await supabase
        .from('equipment')
        .select('*, model:equipment_models(*), assigned_profile:profiles!equipment_assigned_to_fkey(*)')
        .order('created_at', { ascending: false });

    // Fetch all field workers (profiles with role = 'field_worker')
    const { data: fieldWorkers } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'field_worker')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

    // Fetch all profile_skills with joined skill data
    const { data: profileSkills } = await supabase
        .from('profile_skills')
        .select('*, skill:skills(*)');

    // Fetch all active profiles for the "assigned to" dropdown
    const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

    return (
        <ResourcesClient
            equipment={(equipment as Equipment[]) || []}
            equipmentModels={(equipmentModels as EquipmentModel[]) || []}
            fieldWorkers={(fieldWorkers as Profile[]) || []}
            profileSkills={(profileSkills as ProfileSkill[]) || []}
            allProfiles={(allProfiles as Pick<Profile, 'id' | 'full_name' | 'email'>[]) || []}
            currentUserRole={currentProfile.role}
        />
    );
}
