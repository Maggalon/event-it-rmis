'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type {
    Project,
    ProjectStatus,
    TaskGroup,
    ProjectTask,
    TaskPriority,
    TaskStatus,
    UserRole,
    Skill,
    EquipmentModel,
} from '@/types/database';

interface ProjectDetailsClientProps {
    project: Project;
    taskGroups: TaskGroup[];
    tasks: ProjectTask[];
    currentUserRole: UserRole;
    skills: Skill[];
    equipmentModels: EquipmentModel[];
}

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
    active: { label: 'Active', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', borderColor: 'border-emerald-200 dark:border-emerald-800' },
    planning: { label: 'Planning', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30', borderColor: 'border-amber-200 dark:border-amber-800' },
    draft: { label: 'Draft', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800', borderColor: 'border-slate-200 dark:border-slate-700' },
    completed: { label: 'Completed', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-800' },
    cancelled: { label: 'Cancelled', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', borderColor: 'border-red-200 dark:border-red-800' },
};

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
    low: { label: 'Low', color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800' },
    medium: { label: 'Medium', color: 'text-blue-700', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
    high: { label: 'High', color: 'text-amber-700', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
    critical: { label: 'Critical', color: 'text-red-700', bgColor: 'bg-red-50 dark:bg-red-900/30' },
};

const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
    pending: { label: 'Pending', color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-800' },
    in_progress: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-50 dark:bg-blue-900/30' },
    completed: { label: 'Completed', color: 'text-emerald-700', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
    cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-50 dark:bg-red-900/30' },
};

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
    if (!startDate && !endDate) return '—';
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
    const start = startDate ? new Date(startDate).toLocaleDateString('en-US', opts) : '';
    const end = endDate ? new Date(endDate).toLocaleDateString('en-US', opts) : '';
    if (start && end) return `${start} – ${end}`;
    return start || end;
}

export function ProjectDetailsClient({ project, taskGroups, tasks, currentUserRole, skills, equipmentModels }: ProjectDetailsClientProps) {
    const router = useRouter();
    const supabase = createClient();

    // Slide-out panel states
    const [showAddTask, setShowAddTask] = useState(false);
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState('');

    // Active tab
    const [activeTab, setActiveTab] = useState<'wbs' | 'summary'>('wbs');

    // Navigate to schedule page
    function goToSchedule() {
        router.push(`/projects/${project.id}/schedule`);
    }

    // New task form
    const [newTask, setNewTask] = useState({
        name: '',
        description: '',
        estimated_hours: '',
        priority: 'medium' as TaskPriority,
        group_id: '',
        skills_required: [] as string[],
        equipment_needed: [] as string[],
    });

    // New group form
    const [newGroupName, setNewGroupName] = useState('');

    // ── Computed values ──
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalEffortHours = tasks.reduce((sum, t) => sum + Number(t.estimated_hours || 0), 0);

    // Group tasks by group_id
    const groupedTasks = useMemo(() => {
        const map = new Map<string | null, ProjectTask[]>();
        // Initialize groups
        for (const g of taskGroups) {
            map.set(g.id, []);
        }
        map.set(null, []); // ungrouped
        for (const t of tasks) {
            const list = map.get(t.group_id) || map.get(null)!;
            list.push(t);
        }
        return map;
    }, [taskGroups, tasks]);

    // ── WBS numbering ──
    function getWbsNumber(groupIndex: number, taskIndex: number): string {
        return `${groupIndex + 1}.${taskIndex + 1}`;
    }

    // ── Handlers ──
    async function handleAddGroup(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');
        if (!newGroupName.trim()) {
            setFormError('Group name is required.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('task_groups').insert({
                project_id: project.id,
                name: newGroupName.trim(),
                sort_order: taskGroups.length,
            });
            if (error) { setFormError(error.message); return; }
            setNewGroupName('');
            setShowAddGroup(false);
            router.refresh();
        } catch {
            setFormError('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleAddTask(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');
        if (!newTask.name.trim()) {
            setFormError('Task name is required.');
            return;
        }
        setIsSubmitting(true);
        try {
            const groupTasks = groupedTasks.get(newTask.group_id || null) || [];
            const { error } = await supabase.from('project_tasks').insert({
                project_id: project.id,
                group_id: newTask.group_id || null,
                name: newTask.name.trim(),
                description: newTask.description.trim(),
                estimated_hours: parseFloat(newTask.estimated_hours) || 0,
                priority: newTask.priority,
                status: 'pending' as TaskStatus,
                skills_required: newTask.skills_required,
                equipment_needed: newTask.equipment_needed,
                sort_order: groupTasks.length,
            });
            if (error) { setFormError(error.message); return; }
            setNewTask({ name: '', description: '', estimated_hours: '', priority: 'medium', group_id: '', skills_required: [], equipment_needed: [] });
            setShowAddTask(false);
            router.refresh();
        } catch {
            setFormError('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleDeleteTask(taskId: string) {
        if (!confirm('Delete this task?')) return;
        const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
        if (error) { alert('Failed to delete: ' + error.message); return; }
        router.refresh();
    }

    async function handleDeleteGroup(groupId: string) {
        if (!confirm('Delete this group and all its tasks?')) return;
        // Delete tasks in group first
        await supabase.from('project_tasks').delete().eq('group_id', groupId);
        const { error } = await supabase.from('task_groups').delete().eq('id', groupId);
        if (error) { alert('Failed to delete: ' + error.message); return; }
        router.refresh();
    }

    async function handleToggleTaskStatus(task: ProjectTask) {
        const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : task.status;
        const { error } = await supabase.from('project_tasks').update({ status: nextStatus }).eq('id', task.id);
        if (error) { alert('Failed to update: ' + error.message); return; }
        router.refresh();
    }

    function toggleSkill(skillName: string) {
        const already = newTask.skills_required.includes(skillName);
        setNewTask({
            ...newTask,
            skills_required: already
                ? newTask.skills_required.filter((s) => s !== skillName)
                : [...newTask.skills_required, skillName],
        });
    }

    function toggleEquipment(modelName: string) {
        const already = newTask.equipment_needed.includes(modelName);
        setNewTask({
            ...newTask,
            equipment_needed: already
                ? newTask.equipment_needed.filter((e) => e !== modelName)
                : [...newTask.equipment_needed, modelName],
        });
    }

    const statusConf = STATUS_CONFIG[project.status];

    return (
        <div className="space-y-0">
            {/* ── Breadcrumb ── */}
            <div className="flex items-center gap-2 text-sm mb-6">
                <button
                    onClick={() => router.push('/projects')}
                    className="text-slate-400 hover:text-[#2463eb] transition-colors cursor-pointer"
                >
                    Projects
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-white">{project.name}</span>
            </div>

            {/* ── Project Header ── */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-1.5">
                            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                                {project.name}
                            </h2>
                            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider border ${statusConf.bgColor} ${statusConf.color} ${statusConf.borderColor}`}>
                                {statusConf.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-5 text-sm text-slate-500">
                            {project.start_date && (
                                <div className="flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <span>{formatDateRange(project.start_date, project.end_date)}</span>
                                </div>
                            )}
                            {project.location && (
                                <div className="flex items-center gap-1.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <span>{project.location}</span>
                                </div>
                            )}
                        </div>
                        {project.description && (
                            <p className="text-sm text-slate-400 mt-2 max-w-2xl">{project.description}</p>
                        )}
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <button
                            onClick={() => router.push(`/projects/${project.id}/pick-list`)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer text-nowrap"
                            title="Generate Equipment Pick List PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                                <line x1="16" y1="17" x2="8" y2="17" />
                                <polyline points="10 9 9 9 8 9" />
                            </svg>
                            Pick List
                        </button>
                        <button
                            onClick={goToSchedule}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer text-nowrap"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                            Schedule
                        </button>
                        <button
                            onClick={() => setShowAddGroup(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            Add Group
                        </button>
                        <button
                            onClick={() => setShowAddTask(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#2463eb] hover:bg-[#2463eb]/90 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm shadow-[#2463eb]/20 cursor-pointer"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Add Task
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-8 border-b border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setActiveTab('wbs')}
                        className={`pb-3 border-b-2 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'wbs' ? 'border-[#2463eb] text-[#2463eb]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        WBS Builder
                    </button>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`pb-3 border-b-2 text-sm font-bold transition-colors cursor-pointer ${activeTab === 'summary' ? 'border-[#2463eb] text-[#2463eb]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Summary
                    </button>
                </div>
            </div>

            {/* ── Summary Tab ── */}
            {activeTab === 'summary' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Progress Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest mb-6">Progress Overview</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-end mb-2">
                                <p className="text-xs text-slate-500 uppercase font-bold">Overall Progress</p>
                                <p className="text-lg font-black text-[#2463eb]">{progressPercent}%</p>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                                <div className="bg-[#2463eb] h-full rounded-full transition-all duration-700" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalTasks}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-blue-600">{inProgressTasks}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">In Progress</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-emerald-600">{completedTasks}</p>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold">Completed</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Project Info Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest mb-6">Project Details</h3>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4">
                                <div className="bg-[#2463eb]/10 p-2 rounded-lg text-[#2463eb]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Event Dates</p>
                                    <p className="text-sm font-medium">{formatDateRange(project.start_date, project.end_date)}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-[#2463eb]/10 p-2 rounded-lg text-[#2463eb]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Venue</p>
                                    <p className="text-sm font-medium">{project.location || '—'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-[#2463eb]/10 p-2 rounded-lg text-[#2463eb]">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-bold">Total Effort</p>
                                    <p className="text-sm font-medium">{totalEffortHours}h estimated</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Task Breakdown Card */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 uppercase text-xs tracking-widest mb-6">Task Breakdown</h3>
                        {taskGroups.length === 0 ? (
                            <p className="text-sm text-slate-400">No task groups yet. Add groups and tasks to see the breakdown.</p>
                        ) : (
                            <div className="space-y-4">
                                {taskGroups.map((group) => {
                                    const gTasks = groupedTasks.get(group.id) || [];
                                    const gCompleted = gTasks.filter((t) => t.status === 'completed').length;
                                    const gPercent = gTasks.length > 0 ? Math.round((gCompleted / gTasks.length) * 100) : 0;
                                    return (
                                        <div key={group.id}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-semibold truncate">{group.name}</span>
                                                <span className="text-xs font-bold text-slate-500">{gCompleted}/{gTasks.length}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${gPercent === 100 ? 'bg-emerald-500' : 'bg-[#2463eb]'}`}
                                                    style={{ width: `${gPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── WBS Tab ── */}
            {activeTab === 'wbs' && (
                <>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        {taskGroups.length === 0 && tasks.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                                        <rect x="9" y="3" width="6" height="4" rx="2" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">No tasks yet</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    Start building your Work Breakdown Structure by adding groups and tasks.
                                </p>
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => setShowAddGroup(true)}
                                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    >
                                        Add Group
                                    </button>
                                    <button
                                        onClick={() => setShowAddTask(true)}
                                        className="px-4 py-2 bg-[#2463eb] text-white rounded-lg text-sm font-semibold hover:bg-[#2463eb]/90 transition-colors cursor-pointer"
                                    >
                                        Add First Task
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-12">#</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Task Name</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-20 text-center">Hours</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-24 text-center">Status</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Skills Required</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Equipment &amp; Materials</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {taskGroups.map((group, gIndex) => {
                                        const gTasks = groupedTasks.get(group.id) || [];
                                        return (
                                            <GroupRows
                                                key={group.id}
                                                group={group}
                                                groupIndex={gIndex}
                                                tasks={gTasks}
                                                onDeleteTask={handleDeleteTask}
                                                onDeleteGroup={handleDeleteGroup}
                                                onToggleStatus={handleToggleTaskStatus}
                                                getWbsNumber={getWbsNumber}
                                            />
                                        );
                                    })}
                                    {/* Ungrouped tasks */}
                                    {(groupedTasks.get(null) || []).length > 0 && (
                                        <>
                                            <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                                                <td className="px-6 py-3 font-bold text-slate-400">—</td>
                                                <td className="px-6 py-3 font-bold text-slate-500 dark:text-slate-400 italic" colSpan={6}>Ungrouped Tasks</td>
                                            </tr>
                                            {(groupedTasks.get(null) || []).map((task, tIndex) => (
                                                <TaskRow
                                                    key={task.id}
                                                    task={task}
                                                    wbsNumber={`0.${tIndex + 1}`}
                                                    onDelete={handleDeleteTask}
                                                    onToggleStatus={handleToggleTaskStatus}
                                                />
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        )}

                        {(taskGroups.length > 0 || tasks.length > 0) && (
                            <button
                                onClick={() => setShowAddTask(true)}
                                className="w-full py-4 text-sm font-medium text-[#2463eb] hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-2 border-t border-slate-100 dark:border-slate-800 transition-colors cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                                Add New Row
                            </button>
                        )}
                    </div>

                    {/* ── Sticky Bottom Bar ── */}
                    {totalTasks > 0 && (
                        <div className="mt-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex justify-between items-center">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Effort</span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{totalEffortHours}h</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tasks</span>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{totalTasks}</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                <div>
                                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">Completed</span>
                                    <span className="text-lg font-black text-emerald-600">{completedTasks}</span>
                                </div>
                                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                                <div className="flex items-center gap-3">
                                    <div className="w-32 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                        <div className="bg-[#2463eb] h-full rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-[#2463eb]">{progressPercent}%</span>
                                </div>
                            </div>
                            <button
                                onClick={goToSchedule}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#2463eb] text-white text-sm font-bold rounded-lg hover:bg-[#2463eb]/90 transition-all shadow-sm shadow-[#2463eb]/20 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                                Generate Schedule
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ══════ Add Group Modal ══════ */}
            {showAddGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSubmitting && setShowAddGroup(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add Task Group</h3>
                            <button onClick={() => !isSubmitting && setShowAddGroup(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleAddGroup} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">{formError}</div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Group Name</label>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="e.g. Network Infrastructure Setup"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400 text-slate-900 dark:text-white"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => !isSubmitting && setShowAddGroup(false)} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Group'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════ Add Task Slide-Out ══════ */}
            {showAddTask && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setShowAddTask(false)} />
                    <div className="relative w-full max-w-[500px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">ADD NEW TASK</h3>
                            <button onClick={() => !isSubmitting && setShowAddTask(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Body */}
                        <form onSubmit={handleAddTask} className="flex-1 overflow-y-auto">
                            <div className="p-8 space-y-6">
                                {formError && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">{formError}</div>
                                )}

                                {/* Task Name */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Task Name</label>
                                    <input
                                        type="text"
                                        value={newTask.name}
                                        onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                                        placeholder="e.g. Server Rack Installation"
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm focus:ring-[#2463eb] focus:border-[#2463eb] focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                                        autoFocus
                                        required
                                    />
                                </div>

                                {/* Group & Duration */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Task Group</label>
                                        <select
                                            value={newTask.group_id}
                                            onChange={(e) => setNewTask({ ...newTask, group_id: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white cursor-pointer"
                                        >
                                            <option value="">No Group</option>
                                            {taskGroups.map((g) => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Estimated Time (Hours)</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0"
                                            value={newTask.estimated_hours}
                                            onChange={(e) => setNewTask({ ...newTask, estimated_hours: e.target.value })}
                                            placeholder="8"
                                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                {/* Priority */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Priority</label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as TaskPriority })}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm text-slate-900 dark:text-white cursor-pointer"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>

                                {/* Skills Selector */}
                                <SkillSelector
                                    skills={skills}
                                    selected={newTask.skills_required}
                                    onToggle={toggleSkill}
                                />

                                {/* Equipment Selector */}
                                <EquipmentSelector
                                    models={equipmentModels}
                                    selected={newTask.equipment_needed}
                                    onToggle={toggleEquipment}
                                />

                                {/* Description */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Description</label>
                                    <textarea
                                        value={newTask.description}
                                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                                        placeholder="Detail the specific requirements for this task..."
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm h-24 resize-none focus:ring-[#2463eb] focus:border-[#2463eb] focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-6 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => !isSubmitting && setShowAddTask(false)}
                                    className="py-3 px-4 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-sm hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-700 dark:text-slate-300"
                                    disabled={isSubmitting}
                                >
                                    CANCEL
                                </button>
                                <button
                                    type="submit"
                                    className="py-3 px-4 bg-[#2463eb] text-white rounded-lg font-bold text-sm shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'SAVING...' : 'SAVE TASK'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════ */
/*  Sub-components                                       */
/* ══════════════════════════════════════════════════════ */

function GroupRows({
    group,
    groupIndex,
    tasks,
    onDeleteTask,
    onDeleteGroup,
    onToggleStatus,
    getWbsNumber,
}: {
    group: TaskGroup;
    groupIndex: number;
    tasks: ProjectTask[];
    onDeleteTask: (id: string) => void;
    onDeleteGroup: (id: string) => void;
    onToggleStatus: (task: ProjectTask) => void;
    getWbsNumber: (gi: number, ti: number) => string;
}) {
    return (
        <>
            {/* Group Header Row */}
            <tr className="bg-slate-50/50 dark:bg-slate-800/20 group/row">
                <td className="px-6 py-3 font-bold text-[#2463eb]">{groupIndex + 1}.0</td>
                <td className="px-6 py-3 font-bold text-slate-900 dark:text-white" colSpan={5}>
                    {group.name}
                </td>
                <td className="px-6 py-3 text-right">
                    <button
                        onClick={() => onDeleteGroup(group.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover/row:opacity-100 cursor-pointer"
                        title="Delete group"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </td>
            </tr>
            {/* Task Rows */}
            {tasks.map((task, tIndex) => (
                <TaskRow
                    key={task.id}
                    task={task}
                    wbsNumber={getWbsNumber(groupIndex, tIndex)}
                    onDelete={onDeleteTask}
                    onToggleStatus={onToggleStatus}
                />
            ))}
        </>
    );
}

function TaskRow({
    task,
    wbsNumber,
    onDelete,
    onToggleStatus,
}: {
    task: ProjectTask;
    wbsNumber: string;
    onDelete: (id: string) => void;
    onToggleStatus: (task: ProjectTask) => void;
}) {
    const statusConf = TASK_STATUS_CONFIG[task.status];
    return (
        <tr className="group/task hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <td className="px-6 py-4 text-xs text-slate-400">{wbsNumber}</td>
            <td className="px-6 py-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{task.name}</div>
                {task.description && (
                    <div className="text-[10px] text-slate-400 mt-1 truncate max-w-xs">{task.description}</div>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                {Number(task.estimated_hours) > 0 && (
                    <span className="inline-flex items-center px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                        {task.estimated_hours}h
                    </span>
                )}
            </td>
            <td className="px-6 py-4 text-center">
                <button
                    onClick={() => onToggleStatus(task)}
                    className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide cursor-pointer transition-colors ${statusConf.bgColor} ${statusConf.color}`}
                    title="Click to cycle status"
                >
                    {statusConf.label}
                </button>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                    {task.skills_required.map((skill) => (
                        <span key={skill} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-medium border border-slate-200 dark:border-slate-700">
                            {skill}
                        </span>
                    ))}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                    {task.equipment_needed.map((eq) => (
                        <span key={eq} className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                            </svg>
                            {eq}
                        </span>
                    ))}
                </div>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover/task:opacity-100 transition-opacity">
                    <button
                        onClick={() => onDelete(task.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Delete task"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    );
}

/* ══════════════════════════════════════════════════════ */
/*  SkillSelector – searchable grouped checkbox picker    */
/* ══════════════════════════════════════════════════════ */
function SkillSelector({
    skills,
    selected,
    onToggle,
}: {
    skills: Skill[];
    selected: string[];
    onToggle: (name: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const grouped = useMemo(() => {
        const filtered = skills.filter((s) =>
            s.name.toLowerCase().includes(search.toLowerCase()),
        );
        const map = new Map<string, Skill[]>();
        for (const s of filtered) {
            if (!map.has(s.category)) map.set(s.category, []);
            map.get(s.category)!.push(s);
        }
        return map;
    }, [skills, search]);

    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Skill Requirements</label>
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selected.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#2463eb] text-white text-[11px] font-bold rounded-full">
                            {s}
                            <button type="button" onClick={() => onToggle(s)} className="hover:opacity-70 ml-0.5 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 hover:border-[#2463eb]/50 transition-colors cursor-pointer"
            >
                <span>{selected.length === 0 ? 'Select skills...' : `${selected.length} skill${selected.length !== 1 ? 's' : ''} selected`}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {open && (
                <div className="mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search skills..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/30"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {grouped.size === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No skills found</p>
                        ) : (
                            Array.from(grouped.entries()).map(([cat, items]) => (
                                <div key={cat}>
                                    <p className="px-3 pt-2.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">{cat}</p>
                                    {items.map((skill) => {
                                        const checked = selected.includes(skill.name);
                                        return (
                                            <label key={skill.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => onToggle(skill.name)}
                                                    className="rounded border-slate-300 text-[#2463eb] focus:ring-[#2463eb]/30 cursor-pointer"
                                                />
                                                <span className="text-sm text-slate-800 dark:text-slate-200">{skill.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full py-1.5 text-xs font-bold text-[#2463eb] hover:bg-[#2463eb]/5 rounded transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════ */
/*  EquipmentSelector – same pattern for equipment models */
/* ══════════════════════════════════════════════════════ */
function EquipmentSelector({
    models,
    selected,
    onToggle,
}: {
    models: EquipmentModel[];
    selected: string[];
    onToggle: (name: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);

    const CATEGORY_LABELS: Record<string, string> = {
        networking: 'Networking',
        server: 'Servers',
        wireless: 'Wireless / Wi-Fi',
        security: 'Security',
        cabling: 'Cabling',
        power: 'Power / UPS',
        audio_video: 'Audio / Video',
        other: 'Other',
    };

    const grouped = useMemo(() => {
        const filtered = models.filter(
            (m) =>
                m.name.toLowerCase().includes(search.toLowerCase()) ||
                m.manufacturer.toLowerCase().includes(search.toLowerCase()),
        );
        const map = new Map<string, EquipmentModel[]>();
        for (const m of filtered) {
            if (!map.has(m.category)) map.set(m.category, []);
            map.get(m.category)!.push(m);
        }
        return map;
    }, [models, search]);

    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Equipment Required</label>
            {selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {selected.map((e) => (
                        <span key={e} className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-full">
                            {e}
                            <button type="button" onClick={() => onToggle(e)} className="hover:opacity-70 ml-0.5 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-500 hover:border-[#2463eb]/50 transition-colors cursor-pointer"
            >
                <span>{selected.length === 0 ? 'Select equipment models...' : `${selected.length} model${selected.length !== 1 ? 's' : ''} selected`}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>
            {open && (
                <div className="mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search model or manufacturer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2463eb]/30"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {grouped.size === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No equipment found</p>
                        ) : (
                            Array.from(grouped.entries()).map(([cat, items]) => (
                                <div key={cat}>
                                    <p className="px-3 pt-2.5 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                        {CATEGORY_LABELS[cat] ?? cat}
                                    </p>
                                    {items.map((model) => {
                                        const checked = selected.includes(model.name);
                                        return (
                                            <label key={model.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => onToggle(model.name)}
                                                    className="rounded border-slate-300 text-[#2463eb] focus:ring-[#2463eb]/30 cursor-pointer"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{model.name}</p>
                                                    <p className="text-[10px] text-slate-400">{model.manufacturer}</p>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="w-full py-1.5 text-xs font-bold text-[#2463eb] hover:bg-[#2463eb]/5 rounded transition-colors cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
