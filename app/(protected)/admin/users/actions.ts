'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import type { Profile, UserRole } from '@/types/database';

export async function updateUserRole(userId: string, newRole: UserRole) {
    const supabase = await createClient();

    // Verify current user is admin
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || currentProfile.role !== 'admin') {
        return { error: 'Only admins can change user roles' };
    }

    // Prevent admin from changing their own role
    if (userId === user.id) {
        return { error: 'You cannot change your own role' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || currentProfile.role !== 'admin') {
        return { error: 'Only admins can activate/deactivate users' };
    }

    if (userId === user.id) {
        return { error: 'You cannot deactivate your own account' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

export async function updateUserProfile(
    userId: string,
    updates: { full_name?: string; phone?: string }
) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || (currentProfile.role !== 'admin' && currentProfile.role !== 'project_manager')) {
        return { error: 'Insufficient permissions' };
    }

    const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);

    if (error) {
        return { error: error.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}

/**
 * Create a new user using the service-role admin client.
 * Runs server-side only (safe to use service_role key here).
 */
export async function createUser(data: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
    skill_ids: string[];
}) {
    const supabase = await createClient();

    // Verify current user is admin
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'Not authenticated' };
    }

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || currentProfile.role !== 'admin') {
        return { error: 'Only admins can create users' };
    }

    try {
        const adminClient = createAdminClient();

        // 1. Create the auth user with the admin client
        const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
            user_metadata: { full_name: data.full_name || '' },
        });

        if (createError) {
            return { error: createError.message };
        }

        // 2. Update the profile with the chosen role and name
        //    (DB trigger creates profile with default 'field_worker' role)
        //    Wait a moment for the trigger to fire
        await new Promise((resolve) => setTimeout(resolve, 500));

        const { error: updateError } = await adminClient
            .from('profiles')
            .update({
                role: data.role,
                full_name: data.full_name || '',
            })
            .eq('id', newUser.user.id);

        if (updateError) {
            console.error('Profile update error:', updateError);
        }

        // 3. If field_worker and skills provided, assign skills
        if (data.role === 'field_worker' && data.skill_ids.length > 0) {
            const profileSkills = data.skill_ids.map((skillId) => ({
                profile_id: newUser.user.id,
                skill_id: skillId,
            }));

            const { error: skillsError } = await adminClient
                .from('profile_skills')
                .insert(profileSkills);

            if (skillsError) {
                console.error('Skills assignment error:', skillsError);
            }
        }

        revalidatePath('/admin/users');
        return { success: true, userId: newUser.user.id };
    } catch (err) {
        console.error('Create user error:', err);
        return { error: 'Failed to create user. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local' };
    }
}

/**
 * Add a new skill to the master catalog.
 */
export async function addSkill(name: string, category: string) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || currentProfile.role !== 'admin') {
        return { error: 'Only admins can manage skills' };
    }

    const { data: skill, error } = await supabase
        .from('skills')
        .insert({ name: name.trim(), category: category.trim() || 'general' })
        .select()
        .single();

    if (error) return { error: error.message };

    revalidatePath('/admin/users');
    return { success: true, skill };
}

/**
 * Update profile skills for a given user
 */
export async function updateProfileSkills(profileId: string, skillIds: string[]) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: 'Not authenticated' };

    const { data: currentProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<Pick<Profile, 'role'>>();

    if (!currentProfile || currentProfile.role !== 'admin') {
        return { error: 'Only admins can manage profile skills' };
    }

    // Remove all existing skills for this profile
    const { error: deleteError } = await supabase
        .from('profile_skills')
        .delete()
        .eq('profile_id', profileId);

    if (deleteError) return { error: deleteError.message };

    // Insert new skills
    if (skillIds.length > 0) {
        const rows = skillIds.map((skillId) => ({
            profile_id: profileId,
            skill_id: skillId,
        }));

        const { error: insertError } = await supabase
            .from('profile_skills')
            .insert(rows);

        if (insertError) return { error: insertError.message };
    }

    revalidatePath('/admin/users');
    return { success: true };
}
