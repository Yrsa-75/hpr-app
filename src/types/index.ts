export * from './database';

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'member' | 'client_viewer';
  organization_id: string | null;
}

// Form types
export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  email: string;
  password: string;
  full_name: string;
  organization_name: string;
}

// API response types
export interface ApiResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

// Dashboard KPI types
export interface DashboardKPIs {
  activeCampaigns: number;
  emailsSentThisWeek: number;
  averageOpenRate: number;
  clippingsThisMonth: number;
}

// Campaign status display
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  preparing: 'En préparation',
  review: 'En révision',
  approved: 'Approuvé',
  sending: 'En cours d\'envoi',
  active: 'Actif',
  paused: 'En pause',
  completed: 'Terminé',
  archived: 'Archivé',
};

export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: 'text-gray-400',
  preparing: 'text-blue-400',
  review: 'text-yellow-400',
  approved: 'text-green-400',
  sending: 'text-purple-400',
  active: 'text-green-500',
  paused: 'text-orange-400',
  completed: 'text-gray-500',
  archived: 'text-gray-600',
};

// Media type labels
export const MEDIA_TYPE_LABELS: Record<string, string> = {
  presse_ecrite: 'Presse écrite',
  tv: 'Télévision',
  radio: 'Radio',
  web: 'Web',
  podcast: 'Podcast',
  blog: 'Blog',
  influenceur: 'Influenceur',
};
