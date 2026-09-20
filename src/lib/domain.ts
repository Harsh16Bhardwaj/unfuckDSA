export type Difficulty = "easy" | "medium" | "hard";
export type Priority = "normal" | "high";
export type SessionStatus =
  | "solved_independently"
  | "solved_with_hints"
  | "stuck"
  | "stopped";
export type ReviewOutcome = "again" | "hard" | "good" | "easy";
export type DayMode = "balanced" | "revision-heavy" | "catch-up" | "manual";
export type SlotKind = "busy" | "dsa" | "dev";
export type SprintKind = "solve" | "recall";
export type TimerStatus = "idle" | "running" | "paused" | "ending";
export type ScheduleTemplate = "default" | "relaxed" | "custom";

export interface Problem {
  id: string;
  source: "leetcode" | "manual";
  slug: string;
  title: string;
  url?: string;
  topics: string[];
  difficulty: Difficulty;
  priority: Priority;
  revisionMinutes: 10 | 20 | 30;
  scheduleTemplate: ScheduleTemplate;
  customIntervals?: number[];
  approach?: string;
  blocker?: string;
  hint?: string;
  notes?: string;
  needsVisual: boolean;
  initialMinutes: number;
  reviewStage: number;
  dueAt: string;
  lastOutcome?: ReviewOutcome;
  status: SessionStatus;
  revealCount: number;
  createdAt: string;
}

export interface StudySession {
  blocker?: string;
  approach?: string;
  hint?: string;
  id: string;
  problemId: string;
  startedAt: string;
  endedAt?: string;
  activeMinutes: number;
  pausedMinutes: number;
  status?: SessionStatus;
  code?: string;
  idempotencyKey: string;
}

export interface TimerSession {
  status: TimerStatus;
  problemTitle: string;
  problemUrl: string;
  startedAt?: number;
  segmentStartedAt?: number;
  accumulatedMs: number;
  capturedCode?: string;
  captureId?: string;
}

export interface CalendarSlot {
  id: string;
  startsAt: string;
  kind: SlotKind;
  label?: string;
}

export interface ScheduledReview {
  id: string;
  problemId: string;
  slotId: string;
  minutes: number;
  priorityScore: number;
  reason: string[];
  status: "planned" | "completed" | "missed" | "removed";
  compressedFrom?: number;
  pinned?: boolean;
}

export interface FocusSprint {
  id: string;
  name: string;
  topic: string;
  startsOn: string;
  endsOn: string;
  targetBlocks: number;
  completedBlocks: number;
  recallBias: number;
  active: boolean;
}

export interface ReviewAttempt {
  code?: string;
  blocker?: string;
  id: string;
  problemId: string;
  completedAt: string;
  outcome: ReviewOutcome;
  activeMinutes: number;
  hintRevealed: boolean;
  approachRevealed: boolean;
  rubric: {
    recognition: number;
    invariant: number;
    implementation: number;
    complexity: number;
    edgeCases: number;
    explanation: number;
  };
}

export interface ContestSession {
  id: string;
  title: string;
  startsAt: string;
  kind: "live" | "virtual";
  completed: boolean;
  solved: number;
}

export interface WeeklyTask {
  id: string;
  title: string;
  durationHours: number;
  sessionsPerWeek: number;
  color: string;
  createdAt: string;
}

export interface WeeklyTaskPlacement {
  id: string;
  taskId: string;
  dayKey: string;
  startHour: number;
  durationHours: number;
}

export interface AppState {
  recurringAvailability?: Array<{ weekday: number; hour: number; kind: SlotKind; startsOn: string }>;
  availabilityExceptions?: string[];
  revealEvents?: Array<{ id: string; problemId: string; at: string; kind: "hint" | "approach" }>;
  dailyTargetMinutes: number;
  dayMode: DayMode;
  manualRecallBlocks: number;
  problems: Problem[];
  sessions: StudySession[];
  slots: CalendarSlot[];
  scheduled: ScheduledReview[];
  focusSprints: FocusSprint[];
  reviews: ReviewAttempt[];
  contests: ContestSession[];
  sprintDays: Record<string, SprintKind>;
  weeklyTasks: WeeklyTask[];
  weeklyTaskPlacements: WeeklyTaskPlacement[];
}

export const DEFAULT_INTERVALS = [1, 3, 7, 14, 30, 60] as const;
export const RELAXED_INTERVALS = [2, 6, 15, 30, 60] as const;
