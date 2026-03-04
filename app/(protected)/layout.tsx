import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

export default async function ProtectedLayout({
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

    // Fetch user profile with role
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single<Profile>();

    // Debug: trace what we're getting from Supabase
    console.log('[Layout] user.id:', user.id, 'profile:', profile?.role, 'error:', profileError?.message);

    // If profile doesn't exist yet (trigger might be delayed), show a fallback
    // instead of redirecting to /login (which would cause a redirect loop)
    if (!profile || profileError) {
        return (
            <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#111621] font-[Inter] flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 max-w-md w-full text-center">
                    <div className="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        Setting up your profile...
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        Your account is being configured. Please wait a moment and refresh the page.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <a
                            href="/dashboard"
                            className="px-4 py-2 bg-[#2463eb] hover:bg-[#2463eb]/90 text-white font-medium rounded-lg transition-colors text-sm"
                        >
                            Refresh
                        </a>
                        <form action="/auth/signout" method="post">
                            <button
                                type="submit"
                                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium rounded-lg transition-colors text-sm"
                            >
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    if (!profile.is_active) {
        // Inactive users get signed out
        await supabase.auth.signOut();
        redirect('/login');
    }

    if (profile.role === 'field_worker') {
        redirect('/worker/tasks');
    }

    return (
        <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#111621] font-[Inter]">
            {/* Top Navigation Bar */}
            <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="bg-[#2463eb] p-1.5 rounded-lg shadow-md shadow-[#2463eb]/20">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                    <circle cx="5" cy="12" r="1" />
                                    <circle cx="19" cy="12" r="1" />
                                    <line x1="12" y1="6" x2="12" y2="11" />
                                    <line x1="12" y1="13" x2="12" y2="18" />
                                    <line x1="6" y1="12" x2="11" y2="12" />
                                    <line x1="13" y1="12" x2="18" y2="12" />
                                </svg>
                            </div>
                            <span className="text-slate-900 dark:text-white font-bold text-lg hidden sm:block">
                                Event IT RMIS
                            </span>
                        </div>

                        {/* Navigation Links */}
                        <div className="flex items-center gap-1">
                            <a
                                href="/dashboard"
                                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                            >
                                Dashboard
                            </a>
                            {(profile.role === 'admin' || profile.role === 'project_manager') && (
                                <a
                                    href="/projects"
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                                >
                                    Projects
                                </a>
                            )}
                            {(profile.role === 'admin' || profile.role === 'project_manager') && (
                                <a
                                    href="/resources"
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                                >
                                    Resources
                                </a>
                            )}
                            {(profile.role === 'admin' || profile.role === 'project_manager') && (
                                <a
                                    href="/admin/users"
                                    className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-all"
                                >
                                    Users
                                </a>
                            )}
                        </div>

                        {/* User Info + Sign Out */}
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {profile.full_name || profile.email}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                    {profile.role.replace('_', ' ')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-full bg-[#2463eb]/10 flex items-center justify-center">
                                    <span className="text-[#2463eb] font-semibold text-sm">
                                        {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <form action="/auth/signout" method="post">
                                    <button
                                        type="submit"
                                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                        title="Sign out"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                            <polyline points="16 17 21 12 16 7" />
                                            <line x1="21" y1="12" x2="9" y2="12" />
                                        </svg>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Page Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>
        </div>
    );
}
