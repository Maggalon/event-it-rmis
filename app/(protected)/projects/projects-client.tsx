'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, ProjectStatus, UserRole } from '@/types/database';

interface ProjectsClientProps {
    projects: Project[];
    currentUserRole: UserRole;
    currentUserId: string;
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string; borderColor: string; barColor: string }> = {
    active: {
        label: 'Active',
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/20',
        barColor: 'bg-emerald-500',
    },
    planning: {
        label: 'Planning',
        color: 'text-amber-600',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/20',
        barColor: 'bg-amber-500',
    },
    draft: {
        label: 'Draft',
        color: 'text-slate-500',
        bgColor: 'bg-slate-400/10',
        borderColor: 'border-slate-400/20',
        barColor: 'bg-slate-300 dark:bg-slate-700',
    },
    completed: {
        label: 'Completed',
        color: 'text-blue-600',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        barColor: 'bg-blue-500',
    },
    cancelled: {
        label: 'Cancelled',
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20',
        barColor: 'bg-red-400',
    },
};

const ICON_COLORS = [
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
    'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
    'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
    'bg-rose-100 dark:bg-rose-900/30 text-rose-600',
    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
];

function getIconColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return ICON_COLORS[Math.abs(hash) % ICON_COLORS.length];
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
    if (!startDate && !endDate) return '—';
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = startDate ? new Date(startDate).toLocaleDateString('en-US', opts) : '';
    const end = endDate ? new Date(endDate).toLocaleDateString('en-US', opts) : '';
    if (start && end) return `${start} – ${end}`;
    return start || end;
}

export function ProjectsClient({ projects, currentUserRole, currentUserId }: ProjectsClientProps) {
    const router = useRouter();
    const supabase = createClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // New project form
    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        location: '',
        status: 'draft' as ProjectStatus,
        start_date: '',
        end_date: '',
    });

    // Filter projects by search
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const q = searchQuery.toLowerCase();
        return projects.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.location.toLowerCase().includes(q) ||
                p.status.toLowerCase().includes(q)
        );
    }, [projects, searchQuery]);

    // Metrics
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'active').length;
    const completedProjects = projects.filter((p) => p.status === 'completed').length;
    const avgCompletion = totalProjects > 0
        ? Math.round((completedProjects / totalProjects) * 100)
        : 0;

    async function handleCreateProject(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');

        if (!newProject.name.trim()) {
            setFormError('Project name is required.');
            return;
        }

        if (newProject.start_date && newProject.end_date && newProject.start_date > newProject.end_date) {
            setFormError('End date must be after start date.');
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('projects').insert({
                name: newProject.name.trim(),
                description: newProject.description.trim(),
                location: newProject.location.trim(),
                status: newProject.status,
                start_date: newProject.start_date || null,
                end_date: newProject.end_date || null,
                created_by: currentUserId,
            });

            if (error) {
                setFormError(error.message);
                return;
            }

            // Reset and close
            setNewProject({ name: '', description: '', location: '', status: 'draft', start_date: '', end_date: '' });
            setShowCreateModal(false);
            router.refresh();
        } catch {
            setFormError('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteProject(projectId: string) {
        if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) return;

        const { error } = await supabase.from('projects').delete().eq('id', projectId);
        if (error) {
            alert('Failed to delete project: ' + error.message);
            return;
        }
        router.refresh();
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Projects
                    </h1>
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
                    <div className="relative">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-[#2463eb]/20 focus:outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                        />
                    </div>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[#2463eb] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Create New Project
                </button>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Projects */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Projects</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{totalProjects}</h3>
                        {totalProjects > 0 && (
                            <span className="text-emerald-500 text-xs font-bold flex items-center gap-0.5 pb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                    <polyline points="17 6 23 6 23 12" />
                                </svg>
                                {totalProjects} total
                            </span>
                        )}
                    </div>
                </div>

                {/* Active Now */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Now</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-bold text-emerald-600">{activeProjects}</h3>
                        <div className="flex items-center gap-1 text-xs text-slate-400 pb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            In progress
                        </div>
                    </div>
                </div>

                {/* Avg Completion Rate */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Completion Rate</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-3xl font-bold text-slate-900 dark:text-white">{avgCompletion}%</h3>
                        <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 overflow-hidden">
                            <div
                                className="h-full bg-[#2463eb] rounded-full transition-all duration-500"
                                style={{ width: `${avgCompletion}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects Data Grid */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {/* Table Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2">
                        Project List
                    </span>
                    <span className="text-xs text-slate-400">
                        {filteredProjects.length} of {totalProjects} projects
                    </span>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                            {searchQuery ? 'No projects found' : 'No projects yet'}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            {searchQuery
                                ? 'Try adjusting your search query.'
                                : 'Create your first project to get started with resource management.'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="bg-[#2463eb] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                            >
                                Create First Project
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Name</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dates</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Description</th>
                                    {currentUserRole === 'admin' && (
                                        <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredProjects.map((project) => {
                                    const statusConf = STATUS_CONFIG[project.status];
                                    const iconColor = getIconColor(project.name);
                                    return (
                                        <tr
                                            key={project.id}
                                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/projects/${project.id}`)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded flex items-center justify-center ${iconColor}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                            <line x1="16" y1="2" x2="16" y2="6" />
                                                            <line x1="8" y1="2" x2="8" y2="6" />
                                                            <line x1="3" y1="10" x2="21" y2="10" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#2463eb] transition-colors">{project.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {formatDateRange(project.start_date, project.end_date)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {project.location ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                            <circle cx="12" cy="10" r="3" />
                                                        </svg>
                                                        {project.location}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${statusConf.bgColor} ${statusConf.color} border ${statusConf.borderColor} uppercase tracking-wide`}>
                                                    {statusConf.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm text-slate-500 truncate block max-w-[200px]" title={project.description}>
                                                    {project.description || '—'}
                                                </span>
                                            </td>
                                            {currentUserRole === 'admin' && (
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                                                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                                                        title="Delete project"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Table Footer */}
                {filteredProjects.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                            Showing {filteredProjects.length} of {totalProjects} projects
                        </p>
                    </div>
                )}
            </div>

            {/* Create Project Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => !isSubmitting && setShowCreateModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create New Project</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Set up a new event project</p>
                            </div>
                            <button
                                onClick={() => !isSubmitting && setShowCreateModal(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleCreateProject} className="p-6 space-y-5">
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                    {formError}
                                </div>
                            )}

                            {/* Project Name */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Project Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newProject.name}
                                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                    placeholder="e.g. TechCon 2026"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    value={newProject.description}
                                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                                    placeholder="Brief description of the event project..."
                                    rows={3}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400 resize-none"
                                />
                            </div>

                            {/* Location */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Location
                                </label>
                                <input
                                    type="text"
                                    value={newProject.location}
                                    onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                                    placeholder="e.g. Moscone Center, San Francisco"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={newProject.status}
                                    onChange={(e) => setNewProject({ ...newProject, status: e.target.value as ProjectStatus })}
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all cursor-pointer"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="planning">Planning</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newProject.start_date}
                                        onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newProject.end_date}
                                        onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => !isSubmitting && setShowCreateModal(false)}
                                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                            Creating...
                                        </span>
                                    ) : (
                                        'Create Project'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
