'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, signup } from './actions';
import { createClient } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // Client-side check: if user is already logged in, redirect to dashboard
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                router.replace('/dashboard');
            }
        });
    }, [router]);

    async function handleSubmit(formData: FormData) {
        setError(null);
        setLoading(true);
        try {
            const result = mode === 'login' ? await login(formData) : await signup(formData);
            if (result?.error) {
                setError(result.error);
            }
        } catch {
            // redirect throws, this is expected
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="bg-[#f6f6f8] dark:bg-[#111621] font-[Inter] min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo and Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-[#2463eb] p-3 rounded-xl mb-4 shadow-lg shadow-[#2463eb]/20">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="28"
                            height="28"
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
                    <h1 className="text-slate-900 dark:text-slate-100 text-2xl font-bold tracking-tight text-center">
                        Event IT Resource Management System
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                        Secure access to your project infrastructure
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-8">
                        {/* Error Message */}
                        {error && (
                            <div className="mb-5 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <form action={handleSubmit} className="space-y-5">
                            {/* Full Name (signup only) */}
                            {mode === 'signup' && (
                                <div>
                                    <label
                                        className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                        htmlFor="fullName"
                                    >
                                        Full Name
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2463eb] transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                        <input
                                            className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] transition-all"
                                            id="fullName"
                                            name="fullName"
                                            placeholder="John Doe"
                                            type="text"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email Input */}
                            <div>
                                <label
                                    className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2"
                                    htmlFor="email"
                                >
                                    Email Address
                                </label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2463eb] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="20" height="16" x="2" y="4" rx="2" />
                                            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                                        </svg>
                                    </div>
                                    <input
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] transition-all"
                                        id="email"
                                        name="email"
                                        placeholder="name@company.com"
                                        type="email"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label
                                        className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
                                        htmlFor="password"
                                    >
                                        Password
                                    </label>
                                </div>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#2463eb] transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    </div>
                                    <input
                                        className="block w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] transition-all"
                                        id="password"
                                        name="password"
                                        placeholder="••••••••"
                                        type="password"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                className="w-full bg-[#2463eb] hover:bg-[#2463eb]/90 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#2463eb]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="group-hover:translate-x-1 transition-transform"
                                        >
                                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                            <polyline points="10 17 15 12 10 7" />
                                            <line x1="15" y1="12" x2="3" y2="12" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Divider */}
                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white dark:bg-slate-900 px-4 text-slate-500 font-medium tracking-wider">
                                    {mode === 'login' ? 'New here?' : 'Already have an account?'}
                                </span>
                            </div>
                        </div>

                        {/* Toggle Auth Mode */}
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'signup' : 'login');
                                setError(null);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-[#2463eb]/50 hover:bg-[#2463eb]/5 dark:hover:bg-[#2463eb]/10 transition-all group text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-[#2463eb]"
                        >
                            {mode === 'login' ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-[#2463eb]">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                        <circle cx="9" cy="7" r="4" />
                                        <line x1="19" y1="8" x2="19" y2="14" />
                                        <line x1="22" y1="11" x2="16" y2="11" />
                                    </svg>
                                    Create an Account
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-[#2463eb]">
                                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                        <polyline points="10 17 15 12 10 7" />
                                        <line x1="15" y1="12" x2="3" y2="12" />
                                    </svg>
                                    Sign In Instead
                                </>
                            )}
                        </button>
                    </div>

                    {/* Footer Info */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Protected by enterprise-grade encryption.
                            <a className="text-[#2463eb] hover:underline ml-1" href="#">
                                Privacy Policy
                            </a>
                        </p>
                    </div>
                </div>

                {/* System Status */}
                <div className="mt-8 flex items-center justify-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        System Operational
                    </div>
                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                    <div className="text-slate-500">v1.0.0-mvp</div>
                </div>
            </div>
        </div>
    );
}
