import type { RoadmapPhase } from "./domain";

export function roadmapPhaseOnDay(phases: RoadmapPhase[] | undefined, day: string) {
  return phases?.find((phase) => phase.startsOn <= day && day <= phase.endsOn);
}

export function roadmapPhasesInWeek(phases: RoadmapPhase[] | undefined, firstDay: string, lastDay: string) {
  return (phases ?? []).filter((phase) => phase.startsOn <= lastDay && phase.endsOn >= firstDay);
}
