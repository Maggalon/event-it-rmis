'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type {
    Equipment,
    EquipmentModel,
    EquipmentStatus,
    EquipmentCategory,
    Profile,
    ProfileSkill,
    Skill,
    UserRole,
} from '@/types/database';

interface ResourcesClientProps {
    equipment: Equipment[];
    equipmentModels: EquipmentModel[];
    fieldWorkers: Profile[];
    profileSkills: ProfileSkill[];
    allProfiles: Pick<Profile, 'id' | 'full_name' | 'email'>[];
    currentUserRole: UserRole;
}

/* ─────────────── Status & Category configs ─────────────── */

const STATUS_CONFIG: Record<EquipmentStatus, { label: string; dot: string; bg: string; text: string }> = {
    available:   { label: 'Available',   dot: 'bg-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
    deployed:    { label: 'Deployed',    dot: 'bg-[#2463eb]',   bg: 'bg-[#2463eb]/10 dark:bg-[#2463eb]/20', text: 'text-[#2463eb]' },
    maintenance: { label: 'Maintenance', dot: 'bg-red-500',     bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-400' },
    retired:     { label: 'Retired',     dot: 'bg-slate-400',   bg: 'bg-slate-100 dark:bg-slate-800',       text: 'text-slate-500 dark:text-slate-400' },
};

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
    networking:  'Networking',
    server:      'Server',
    wireless:    'Wireless',
    security:    'Security',
    cabling:     'Cabling',
    power:       'Power',
    audio_video: 'Audio/Video',
    other:       'Other',
};

const SKILL_CATEGORY_LABELS: Record<string, string> = {
    certification: 'Certifications',
    technical:     'Technical Skills',
    general:       'General',
};

/* ─────────────── SVG Icon Components ─────────────── */

function SearchIcon({ className = '' }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}

function PlusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
    );
}

function ModelsIcon({ className = '' }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    );
}

function ItemsIcon({ className = '' }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
    );
}

function TeamIcon({ className = '' }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function PersonIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function SpinnerIcon() {
    return (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
    );
}

function MailIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

function PhoneIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

/* ─────────────── Reusable label component ─────────────── */

function InputLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
    return (
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {children} {required && <span className="text-red-500">*</span>}
        </label>
    );
}

const inputCls = 'w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all placeholder:text-slate-400';

/* ─────────────── Main Component ─────────────── */

