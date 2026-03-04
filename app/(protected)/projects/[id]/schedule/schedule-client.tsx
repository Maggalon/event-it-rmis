'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, TaskGroup, ProjectTask, TeamMember, Equipment, Profile } from '@/types/database';
import type { ProjectSchedule, ScheduleEntry } from './page';

/* ─────────────────────────────────────────────────────────────
   Types for the in-memory allocation result (before DB write)
──────────────────────────────────────────────────────────────── */
interface AllocatedWorker {
    id: string;
    name: string;
    job_title: string;
}

interface AllocatedEquipment {
    id: string;
    asset_tag: string;
    model_name: string;
}

interface AllocationResult {
    task: ProjectTask;
    assigned_workers: AllocatedWorker[];
    assigned_equipment: AllocatedEquipment[];
    missing_skills: string[];
    missing_equipment: string[];
    has_gap: boolean;
}

/* ─────────────────────────────────────────────────────────────
   Props
──────────────────────────────────────────────────────────────── */
interface ScheduleClientProps {
    project: Project;
    taskGroups: TaskGroup[];
    tasks: ProjectTask[];
    teamMembers: TeamMember[];
    profiles: Profile[];
    equipment: Equipment[];
    currentUserId: string;
    latestSchedule: ProjectSchedule | null;
    scheduleEntries: ScheduleEntry[];
}

/* ─────────────────────────────────────────────────────────────
   Helpers
──────────────────────────────────────────────────────────────── */
function initials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

function normalise(s: string): string {
    return s.toLowerCase().replace(/[-_ ]/g, '');
}

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const AVATAR_COLORS = [
    'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
];

function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ─────────────────────────────────────────────────────────────
   Core: Auto-Allocation Engine
   Matches task skill/equipment requirements against available
   resources. Uses simple greedy matching (skill substring /
   normalised equality). Detects gaps when no match is found.
