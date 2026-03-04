'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ProjectTask, Project, Profile } from '@/types/database';

export interface TaskDetailData extends ProjectTask {
    project?: Pick<Project, 'id' | 'name' | 'location' | 'start_date' | 'end_date'>;
    coworkers?: Pick<Profile, 'id' | 'full_name' | 'email'>[];
    scheduled_start?: string | null;
    scheduled_end?: string | null;
}

const PRIORITY_COLORS: Record<string, string> = {
    low: '#64748b',
    medium: '#2463eb',
    high: '#f59e0b',
    critical: '#ef4444',
};

const PRIORITY_LABELS: Record<string, string> = {
    low: 'Low Priority',
    medium: 'Medium Priority',
    high: 'High Priority',
    critical: 'Critical',
};

function formatScheduledTime(start?: string | null, end?: string | null) {
    if (!start && !end) return null;
    const fmt = (s: string) =>
        new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return fmt(start);
    return null;
}

function formatDate(dateStr?: string | null) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
    });
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

const COWORKER_GRADIENTS = [
    'linear-gradient(135deg, #2463eb, #60a5fa)',
    'linear-gradient(135deg, #7c3aed, #a78bfa)',
    'linear-gradient(135deg, #059669, #34d399)',
    'linear-gradient(135deg, #d97706, #fbbf24)',
    'linear-gradient(135deg, #dc2626, #f87171)',
];

