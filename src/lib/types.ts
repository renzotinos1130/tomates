/**
 * Domain model for Team Tomate HQ.
 *
 * Field names intentionally mirror the Postgres columns (snake_case) so rows
 * coming from Supabase (REST or Realtime) can be stored as-is, without a
 * mapping layer. See `supabase/migrations` for the source of truth.
 */

export type ID = string;
/** ISO-8601 timestamp, e.g. `2026-11-11T14:03:00.000Z`. */
export type Timestamp = string;
/** Calendar date without time, `YYYY-MM-DD` (local to the team). */
export type DateOnly = string;

export type TaskStatus = "todo" | "in_progress" | "review" | "blocked" | "done";
export type TaskPriority = "high" | "normal" | "low";
export type MemberRole = "admin" | "member";
export type MeetingStatus = "planned" | "live" | "closed";
export type MeetingItemKind = "decision" | "topic";

export type MemberColor =
  | "teal"
  | "amber"
  | "indigo"
  | "rose"
  | "sky"
  | "violet"
  | "emerald"
  | "orange"
  | "slate";

export interface Member {
  id: ID;
  email: string;
  full_name: string;
  color: MemberColor;
  avatar_url: string | null;
  role: MemberRole;
  active: boolean;
  created_at: Timestamp;
}

export interface MemberInvite {
  email: string;
  role: MemberRole;
  invited_by: ID | null;
  created_at: Timestamp;
}

export interface Project {
  id: ID;
  slug: string;
  name: string;
  description: string;
  color: MemberColor;
  icon: ProjectIcon;
  position: number;
  archived_at: Timestamp | null;
  created_at: Timestamp;
  created_by: ID | null;
}

export type ProjectIcon =
  | "smartphone"
  | "globe"
  | "megaphone"
  | "folder"
  | "palette"
  | "rocket"
  | "chart"
  | "users"
  | "book";

export interface Task {
  id: ID;
  project_id: ID;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id: ID | null;
  due_date: DateOnly | null;
  /** Manual ordering inside a status column (fractional index). */
  position: number;
  /** Meeting during which the task was created, if any. */
  meeting_id: ID | null;
  created_by: ID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  /** Last time `status` changed — used to detect tasks that did not move. */
  status_changed_at: Timestamp;
  completed_at: Timestamp | null;
  archived_at: Timestamp | null;
}

export interface Subtask {
  id: ID;
  task_id: ID;
  title: string;
  done: boolean;
  position: number;
  created_at: Timestamp;
}

export interface Comment {
  id: ID;
  task_id: ID;
  author_id: ID | null;
  body: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export type TaskEventKind =
  | "created"
  | "status"
  | "priority"
  | "assignee"
  | "due_date"
  | "title"
  | "project"
  | "archived"
  | "unarchived"
  | "commented";

export interface TaskEvent {
  id: ID;
  task_id: ID;
  project_id: ID;
  actor_id: ID | null;
  kind: TaskEventKind;
  /** Previous value (status, priority, member id, date, title…). */
  old_value: string | null;
  /** New value. For `commented`, the comment id. */
  new_value: string | null;
  created_at: Timestamp;
}

export interface Meeting {
  id: ID;
  /** Wednesday that starts the Wed → Tue week this meeting belongs to. */
  week_start: DateOnly;
  status: MeetingStatus;
  started_at: Timestamp | null;
  ended_at: Timestamp | null;
  started_by: ID | null;
  attendees: ID[];
  notes: string;
  /** Frozen recap written when the meeting is closed (history). */
  summary: MeetingSummary | null;
  created_at: Timestamp;
}

export interface MeetingItem {
  id: ID;
  meeting_id: ID;
  kind: MeetingItemKind;
  body: string;
  project_id: ID | null;
  author_id: ID | null;
  /** Topic discussed / decision acted upon. */
  done: boolean;
  position: number;
  created_at: Timestamp;
}

export interface MeetingPriority {
  meeting_id: ID;
  task_id: ID;
  position: number;
  created_by: ID | null;
  created_at: Timestamp;
}

/** Task snapshot stored in a meeting recap (stable even if the task changes later). */
export interface SummaryTask {
  id: ID;
  title: string;
  project_id: ID;
  project_name: string;
  assignee_id: ID | null;
  assignee_name: string | null;
  due_date: DateOnly | null;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface MeetingSummary {
  version: 1;
  since: Timestamp;
  closed_at: Timestamp;
  duration_minutes: number | null;
  completed: SummaryTask[];
  created: SummaryTask[];
  priorities: SummaryTask[];
  blocked: SummaryTask[];
  decisions: { id: ID; body: string; project_id: ID | null }[];
  open_topics: { id: ID; body: string; project_id: ID | null }[];
  attendees: { id: ID; name: string }[];
}

/** Everything the client keeps in memory. */
export interface Snapshot {
  members: Member[];
  invites: MemberInvite[];
  projects: Project[];
  tasks: Task[];
  subtasks: Subtask[];
  comments: Comment[];
  task_events: TaskEvent[];
  meetings: Meeting[];
  meeting_items: MeetingItem[];
  meeting_priorities: MeetingPriority[];
}

export type TableName = keyof Snapshot;

export type RowOf<T extends TableName> = Snapshot[T][number];
