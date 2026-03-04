import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';
import Link from 'next/link';

export default async function WorkerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
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

    if (!profile) {
        redirect('/login');
    }

    if (!profile.is_active) {
        await supabase.auth.signOut();
        redirect('/login');
    }

    // Only field_workers can access this layout
    if (profile.role !== 'field_worker') {
        redirect('/dashboard');
    }

    const initials = (profile.full_name || profile.email)
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="worker-shell">
            <style>{`
                :root {
                    --primary: #2463eb;
                    --bg-light: #f6f6f8;
                    --bg-dark: #111621;
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html { font-family: 'Inter', system-ui, sans-serif; }
                body { background-color: var(--bg-light); min-height: 100dvh; }
                @media (prefers-color-scheme: dark) {
                    body { background-color: var(--bg-dark); color: #f1f5f9; }
                }
                .worker-shell {
                    position: relative;
                    min-height: 100dvh;
                    display: flex;
                    flex-direction: column;
                    max-width: 430px;
                    margin: 0 auto;
                    background: #f6f6f8;
                    box-shadow: 0 0 40px rgba(0,0,0,0.1);
                }
                @media (prefers-color-scheme: dark) {
                    .worker-shell { background: #111621; }
                }
            `}</style>

            {/* Sticky Profile Strip at top — shows who is logged in */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '8px 16px',
                gap: '10px',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(12px)',
                position: 'sticky',
                top: 0,
                zIndex: 20,
            }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    {profile.full_name || profile.email}
                </span>
                <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2463eb, #60a5fa)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '11px', fontWeight: 700,
                }}>
                    {initials}
                </div>
                <form action="/auth/signout" method="post">
                    <button
                        type="submit"
                        title="Sign out"
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#94a3b8', padding: '4px', borderRadius: '6px',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </form>
            </div>

            {/* Page content */}
            <main style={{ flex: 1, paddingBottom: '80px' }}>
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav style={{
                position: 'fixed',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: '430px',
                borderTop: '1px solid #e2e8f0',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '8px 24px 12px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                zIndex: 50,
            }}>
                <Link
                    href="/worker/tasks"
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        color: '#2463eb', textDecoration: 'none',
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="2" fill="currentColor" stroke="none" />
                        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>My Tasks</span>
                </Link>
                <Link
                    href="/worker/profile"
                    style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                        color: '#94a3b8', textDecoration: 'none',
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Profile</span>
                </Link>
            </nav>
        </div>
    );
}