export function WorkerTaskDetailClient({ task }: { task: TaskDetailData }) {
    const router = useRouter();
    const supabase = createClient();

    const [status, setStatus] = useState(task.status);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState<'start' | 'complete' | null>(null);

    const timeStr = formatScheduledTime(task.scheduled_start, task.scheduled_end);
    const dateStr = formatDate(task.scheduled_start) || formatDate(task.project?.start_date);
    const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

    async function updateTaskStatus(newStatus: 'in_progress' | 'completed') {
        setIsUpdating(true);
        setError('');
        const { error: err } = await supabase
            .from('project_tasks')
            .update({ status: newStatus })
            .eq('id', task.id);

        if (err) {
            setError(err.message);
            setIsUpdating(false);
            return;
        }

        setStatus(newStatus);
        setIsUpdating(false);
        setShowConfirm(null);
        router.refresh();
    }

    const isCompleted = status === 'completed';
    const isInProgress = status === 'in_progress';
    const isPending = status === 'pending';

    return (
        <div style={{ minHeight: '100dvh', background: '#f6f6f8' }}>
            {/* ── Header ── */}
            <header style={{
                position: 'sticky',
                top: 44, // below auth strip
                zIndex: 10,
                background: 'rgba(246,246,248,0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                padding: '10px 16px',
                gap: '12px',
            }}>
                <button
                    onClick={() => router.back()}
                    style={{
                        width: 36, height: 36,
                        background: 'white',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                </button>
                <h2 style={{
                    fontSize: '16px', fontWeight: 700, color: '#0f172a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    Task Details
                </h2>
            </header>

            <div style={{ padding: '24px 16px', paddingBottom: '120px' }}>
                {/* ── Priority bar + Status Badge ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px',
                }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '6px',
                        width: '6px',
                        borderRadius: '50%',
                        background: priorityColor,
                    }} />
                    <span style={{
                        fontSize: '11px', fontWeight: 700,
                        color: priorityColor,
                        textTransform: 'uppercase', letterSpacing: '0.07em',
                    }}>
                        {PRIORITY_LABELS[task.priority]}
                    </span>

                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <StatusBadge status={status} />
                    </span>
                </div>

                {/* ── Task Name ── */}
                <h1 style={{
                    fontSize: '26px', fontWeight: 900,
                    color: '#0f172a', lineHeight: 1.2,
                    letterSpacing: '-0.5px', marginBottom: '24px',
                }}>
                    {task.name}
                </h1>

                {/* ── Info Cards ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {/* Schedule */}
                    {(timeStr || dateStr) && (
                        <InfoCard
                            icon={
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            }
                            label="Scheduled Time"
                            value={[dateStr, timeStr].filter(Boolean).join(' · ')}
                        />
                    )}
                    {/* Location */}
                    {task.project?.location && (
                        <InfoCard
                            icon={
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            }
                            label="Event Venue"
                            value={task.project.location}
                        />
                    )}
                    {/* Duration */}
                    {task.estimated_hours > 0 && (
                        <InfoCard
                            icon={
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                            }
                            label="Estimated Duration"
                            value={`${task.estimated_hours} hour${task.estimated_hours !== 1 ? 's' : ''}`}
                        />
                    )}
                    {/* Project */}
                    {task.project?.name && (
                        <InfoCard
                            icon={
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                </svg>
                            }
                            label="Project / Event"
                            value={task.project.name}
                        />
                    )}
                </div>

                {/* ── Description ── */}
                {task.description && (
                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{
                            fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
                        }}>
                            Description
                        </h3>
                        <p style={{
                            fontSize: '14px', color: '#475569', lineHeight: 1.7,
                            background: 'white',
                            borderRadius: '12px',
                            border: '1.5px solid #e2e8f0',
                            padding: '14px 16px',
                        }}>
                            {task.description}
                        </p>
                    </section>
                )}

                {/* ── Equipment Pick List ── */}
                {task.equipment_needed?.length > 0 && (
                    <section style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <h3 style={{
                                fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                                textTransform: 'uppercase', letterSpacing: '0.1em',
                            }}>
                                Equipment Needed
                            </h3>
                            <span style={{
                                fontSize: '11px', fontWeight: 600, color: '#64748b',
                                background: '#f1f5f9', borderRadius: '6px', padding: '2px 8px',
                            }}>
                                {task.equipment_needed.length} items
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {task.equipment_needed.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0',
                                    padding: '12px 16px',
                                }}>
                                    <div style={{
                                        width: 36, height: 36, flexShrink: 0,
                                        background: '#eff6ff', borderRadius: '8px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2463eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="1" y="3" width="15" height="13" />
                                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                            <circle cx="5.5" cy="18.5" r="2.5" />
                                            <circle cx="18.5" cy="18.5" r="2.5" />
                                        </svg>
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                        {item}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Skills Required ── */}
                {task.skills_required?.length > 0 && (
                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{
                            fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
                        }}>
                            Skills Required
                        </h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {task.skills_required.map((skill, i) => (
                                <span key={i} style={{
                                    padding: '5px 12px',
                                    borderRadius: '999px',
                                    background: '#eff6ff',
                                    color: '#2463eb',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    border: '1px solid #bfdbfe',
                                }}>
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Co-workers ── */}
                {task.coworkers && task.coworkers.length > 0 && (
                    <section style={{ marginBottom: '24px' }}>
                        <h3 style={{
                            fontSize: '12px', fontWeight: 700, color: '#94a3b8',
                            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px',
                        }}>
                            Team on this task
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {task.coworkers.map((worker, i) => (
                                <div key={worker.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    background: 'white',
                                    borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0',
                                    padding: '10px 14px',
                                }}>
                                    <div style={{
                                        width: 38, height: 38, flexShrink: 0,
                                        borderRadius: '50%',
                                        background: COWORKER_GRADIENTS[i % COWORKER_GRADIENTS.length],
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '13px', fontWeight: 700,
                                    }}>
                                        {getInitials(worker.full_name || worker.email)}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                        {worker.full_name || worker.email}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Error ── */}
                {error && (
                    <div style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        background: '#fef2f2',
                        border: '1.5px solid #fecaca',
                        color: '#dc2626',
                        fontSize: '13px',
                        marginBottom: '16px',
                    }}>
                        {error}
                    </div>
                )}
            </div>

            {/* ── Sticky Bottom Action ── */}
            {!isCompleted && (
                <footer style={{
                    position: 'fixed',
                    bottom: 64, // above bottom nav
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '100%',
                    maxWidth: '430px',
                    padding: '12px 16px',
                    background: 'rgba(246,246,248,0.95)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    gap: '10px',
                    zIndex: 40,
                }}>
                    {isPending && (
                        <button
                            onClick={() => setShowConfirm('start')}
                            disabled={isUpdating}
                            style={{
                                flex: 1,
                                padding: '16px',
                                borderRadius: '14px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #2463eb, #3b82f6)',
                                color: 'white',
                                fontSize: '15px',
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: '0 4px 16px rgba(36,99,235,0.3)',
                                opacity: isUpdating ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            {isUpdating ? 'Updating...' : 'Start Task'}
                        </button>
                    )}

                    {isInProgress && (
                        <button
                            onClick={() => setShowConfirm('complete')}
                            disabled={isUpdating}
                            style={{
                                flex: 1,
                                padding: '16px',
                                borderRadius: '14px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #059669, #10b981)',
                                color: 'white',
                                fontSize: '15px',
                                fontWeight: 800,
                                cursor: isUpdating ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
                                opacity: isUpdating ? 0.7 : 1,
                                transition: 'all 0.2s',
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            {isUpdating ? 'Updating...' : 'Mark as Completed'}
                        </button>
                    )}
                </footer>
            )}

            {/* ── Confirmation Modal ── */}
            {showConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(4px)',
                }}>
                    <div
                        style={{
                            width: '100%', maxWidth: '430px',
                            background: 'white',
                            borderRadius: '24px 24px 0 0',
                            padding: '24px 20px 32px',
                            animation: 'slideUp 0.25s ease',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{
                            width: 48, height: 4, background: '#e2e8f0',
                            borderRadius: '999px', margin: '0 auto 24px',
                        }} />

                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: showConfirm === 'start' ? '#eff6ff' : '#ecfdf5',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 16px',
                        }}>
                            {showConfirm === 'start' ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="#2463eb" stroke="none">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                        </div>

                        <h3 style={{
                            fontSize: '20px', fontWeight: 800, color: '#0f172a',
                            textAlign: 'center', marginBottom: '8px',
                        }}>
                            {showConfirm === 'start' ? 'Start this task?' : 'Mark as completed?'}
                        </h3>
                        <p style={{
                            fontSize: '14px', color: '#64748b',
                            textAlign: 'center', lineHeight: 1.6, marginBottom: '28px',
                        }}>
                            {showConfirm === 'start'
                                ? 'This will mark the task as "In Progress" and notify your project manager.'
                                : 'This will mark the task as "Completed". Make sure all equipment has been handled before confirming.'}
                        </p>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowConfirm(null)}
                                style={{
                                    flex: 1, padding: '14px',
                                    borderRadius: '12px',
                                    border: '1.5px solid #e2e8f0',
                                    background: 'white', color: '#475569',
                                    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateTaskStatus(showConfirm === 'start' ? 'in_progress' : 'completed')}
                                disabled={isUpdating}
                                style={{
                                    flex: 1, padding: '14px',
                                    borderRadius: '12px',
                                    border: 'none',
                                    background: showConfirm === 'start'
                                        ? 'linear-gradient(135deg, #2463eb, #3b82f6)'
                                        : 'linear-gradient(135deg, #059669, #10b981)',
                                    color: 'white',
                                    fontSize: '14px', fontWeight: 700,
                                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                                    opacity: isUpdating ? 0.7 : 1,
                                }}
                            >
                                {isUpdating ? 'Saving...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const configs: Record<string, { bg: string; text: string; label: string; dot?: boolean }> = {
        pending: { bg: '#f1f5f9', text: '#475569', label: 'Pending' },
        in_progress: { bg: '#eff6ff', text: '#2463eb', label: 'In Progress', dot: true },
        completed: { bg: '#ecfdf5', text: '#059669', label: 'Completed' },
        cancelled: { bg: '#fef2f2', text: '#dc2626', label: 'Cancelled' },
    };
    const c = configs[status] || configs.pending;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 12px 4px 10px',
            borderRadius: '999px',
            background: c.bg, color: c.text,
            fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
            {c.dot && (
                <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: c.text, animation: 'pulse 1.5s infinite',
                }} />
            )}
            {c.label}
        </span>
    );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: 'white',
            borderRadius: '12px',
            border: '1.5px solid #e2e8f0',
            padding: '13px 16px',
        }}>
            <div style={{
                width: 44, height: 44, flexShrink: 0,
                background: '#eff6ff',
                borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#2463eb',
            }}>
                {icon}
            </div>
            <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{value}</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginTop: '2px' }}>{label}</p>
            </div>
        </div>
    );
}
