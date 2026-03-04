'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectTask, Project } from '@/types/database';

export interface WorkerTask extends ProjectTask {
    project?: Pick<Project, 'id' | 'name' | 'location' | 'start_date' | 'end_date'>;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
}

type FilterTab = 'today' | 'upcoming' | 'completed';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot?: string }> = {
    in_progress: { bg: '#eff6ff', text: '#2463eb', dot: '#2463eb' },
    pending: { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' },
    completed: { bg: '#ecfdf5', text: '#059669', dot: '#10b981' },
    cancelled: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
};

const STATUS_LABELS: Record<string, string> = {
    in_progress: 'Active Now',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<string, string> = {
    low: '#64748b',
    medium: '#2463eb',
    high: '#f59e0b',
    critical: '#ef4444',
};

function formatScheduledTime(start?: string | null, end?: string | null) {
    if (!start && !end) return null;
    const fmt = (s: string) =>
        new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return fmt(start);
    return null;
}

function isToday(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
}

function isUpcoming(dateStr?: string | null) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d > now && !isToday(dateStr);
}

export function WorkerTasksClient({ tasks }: { tasks: WorkerTask[] }) {
    const router = useRouter();
    const [activeFilter, setActiveFilter] = useState<FilterTab>('today');

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const filteredTasks = useMemo(() => {
        if (activeFilter === 'completed') {
            return tasks.filter((t) => t.status === 'completed');
        }
        if (activeFilter === 'today') {
            return tasks.filter((t) => {
                if (t.status === 'completed' || t.status === 'cancelled') return false;
                if (t.scheduled_start) return isToday(t.scheduled_start);
                if (t.status === 'in_progress') return true;
                // If no schedule date, show pending/in_progress tasks in "today"
                return t.status === 'pending' || t.status === 'in_progress';
            });
        }
        // upcoming
        return tasks.filter((t) => {
            if (t.status === 'completed' || t.status === 'cancelled') return false;
            if (t.scheduled_start) return isUpcoming(t.scheduled_start);
            return false;
        });
    }, [tasks, activeFilter]);

    const counts = useMemo(() => ({
        today: tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && (!t.scheduled_start || isToday(t.scheduled_start) || t.status === 'in_progress')).length,
        upcoming: tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled' && t.scheduled_start && isUpcoming(t.scheduled_start)).length,
        completed: tasks.filter((t) => t.status === 'completed').length,
    }), [tasks]);

    return (
        <div>
            {/* ── Header ── */}
            <header style={{
                padding: '20px 16px 8px',
                position: 'sticky',
                top: 44, // below the auth strip
                zIndex: 10,
                background: 'rgba(246,246,248,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}>
                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.5px',
                    lineHeight: 1.2,
                }}>
                    My Tasks
                </h1>
                <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                    {today}
                </p>

                {/* Filter Pills */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '16px',
                    overflowX: 'auto',
                    paddingBottom: '4px',
                    scrollbarWidth: 'none',
                }}>
                    {(['today', 'upcoming', 'completed'] as FilterTab[]).map((tab) => {
                        const active = activeFilter === tab;
                        const label = tab.charAt(0).toUpperCase() + tab.slice(1);
                        const count = counts[tab];
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveFilter(tab)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    flexShrink: 0,
                                    height: '38px',
                                    padding: '0 18px',
                                    borderRadius: '999px',
                                    border: active ? 'none' : '1.5px solid #e2e8f0',
                                    background: active ? '#2463eb' : 'white',
                                    color: active ? 'white' : '#475569',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: active ? '0 4px 12px rgba(36,99,235,0.25)' : undefined,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                {label}
                                {count > 0 && (
                                    <span style={{
                                        background: active ? 'rgba(255,255,255,0.3)' : '#f1f5f9',
                                        color: active ? 'white' : '#64748b',
                                        fontSize: '10px',
                                        fontWeight: 700,
                                        borderRadius: '999px',
                                        padding: '1px 7px',
                                    }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* ── Task Cards ── */}
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredTasks.length === 0 ? (
                    <div style={{
                        marginTop: '48px',
                        textAlign: 'center',
                        padding: '40px 24px',
                        background: 'white',
                        borderRadius: '16px',
                        border: '1.5px solid #e2e8f0',
                    }}>
                        <div style={{
                            width: 56, height: 56,
                            background: '#f1f5f9',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 11 12 14 22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                            {activeFilter === 'completed' ? 'No completed tasks yet' : 'No tasks for this period'}
                        </p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>
                            {activeFilter === 'today'
                                ? "You're all caught up! Check 'Upcoming' for future tasks."
                                : activeFilter === 'upcoming'
                                    ? 'No upcoming tasks scheduled.'
                                    : 'Complete your tasks and they will appear here.'}
                        </p>
                    </div>
                ) : (
                    filteredTasks.map((task) => {
                        const sc = STATUS_COLORS[task.status] || STATUS_COLORS.pending;
                        const isActive = task.status === 'in_progress';
                        const timeStr = formatScheduledTime(task.scheduled_start, task.scheduled_end);
                        const estimatedLabel = task.estimated_hours ? `~${task.estimated_hours}h` : null;

                        return (
                            <div
                                key={task.id}
                                onClick={() => router.push(`/worker/tasks/${task.id}`)}
                                style={{
                                    background: 'white',
                                    borderRadius: '16px',
                                    border: `1.5px solid ${isActive ? '#bfdbfe' : '#e2e8f0'}`,
                                    overflow: 'hidden',
                                    boxShadow: isActive
                                        ? '0 4px 20px rgba(36,99,235,0.12)'
                                        : '0 2px 8px rgba(0,0,0,0.04)',
                                    cursor: 'pointer',
                                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                                    position: 'relative',
                                }}
                                onMouseDown={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.98)';
                                }}
                                onMouseUp={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                                }}
                                onTouchStart={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.98)';
                                }}
                                onTouchEnd={(e) => {
                                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                                }}
                            >
                                {/* Priority accent bar */}
                                <div style={{
                                    height: '3px',
                                    background: PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium,
                                }} />

                                <div style={{ padding: '16px' }}>
                                    {/* Status badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '3px 10px 3px 8px',
                                            borderRadius: '999px',
                                            background: sc.bg,
                                            color: sc.text,
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.06em',
                                        }}>
                                            {isActive && (
                                                <span style={{
                                                    width: 6, height: 6,
                                                    borderRadius: '50%',
                                                    background: sc.dot,
                                                    animation: 'pulse 1.5s infinite',
                                                }} />
                                            )}
                                            {STATUS_LABELS[task.status] || task.status}
                                        </span>
                                        {estimatedLabel && (
                                            <span style={{
                                                fontSize: '11px',
                                                color: '#94a3b8',
                                                fontWeight: 600,
                                                marginLeft: 'auto',
                                            }}>
                                                {estimatedLabel}
                                            </span>
                                        )}
                                    </div>

                                    {/* Time */}
                                    {timeStr && (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: '5px',
                                            color: isActive ? '#2463eb' : '#64748b',
                                            fontSize: '13px', fontWeight: 700,
                                            marginBottom: '6px',
                                        }}>
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="10" />
                                                <polyline points="12 6 12 12 16 14" />
                                            </svg>
                                            {timeStr}
                                        </div>
                                    )}

                                    {/* Task name */}
                                    <h3 style={{
                                        fontSize: '17px',
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        lineHeight: 1.3,
                                        letterSpacing: '-0.3px',
                                        marginBottom: '12px',
                                    }}>
                                        {task.name}
                                    </h3>

                                    {/* Footer row */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span style={{ fontSize: '13px', fontWeight: 500 }}>
                                                {task.project?.location || task.project?.name || '—'}
                                            </span>
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            background: isActive ? '#2463eb' : '#f1f5f9',
                                            color: isActive ? 'white' : '#475569',
                                            fontSize: '13px',
                                            fontWeight: 700,
                                        }}>
                                            {task.status === 'completed' ? 'Review' : 'Details'}
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
                ::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
}
