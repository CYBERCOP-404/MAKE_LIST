
export type View = 'AUTH' | 'DASHBOARD' | 'ADMIN' | 'EDITOR';
export type AuthMode = 'login' | 'register' | 'forgot' | 'admin_login';

export interface SavedList {
  id: string;
  name: string;
  timestamp: number;
  data: TableRow[];
}

export interface User {
  fullName: string;
  email: string;
  username: string;
  password?: string;
  phone?: string;
  profilePic?: string;
  isActive: boolean;
  role: 'user' | 'admin';
  notifications: string[];
  activityLog: ActivityLog[];
  savedLists?: SavedList[];
}

export interface ActivityLog {
  action: string;
  timestamp: number;
}

export interface Report {
  id: string;
  username: string;
  phone: string;
  message: string;
  timestamp: number;
  status: 'pending' | 'resolved';
}

export interface TableRow {
  id: number;
  name: string;
  group: string;
  skill: string;
}
