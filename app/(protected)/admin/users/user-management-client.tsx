'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, UserRole, Skill, ProfileSkill } from '@/types/database';
import {
    updateUserRole,
    toggleUserActive,
    createUser,
    addSkill,
    updateProfileSkills,
} from './actions';

/* ─── Constants ─── */

const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    project_manager: 'Project Manager',
    field_worker: 'Field Worker',
};

const roleBadgeColors: Record<UserRole, string> = {
    admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    project_manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    field_worker: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const SKILL_CATEGORY_LABELS: Record<string, string> = {
    certification: 'Certifications',
    technical: 'Technical Skills',
    general: 'General',
};

const SKILL_CATEGORY_ORDER = ['certification', 'technical', 'general'];

/* ─── Password Generator ─── */

function generatePassword(length = 14): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;

    // Guarantee one of each category
    let pw = '';
    pw += upper[Math.floor(Math.random() * upper.length)];
    pw += lower[Math.floor(Math.random() * lower.length)];
    pw += digits[Math.floor(Math.random() * digits.length)];
    pw += special[Math.floor(Math.random() * special.length)];

    for (let i = pw.length; i < length; i++) {
        pw += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle
    return pw
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');
}

/* ─── SVG Icons ─── */

function SpinnerIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
    return (
        <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function RefreshIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
    );
}

/* ─── Main Component ─── */

