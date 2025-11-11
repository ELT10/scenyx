export interface VideoStatus {
  video_id: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  model?: string;
  created_at?: number;
  seconds?: string;
  size?: string;
  video_data?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface Thread {
  id: number;
  title: string;
  description: string;
}

export interface ArchiveItem {
  video_id: string;
  model: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  seconds?: string | null;
  created_at: string;
  source: 'replicate' | 'openai';
  expiresAt: string; // ISO
  remainingHours: number;
  video_url?: string | null;
}


