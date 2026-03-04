'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Project, ScheduleEntry } from '@/types/database';

interface PickListClientProps {
    project: Project;
    scheduleEntries: ScheduleEntry[];
    hasSchedule: boolean;
}

export function PickListClient({ project, scheduleEntries, hasSchedule }: PickListClientProps) {
    const router = useRouter();

    const { groupedEquipment, missingEquipment } = useMemo(() => {
        const grouped: Record<string, string[]> = {};
        const missing: Record<string, number> = {};

        for (const entry of scheduleEntries) {
            // Process assigned equipment
            for (const eq of entry.assigned_equipment || []) {
                const modelName = eq.model_name || 'Unknown Model';
                if (!grouped[modelName]) {
                    grouped[modelName] = [];
                }
                // Only add if not already in the list (if one item is used for multiple tasks, though usually it's locked to one)
                if (!grouped[modelName].includes(eq.asset_tag)) {
                    grouped[modelName].push(eq.asset_tag);
                }
            }

            // Process missing equipment
            for (const mis of entry.missing_equipment || []) {
                if (!missing[mis]) {
                    missing[mis] = 0;
                }
                missing[mis]++;
            }
        }

        return { groupedEquipment: grouped, missingEquipment: missing };
    }, [scheduleEntries]);

    const hasMissing = Object.keys(missingEquipment).length > 0;
    const hasAssigned = Object.keys(groupedEquipment).length > 0;

    const formattedDate = project.start_date
        ? new Date(project.start_date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'TBD';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* ── Screen-only controls ── */}
            <div className="flex items-center justify-between mb-8 print:hidden">
                <div className="flex items-center gap-2 text-sm">
                    <button
                        onClick={() => router.push(`/projects/${project.id}`)}
                        className="text-slate-500 hover:text-[#2463eb] transition-colors flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Project
                    </button>
                </div>
                {hasSchedule && (
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-semibold hover:bg-[#2463eb]/90 shadow-sm transition-colors cursor-pointer"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Print PDF / Pick List
                    </button>
                )}
            </div>

            {/* ── Printable Area ── */}
            <div className="bg-white border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-8 print:p-0 print:border-none print:shadow-none print:bg-transparent">
                {!hasSchedule ? (
                    <div className="text-center py-16 print:hidden">
                        <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Schedule Generated</h3>
                        <p className="text-sm text-slate-500 mb-6">A schedule must be generated before you can print a pick list.</p>
                        <button
                            onClick={() => router.push(`/projects/${project.id}/schedule`)}
                            className="px-5 py-2 bg-[#2463eb] text-white rounded-lg text-sm font-semibold hover:bg-[#2463eb]/90 transition-colors"
                        >
                            Go to Schedule Gen
                        </button>
                    </div>
                ) : (
                    <div className="font-[Inter] text-slate-900 dark:text-slate-100">
                        {/* Header Document */}
                        <div className="border-b-2 border-slate-800 dark:border-slate-200 pb-6 mb-8 flex justify-between items-end">
                            <div>
                                <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Equipment Pick List</h1>
                                <h2 className="text-2xl font-bold text-[#2463eb]">{project.name}</h2>
                            </div>
                            <div className="text-right text-sm font-medium space-y-1">
                                <p><span className="text-slate-500 uppercase text-xs font-bold tracking-wider mr-2">Venue:</span> {project.location || '—'}</p>
                                <p><span className="text-slate-500 uppercase text-xs font-bold tracking-wider mr-2">Load-Out Date:</span> {formattedDate}</p>
                                <p><span className="text-slate-500 uppercase text-xs font-bold tracking-wider mr-2">Generated On:</span> {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        {/* Shortages Alert Area */}
                        {hasMissing && (
                            <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700 rounded-lg print:border-amber-500 print:bg-amber-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" />
                                        <line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <h3 className="text-xl font-bold text-amber-900 dark:text-amber-500 uppercase tracking-widest">Action Required: Shortages</h3>
                                </div>
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-400 mb-4">
                                    The following required equipment could not be allocated from inventory. Please arrange cross-hire or alternative allocation before dispatch.
                                </p>
                                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {Object.entries(missingEquipment).map(([itemName, count]) => (
                                        <li key={itemName} className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-md shadow-sm border border-amber-200 dark:border-amber-800 select-all">
                                            <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center font-bold text-amber-700 dark:text-amber-400">
                                                {count}
                                            </span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200">{itemName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Allocated Equipment Lists */}
                        <div>
                            <h3 className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2 mb-6 uppercase tracking-widest">
                                Pick List (Allocated Items)
                            </h3>

                            {!hasAssigned ? (
                                <p className="text-slate-500 italic">No equipment allocated for this project.</p>
                            ) : (
                                <div className="space-y-8">
                                    {Object.entries(groupedEquipment).map(([modelName, assetTags], idx) => (
                                        <div key={idx} className="break-inside-avoid">
                                            <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-t-lg border-b border-slate-200 dark:border-slate-700">
                                                <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">{modelName}</h4>
                                                <span className="text-sm font-black bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                                                    Quantity: {assetTags.length}
                                                </span>
                                            </div>
                                            <div className="border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-lg p-4 bg-white dark:bg-slate-900/50">
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                                                    {assetTags.map((tag) => (
                                                        <div key={tag} className="flex items-center gap-4">
                                                            {/* Checkbox for signoff */}
                                                            <div className="w-6 h-6 border-2 border-slate-400 rounded shrink-0 print:border-black"></div>
                                                            <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-base">
                                                                {tag}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sign-off Footers */}
                        <div className="mt-16 pt-8 border-t-2 border-slate-800 dark:border-slate-200 break-inside-avoid">
                            <h3 className="text-lg font-bold mb-8 uppercase tracking-widest">Dispatch Sign-off</h3>
                            <div className="grid grid-cols-2 gap-12">
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-8">Prepared By (Warehouse)</p>
                                    <div className="border-b border-slate-400 dark:border-slate-600 relative h-10 mb-2">
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Print Name &amp; Signature</span>
                                        <span>Date / Time</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-8">Loaded By (Transport / Field)</p>
                                    <div className="border-b border-slate-400 dark:border-slate-600 relative h-10 mb-2">
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Print Name &amp; Signature</span>
                                        <span>Date / Time</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>

            <style>{`
                @media print {
                    @page { margin: 1.5cm; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}
