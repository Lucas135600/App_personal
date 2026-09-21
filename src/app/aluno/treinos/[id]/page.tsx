import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { activePlanWorkouts, resolveWorkout } from "@/lib/queries";
import { WorkoutRunner, type RunnerItem } from "./runner";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { student } = await requireStudent();
  const { id } = await params;

  const { workouts } = await activePlanWorkouts(student.id);
  if (!workouts.some((w) => w.id === id)) notFound();

  const resolved = await resolveWorkout(id, student.id);
  if (!resolved) notFound();

  const items: RunnerItem[] = resolved.items.map((r) => ({
    id: r.item.id,
    name: r.exercise.name,
    muscleGroup: r.exercise.muscleGroup,
    equipment: r.exercise.equipment,
    videoUrl: r.exercise.videoUrl,
    instructions: r.exercise.instructions,
    commonMistakes: r.exercise.commonMistakes,
    tips: r.exercise.tips,
    sets: r.item.sets,
    repsMin: r.item.repsMin,
    repsMax: r.item.repsMax,
    load: r.item.load,
    restSeconds: r.item.restSeconds,
    rir: r.item.rir,
    notes: r.item.notes,
    lastLoad: r.lastLoad,
    lastReps: r.lastReps,
  }));

  return (
    <div className="space-y-4 lb-enter">
      <Link href="/aluno/treinos" className="text-xs font-semibold text-ink-400">
        &larr; Meus treinos
      </Link>
      <WorkoutRunner
        workoutId={resolved.workout.id}
        label={resolved.workout.label}
        name={resolved.workout.name}
        estimatedMinutes={resolved.workout.estimatedMinutes}
        items={items}
      />
    </div>
  );
}
