export interface Task {
  id: string;
  user_id: string;
  title: string;
  category: string;
  deadline: string | null;
  estimated_effort: number; // in minutes
  calibrated_effort: number; // in minutes
  importance: number; // 1 to 5
  status: string; // "todo", "done"
  postponements: number;
  priority_score: number;
  explanation: string;
  created_at: string;
  google_event_id?: string;
  google_meet_link?: string;
  google_drive_attachment?: { name: string; url: string };
}

export interface ParsedTaskResult {
  title: string;
  deadline: string | null;
  estimated_effort: number; // in minutes
  category: string;
}