──────────────────────────────────────────────────────────────── */
function runAllocation(
    tasks: ProjectTask[],
    teamMembers: TeamMember[],
    profiles: Profile[],
    equipment: Equipment[],
): AllocationResult[] {
    // Track which workers / equipment have already been assigned
    // (a resource can only serve one task at a time in this simple model)
    const usedWorkerIds = new Set<string>();
    const usedEquipmentIds = new Set<string>();

    return tasks.map((task) => {
        const assigned_workers: AllocatedWorker[] = [];
        const assigned_equipment: AllocatedEquipment[] = [];
        const missing_skills: string[] = [];
        const missing_equipment: string[] = [];

        /* ── Match skills ── */
        for (const requiredSkill of task.skills_required ?? []) {
            const norm = normalise(requiredSkill);
            let matched = false;

            // 1. Try TeamMembers (external workforce catalog)
            for (const tm of teamMembers) {
                if (usedWorkerIds.has(tm.id)) continue;
                const hasSkill = (tm.skills ?? []).some(
                    (s) => normalise(s).includes(norm) || norm.includes(normalise(s)),
                );
                if (hasSkill) {
                    assigned_workers.push({
                        id: tm.id,
                        name: tm.full_name,
                        job_title: tm.job_title || 'Team Member',
                    });
                    usedWorkerIds.add(tm.id);
                    matched = true;
                    break;
                }
            }

            if (matched) continue;

            // 2. Try system Profiles (field workers with profile_skills)
            for (const p of profiles) {
                if (usedWorkerIds.has(p.id)) continue;
                // profile_skills is a joined array: [{skill: {name}}]
                const skillNames: string[] = [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const rawSkills = (p as any).profile_skills ?? [];
                for (const ps of rawSkills) {
                    if (ps.skill?.name) skillNames.push(ps.skill.name);
                }
                const hasSkill = skillNames.some(
                    (s) => normalise(s).includes(norm) || norm.includes(normalise(s)),
                );
                if (hasSkill) {
                    assigned_workers.push({
                        id: p.id,
                        name: p.full_name || p.email,
                        job_title: 'Field Worker',
                    });
                    usedWorkerIds.add(p.id);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                missing_skills.push(requiredSkill);
            }
        }

        /* ── Match equipment ── */
        for (const requiredEq of task.equipment_needed ?? []) {
            const norm = normalise(requiredEq);
            let matched = false;

            for (const eq of equipment) {
                if (usedEquipmentIds.has(eq.id)) continue;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const model = (eq as any).model as { name?: string; manufacturer?: string } | undefined;
                const modelName = model?.name ?? '';
                const mfr = model?.manufacturer ?? '';
                const combined = normalise(`${modelName} ${mfr} ${eq.asset_tag}`);
                if (combined.includes(norm) || norm.includes(normalise(modelName))) {
                    assigned_equipment.push({
                        id: eq.id,
                        asset_tag: eq.asset_tag,
                        model_name: modelName || eq.asset_tag,
                    });
                    usedEquipmentIds.add(eq.id);
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                missing_equipment.push(requiredEq);
            }
        }

        const has_gap = missing_skills.length > 0 || missing_equipment.length > 0;

        return { task, assigned_workers, assigned_equipment, missing_skills, missing_equipment, has_gap };
    });
}

/* ─────────────────────────────────────────────────────────────
   Main Component
──────────────────────────────────────────────────────────────── */
export function ScheduleClient({
    project,
    taskGroups,
    tasks,
    teamMembers,
    profiles,
    equipment,
    currentUserId,
    latestSchedule,
    scheduleEntries,
}: ScheduleClientProps) {
    const router = useRouter();
    const supabase = createClient();

    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState('');

    /* ── Build display data from persisted schedule or fresh allocation ── */
    const displayEntries = useMemo<AllocationResult[]>(() => {
        if (!latestSchedule || scheduleEntries.length === 0) return [];

        return scheduleEntries.map((entry) => {
            const task = tasks.find((t) => t.id === entry.task_id);
            if (!task) return null;
            return {
                task,
                assigned_workers: entry.assigned_workers,
                assigned_equipment: entry.assigned_equipment,
                missing_skills: entry.missing_skills,
                missing_equipment: entry.missing_equipment,
                has_gap: entry.has_gap,
            };
        }).filter(Boolean) as AllocationResult[];
    }, [latestSchedule, scheduleEntries, tasks]);

    /* ── Gap counts ── */
    const gapCount = displayEntries.filter((e) => e.has_gap).length;
    const allGaps = useMemo(() => {
        const skill_gaps: { skill: string; taskName: string }[] = [];
        const eq_gaps: { eq: string; taskName: string }[] = [];
        for (const entry of displayEntries) {
            for (const s of entry.missing_skills) {
                skill_gaps.push({ skill: s, taskName: entry.task.name });
            }
            for (const e of entry.missing_equipment) {
                eq_gaps.push({ eq: e, taskName: entry.task.name });
            }
        }
        return { skill_gaps, eq_gaps };
    }, [displayEntries]);


    /* ── Generate Schedule Handler ── */
    async function handleGenerate() {
        setGenerateError('');
        if (tasks.length === 0) {
            setGenerateError('No tasks found. Add tasks to the project before generating a schedule.');
            return;
        }

        setIsGenerating(true);
        try {
            // Run allocation engine
            const results = runAllocation(tasks, teamMembers, profiles, equipment);
            const hasGaps = results.some((r) => r.has_gap);

            // Delete old schedules for this project (keep only latest)
            await supabase.from('project_schedules').delete().eq('project_id', project.id);

            // Insert new schedule
            const { data: newSchedule, error: schedErr } = await supabase
                .from('project_schedules')
                .insert({
                    project_id: project.id,
                    generated_by: currentUserId,
                    has_gaps: hasGaps,
                    notes: '',
                })
                .select()
                .single();

            if (schedErr || !newSchedule) {
                setGenerateError(schedErr?.message ?? 'Failed to save schedule.');
                return;
            }

            // Insert entries
            const entries = results.map((r) => ({
                schedule_id: newSchedule.id,
                task_id: r.task.id,
                assigned_workers: r.assigned_workers,
                assigned_equipment: r.assigned_equipment,
                missing_skills: r.missing_skills,
                missing_equipment: r.missing_equipment,
                has_gap: r.has_gap,
            }));

            const { error: entryErr } = await supabase.from('schedule_entries').insert(entries);
            if (entryErr) {
                setGenerateError(entryErr.message);
                return;
            }

            router.refresh();
        } catch (err) {
            setGenerateError('An unexpected error occurred.');
            console.error(err);
        } finally {
            setIsGenerating(false);
        }
    }

    const hasSchedule = !!latestSchedule && displayEntries.length > 0;

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
                <button
                    onClick={() => router.push(`/projects/${project.id}`)}
                    className="text-slate-400 hover:text-[#2463eb] transition-colors cursor-pointer"
                >
                    {project.name}
                </button>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                    <polyline points="9 18 15 12 9 6" />
                </svg>
                <span className="font-medium text-slate-900 dark:text-white">Schedule</span>
            </div>

            {/* ── Page Title ── */}
            <div className="flex items-end justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                        Schedule &amp; Gaps
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
                        Auto-allocate resources across tasks and detect shortfalls.
                    </p>
                </div>
                <div className="flex gap-3">
                    {hasSchedule && (
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Export
                        </button>
                    )}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || tasks.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-semibold hover:bg-[#2463eb]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#2463eb]/20 transition-all cursor-pointer"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                                {hasSchedule ? 'Regenerate Schedule' : 'Generate Schedule'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error Banner */}
            {generateError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {generateError}
                </div>
            )}

            {/* ── No Tasks State ── */}
            {tasks.length === 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-16 text-center">
                    <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Tasks to Schedule</h3>
                    <p className="text-sm text-slate-500 mb-4">Go to the project details page and add task groups and tasks first.</p>
                    <button
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="px-5 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-semibold hover:bg-[#2463eb]/90 transition-colors cursor-pointer"
                    >
                        Go to Project Details
                    </button>
                </div>
            )}

            {/* ── No Schedule Generated Yet ── */}
            {tasks.length > 0 && !hasSchedule && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 shadow-sm p-16 text-center">
                    <div className="mx-auto w-20 h-20 bg-[#2463eb]/10 rounded-full flex items-center justify-center mb-5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ready to Generate</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 max-w-md mx-auto">
                        The system will automatically match <strong>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</strong> with available workers and equipment from your resource catalog.
                    </p>
                    <p className="text-xs text-slate-400 mb-6">Any unfulfilled requirements will be flagged as <span className="text-red-500 font-semibold">resource gaps</span>.</p>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-[#2463eb]/90 shadow-lg shadow-[#2463eb]/20 transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                                Generate Schedule Now
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ══════════════════════════════════════════════
                SCHEDULE CONTENT (shown after generation)
            ══════════════════════════════════════════════ */}
            {hasSchedule && (
                <div className="space-y-8">

                    {/* ── Schedule Meta Banner ── */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm px-6 py-4">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span className="text-xs font-semibold">Generated {formatDateTime(latestSchedule!.generated_at)}</span>
                            </div>
                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500">{displayEntries.length} tasks allocated</span>
                            </div>
                            {latestSchedule!.has_gaps && (
                                <>
                                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs font-bold text-red-600 dark:text-red-400">{gapCount} gap{gapCount !== 1 ? 's' : ''} detected</span>
                                    </div>
                                </>
                            )}
                            {!latestSchedule!.has_gaps && (
                                <>
                                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">All resources satisfied</span>
                                    </div>
                                </>
                            )}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${latestSchedule!.has_gaps ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'}`}>
                            {latestSchedule!.has_gaps ? 'Has Gaps' : 'Fully Staffed'}
                        </span>
                    </div>

                    {/* ── Gap Alerts Section ── */}
                    {latestSchedule!.has_gaps && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Necessity Gaps (Alerts)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {allGaps.skill_gaps.map((g, i) => (
                                    <div key={`sg-${i}`} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="23" y1="11" x2="17" y2="11" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-red-900 dark:text-red-300">Missing: {g.skill}</p>
                                                <p className="text-sm text-red-700/70 dark:text-red-400/60">Required for: {g.taskName}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-xs font-bold rounded-lg uppercase tracking-wider">Worker Gap</span>
                                    </div>
                                ))}
                                {allGaps.eq_gaps.map((g, i) => (
                                    <div key={`eq-${i}`} className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 p-4 rounded-xl flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="font-bold text-amber-900 dark:text-amber-300">Shortage: {g.eq}</p>
                                                <p className="text-sm text-amber-700/70 dark:text-amber-400/60">Equipment shortfall for: {g.taskName}</p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg uppercase tracking-wider">Equipment Gap</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* ── WBS Status Cards ── */}
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                                </svg>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">WBS Status</h3>
                            </div>
                            <button
                                onClick={() => router.push(`/projects/${project.id}`)}
                                className="text-xs font-bold text-[#2463eb] hover:underline uppercase tracking-widest"
                            >
                                View Full WBS →
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {displayEntries.map((entry) => (
                                <TaskCard key={entry.task.id} entry={entry} />
                            ))}
                        </div>
                    </section>

                    {/* ── Allocated Resources Table ── */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                <polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" />
                            </svg>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Allocated Resources</h3>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Task Name</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assigned Workers</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assigned Equipment</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {displayEntries.map((entry) => {
                                        const group = taskGroups.find((g) => g.id === entry.task.group_id);
                                        return (
                                            <tr key={entry.task.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${entry.has_gap ? 'border-l-4 border-l-red-400' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{entry.task.name}</div>
                                                    {group && <div className="text-xs text-slate-500 mt-0.5">{group.name}</div>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {entry.assigned_workers.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {entry.assigned_workers.map((w) => (
                                                                <div key={w.id} className="flex items-center gap-2.5">
                                                                    <div className={`size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarColor(w.name)}`}>
                                                                        {initials(w.name)}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{w.name}</div>
                                                                        <div className="text-[10px] text-slate-400">{w.job_title}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            {entry.missing_skills.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {entry.missing_skills.map((s) => (
                                                                        <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold rounded border border-red-200 dark:border-red-800">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                            Missing: {s}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : entry.task.skills_required.length === 0 ? (
                                                        <span className="text-xs text-slate-400 italic">No workers required</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entry.missing_skills.map((s) => (
                                                                <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold rounded border border-red-200 dark:border-red-800">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                    No worker: {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {entry.assigned_equipment.length > 0 ? (
                                                        <div className="space-y-1">
                                                            <div className="flex flex-wrap gap-1">
                                                                {entry.assigned_equipment.map((e) => (
                                                                    <span key={e.id} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                                                        #{e.asset_tag}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            {entry.missing_equipment.length > 0 && (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {entry.missing_equipment.map((e) => (
                                                                        <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-800">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                            Missing: {e}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : entry.task.equipment_needed.length === 0 ? (
                                                        <span className="text-xs text-slate-400 italic">No equipment required</span>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1">
                                                            {entry.missing_equipment.map((e) => (
                                                                <span key={e} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded border border-amber-200 dark:border-amber-800">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                                                    No equipment: {e}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {entry.has_gap ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase rounded-full border border-red-200 dark:border-red-800">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                                            Gap
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase rounded-full border border-emerald-200 dark:border-emerald-800">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            OK
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ── Resource Summary ── */}
                    <section>
                        <ResourceSummary entries={displayEntries} />
                    </section>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Task Card (WBS Status section)
──────────────────────────────────────────────────────────────── */
function TaskCard({ entry }: { entry: AllocationResult }) {
    const { task, assigned_workers, assigned_equipment, missing_skills, missing_equipment, has_gap } = entry;

    const statusConfig = {
        pending: { label: 'Pending', color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700' },
        in_progress: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
        completed: { label: 'Done', color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
        cancelled: { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
    };

    const sc = statusConfig[task.status];

    return (
        <div className={`bg-white dark:bg-slate-900 border p-5 rounded-xl shadow-sm hover:shadow-md transition-all group ${has_gap ? 'border-l-4 border-l-red-400 border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 hover:border-[#2463eb]/50'}`}>
            <div className="flex justify-between items-start mb-3">
                <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${sc.bg} ${sc.color} ${sc.border}`}>
                    {sc.label}
                </span>
                {has_gap && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        </svg>
                        Gap
                    </span>
                )}
            </div>

            <h4 className="font-bold text-base mb-1 group-hover:text-[#2463eb] transition-colors text-slate-900 dark:text-white line-clamp-1">
                {task.name}
            </h4>
            {task.description && (
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">{task.description}</p>
            )}

            {/* Workers */}
            {assigned_workers.length > 0 && (
                <div className="flex items-center gap-2 mb-2">
                    <div className="flex -space-x-2">
                        {assigned_workers.slice(0, 3).map((w) => (
                            <div key={w.id} className={`size-6 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[9px] font-bold ${avatarColor(w.name)}`}>
                                {initials(w.name)}
                            </div>
                        ))}
                        {assigned_workers.length > 3 && (
                            <div className="size-6 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-slate-400">
                                +{assigned_workers.length - 3}
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">
                        {assigned_workers.length} worker{assigned_workers.length !== 1 ? 's' : ''}
                    </span>
                </div>
            )}

            {/* Equipment */}
            {assigned_equipment.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                    {assigned_equipment.slice(0, 2).map((e) => (
                        <span key={e.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-bold rounded text-slate-500 border border-slate-200 dark:border-slate-700">
                            #{e.asset_tag}
                        </span>
                    ))}
                    {assigned_equipment.length > 2 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-mono font-bold rounded text-slate-500 border border-slate-200 dark:border-slate-700">
                            +{assigned_equipment.length - 2}
                        </span>
                    )}
                </div>
            )}

            {/* Missing */}
            {(missing_skills.length > 0 || missing_equipment.length > 0) && (
                <div className="pt-2 border-t border-red-100 dark:border-red-900/30 mt-2">
                    <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Missing:</p>
                    <div className="flex flex-wrap gap-1">
                        {missing_skills.map((s) => (
                            <span key={s} className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[9px] font-bold rounded">👤 {s}</span>
                        ))}
                        {missing_equipment.map((e) => (
                            <span key={e} className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[9px] font-bold rounded">🔧 {e}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Fully allocated ✓ */}
            {!has_gap && task.skills_required.length === 0 && task.equipment_needed.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">No specific resources required.</p>
            )}
            {!has_gap && (task.skills_required.length > 0 || task.equipment_needed.length > 0) && (
                <div className="flex items-center gap-1 mt-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">All resources allocated</span>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Resource Summary Panel
──────────────────────────────────────────────────────────────── */
function ResourceSummary({ entries }: { entries: AllocationResult[] }) {
    // Unique workers across all tasks
    const allWorkers = new Map<string, AllocatedWorker & { taskCount: number }>();
    const allEquipment = new Map<string, AllocatedEquipment & { taskCount: number }>();

    for (const entry of entries) {
        for (const w of entry.assigned_workers) {
            if (!allWorkers.has(w.id)) {
                allWorkers.set(w.id, { ...w, taskCount: 0 });
            }
            allWorkers.get(w.id)!.taskCount++;
        }
        for (const e of entry.assigned_equipment) {
            if (!allEquipment.has(e.id)) {
                allEquipment.set(e.id, { ...e, taskCount: 0 });
            }
            allEquipment.get(e.id)!.taskCount++;
        }
    }

    const workers = Array.from(allWorkers.values());
    const equipmentList = Array.from(allEquipment.values());

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workers Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <h4 className="font-bold text-slate-900 dark:text-white">Assigned Workers</h4>
                    <span className="ml-auto text-xs font-bold text-slate-400">{workers.length} total</span>
                </div>
                {workers.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No workers were matched from the resource catalog.</p>
                ) : (
                    <div className="space-y-3">
                        {workers.map((w) => (
                            <div key={w.id} className="flex items-center gap-3">
                                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(w.name)}`}>
                                    {initials(w.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{w.name}</p>
                                    <p className="text-[10px] text-slate-400">{w.job_title}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {w.taskCount} task{w.taskCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Equipment Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                    </svg>
                    <h4 className="font-bold text-slate-900 dark:text-white">Assigned Equipment</h4>
                    <span className="ml-auto text-xs font-bold text-slate-400">{equipmentList.length} total</span>
                </div>
                {equipmentList.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No equipment was matched from the inventory catalog.</p>
                ) : (
                    <div className="space-y-3">
                        {equipmentList.map((e) => (
                            <div key={e.id} className="flex items-center gap-3">
                                <div className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{e.model_name}</p>
                                    <p className="text-[10px] font-mono text-slate-400">#{e.asset_tag}</p>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                    {e.taskCount} task{e.taskCount !== 1 ? 's' : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
