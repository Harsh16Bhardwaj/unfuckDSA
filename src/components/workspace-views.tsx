"use client";

import {
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Clock3,
  Eraser,
  ExternalLink,
  KeyRound,
  Lightbulb,
  LogOut,
  Lock,
  Plus,
  GripVertical,
  Search,
  Redo2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type {
  AppState,
  CalendarSlot,
  Problem,
  SlotKind,
  SprintKind,
} from "@/lib/domain";
import { getWeeklyTaskPlacement, WEEKLY_TASK_HOURS } from "@/lib/weekly-tasks";
import {
  copyPreviousWeek,
  isPastCalendarCell,
  isPastCalendarDay,
  materializeAvailability,
  occupiedTaskCells,
  moveAvailability,
} from "@/lib/calendar-pattern";
import { ProblemHistory } from "./problem-history";
import { ChangePassword } from "./change-password";
import { createSchedule } from "@/lib/scheduler";

type UpdateState = (
  recipe: (current: AppState) => AppState,
  shouldReplan?: boolean,
) => void;

const isoDay = (date: Date) => date.toLocaleDateString("en-CA");
const addDays = (date: Date, days: number) => {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
};

const STUDY_HOURS = WEEKLY_TASK_HOURS;

function hourLabel(hour: number) {
  const normalized = hour % 24;
  return new Date(2020, 1, 1, normalized).toLocaleTimeString([], {
    hour: "numeric",
  });
}

export function CalendarView({
  state,
  updateState: persistState,
}: {
  state: AppState;
  updateState: UpdateState;
}) {
  type Snapshot = Pick<
    AppState,
    | "slots"
    | "weeklyTaskPlacements"
    | "sprintDays"
    | "recurringAvailability"
    | "availabilityExceptions"
  >;
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
  const [calendarNotice, setCalendarNotice] = useState("");
  const [calendarNow, setCalendarNow] = useState(() => Date.now());
  const lastPlacementTap = useRef<{ id: string; at: number } | null>(null);
  const snapshot = (value: AppState): Snapshot => ({
    slots: value.slots,
    weeklyTaskPlacements: value.weeklyTaskPlacements,
    sprintDays: value.sprintDays,
    recurringAvailability: value.recurringAvailability,
    availabilityExceptions: value.availabilityExceptions,
  });
  const updateState: UpdateState = (recipe, replan) => {
    undoStack.current = [...undoStack.current.slice(-49), snapshot(state)];
    redoStack.current = [];
    persistState(recipe, replan);
    setHistoryCounts({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  };
  function historicalFingerprint(value: Snapshot) {
    return JSON.stringify({
      slots: value.slots
        .filter((slot) =>
          isPastCalendarCell(slot.id.replace(/^slot-/, ""), calendarNow),
        )
        .map((slot) => `${slot.id}:${slot.kind}`)
        .sort(),
      placements: (value.weeklyTaskPlacements ?? [])
        .filter((placement) =>
          isPastCalendarCell(
            `${placement.dayKey}-${String(placement.startHour).padStart(2, "0")}`,
            calendarNow,
          ),
        )
        .map(
          (placement) =>
            `${placement.id}:${placement.taskId}:${placement.dayKey}:${placement.startHour}:${placement.durationHours}`,
        )
        .sort(),
      days: Object.entries(value.sprintDays ?? {})
        .filter(([day]) => isPastCalendarDay(day, calendarNow))
        .sort(),
    });
  }
  function travelHistory(redo: boolean) {
    const source = redo ? redoStack : undoStack;
    const target = redo ? undoStack : redoStack;
    const previous = source.current.pop();
    if (!previous) return;
    if (
      historicalFingerprint(previous) !== historicalFingerprint(snapshot(state))
    ) {
      source.current.push(previous);
      setCalendarNotice("Past calendar history is locked.");
      return;
    }
    target.current.push(snapshot(state));
    persistState((current) => {
      const restored = { ...current, ...previous };
      return {
        ...restored,
        scheduled: createSchedule({
          problems: restored.problems,
          slots: restored.slots,
          mode: restored.dayMode,
          manualRecallBlocks: restored.manualRecallBlocks,
        }),
      };
    });
    setHistoryCounts({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  }
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileDayIndex, setMobileDayIndex] = useState(
    () => (new Date().getDay() + 6) % 7,
  );
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [invalidTaskId, setInvalidTaskId] = useState<string | null>(null);
  const [movingPlacementId, setMovingPlacementId] = useState<string | null>(
    null,
  );
  const [movingSlotKey, setMovingSlotKey] = useState<string | null>(null);
  const paintMode = useRef<"select" | "remove" | null>(null);
  const weekStart = addDays(new Date(), weekOffset * 7);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays(weekStart, index),
  );
  const mobileDay = days[mobileDayIndex];
  const mobileDayKey = isoDay(mobileDay);
  const slotMap = new Map(
    state.slots.map((slot) => [slot.id.replace(/^slot-/, ""), slot]),
  );
  const taskMap = new Map(
    (state.weeklyTasks ?? []).map((task) => [task.id, task]),
  );
  const placementCellMap = useMemo(() => {
    const result = new Map<
      string,
      { placementId: string; taskId: string; first: boolean }
    >();
    for (const placement of state.weeklyTaskPlacements ?? []) {
      for (let offset = 0; offset < placement.durationHours; offset += 1) {
        result.set(
          `${placement.dayKey}-${String(placement.startHour + offset).padStart(2, "0")}`,
          {
            placementId: placement.id,
            taskId: placement.taskId,
            first: offset === 0,
          },
        );
      }
    }
    return result;
  }, [state.weeklyTaskPlacements]);
  const displayedDays = new Set(days.map(isoDay));
  const displayedCounts = new Map<string, number>();
  for (const placement of state.weeklyTaskPlacements ?? [])
    if (displayedDays.has(placement.dayKey))
      displayedCounts.set(
        placement.taskId,
        (displayedCounts.get(placement.taskId) ?? 0) + 1,
      );
  const movingPlacement = state.weeklyTaskPlacements.find(
    (p) => p.id === movingPlacementId,
  );
  const activeTask = taskMap.get(
    movingPlacement?.taskId ?? draggingTaskId ?? selectedTaskId ?? "",
  );
  const displayedStart = isoDay(days[0]);
  const weekHasEditableCells = days.some((day) =>
    STUDY_HOURS.some(
      (hour) =>
        !isPastCalendarCell(
          `${isoDay(day)}-${String(hour).padStart(2, "0")}`,
          calendarNow,
        ),
    ),
  );
  useEffect(() => {
    persistState(
      (current) =>
        materializeAvailability(
          current,
          new Date(`${displayedStart}T00:00:00`),
          21,
        ),
      true,
    );
  }, [displayedStart, persistState]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      setCalendarNow(now);
      setSelectedCells(
        (current) =>
          new Set([...current].filter((key) => !isPastCalendarCell(key, now))),
      );
      setSelectedDays(
        (current) =>
          new Set([...current].filter((day) => !isPastCalendarDay(day, now))),
      );
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  function repeatSelection() {
    const selected = state.slots.filter(
      (slot) =>
        selectedCells.has(slot.id.slice(5)) &&
        !isPastCalendarCell(slot.id.slice(5), calendarNow),
    );
    if (!selected.length) {
      setCalendarNotice("Select painted hours first.");
      return;
    }
    updateState((current) => {
      const patterns = new Map(
        (current.recurringAvailability ?? []).map((p) => [
          `${p.weekday}-${p.hour}`,
          p,
        ]),
      );
      for (const slot of selected) {
        const key = slot.id.slice(5);
        const day = key.slice(0, -3);
        const weekday = new Date(`${day}T00:00:00`).getDay();
        const hour = Number(key.slice(-2));
        patterns.set(`${weekday}-${hour}`, {
          weekday,
          hour,
          kind: slot.kind,
          startsOn: day,
        });
      }
      return materializeAvailability(
        { ...current, recurringAvailability: [...patterns.values()] },
        days[0],
        21,
      );
    }, true);
    setCalendarNotice(
      `${selected.length} hours repeat weekly. Existing bookings are preserved.`,
    );
  }

  function placementKeys(taskId: string, startKey: string) {
    const task = taskMap.get(taskId);
    if (!task || isPastCalendarCell(startKey, calendarNow)) return null;
    const occupied = new Set([
      ...slotMap.keys(),
      ...[...placementCellMap]
        .filter(([, p]) => p.placementId !== movingPlacementId)
        .map(([key]) => key),
    ]);
    const placement = getWeeklyTaskPlacement(task, startKey, occupied);
    return placement ? { ...placement, day: placement.dayKey, task } : null;
  }

  function rejectPlacement(taskId: string) {
    setInvalidTaskId(taskId);
    setCalendarNotice(
      "That session needs consecutive empty hours within this day.",
    );
    window.setTimeout(
      () =>
        setInvalidTaskId((current) => (current === taskId ? null : current)),
      520,
    );
  }

  function placeTask(taskId: string, startKey: string) {
    if (isPastCalendarCell(startKey, calendarNow)) {
      setCalendarNotice("Past hours are locked.");
      return;
    }
    const placement = placementKeys(taskId, startKey);
    if (!placement) return rejectPlacement(taskId);
    const placedCount = displayedCounts.get(taskId) ?? 0;
    if (!movingPlacement && placedCount >= placement.task.sessionsPerWeek)
      return rejectPlacement(taskId);
    updateState((current) => {
      const currentTask = (current.weeklyTasks ?? []).find(
        (task) => task.id === taskId,
      );
      if (!currentTask) return current;
      const currentWeekDays = new Set(days.map(isoDay));
      const retained = current.weeklyTaskPlacements.filter(
        (item) => item.id !== movingPlacementId,
      );
      const currentCount = retained.filter(
        (item) => item.taskId === taskId && currentWeekDays.has(item.dayKey),
      ).length;
      const occupied = new Set(
        current.slots.map((slot) => slot.id.replace(/^slot-/, "")),
      );
      for (const item of retained)
        for (let offset = 0; offset < item.durationHours; offset += 1)
          occupied.add(
            `${item.dayKey}-${String(item.startHour + offset).padStart(2, "0")}`,
          );
      const checked = getWeeklyTaskPlacement(currentTask, startKey, occupied);
      if (!checked || currentCount >= currentTask.sessionsPerWeek)
        return current;
      return {
        ...current,
        weeklyTaskPlacements: [
          ...retained,
          {
            id: movingPlacementId ?? crypto.randomUUID(),
            taskId,
            dayKey: checked.dayKey,
            startHour: checked.startHour,
            durationHours: currentTask.durationHours,
          },
        ],
      };
    });
    setSelectedTaskId(null);
    setMovingPlacementId(null);
    setHoveredCell(null);
  }

  function removePlacement(placementId: string) {
    const placement = state.weeklyTaskPlacements.find(
      (item) => item.id === placementId,
    );
    if (
      placement &&
      isPastCalendarCell(
        `${placement.dayKey}-${String(placement.startHour).padStart(2, "0")}`,
        calendarNow,
      )
    ) {
      setCalendarNotice("Past bookings are locked.");
      return;
    }
    updateState((current) => ({
      ...current,
      weeklyTaskPlacements: (current.weeklyTaskPlacements ?? []).filter(
        (item) => item.id !== placementId,
      ),
    }));
  }

  function startMovingPlacement(placementId: string) {
    const placement = state.weeklyTaskPlacements.find(
      (item) => item.id === placementId,
    );
    if (!placement) return;
    if (
      isPastCalendarCell(
        `${placement.dayKey}-${String(placement.startHour).padStart(2, "0")}`,
        calendarNow,
      )
    ) {
      setCalendarNotice("Past bookings are locked.");
      return;
    }
    setMovingSlotKey(null);
    setMovingPlacementId(placementId);
    setCalendarNotice(
      `${taskMap.get(placement.taskId)?.title ?? "Weekly task"}: choose a new start hour.`,
    );
  }

  function requestPlacementPickup(placementId: string, occurredAt: number) {
    const previous = lastPlacementTap.current;
    if (previous?.id === placementId && occurredAt - previous.at < 500) {
      lastPlacementTap.current = null;
      startMovingPlacement(placementId);
      return;
    }
    lastPlacementTap.current = { id: placementId, at: occurredAt };
    setCalendarNotice("Double tap the booking to pick it up.");
  }

  function onTaskDragStart(
    event: DragEvent<HTMLButtonElement>,
    taskId: string,
  ) {
    if (window.matchMedia("(max-width: 700px)").matches) {
      event.preventDefault();
      return;
    }
    setMovingPlacementId(null);
    setMovingSlotKey(null);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  }

  useEffect(() => {
    const stopPainting = () => {
      paintMode.current = null;
    };
    window.addEventListener("pointerup", stopPainting);
    window.addEventListener("pointercancel", stopPainting);
    return () => {
      window.removeEventListener("pointerup", stopPainting);
      window.removeEventListener("pointercancel", stopPainting);
    };
  }, []);

  function toggleCell(key: string) {
    setSelectedCells((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function beginPainting(key: string) {
    paintMode.current = selectedCells.has(key) ? "remove" : "select";
    toggleCell(key);
  }

  function paintCell(key: string) {
    if (!paintMode.current) return;
    setSelectedCells((current) => {
      const next = new Set(current);
      if (paintMode.current === "select") next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleHour(hour: number) {
    const keys = days
      .map((day) => `${isoDay(day)}-${String(hour).padStart(2, "0")}`)
      .filter((key) => !isPastCalendarCell(key, calendarNow));
    if (!keys.length) {
      setCalendarNotice("Past hours are locked.");
      return;
    }
    setSelectedCells((current) => {
      const next = new Set(current);
      const remove = keys.every((key) => next.has(key));
      keys.forEach((key) => (remove ? next.delete(key) : next.add(key)));
      return next;
    });
  }

  function toggleHourForCurrentView(hour: number) {
    if (window.matchMedia("(max-width: 700px)").matches) {
      const key = `${mobileDayKey}-${String(hour).padStart(2, "0")}`;
      if (isPastCalendarCell(key, calendarNow)) {
        setCalendarNotice("Past hours are locked.");
        return;
      }
      toggleCell(key);
      return;
    }
    toggleHour(hour);
  }

  function selectDayPreset(preset: "weekdays" | "all" | "clear") {
    if (preset === "clear") return setSelectedDays(new Set());
    setSelectedDays(
      new Set(
        days
          .filter(
            (day, index) =>
              !isPastCalendarDay(isoDay(day), calendarNow) &&
              (preset === "all" || index < 5),
          )
          .map(isoDay),
      ),
    );
  }

  function toggleDay(dayKey: string) {
    if (isPastCalendarDay(dayKey, calendarNow)) {
      setCalendarNotice("Past days are locked.");
      return;
    }
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  }

  function applyCells(kind?: SlotKind) {
    updateState((current) => {
      const occupied = occupiedTaskCells(current);
      const editableCells = new Set(
        [...selectedCells].filter(
          (key) => !occupied.has(key) && !isPastCalendarCell(key, calendarNow),
        ),
      );
      const untouched = current.slots.filter(
        (slot) => !editableCells.has(slot.id.replace(/^slot-/, "")),
      );
      const availabilityExceptions = [
        ...new Set([
          ...(current.availabilityExceptions ?? []),
          ...editableCells,
        ]),
      ];
      if (!kind)
        return { ...current, slots: untouched, availabilityExceptions };
      const additions: CalendarSlot[] = [...editableCells].map((key) => {
        const hour = Number(key.slice(-2));
        const dayKey = key.slice(0, -3);
        const startsAt = new Date(`${dayKey}T00:00:00`);
        startsAt.setHours(hour, 0, 0, 0);
        return { id: `slot-${key}`, startsAt: startsAt.toISOString(), kind };
      });
      return {
        ...current,
        slots: [...untouched, ...additions],
        availabilityExceptions,
      };
    }, true);
    setSelectedCells(new Set());
  }

  function applySprint(kind?: SprintKind) {
    updateState((current) => {
      const sprintDays = { ...(current.sprintDays ?? {}) };
      selectedDays.forEach((day) => {
        if (isPastCalendarDay(day, calendarNow)) return;
        if (kind) sprintDays[day] = kind;
        else delete sprintDays[day];
      });
      return { ...current, sprintDays };
    }, true);
    setSelectedDays(new Set());
  }

  function moveHour(source: string, target: string) {
    if (
      isPastCalendarCell(source, calendarNow) ||
      isPastCalendarCell(target, calendarNow)
    ) {
      setCalendarNotice("Past hours are locked.");
      return;
    }
    if (moveAvailability(state, source, target, calendarNow) === state) {
      setCalendarNotice("Choose an empty hour to move this block.");
      return;
    }
    updateState(
      (current) => moveAvailability(current, source, target, calendarNow),
      true,
    );
    setMovingSlotKey(null);
    setSelectedCells(new Set());
    setCalendarNotice("Hour moved. Undo is available.");
  }

  function changeWeek(offset: number) {
    setWeekOffset(offset);
    setMobileDayIndex(offset === 0 ? (new Date().getDay() + 6) % 7 : 0);
    setSelectedCells(new Set());
    setSelectedDays(new Set());
    setMovingSlotKey(null);
    setMovingPlacementId(null);
    setCalendarNotice("");
  }

  function changeMobileDay(direction: -1 | 1) {
    const next = mobileDayIndex + direction;
    if (next < 0) {
      setWeekOffset((current) => current - 1);
      setMobileDayIndex(6);
    } else if (next > 6) {
      setWeekOffset((current) => current + 1);
      setMobileDayIndex(0);
    } else {
      setMobileDayIndex(next);
    }
    setSelectedCells(new Set());
    setMovingSlotKey(null);
    setMovingPlacementId(null);
    setCalendarNotice("");
  }

  function activateCell(
    key: string,
    slot: CalendarSlot | undefined,
    placed: { placementId: string; taskId: string; first: boolean } | undefined,
    occurredAt: number,
  ) {
    if (isPastCalendarCell(key, calendarNow)) {
      setCalendarNotice("Past hours are locked.");
      return;
    }
    if (movingSlotKey && !slot && !placed) {
      moveHour(movingSlotKey, key);
      return;
    }
    if (placed) {
      requestPlacementPickup(placed.placementId, occurredAt);
      return;
    }
    if (movingPlacement) placeTask(movingPlacement.taskId, key);
    else if (selectedTaskId) placeTask(selectedTaskId, key);
    else toggleCell(key);
  }

  return (
    <div className="page-stack calendar-page">
      {movingSlotKey && (
        <div className="calendar-tools" role="status">
          <span>Choose an empty hour for this block.</span>
          <button
            className="text-button"
            onClick={() => setMovingSlotKey(null)}
          >
            Cancel move
          </button>
        </div>
      )}
      {movingPlacement && (
        <div className="calendar-tools" role="status">
          <span>
            {taskMap.get(movingPlacement.taskId)?.title}: choose a new start
            hour
          </span>
          <button
            className="text-button"
            onClick={() => setMovingPlacementId(null)}
          >
            Cancel move
          </button>
          <button
            className="text-button"
            onClick={() => {
              removePlacement(movingPlacement.id);
              setMovingPlacementId(null);
            }}
          >
            Remove booking
          </button>
        </div>
      )}
      <div className="calendar-tools">
        <button
          className="secondary-button compact"
          disabled={!selectedCells.size}
          onClick={repeatSelection}
        >
          Repeat selected weekly
        </button>
        {!!state.recurringAvailability?.length && (
          <button
            className="text-button"
            onClick={() => {
              updateState((current) => ({
                ...current,
                recurringAvailability: [],
              }));
              setCalendarNotice(
                "Weekly repetition stopped. Existing hours kept.",
              );
            }}
          >
            Stop repeating
          </button>
        )}
        <span role="status">{calendarNotice}</span>
      </div>
      <div className="page-intro compact-intro calendar-title-row">
        <div>
          <h2>Plan your week.</h2>
        </div>
        <div className="calendar-controls">
          <button
            className="icon-button"
            disabled={!historyCounts.undo}
            onClick={() => travelHistory(false)}
            aria-label="Undo calendar change"
            title="Undo"
          >
            <Undo2 size={17} />
          </button>
          <button
            className="icon-button"
            disabled={!historyCounts.redo}
            onClick={() => travelHistory(true)}
            aria-label="Redo calendar change"
            title="Redo"
          >
            <Redo2 size={17} />
          </button>
          <button
            className="icon-button"
            disabled={!weekHasEditableCells}
            onClick={() => {
              updateState(
                (current) =>
                  copyPreviousWeek(current, days[0], new Date(calendarNow)),
                true,
              );
              setCalendarNotice(
                "Copied last week into future free hours. Existing bookings kept.",
              );
            }}
            aria-label="Copy last week"
            title="Copy last week"
          >
            <Copy size={17} />
          </button>
          <i className="calendar-control-divider" />
          <button
            className="icon-button"
            onClick={() => changeWeek(weekOffset - 1)}
            aria-label="Previous week"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="secondary-button compact"
            onClick={() => changeWeek(0)}
          >
            This week
          </button>
          <button
            className="icon-button"
            onClick={() => changeWeek(weekOffset + 1)}
            aria-label="Next week"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mobile-day-picker panel">
        <button
          className="icon-button"
          onClick={() => changeMobileDay(-1)}
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          className={`mobile-day-label ${selectedDays.has(mobileDayKey) ? "selected" : ""} ${isPastCalendarDay(mobileDayKey, calendarNow) ? "past-locked" : ""}`}
          disabled={isPastCalendarDay(mobileDayKey, calendarNow)}
          onClick={() => toggleDay(mobileDayKey)}
          aria-pressed={selectedDays.has(mobileDayKey)}
        >
          <span>{mobileDay.toLocaleDateString([], { weekday: "long" })}</span>
          <strong>
            {mobileDay.toLocaleDateString([], {
              day: "numeric",
              month: "long",
            })}
          </strong>
          <small>
            {isPastCalendarDay(mobileDayKey, calendarNow)
              ? "past day locked"
              : (state.sprintDays?.[mobileDayKey] ??
                (selectedDays.has(mobileDayKey)
                  ? "selected for emphasis"
                  : "tap to select the day"))}
          </small>
        </button>
        <button
          className="icon-button"
          onClick={() => changeMobileDay(1)}
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="calendar-toolbox panel">
        <div className="toolbox-group allocation-tools">
          <div className="selection-count">
            <span className="count-badge">{selectedCells.size}</span>
            <span>
              <strong>Selected hours</strong>
              <small>Click or drag across the grid</small>
            </span>
          </div>
          <div
            className="tool-actions"
            role="group"
            aria-label="Allocate selected hours"
          >
            <button
              className="allocation-button dsa"
              disabled={!selectedCells.size}
              onClick={() => applyCells("dsa")}
            >
              <BrainCircuit size={15} />
              DSA
            </button>
            <button
              className="allocation-button dev"
              disabled={!selectedCells.size}
              onClick={() => applyCells("dev")}
            >
              <Code2 size={15} />
              Development
            </button>
            <button
              className="allocation-button busy"
              disabled={!selectedCells.size}
              onClick={() => applyCells("busy")}
            >
              <BriefcaseBusiness size={15} />
              Busy
            </button>
            <button
              className="allocation-button clear"
              disabled={!selectedCells.size}
              onClick={() => applyCells()}
            >
              <Eraser size={15} />
              Clear hours
            </button>
          </div>
        </div>
        <div className="toolbox-group day-tools">
          <div className="selection-count">
            <span className="count-badge purple">{selectedDays.size}</span>
            <span>
              <strong>Day emphasis</strong>
              <small>Select headers or use a preset</small>
            </span>
          </div>
          <div className="day-presets">
            <button onClick={() => selectDayPreset("weekdays")}>
              Weekdays
            </button>
            <button onClick={() => selectDayPreset("all")}>All 7</button>
            <button onClick={() => selectDayPreset("clear")}>Reset</button>
          </div>
          <div
            className="tool-actions"
            role="group"
            aria-label="Set selected day emphasis"
          >
            <button
              className="allocation-button solve"
              disabled={!selectedDays.size}
              onClick={() => applySprint("solve")}
            >
              <Zap size={15} />
              Solve sprint
            </button>
            <button
              className="allocation-button recall"
              disabled={!selectedDays.size}
              onClick={() => applySprint("recall")}
            >
              <BrainCircuit size={15} />
              Recall sprint
            </button>
            <button
              className="allocation-button clear"
              disabled={!selectedDays.size}
              onClick={() => applySprint()}
            >
              <CheckSquare2 size={15} />
              Normal
            </button>
          </div>
        </div>
      </div>

      <div className="calendar-legend">
        <span>
          <i className="legend-dot dsa" /> DSA
        </span>
        <span>
          <i className="legend-dot dev" /> Development
        </span>
        <span>
          <i className="legend-dot busy" /> Busy
        </span>
        <span>
          <i className="legend-dot solve" /> Solve sprint
        </span>
        <span>
          <i className="legend-dot recall" /> Recall sprint
        </span>
      </div>

      <section className="calendar-board panel calendar-multiselect">
        <div className="calendar-head">
          <div />
          <div className="calendar-days">
            {days.map((day) => {
              const dayKey = isoDay(day);
              const sprint = state.sprintDays?.[dayKey];
              const selected = selectedDays.has(dayKey);
              const locked = isPastCalendarDay(dayKey, calendarNow);
              return (
                <button
                  key={dayKey}
                  disabled={locked}
                  title={
                    locked
                      ? "Past day locked"
                      : "Select this day for solve or recall emphasis"
                  }
                  className={`day-selector ${locked ? "past-locked" : ""} ${dayKey === isoDay(new Date()) ? "today" : ""} ${selected ? "selected" : ""} ${sprint ? `sprint-${sprint}` : ""}`}
                  onClick={() => toggleDay(dayKey)}
                  aria-pressed={selected}
                >
                  <span>
                    {day.toLocaleDateString([], { weekday: "short" })}
                  </span>
                  <strong>{day.getDate()}</strong>
                  <small>
                    {locked
                      ? "locked"
                      : (sprint ?? (selected ? "selected" : "select day"))}
                  </small>
                </button>
              );
            })}
          </div>
        </div>
        <div className="calendar-body">
          {STUDY_HOURS.map((hour) => (
            <div className="calendar-row" key={hour}>
              <button
                className="hour-label"
                onClick={() => toggleHourForCurrentView(hour)}
                aria-label={`Select ${hourLabel(hour)}`}
              >
                {hourLabel(hour)}
              </button>
              <div className="calendar-days">
                {days.map((day, dayIndex) => {
                  const key = `${isoDay(day)}-${String(hour).padStart(2, "0")}`;
                  const slot = slotMap.get(key);
                  const selected = selectedCells.has(key);
                  const placed = placementCellMap.get(key);
                  const placement = placed
                    ? state.weeklyTaskPlacements.find(
                        (item) => item.id === placed.placementId,
                      )
                    : undefined;
                  const locked =
                    isPastCalendarCell(key, calendarNow) ||
                    Boolean(
                      placement &&
                      isPastCalendarCell(
                        `${placement.dayKey}-${String(placement.startHour).padStart(2, "0")}`,
                        calendarNow,
                      ),
                    );
                  const placedTask = placed
                    ? taskMap.get(placed.taskId)
                    : undefined;
                  const preview =
                    !locked && activeTask && hoveredCell
                      ? placementKeys(
                          activeTask.id,
                          hoveredCell,
                        )?.keys.includes(key)
                      : false;
                  const invalidPreview = Boolean(
                    !locked &&
                    activeTask &&
                    hoveredCell === key &&
                    !placementKeys(activeTask.id, key),
                  );
                  return (
                    <button
                      draggable={Boolean((placed || slot) && !locked)}
                      onDragStart={(event) => {
                        if (
                          locked ||
                          window.matchMedia("(max-width: 700px)").matches
                        ) {
                          event.preventDefault();
                          return;
                        }
                        paintMode.current = null;
                        if (slot) {
                          setMovingPlacementId(null);
                          setMovingSlotKey(key);
                          event.dataTransfer.setData(
                            "text/plain",
                            "availability:" + key,
                          );
                          event.dataTransfer.effectAllowed = "move";
                          return;
                        }
                        if (!placed) return;
                        setMovingSlotKey(null);
                        setMovingPlacementId(placed.placementId);
                        setDraggingTaskId(placed.taskId);
                        event.dataTransfer.setData("text/plain", placed.taskId);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDraggingTaskId(null);
                        setHoveredCell(null);
                      }}
                      key={key}
                      title={
                        locked
                          ? "Past time is locked"
                          : placedTask
                            ? `${placedTask.title} · double tap to move`
                            : undefined
                      }
                      className={`calendar-cell ${locked ? "past-locked" : ""} ${dayIndex === mobileDayIndex ? "mobile-active" : "mobile-inactive"} ${placed ? "weekly-placed" : (slot?.kind ?? "empty")} ${placed?.first ? "weekly-start" : ""} ${placed && !placed.first ? "weekly-continuation" : ""} ${selected ? "selected" : ""} ${preview ? "drop-preview" : ""} ${invalidPreview ? "drop-invalid" : ""}`}
                      style={
                        placedTask
                          ? ({
                              "--task-color": placedTask.color,
                            } as React.CSSProperties)
                          : undefined
                      }
                      onPointerDown={(event) => {
                        if (event.pointerType !== "mouse") return;
                        if (locked) {
                          setCalendarNotice("Past hours are locked.");
                          return;
                        }
                        if (movingSlotKey && !slot && !placed) {
                          event.preventDefault();
                          moveHour(movingSlotKey, key);
                          return;
                        }
                        if (placed) return;
                        if (!slot) event.preventDefault();
                        if (movingPlacement)
                          placeTask(movingPlacement.taskId, key);
                        else if (selectedTaskId) placeTask(selectedTaskId, key);
                        else beginPainting(key);
                      }}
                      onClick={(event) => {
                        if (
                          event.detail === 0 ||
                          window.matchMedia("(max-width: 700px)").matches
                        )
                          activateCell(key, slot, placed, event.timeStamp);
                      }}
                      onDoubleClick={() => {
                        if (placed) startMovingPlacement(placed.placementId);
                      }}
                      onPointerEnter={(event) => {
                        if (locked || event.pointerType !== "mouse") return;
                        if (draggingTaskId || movingPlacement)
                          setHoveredCell(key);
                        else paintCell(key);
                      }}
                      onDragOver={(event) => {
                        if (locked) {
                          event.dataTransfer.dropEffect = "none";
                          return;
                        }
                        event.preventDefault();
                        event.dataTransfer.dropEffect =
                          movingPlacementId || movingSlotKey ? "move" : "copy";
                        setHoveredCell(key);
                      }}
                      onDragLeave={() =>
                        setHoveredCell((current) =>
                          current === key ? null : current,
                        )
                      }
                      onDrop={(event) => {
                        if (locked) return;
                        event.preventDefault();
                        const taskId =
                          event.dataTransfer.getData("text/plain") ||
                          draggingTaskId;
                        if (taskId?.startsWith("availability:"))
                          moveHour(taskId.slice(13), key);
                        else if (taskId) placeTask(taskId, key);
                        setDraggingTaskId(null);
                      }}
                      aria-disabled={locked}
                      aria-pressed={selected}
                      aria-label={`${day.toLocaleDateString([], { weekday: "long" })} ${hourLabel(hour)} ${placedTask?.title ?? slot?.kind ?? "unallocated"}${locked ? " locked" : ""}`}
                    >
                      <span>
                        {placed
                          ? placed.first
                            ? placedTask?.title
                            : ""
                          : slot?.kind === "dsa"
                            ? "DSA"
                            : slot?.kind === "dev"
                              ? "DEV"
                              : slot?.kind === "busy"
                                ? "BUSY"
                                : ""}
                      </span>
                      {locked && <Lock className="cell-lock" size={12} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section
        className="weekly-inventory panel"
        aria-label="Weekly task inventory"
      >
        <div className="inventory-track">
          {(state.weeklyTasks ?? []).map((task) => {
            const remaining = Math.max(
              0,
              task.sessionsPerWeek - (displayedCounts.get(task.id) ?? 0),
            );
            return (
              <button
                key={task.id}
                draggable={remaining > 0 && weekHasEditableCells}
                disabled={remaining === 0 || !weekHasEditableCells}
                className={`inventory-pill ${selectedTaskId === task.id ? "selected" : ""} ${invalidTaskId === task.id ? "shake" : ""}`}
                style={{ "--task-color": task.color } as React.CSSProperties}
                onDragStart={(event) => onTaskDragStart(event, task.id)}
                onDragEnd={() => {
                  setDraggingTaskId(null);
                  setHoveredCell(null);
                }}
                onClick={() =>
                  setSelectedTaskId((current) =>
                    current === task.id ? null : task.id,
                  )
                }
              >
                <GripVertical size={15} />
                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {weekHasEditableCells
                      ? `${task.durationHours}h session`
                      : "past week locked"}
                  </small>
                </span>
                <b>×{remaining}</b>
              </button>
            );
          })}
          {!state.weeklyTasks?.length && (
            <div className="inventory-empty">
              <Plus size={16} /> Create a weekly task from the Weekly Tasks tab
            </div>
          )}
        </div>
      </section>
      <div className="info-strip">
        <Lightbulb size={18} />
        <p>
          A solve sprint gives new problems preference. A recall sprint gives
          due revisions preference. Critical overdue work stays protected on
          both.
        </p>
      </div>
    </div>
  );
}

const TASK_COLORS = [
  "#6d5cff",
  "#ff6d3a",
  "#00b99a",
  "#e24ca6",
  "#e8a100",
  "#2879ff",
];

export function WeeklyTasksView({
  state,
  updateState,
  onOpenCalendar,
}: {
  state: AppState;
  updateState: UpdateState;
  onOpenCalendar: () => void;
}) {
  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [sessionsPerWeek, setSessionsPerWeek] = useState(2);

  function addTask(event: React.FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    updateState((current) => ({
      ...current,
      weeklyTasks: [
        ...(current.weeklyTasks ?? []),
        {
          id: crypto.randomUUID(),
          title: cleanTitle,
          durationHours,
          sessionsPerWeek,
          color:
            TASK_COLORS[
              (current.weeklyTasks?.length ?? 0) % TASK_COLORS.length
            ],
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setTitle("");
  }

  function deleteTask(id: string) {
    updateState((current) => ({
      ...current,
      weeklyTasks: (current.weeklyTasks ?? []).filter((task) => task.id !== id),
      weeklyTaskPlacements: (current.weeklyTaskPlacements ?? []).filter(
        (placement) => placement.taskId !== id,
      ),
    }));
  }

  return (
    <div className="page-stack weekly-tasks-page">
      <div className="page-intro compact-intro">
        <div>
          <span className="eyebrow">Recurring commitments</span>
          <h2>Weekly Tasks</h2>
          <p>Define the work once. Place each session exactly where it fits.</p>
        </div>
        <button className="secondary-button" onClick={onOpenCalendar}>
          <CalendarClock size={16} /> Open calendar
        </button>
      </div>
      <div className="weekly-task-layout">
        <form className="weekly-task-form panel" onSubmit={addTask}>
          <span className="eyebrow">New weekly task</span>
          <h3>Create a commitment</h3>
          <label>
            Task name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
              placeholder="HLD round"
              required
            />
          </label>
          <div className="weekly-form-grid">
            <label>
              Session length
              <select
                value={durationHours}
                onChange={(event) =>
                  setDurationHours(Number(event.target.value))
                }
              >
                {Array.from({ length: 6 }, (_, index) => index + 1).map(
                  (hours) => (
                    <option key={hours} value={hours}>
                      {hours} hour{hours === 1 ? "" : "s"}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Times each week
              <select
                value={sessionsPerWeek}
                onChange={(event) =>
                  setSessionsPerWeek(Number(event.target.value))
                }
              >
                {Array.from({ length: 14 }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count}× / week
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <button className="primary-button">
            <Plus size={16} /> Add to inventory
          </button>
        </form>
        <section className="weekly-task-list panel">
          <div>
            <span className="eyebrow">Your inventory</span>
            <h3>{state.weeklyTasks?.length ?? 0} active commitments</h3>
          </div>
          <div className="weekly-entities">
            {(state.weeklyTasks ?? []).map((task) => (
              <article
                key={task.id}
                style={{ "--task-color": task.color } as React.CSSProperties}
              >
                <i />
                <div>
                  <strong>{task.title}</strong>
                  <span>
                    <Clock3 size={14} /> {task.durationHours}h per session ·{" "}
                    {task.sessionsPerWeek} times each week
                  </span>
                </div>
                <b>×{task.sessionsPerWeek}</b>
                <button
                  className="row-icon danger"
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Delete ${task.title}`}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
            {!state.weeklyTasks?.length && (
              <div className="weekly-empty">
                <CalendarClock size={28} />
                <strong>No weekly commitments yet</strong>
                <p>
                  Create one like “2 HLD rounds, 1 hour each.” It becomes a
                  draggable inventory item on every calendar week.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type ProblemTab = "today" | "week" | "all";

export function ProblemsView({
  state,
  onAdd,
  onComplete,
  onDelete,
  onReschedule,
  updateState,
}: {
  state: AppState;
  onAdd: () => void;
  onComplete: (problemId: string, scheduledId?: string) => void;
  onDelete: (id: string) => void;
  onReschedule: (id: string) => void;
  updateState: UpdateState;
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ProblemTab>("today");
  const [selectedRecord, setSelected] = useState<Problem | null>(null);
  const selected =
    state.problems.find((p) => p.id === selectedRecord?.id) ?? null;
  const today = new Date();
  const todayKeyValue = isoDay(today);
  const endOfWeek = addDays(today, 7).getTime();
  const visible = useMemo(
    () =>
      state.problems.filter((problem) => {
        if (
          !`${problem.title} ${problem.topics.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
          return false;
        const due = new Date(problem.dueAt).getTime();
        if (tab === "today")
          return isoDay(new Date(problem.dueAt)) === todayKeyValue;
        if (tab === "week")
          return due >= new Date(todayKeyValue).getTime() && due <= endOfWeek;
        return true;
      }),
    [state.problems, query, tab, endOfWeek, todayKeyValue],
  );

  return (
    <div className="page-stack problems-page">
      <div className="page-intro compact-intro">
        <div>
          <h2>Problems</h2>
        </div>
        <button className="secondary-button" onClick={onAdd}>
          <Plus size={16} /> Add manually
        </button>
      </div>
      <div className="problem-tabs" role="tablist">
        {(["today", "week", "all"] as ProblemTab[]).map((item) => (
          <button
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => {
              setTab(item);
              setSelected(null);
            }}
          >
            {item === "today"
              ? "Today"
              : item === "week"
                ? "This week"
                : "All solved"}
            <span>{item === "all" ? state.problems.length : undefined}</span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="search-shell">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title or topic"
          />
        </div>
      </div>
      <div className="problem-layout">
        <section className="problem-list panel">
          {visible.map((problem) => (
            <article
              className={`revision-row ${selected?.id === problem.id ? "selected" : ""}`}
              key={problem.id}
            >
              <button
                className="revision-main"
                onClick={() => {
                  setSelected(problem);
                }}
              >
                <i className={`difficulty ${problem.difficulty}`} />
                <div>
                  <strong>{problem.title}</strong>
                  <span>
                    {problem.topics.join(" · ") || "Unclustered"} ·{" "}
                    {problem.revisionMinutes} min
                  </span>
                </div>
              </button>
              {problem.url && (
                <a
                  className="row-icon open"
                  href={problem.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${problem.title} on LeetCode`}
                >
                  <ExternalLink size={17} />
                </a>
              )}
              <button
                className="row-icon complete"
                onClick={() =>
                  onComplete(
                    problem.id,
                    state.scheduled.find(
                      (item) =>
                        item.problemId === problem.id &&
                        item.status === "planned",
                    )?.id,
                  )
                }
                aria-label={`Mark ${problem.title} revised`}
                title="Mark revised"
              >
                <CheckSquare2 size={17} />
              </button>
              <button
                className="row-icon reschedule"
                onClick={() => onReschedule(problem.id)}
                aria-label={`Reschedule ${problem.title}`}
              >
                <CalendarClock size={17} />
              </button>
              <button
                className="row-icon delete"
                onClick={() => onDelete(problem.id)}
                aria-label={`Remove ${problem.title}`}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
          {!visible.length && (
            <div className="empty-state">
              <BookOpen size={28} />
              <h4>
                {tab === "all"
                  ? "No solved problems yet"
                  : "Nothing scheduled here"}
              </h4>
              <p>
                Your extension will populate this list as you finish LeetCode
                sessions.
              </p>
            </div>
          )}
        </section>
        <aside className="problem-detail panel">
          {selected && (
            <ProblemHistory
              key={selected.id}
              problem={selected}
              state={state}
              onUpdate={updateState}
            />
          )}
          {!selected && (
            <div className="empty-detail">
              <BookOpen size={30} />
              <h3>Select a question</h3>
              <p>Its history and revision settings appear here.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function SettingsView({
  state,
  updateState,
  cloudEnabled,
  username,
  onSignOut,
}: {
  state: AppState;
  updateState: UpdateState;
  cloudEnabled: boolean;
  username: string;
  onSignOut: () => void;
}) {
  const [pairCode, setPairCode] = useState("");
  const [pairError, setPairError] = useState("");
  async function loadPairingKey() {
    setPairError("");
    const response = await fetch("/api/extension/pairing-code");
    const data = (await response.json()) as { code?: string; error?: string };
    if (!response.ok || !data.code)
      setPairError(data.error ?? "Could not create a pairing code.");
    else setPairCode(data.code);
  }
  return (
    <div className="page-stack settings-page">
      <div className="page-intro compact-intro">
        <div>
          <h2>Settings</h2>
          <p>
            Personalize the workload, planner and companion without changing
            your stored history.
          </p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="panel settings-section featured-setting">
          <div className="settings-icon">
            <SlidersHorizontal size={20} />
          </div>
          <div className="settings-copy">
            <h3>Daily focus target</h3>
            <p>The dashboard meter and overdrive state use this target.</p>
            <label className="setting-field">
              <span>Minutes per day</span>
              <input
                type="number"
                min={120}
                max={720}
                step={15}
                value={state.dailyTargetMinutes}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value))
                    updateState((current) => ({
                      ...current,
                      dailyTargetMinutes: Math.max(120, Math.min(720, value)),
                    }));
                }}
              />
            </label>
            <div className="target-presets">
              {[180, 240, 300, 360, 480].map((minutes) => (
                <button
                  key={minutes}
                  className={
                    state.dailyTargetMinutes === minutes ? "active" : ""
                  }
                  onClick={() =>
                    updateState((current) => ({
                      ...current,
                      dailyTargetMinutes: minutes,
                    }))
                  }
                >
                  {minutes}m
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-icon">
            <CalendarClock size={20} />
          </div>
          <div className="settings-copy">
            <h3>Planning defaults</h3>
            <p>
              Balanced reserves roughly 40% of valid DSA capacity for recall.
            </p>
            <label className="setting-field">
              <span>Day mode</span>
              <select
                value={state.dayMode}
                onChange={(event) =>
                  updateState(
                    (current) => ({
                      ...current,
                      dayMode: event.target.value as AppState["dayMode"],
                    }),
                    true,
                  )
                }
              >
                <option value="balanced">Balanced</option>
                <option value="revision-heavy">Revision-heavy</option>
                <option value="catch-up">Catch-up</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            {state.dayMode === "manual" && (
              <label className="setting-field">
                <span>Recall blocks</span>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={state.manualRecallBlocks}
                  onChange={(event) =>
                    updateState(
                      (current) => ({
                        ...current,
                        manualRecallBlocks: Math.max(
                          0,
                          Math.min(16, Number(event.target.value)),
                        ),
                      }),
                      true,
                    )
                  }
                />
              </label>
            )}
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-icon">
            <KeyRound size={20} />
          </div>
          <div className="settings-copy">
            <h3>LeetCode companion</h3>
            <p>
              Use the same reusable account key on every browser you want to
              connect. Timer position stays in the extension popup.
            </p>
            {cloudEnabled ? (
              <button
                className="secondary-button compact"
                onClick={loadPairingKey}
              >
                Show pairing key
              </button>
            ) : (
              <div className="status-line">
                <span className="status-ok" />
                Local sync active
              </div>
            )}
            {pairCode && <code className="pairing-code">{pairCode}</code>}
            {pairError && <p className="auth-error">{pairError}</p>}
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-icon">
            <Database size={20} />
          </div>
          <div className="settings-copy">
            <h3>Storage</h3>
            <p>
              {cloudEnabled
                ? "Your authenticated workspace is stored in MongoDB under your account and synchronized across devices."
                : "Account storage is currently unavailable."}
            </p>
            <div className="status-line">
              <span className={cloudEnabled ? "status-ok" : "status-warn"} />
              {cloudEnabled ? "MongoDB sync connected" : "Storage unavailable"}
            </div>
          </div>
        </section>
        <section className="panel settings-section">
          <div className="settings-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="settings-copy">
            <h3>Capture boundary</h3>
            <p>
              No profile crawling or submission interception. Code is read only
              when you explicitly press End in the LeetCode overlay.
            </p>
            <div className="status-line">
              <span className="status-ok" />
              User-triggered capture
            </div>
          </div>
        </section>
        {cloudEnabled && <ChangePassword />}
        <section className="panel settings-section account-setting">
          <div className="settings-icon">
            <LogOut size={20} />
          </div>
          <div className="settings-copy">
            <h3>{username}</h3>
            <p>
              {cloudEnabled
                ? "Sign out on this browser. Your synchronized workspace remains stored."
                : "Cloud accounts are not configured on this deployment yet."}
            </p>
            <button className="secondary-button compact" onClick={onSignOut}>
              {cloudEnabled ? "Sign out" : "Open sign in"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