export function UserManagementClient({
    profiles,
    skills,
    profileSkills,
    currentUserRole,
}: {
    profiles: Profile[];
    skills: Skill[];
    profileSkills: ProfileSkill[];
    currentUserRole: UserRole;
}) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Create User modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
    const [newUser, setNewUser] = useState({
        email: '',
        full_name: '',
        role: 'field_worker' as UserRole,
        password: generatePassword(),
        selectedSkills: [] as string[],
    });

    // Add Skill modal
    const [showAddSkillModal, setShowAddSkillModal] = useState(false);
    const [newSkillName, setNewSkillName] = useState('');
    const [newSkillCategory, setNewSkillCategory] = useState('technical');
    const [isAddingSkill, setIsAddingSkill] = useState(false);

    // Edit Skills modal
    const [showEditSkillsModal, setShowEditSkillsModal] = useState(false);
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingSkills, setEditingSkills] = useState<string[]>([]);
    const [isSavingSkills, setIsSavingSkills] = useState(false);

    // Copied password indicator
    const [copied, setCopied] = useState(false);

    /* ─── Helpers ─── */

    // Build a map of profileId -> skill[]
    const profileSkillMap = useMemo(() => {
        const map: Record<string, Skill[]> = {};
        for (const ps of profileSkills) {
            if (ps.skill) {
                if (!map[ps.profile_id]) map[ps.profile_id] = [];
                map[ps.profile_id].push(ps.skill);
            }
        }
        return map;
    }, [profileSkills]);

    // Group skills by category
    const groupedSkills = useMemo(() => {
        const groups: Record<string, Skill[]> = {};
        for (const s of skills) {
            const cat = s.category || 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        }
        return groups;
    }, [skills]);

    const filteredProfiles = profiles.filter((p) => {
        const matchesSearch =
            p.full_name.toLowerCase().includes(search.toLowerCase()) ||
            p.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || p.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    /* ─── Handlers ─── */

    async function handleRoleChange(userId: string, newRole: UserRole) {
        setActionLoading(userId);
        setError(null);
        setSuccess(null);
        const result = await updateUserRole(userId, newRole);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess('Role updated successfully');
            setTimeout(() => setSuccess(null), 3000);
        }
        setActionLoading(null);
    }

    async function handleToggleActive(userId: string, isActive: boolean) {
        setActionLoading(userId);
        setError(null);
        setSuccess(null);
        const result = await toggleUserActive(userId, isActive);
        if (result.error) {
            setError(result.error);
        } else {
            setSuccess(`User ${isActive ? 'activated' : 'deactivated'} successfully`);
            setTimeout(() => setSuccess(null), 3000);
        }
        setActionLoading(null);
    }

    function openCreateModal() {
        setNewUser({
            email: '',
            full_name: '',
            role: 'field_worker',
            password: generatePassword(),
            selectedSkills: [],
        });
        setCreateError('');
        setCreatedCredentials(null);
        setShowCreateModal(true);
    }

    async function handleCreateUser(e: React.FormEvent) {
        e.preventDefault();
        setCreateError('');

        if (!newUser.email.trim()) {
            setCreateError('Email is required.');
            return;
        }
        if (!newUser.password || newUser.password.length < 6) {
            setCreateError('Password must be at least 6 characters.');
            return;
        }

        setIsCreating(true);
        try {
            const result = await createUser({
                email: newUser.email.trim(),
                password: newUser.password,
                full_name: newUser.full_name.trim(),
                role: newUser.role,
                skill_ids: newUser.role === 'field_worker' ? newUser.selectedSkills : [],
            });

            if (result.error) {
                setCreateError(result.error);
                return;
            }

            // Show the credentials so admin can copy them
            setCreatedCredentials({
                email: newUser.email.trim(),
                password: newUser.password,
            });

            // Refresh the page data
            router.refresh();
        } catch {
            setCreateError('An unexpected error occurred.');
        } finally {
            setIsCreating(false);
        }
    }

    async function handleCopyPassword() {
        if (createdCredentials) {
            await navigator.clipboard.writeText(
                `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`
            );
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }

    function toggleSkill(skillId: string) {
        setNewUser((prev) => ({
            ...prev,
            selectedSkills: prev.selectedSkills.includes(skillId)
                ? prev.selectedSkills.filter((id) => id !== skillId)
                : [...prev.selectedSkills, skillId],
        }));
    }

    async function handleAddSkill(e: React.FormEvent) {
        e.preventDefault();
        if (!newSkillName.trim()) return;
        setIsAddingSkill(true);
        const result = await addSkill(newSkillName, newSkillCategory);
        if (result.error) {
            alert(result.error);
        } else {
            setNewSkillName('');
            setShowAddSkillModal(false);
            router.refresh();
        }
        setIsAddingSkill(false);
    }

    function openEditSkills(profileId: string) {
        const currentSkillIds = (profileSkillMap[profileId] || []).map((s) => s.id);
        setEditingUserId(profileId);
        setEditingSkills(currentSkillIds);
        setShowEditSkillsModal(true);
    }

    function toggleEditSkill(skillId: string) {
        setEditingSkills((prev) =>
            prev.includes(skillId) ? prev.filter((id) => id !== skillId) : [...prev, skillId]
        );
    }

    async function handleSaveEditSkills() {
        if (!editingUserId) return;
        setIsSavingSkills(true);
        const result = await updateProfileSkills(editingUserId, editingSkills);
        if (result.error) {
            alert(result.error);
        } else {
            setShowEditSkillsModal(false);
            setSuccess('Skills updated successfully');
            setTimeout(() => setSuccess(null), 3000);
            router.refresh();
        }
        setIsSavingSkills(false);
    }

    /* ─── Skill Picker (reusable sub-component) ─── */

    function SkillPicker({
        selected,
        onToggle,
    }: {
        selected: string[];
        onToggle: (skillId: string) => void;
    }) {
        return (
            <div className="space-y-4 max-h-52 overflow-y-auto pr-1">
                {SKILL_CATEGORY_ORDER.filter((cat) => groupedSkills[cat]?.length).map((cat) => (
                    <div key={cat}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {SKILL_CATEGORY_LABELS[cat] || cat}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {groupedSkills[cat].map((skill) => {
                                const isSelected = selected.includes(skill.id);
                                return (
                                    <button
                                        key={skill.id}
                                        type="button"
                                        onClick={() => onToggle(skill.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border ${isSelected
                                                ? 'bg-[#2463eb] text-white border-[#2463eb]'
                                                : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#2463eb]/50'
                                            }`}
                                    >
                                        {isSelected && (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        )}
                                        {skill.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {skills.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">No skills defined yet.</p>
                )}
            </div>
        );
    }

    /* ─── RENDER ─── */

    return (
        <div className="space-y-4">
            {/* Messages */}
            {error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                </div>
            )}
            {success && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {success}
                </div>
            )}

            {/* Filters + Create Button */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] transition-all text-sm"
                        />
                    </div>
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                        className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] transition-all text-sm cursor-pointer"
                    >
                        <option value="all">All Roles</option>
                        <option value="admin">Admin</option>
                        <option value="project_manager">Project Manager</option>
                        <option value="field_worker">Field Worker</option>
                    </select>
                    {currentUserRole === 'admin' && (
                        <button
                            onClick={openCreateModal}
                            className="bg-[#2463eb] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                            Create User
                        </button>
                    )}
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Skills</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Joined</th>
                                {currentUserRole === 'admin' && (
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredProfiles.map((profile) => {
                                const userSkills = profileSkillMap[profile.id] || [];
                                return (
                                    <tr
                                        key={profile.id}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!profile.is_active ? 'opacity-50' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-[#2463eb]/10 flex items-center justify-center flex-shrink-0">
                                                    <span className="text-[#2463eb] font-semibold text-sm">
                                                        {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                        {profile.full_name || '–'}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">{profile.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {currentUserRole === 'admin' ? (
                                                <select
                                                    value={profile.role}
                                                    onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                                                    disabled={actionLoading === profile.id}
                                                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#2463eb]/20 ${roleBadgeColors[profile.role]} disabled:cursor-not-allowed`}
                                                >
                                                    <option value="admin">Administrator</option>
                                                    <option value="project_manager">Project Manager</option>
                                                    <option value="field_worker">Field Worker</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleBadgeColors[profile.role]}`}>
                                                    {roleLabels[profile.role]}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {userSkills.length > 0 ? (
                                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                    {userSkills.slice(0, 3).map((skill) => (
                                                        <span key={skill.id} className="px-1.5 py-0.5 bg-[#2463eb]/10 text-[#2463eb] text-[9px] font-bold uppercase rounded">
                                                            {skill.name}
                                                        </span>
                                                    ))}
                                                    {userSkills.length > 3 && (
                                                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold rounded">
                                                            +{userSkills.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">—</span>
                                            )}
                                            {currentUserRole === 'admin' && profile.role === 'field_worker' && (
                                                <button
                                                    onClick={() => openEditSkills(profile.id)}
                                                    className="text-[10px] text-[#2463eb] hover:underline mt-1 block cursor-pointer"
                                                >
                                                    {userSkills.length > 0 ? 'Edit skills' : 'Assign skills'}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${profile.is_active
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    }`}
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${profile.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                {profile.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {new Date(profile.created_at).toLocaleDateString('en-GB', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </span>
                                        </td>
                                        {currentUserRole === 'admin' && (
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleToggleActive(profile.id, !profile.is_active)}
                                                    disabled={actionLoading === profile.id}
                                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${profile.is_active
                                                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                        : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                        }`}
                                                >
                                                    {actionLoading === profile.id ? (
                                                        <SpinnerIcon />
                                                    ) : profile.is_active ? (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                                                            </svg>
                                                            Deactivate
                                                        </>
                                                    ) : (
                                                        <>
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                            Activate
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredProfiles.length === 0 && (
                                <tr>
                                    <td colSpan={currentUserRole === 'admin' ? 6 : 5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 dark:text-slate-600">
                                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" />
                                            </svg>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm">No users found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-6 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Showing {filteredProfiles.length} of {profiles.length} users
                    </p>
                </div>
            </div>

            {/* ─────── CREATE USER MODAL ─────── */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isCreating && !createdCredentials && setShowCreateModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    {createdCredentials ? 'User Created Successfully' : 'Create New User'}
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {createdCredentials ? 'Save the credentials below' : 'Set up a new user account with corporate email'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setShowCreateModal(false); setCreatedCredentials(null); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Success: show credentials */}
                        {createdCredentials ? (
                            <div className="p-6 space-y-5">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                                            <CheckIcon />
                                        </div>
                                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Account created!</p>
                                    </div>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">
                                        Share these credentials with the new user. The password will not be shown again.
                                    </p>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-700">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Email</p>
                                        <p className="text-sm font-mono text-slate-900 dark:text-white">{createdCredentials.email}</p>
                                    </div>
                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Password</p>
                                        <p className="text-sm font-mono text-slate-900 dark:text-white">{createdCredentials.password}</p>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        onClick={handleCopyPassword}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
                                    >
                                        {copied ? <><CheckIcon /> Copied!</> : <><CopyIcon /> Copy Credentials</>}
                                    </button>
                                    <button
                                        onClick={() => { setShowCreateModal(false); setCreatedCredentials(null); }}
                                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Form */
                            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                                {createError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                        {createError}
                                    </div>
                                )}

                                {/* Full Name */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        placeholder="e.g. John Smith"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                {/* Corporate Email */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Corporate Email <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        placeholder="e.g. j.smith@company.com"
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400"
                                        required
                                        autoFocus
                                    />
                                </div>

                                {/* Generated Password */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Password <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                            className="flex-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setNewUser({ ...newUser, password: generatePassword() })}
                                            className="flex items-center gap-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                            title="Regenerate password"
                                        >
                                            <RefreshIcon />
                                        </button>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">Auto-generated. You can edit or regenerate it.</p>
                                </div>

                                {/* Role */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Role <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(['field_worker', 'project_manager', 'admin'] as UserRole[]).map((role) => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setNewUser({ ...newUser, role, selectedSkills: role !== 'field_worker' ? [] : newUser.selectedSkills })}
                                                className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition-all cursor-pointer ${newUser.role === role
                                                        ? 'bg-[#2463eb] text-white border-[#2463eb] shadow-sm'
                                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#2463eb]/50'
                                                    }`}
                                            >
                                                {roleLabels[role]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Skills (only for field_worker) */}
                                {newUser.role === 'field_worker' && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                Assign Skills
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddSkillModal(true)}
                                                className="text-xs text-[#2463eb] hover:underline font-semibold cursor-pointer"
                                            >
                                                + New Skill
                                            </button>
                                        </div>
                                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                                            <SkillPicker
                                                selected={newUser.selectedSkills}
                                                onToggle={toggleSkill}
                                            />
                                        </div>
                                        {newUser.selectedSkills.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-1.5">
                                                {newUser.selectedSkills.length} skill{newUser.selectedSkills.length > 1 ? 's' : ''} selected
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Footer */}
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => !isCreating && setShowCreateModal(false)}
                                        className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                        disabled={isCreating}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        disabled={isCreating}
                                    >
                                        {isCreating ? (
                                            <span className="flex items-center gap-2"><SpinnerIcon className="h-4 w-4" /> Creating...</span>
                                        ) : (
                                            'Create User'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ─────── ADD SKILL MODAL ─────── */}
            {showAddSkillModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => !isAddingSkill && setShowAddSkillModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm">
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Add New Skill</h3>
                        </div>
                        <form onSubmit={handleAddSkill} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Skill Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newSkillName}
                                    onChange={(e) => setNewSkillName(e.target.value)}
                                    placeholder="e.g. CCNA, Fiber Splicing"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                                <select
                                    value={newSkillCategory}
                                    onChange={(e) => setNewSkillCategory(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all cursor-pointer"
                                >
                                    <option value="certification">Certification</option>
                                    <option value="technical">Technical</option>
                                    <option value="general">General</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddSkillModal(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" disabled={isAddingSkill}>
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer" disabled={isAddingSkill}>
                                    {isAddingSkill ? <span className="flex items-center gap-2"><SpinnerIcon /> Adding...</span> : 'Add Skill'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─────── EDIT SKILLS MODAL ─────── */}
            {showEditSkillsModal && editingUserId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSavingSkills && setShowEditSkillsModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Skills</h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    {profiles.find((p) => p.id === editingUserId)?.full_name || profiles.find((p) => p.id === editingUserId)?.email}
                                </p>
                            </div>
                            <button
                                onClick={() => !isSavingSkills && setShowEditSkillsModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/30">
                                <SkillPicker selected={editingSkills} onToggle={toggleEditSkill} />
                            </div>
                            <p className="text-xs text-slate-500">
                                {editingSkills.length} skill{editingSkills.length !== 1 ? 's' : ''} selected
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => !isSavingSkills && setShowEditSkillsModal(false)}
                                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    disabled={isSavingSkills}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveEditSkills}
                                    className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                                    disabled={isSavingSkills}
                                >
                                    {isSavingSkills ? <span className="flex items-center gap-2"><SpinnerIcon className="h-4 w-4" /> Saving...</span> : 'Save Skills'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