export function ResourcesClient({
    equipment,
    equipmentModels,
    fieldWorkers,
    profileSkills,
    allProfiles,
    currentUserRole,
}: ResourcesClientProps) {
    const router = useRouter();
    const supabase = createClient();

    /* ── Tab ── */
    const [activeTab, setActiveTab] = useState<'models' | 'items' | 'team'>('models');

    /* ── Search & filters ── */
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | ''>('');
    const [statusFilter, setStatusFilter] = useState<EquipmentStatus | ''>('');
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    /* ── Model modal state ── */
    const [showModelModal, setShowModelModal] = useState(false);
    const [isSubmittingModel, setIsSubmittingModel] = useState(false);
    const [modelFormError, setModelFormError] = useState('');
    const [newModel, setNewModel] = useState({
        name: '',
        manufacturer: '',
        category: 'other' as EquipmentCategory,
        description: '',
    });

    /* ── Item modal state ── */
    const [showItemModal, setShowItemModal] = useState(false);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    const [itemFormError, setItemFormError] = useState('');
    const [newItem, setNewItem] = useState({
        model_id: '',
        asset_tag: '',
        serial_number: '',
        ip_address: '',
        status: 'available' as EquipmentStatus,
        notes: '',
        assigned_to: '',
    });

    /* ── Derived data ── */

    const modelItemCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        for (const item of equipment) {
            counts[item.model_id] = (counts[item.model_id] || 0) + 1;
        }
        return counts;
    }, [equipment]);

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

    /* ── Filtered lists ── */

    const filteredModels = useMemo(() => {
        let list = equipmentModels;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    m.manufacturer.toLowerCase().includes(q) ||
                    (m.description && m.description.toLowerCase().includes(q))
            );
        }
        if (categoryFilter) list = list.filter((m) => m.category === categoryFilter);
        return list;
    }, [equipmentModels, searchQuery, categoryFilter]);

    const filteredItems = useMemo(() => {
        let list = equipment;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (e) =>
                    e.asset_tag.toLowerCase().includes(q) ||
                    (e.model?.name.toLowerCase().includes(q)) ||
                    (e.serial_number && e.serial_number.toLowerCase().includes(q)) ||
                    (e.ip_address && e.ip_address.toLowerCase().includes(q))
            );
        }
        if (categoryFilter) list = list.filter((e) => e.model?.category === categoryFilter);
        if (statusFilter) list = list.filter((e) => e.status === statusFilter);
        return list;
    }, [equipment, searchQuery, categoryFilter, statusFilter]);

    const filteredTeam = useMemo(() => {
        if (!searchQuery.trim()) return fieldWorkers;
        const q = searchQuery.toLowerCase();
        return fieldWorkers.filter((fw) => {
            const nameMatch = fw.full_name.toLowerCase().includes(q) || fw.email.toLowerCase().includes(q);
            const skillMatch = (profileSkillMap[fw.id] || []).some((s) => s.name.toLowerCase().includes(q));
            return nameMatch || skillMatch;
        });
    }, [fieldWorkers, searchQuery, profileSkillMap]);

    /* ── Metrics ── */
    const totalModels = equipmentModels.length;
    const totalItems  = equipment.length;
    const availableItems = equipment.filter((e) => e.status === 'available').length;
    const deployedItems  = equipment.filter((e) => e.status === 'deployed').length;
    const totalTeam  = fieldWorkers.length;
    const activeTeam = fieldWorkers.filter((fw) => fw.is_active).length;
    const uniqueCategories = new Set(equipmentModels.map((m) => m.category)).size;

    /* ── Handlers ── */

    async function handleCreateModel(e: React.FormEvent) {
        e.preventDefault();
        setModelFormError('');
        if (!newModel.name.trim() || !newModel.manufacturer.trim()) {
            setModelFormError('Name and Manufacturer are required.');
            return;
        }
        setIsSubmittingModel(true);
        try {
            const { error } = await supabase.from('equipment_models').insert({
                name: newModel.name.trim(),
                manufacturer: newModel.manufacturer.trim(),
                category: newModel.category,
                description: newModel.description.trim(),
            });
            if (error) { setModelFormError(error.message); return; }
            setNewModel({ name: '', manufacturer: '', category: 'other', description: '' });
            setShowModelModal(false);
            router.refresh();
        } catch { setModelFormError('An unexpected error occurred.'); }
        finally { setIsSubmittingModel(false); }
    }

    async function handleDeleteModel(id: string) {
        if (!confirm('Delete this equipment model? Items linked to it may be affected.')) return;
        const { error } = await supabase.from('equipment_models').delete().eq('id', id);
        if (error) { alert('Failed to delete: ' + error.message); return; }
        router.refresh();
    }

    async function handleCreateItem(e: React.FormEvent) {
        e.preventDefault();
        setItemFormError('');
        if (!newItem.model_id || !newItem.asset_tag.trim()) {
            setItemFormError('Model and Asset Tag are required.');
            return;
        }
        setIsSubmittingItem(true);
        try {
            const { error } = await supabase.from('equipment').insert({
                model_id:      newItem.model_id,
                asset_tag:     newItem.asset_tag.trim(),
                serial_number: newItem.serial_number.trim() || null,
                ip_address:    newItem.ip_address.trim() || null,
                status:        newItem.status,
                notes:         newItem.notes.trim(),
                assigned_to:   newItem.assigned_to || null,
            });
            if (error) { setItemFormError(error.message); return; }
            setNewItem({ model_id: '', asset_tag: '', serial_number: '', ip_address: '', status: 'available', notes: '', assigned_to: '' });
            setShowItemModal(false);
            router.refresh();
        } catch { setItemFormError('An unexpected error occurred.'); }
        finally { setIsSubmittingItem(false); }
    }

    async function handleDeleteItem(id: string) {
        if (!confirm('Delete this equipment item?')) return;
        const { error } = await supabase.from('equipment').delete().eq('id', id);
        if (error) { alert('Failed to delete: ' + error.message); return; }
        router.refresh();
    }

    function getGroupedSkills(workerId: string) {
        const skills = profileSkillMap[workerId] || [];
        const groups: Record<string, Skill[]> = {};
        for (const s of skills) {
            const cat = s.category || 'general';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        }
        return groups;
    }

    /* ─────────────── RENDER ─────────────── */

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Resource Catalogs</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Centralized management for hardware assets and field personnel.
                    </p>
                </div>
                {activeTab === 'models' && (
                    <button
                        onClick={() => setShowModelModal(true)}
                        className="bg-[#2463eb] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                        <PlusIcon /> Add Model
                    </button>
                )}
                {activeTab === 'items' && (
                    <button
                        onClick={() => setShowItemModal(true)}
                        disabled={equipmentModels.length === 0}
                        title={equipmentModels.length === 0 ? 'Add at least one model first' : ''}
                        className="bg-[#2463eb] text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <PlusIcon /> Add Item
                    </button>
                )}
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                {(
                    [
                        { key: 'models', label: 'Models',    Icon: ModelsIcon, count: totalModels },
                        { key: 'items',  label: 'Items',     Icon: ItemsIcon,  count: totalItems  },
                        { key: 'team',   label: 'Team',      Icon: TeamIcon,   count: totalTeam   },
                    ] as const
                ).map(({ key, label, Icon, count }) => (
                    <button
                        key={key}
                        onClick={() => { setActiveTab(key); setSearchQuery(''); setCategoryFilter(''); setStatusFilter(''); }}
                        className={`px-6 py-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
                            activeTab === key
                                ? 'border-[#2463eb] text-[#2463eb]'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <Icon />
                        {label}
                        <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            activeTab === key ? 'bg-[#2463eb]/10 text-[#2463eb]' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>{count}</span>
                    </button>
                ))}
            </div>

            {/* ── Metric Cards ── */}
            {activeTab === 'models' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard label="Total Models" value={totalModels} sub={<><ModelsIcon className="w-4 h-4" /> catalog</>} />
                    <MetricCard label="Total Items" value={totalItems} sub={<><ItemsIcon className="w-4 h-4" /> physical devices</>} />
                    <MetricCard label="Categories" value={uniqueCategories} valueColor="text-[#2463eb]"
                        sub={
                            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 overflow-hidden">
                                <div className="h-full bg-[#2463eb] rounded-full" style={{ width: `${totalModels > 0 ? Math.round((uniqueCategories / Object.keys(CATEGORY_LABELS).length) * 100) : 0}%` }} />
                            </div>
                        }
                    />
                </div>
            )}
            {activeTab === 'items' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard label="Total Items" value={totalItems} sub={<><ItemsIcon className="w-4 h-4" /> catalog</>} />
                    <MetricCard label="Available" value={availableItems} valueColor="text-emerald-600"
                        sub={<><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> ready</>}
                    />
                    <MetricCard label="Deployed" value={deployedItems} valueColor="text-[#2463eb]"
                        sub={
                            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 overflow-hidden">
                                <div className="h-full bg-[#2463eb] rounded-full transition-all duration-500" style={{ width: `${totalItems > 0 ? Math.round((deployedItems / totalItems) * 100) : 0}%` }} />
                            </div>
                        }
                    />
                </div>
            )}
            {activeTab === 'team' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard label="Field Workers" value={totalTeam} sub={<><TeamIcon className="w-4 h-4" /> roster</>} />
                    <MetricCard label="Active" value={activeTeam} valueColor="text-emerald-600"
                        sub={<><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> online</>}
                    />
                    <MetricCard label="With Skills" value={fieldWorkers.filter((fw) => (profileSkillMap[fw.id] || []).length > 0).length} valueColor="text-[#2463eb]"
                        sub={
                            <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2 overflow-hidden">
                                <div className="h-full bg-[#2463eb] rounded-full transition-all duration-500" style={{ width: `${totalTeam > 0 ? Math.round((fieldWorkers.filter((fw) => (profileSkillMap[fw.id] || []).length > 0).length / totalTeam) * 100) : 0}%` }} />
                            </div>
                        }
                    />
                </div>
            )}

            {/* ── Toolbar ── */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={
                            activeTab === 'models' ? 'Search models by name or manufacturer...' :
                            activeTab === 'items'  ? 'Search items by tag, model, S/N, or IP...' :
                            'Search field workers by name, email, or skill...'
                        }
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:ring-2 focus:ring-[#2463eb]/20 focus:border-[#2463eb] focus:outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                    />
                </div>

                {(activeTab === 'models' || activeTab === 'items') && (
                    <div className="flex gap-2">
                        {/* Category Filter */}
                        <div className="relative">
                            <button
                                onClick={() => { setShowCategoryDropdown(!showCategoryDropdown); setShowStatusDropdown(false); }}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                {categoryFilter ? CATEGORY_LABELS[categoryFilter] : 'Category'}
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>
                            {showCategoryDropdown && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-20 py-1">
                                    <button onClick={() => { setCategoryFilter(''); setShowCategoryDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">All</button>
                                    {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((cat) => (
                                        <button key={cat} onClick={() => { setCategoryFilter(cat); setShowCategoryDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer ${categoryFilter === cat ? 'text-[#2463eb] font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                            {CATEGORY_LABELS[cat]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Status Filter — items only */}
                        {activeTab === 'items' && (
                            <div className="relative">
                                <button
                                    onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowCategoryDropdown(false); }}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    {statusFilter ? STATUS_CONFIG[statusFilter].label : 'Status'}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                </button>
                                {showStatusDropdown && (
                                    <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-20 py-1">
                                        <button onClick={() => { setStatusFilter(''); setShowStatusDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">All</button>
                                        {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map((st) => (
                                            <button key={st} onClick={() => { setStatusFilter(st); setShowStatusDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer ${statusFilter === st ? 'text-[#2463eb] font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[st].dot}`} />
                                                {STATUS_CONFIG[st].label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {(categoryFilter || statusFilter) && (
                            <button
                                onClick={() => { setCategoryFilter(''); setStatusFilter(''); }}
                                className="flex items-center gap-1 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                            >
                                <CloseIcon /> Clear
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ─────── MODELS TAB ─────── */}
            {activeTab === 'models' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    {filteredModels.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <ModelsIcon className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                {searchQuery || categoryFilter ? 'No models found' : 'No models yet'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {searchQuery || categoryFilter
                                    ? 'Try adjusting your search or filters.'
                                    : 'Add your first equipment model (e.g. Cisco Catalyst 2960).'}
                            </p>
                            {!searchQuery && !categoryFilter && (
                                <button
                                    onClick={() => setShowModelModal(true)}
                                    className="bg-[#2463eb] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                                >
                                    Add First Model
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Model Name</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Manufacturer</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Category</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Description</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-center">Items</th>
                                        {currentUserRole === 'admin' && (
                                            <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredModels.map((model) => (
                                        <tr key={model.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{model.name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{model.manufacturer}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                                                    {CATEGORY_LABELS[model.category]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">
                                                {model.description || <span className="text-slate-300 dark:text-slate-600 italic">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#2463eb]/10 text-[#2463eb] text-xs font-bold">
                                                    {modelItemCounts[model.id] ?? 0}
                                                </span>
                                            </td>
                                            {currentUserRole === 'admin' && (
                                                <td className="px-6 py-4 text-right">
                                                    <button
                                                        onClick={() => handleDeleteModel(model.id)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                                                        title="Delete model"
                                                    >
                                                        <TrashIcon />
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {filteredModels.length > 0 && (
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 font-medium">
                                Showing {filteredModels.length} of {totalModels} models
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ─────── ITEMS TAB ─────── */}
            {activeTab === 'items' && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    {filteredItems.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <ItemsIcon className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                {searchQuery || categoryFilter || statusFilter ? 'No items found' : 'No items yet'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {searchQuery || categoryFilter || statusFilter
                                    ? 'Try adjusting your search or filters.'
                                    : equipmentModels.length === 0
                                        ? 'Add equipment models first, then register physical items.'
                                        : 'Register your first physical equipment item.'}
                            </p>
                            {!searchQuery && !categoryFilter && !statusFilter && equipmentModels.length > 0 && (
                                <button
                                    onClick={() => setShowItemModal(true)}
                                    className="bg-[#2463eb] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
                                >
                                    Add First Item
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Asset Tag</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Model</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">S/N & IP</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Status</th>
                                        <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">Assigned To</th>
                                        {currentUserRole === 'admin' && (
                                            <th className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 text-right">Actions</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredItems.map((item) => {
                                        const sc = STATUS_CONFIG[item.status];
                                        const assignedName = item.assigned_profile?.full_name || item.assigned_profile?.email;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="px-6 py-4 text-sm font-mono text-[#2463eb] font-semibold">{item.asset_tag}</td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.model?.name ?? '—'}</p>
                                                    <p className="text-xs text-slate-500">{item.model?.manufacturer}</p>
                                                    {item.model?.category && (
                                                        <span className="mt-0.5 inline-block px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-bold text-slate-500 uppercase">
                                                            {CATEGORY_LABELS[item.model.category]}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.serial_number && (
                                                        <p className="text-xs text-slate-600 dark:text-slate-300 font-mono">SN: {item.serial_number}</p>
                                                    )}
                                                    {item.ip_address && (
                                                        <p className="text-xs text-slate-500 font-mono">IP: {item.ip_address}</p>
                                                    )}
                                                    {!item.serial_number && !item.ip_address && (
                                                        <span className="text-sm text-slate-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${sc.bg} ${sc.text}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {assignedName ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-[#2463eb]/10 flex items-center justify-center">
                                                                <span className="text-[#2463eb] text-[10px] font-bold">{assignedName.charAt(0).toUpperCase()}</span>
                                                            </div>
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">{assignedName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">—</span>
                                                    )}
                                                </td>
                                                {currentUserRole === 'admin' && (
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteItem(item.id)}
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                                                            title="Delete item"
                                                        >
                                                            <TrashIcon />
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
                    {filteredItems.length > 0 && (
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500 font-medium">
                                Showing {filteredItems.length} of {totalItems} items
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ─────── TEAM TAB ─────── */}
            {activeTab === 'team' && (
                <div>
                    {filteredTeam.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
                            <div className="mx-auto w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                                <PersonIcon />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                                {searchQuery ? 'No field workers found' : 'No field workers yet'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {searchQuery
                                    ? 'Try adjusting your search.'
                                    : 'Create field worker accounts in User Management to see them here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredTeam.map((worker) => {
                                const workerSkills = profileSkillMap[worker.id] || [];
                                const grouped = getGroupedSkills(worker.id);
                                const certifications  = grouped['certification'] || [];
                                const technicalSkills = grouped['technical']     || [];
                                const generalSkills   = grouped['general']       || [];

                                return (
                                    <div key={worker.id} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
                                        <div className="w-12 h-12 rounded-full bg-[#2463eb]/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[#2463eb] font-bold text-lg">
                                                {(worker.full_name || worker.email).charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{worker.full_name || '—'}</p>
                                                    <p className="text-xs text-slate-500">Field Worker</p>
                                                </div>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${worker.is_active
                                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${worker.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                    {worker.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                                {worker.email && (
                                                    <span className="flex items-center gap-1"><MailIcon />{worker.email}</span>
                                                )}
                                                {worker.phone && (
                                                    <span className="flex items-center gap-1"><PhoneIcon />{worker.phone}</span>
                                                )}
                                            </div>
                                            {workerSkills.length > 0 ? (
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {certifications.map((s) => (
                                                        <span key={s.id} className="px-1.5 py-0.5 bg-[#2463eb]/10 text-[#2463eb] text-[9px] font-bold uppercase rounded">{s.name}</span>
                                                    ))}
                                                    {technicalSkills.map((s) => (
                                                        <span key={s.id} className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase rounded">{s.name}</span>
                                                    ))}
                                                    {generalSkills.map((s) => (
                                                        <span key={s.id} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-bold uppercase rounded">{s.name}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="mt-3 text-[10px] text-slate-400 italic">No skills assigned</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {filteredTeam.length > 0 && (
                        <div className="mt-4 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                            <p className="text-xs text-slate-500 font-medium">Showing {filteredTeam.length} of {totalTeam} field workers</p>
                        </div>
                    )}
                </div>
            )}

            {/* ─────── ADD MODEL MODAL ─────── */}
            {showModelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSubmittingModel && setShowModelModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Equipment Model</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Define a new device model (e.g. Cisco Catalyst 2960)</p>
                            </div>
                            <button onClick={() => !isSubmittingModel && setShowModelModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <CloseIcon />
                            </button>
                        </div>
                        <form onSubmit={handleCreateModel} className="p-6 space-y-5">
                            {modelFormError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{modelFormError}</div>
                            )}
                            <div>
                                <InputLabel required>Model Name</InputLabel>
                                <input type="text" value={newModel.name} onChange={(e) => setNewModel({ ...newModel, name: e.target.value })} placeholder="e.g. Catalyst 2960-X" className={inputCls} required autoFocus />
                            </div>
                            <div>
                                <InputLabel required>Manufacturer</InputLabel>
                                <input type="text" value={newModel.manufacturer} onChange={(e) => setNewModel({ ...newModel, manufacturer: e.target.value })} placeholder="e.g. Cisco" className={inputCls} required />
                            </div>
                            <div>
                                <InputLabel>Category</InputLabel>
                                <select value={newModel.category} onChange={(e) => setNewModel({ ...newModel, category: e.target.value as EquipmentCategory })} className={inputCls + ' cursor-pointer'}>
                                    {(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((cat) => (
                                        <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel>Description</InputLabel>
                                <textarea value={newModel.description} onChange={(e) => setNewModel({ ...newModel, description: e.target.value })} placeholder="Optional notes about this model..." rows={2} className={inputCls + ' resize-none'} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => !isSubmittingModel && setShowModelModal(false)} disabled={isSubmittingModel} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmittingModel} className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                    {isSubmittingModel ? <span className="flex items-center gap-2"><SpinnerIcon /> Saving...</span> : 'Add Model'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─────── ADD ITEM MODAL ─────── */}
            {showItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isSubmittingItem && setShowItemModal(false)} />
                    <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Equipment Item</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Register a specific physical device</p>
                            </div>
                            <button onClick={() => !isSubmittingItem && setShowItemModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                <CloseIcon />
                            </button>
                        </div>
                        <form onSubmit={handleCreateItem} className="p-6 space-y-5">
                            {itemFormError && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">{itemFormError}</div>
                            )}
                            <div>
                                <InputLabel required>Model</InputLabel>
                                <select value={newItem.model_id} onChange={(e) => setNewItem({ ...newItem, model_id: e.target.value })} className={inputCls + ' cursor-pointer'} required autoFocus>
                                    <option value="">Select a model...</option>
                                    {equipmentModels.map((m) => (
                                        <option key={m.id} value={m.id}>{m.manufacturer} {m.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel required>Asset Tag</InputLabel>
                                <input type="text" value={newItem.asset_tag} onChange={(e) => setNewItem({ ...newItem, asset_tag: e.target.value })} placeholder="e.g. AST-2960-01" className={inputCls} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <InputLabel>Serial Number</InputLabel>
                                    <input type="text" value={newItem.serial_number} onChange={(e) => setNewItem({ ...newItem, serial_number: e.target.value })} placeholder="e.g. FOX2401W0XX" className={inputCls} />
                                </div>
                                <div>
                                    <InputLabel>IP Address</InputLabel>
                                    <input type="text" value={newItem.ip_address} onChange={(e) => setNewItem({ ...newItem, ip_address: e.target.value })} placeholder="e.g. 192.168.1.10" className={inputCls} />
                                </div>
                            </div>
                            <div>
                                <InputLabel>Status</InputLabel>
                                <select value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value as EquipmentStatus })} className={inputCls + ' cursor-pointer'}>
                                    {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map((st) => (
                                        <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <InputLabel>Notes</InputLabel>
                                <textarea value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Optional notes about this device..." rows={2} className={inputCls + ' resize-none'} />
                            </div>
                            <div>
                                <InputLabel>Assign To</InputLabel>
                                <select value={newItem.assigned_to} onChange={(e) => setNewItem({ ...newItem, assigned_to: e.target.value })} className={inputCls + ' cursor-pointer'}>
                                    <option value="">Unassigned</option>
                                    {allProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => !isSubmittingItem && setShowItemModal(false)} disabled={isSubmittingItem} className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">Cancel</button>
                                <button type="submit" disabled={isSubmittingItem} className="px-6 py-2.5 bg-[#2463eb] text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                                    {isSubmittingItem ? <span className="flex items-center gap-2"><SpinnerIcon /> Adding...</span> : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────── MetricCard helper ─────────────── */

function MetricCard({
    label,
    value,
    valueColor = 'text-slate-900 dark:text-white',
    sub,
}: {
    label: string;
    value: number;
    valueColor?: string;
    sub: React.ReactNode;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
            <div className="flex items-end justify-between">
                <h3 className={`text-3xl font-bold ${valueColor}`}>{value}</h3>
                <div className="flex items-center gap-1 text-xs text-slate-400 pb-1">{sub}</div>
            </div>
        </div>
    );
}
