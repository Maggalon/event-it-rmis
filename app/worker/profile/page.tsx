import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@/types/database';

export default async function WorkerProfilePage() {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    if (!profile) redirect('/login');

    // Fetch skills
    const { data: profileSkills } = await supabase
        .from('profile_skills')
        .select('skill_id, skill:skills(id, name)')
        .eq('profile_id', user.id);

    const skills = (profileSkills || []).map((ps: any) => {
        const skillName = Array.isArray(ps.skill) ? ps.skill[0]?.name : ps.skill?.name;
        return skillName;
    }).filter(Boolean) as string[];

    // Count assigned tasks (checking both user.id and team_member.id)
    const { data: teamMember } = await admin
        .from('team_members')
        .select('id')
        .eq('profile_id', user.id)
        .single();

    const workerIds = new Set([user.id, teamMember?.id].filter(Boolean));

    const { data: scheduleEntries } = await admin
        .from('schedule_entries')
        .select('task_id, assigned_workers');

    const myTaskIds = new Set(
        (scheduleEntries || [])
            .filter((e) => {
                const workers = e.assigned_workers as { id: string; name: string }[];
                return workers?.some((w) =>
                    w.id === user.id ||
                    (teamMember?.id && w.id === teamMember.id) ||
                    (profile.full_name && w.name === profile.full_name)
                );
            })
            .map((e) => e.task_id as string)
    );

    const initials = (profile.full_name || profile.email)
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div style={{ padding: '24px 16px 32px' }}>
            {/* Avatar + Name */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '32px 0 24px',
            }}>
                <div style={{
                    width: 80, height: 80,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2463eb, #60a5fa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '28px', fontWeight: 800,
                    marginBottom: '16px',
                    boxShadow: '0 8px 24px rgba(36,99,235,0.3)',
                }}>
                    {initials}
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
                    {profile.full_name || 'Field Worker'}
                </h1>
                <span style={{
                    display: 'inline-block',
                    padding: '4px 14px',
                    borderRadius: '999px',
                    background: '#ecfdf5',
                    color: '#059669',
                    fontSize: '12px', fontWeight: 700,
                    border: '1px solid #a7f3d0',
                }}>
                    Field Worker
                </span>
            </div>

            {/* Stats row */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '10px', marginBottom: '24px',
            }}>
                {[
                    { label: 'Tasks Assigned', value: myTaskIds.size, color: '#2463eb' },
                    { label: 'Skills', value: skills.length, color: '#7c3aed' },
                ].map((stat) => (
                    <div key={stat.label} style={{
                        background: 'white',
                        borderRadius: '14px',
                        border: '1.5px solid #e2e8f0',
                        padding: '18px 16px',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: '28px', fontWeight: 900, color: stat.color }}>{stat.value}</p>
                        <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600, marginTop: '4px' }}>{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Info rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {[
                    { label: 'Email', value: profile.email, icon: '✉' },
                    { label: 'Phone', value: profile.phone || '—', icon: '📱' },
                ].map((row) => (
                    <div key={row.label} style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        background: 'white', borderRadius: '12px',
                        border: '1.5px solid #e2e8f0', padding: '13px 16px',
                    }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{row.icon}</span>
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{row.value}</p>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginTop: '1px' }}>{row.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Skills */}
            {skills.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{
                        fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
                    }}>
                        My Skills
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {skills.map((skill, i) => (
                            <span key={i} style={{
                                padding: '6px 14px', borderRadius: '999px',
                                background: '#eff6ff', color: '#2463eb',
                                fontSize: '13px', fontWeight: 600,
                                border: '1px solid #bfdbfe',
                            }}>
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Sign out */}
            <form action="/auth/signout" method="post">
                <button type="submit" style={{
                    width: '100%', padding: '15px',
                    borderRadius: '14px', border: '1.5px solid #fecaca',
                    background: '#fef2f2', color: '#dc2626',
                    fontSize: '14px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    Sign Out
                </button>
            </form>
        </div>
    );
}
