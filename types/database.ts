export type UserRole = 'admin' | 'project_manager' | 'field_worker';

export type ProjectStatus = 'draft' | 'planning' | 'active' | 'completed' | 'cancelled';

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export type EquipmentStatus = 'available' | 'deployed' | 'maintenance' | 'retired';

export type EquipmentCategory = 'networking' | 'server' | 'wireless' | 'security' | 'cabling' | 'power' | 'audio_video' | 'other';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    phone: string | null;
    avatar_url: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: string;
    name: string;
    description: string;
    location: string;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface TaskGroup {
    id: string;
    project_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface ProjectTask {
    id: string;
    project_id: string;
    group_id: string | null;
    name: string;
    description: string;
    estimated_hours: number;
    priority: TaskPriority;
    status: TaskStatus;
    skills_required: string[];
    equipment_needed: string[];
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface EquipmentModel {
    id: string;
    name: string;
    manufacturer: string;
    category: EquipmentCategory;
    description: string;
    created_at: string;
    updated_at: string;
    // virtual / joined
    item_count?: number;
}

export interface Equipment {
    id: string;
    model_id: string;
    asset_tag: string;
    serial_number: string | null;
    ip_address: string;
    status: EquipmentStatus;
    notes: string;
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
    // joined fields
    model?: EquipmentModel;
    assigned_profile?: Profile;
}

export interface TeamMember {
    id: string;
    profile_id: string | null;
    full_name: string;
    job_title: string;
    phone: string;
    email: string;
    skills: string[];
    certifications: string[];
    is_available: boolean;
    notes: string;
    created_at: string;
    updated_at: string;
}

export interface Skill {
    id: string;
    name: string;
    category: string;
    created_at: string;
}

export interface ProfileSkill {
    id: string;
    profile_id: string;
    skill_id: string;
    created_at: string;
    skill?: Skill;
}

export interface ProjectSchedule {
    id: string;
    project_id: string;
    generated_at: string;
    generated_by: string | null;
    has_gaps: boolean;
    notes: string;
    created_at: string;
}

export interface ScheduleEntry {
    id: string;
    schedule_id: string;
    task_id: string;
    assigned_workers: { id: string; name: string; job_title: string }[];
    assigned_equipment: { id: string; asset_tag: string; model_name: string }[];
    missing_skills: string[];
    missing_equipment: string[];
    has_gap: boolean;
    created_at: string;
}
