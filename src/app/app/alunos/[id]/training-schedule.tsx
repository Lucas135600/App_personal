"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { cx, Field, Input } from "@/components/ui";

/* Dias de treino e horário da aula, num campo só.
 *
 * Eram duas telas e dois botões: o personal marcava os dias, salvava, e só
 * então apareciam os horários para salvar de novo. Separado, o horário sempre
 * descrevia a grade anterior — e metade das vezes o segundo salvar era
 * esquecido. Aqui o horário nasce junto do dia: marcar QUA abre o campo de
 * QUA na hora, desmarcar leva o campo embora, e um único salvar grava tudo.
 */

const ORDEM_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda a domingo

export function TrainingSchedule({
  defaultDays,
  defaultTimes,
  defaultDuration,
  defaultPackage,
  comHorario,
}: {
  defaultDays: number[];
  /** Horário já cadastrado de cada dia, 'HH:MM'. */
  defaultTimes: Record<number, string>;
  defaultDuration: number;
  defaultPackage: number;
  /** Aluno ocupa horário do personal? Online não ocupa, e aí não há o que marcar. */
  comHorario: boolean;
}) {
  const [selected, setSelected] = useState<number[]>(defaultDays);

  const toggle = (day: number) =>
    setSelected((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );

  const dias = ORDEM_SEMANA.filter((d) => selected.includes(d));

  return (
    <div className="space-y-3">
      <Field label="Dias de treino">
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LABELS.map((label, day) => {
            const ativo = selected.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                aria-pressed={ativo}
                className={cx(
                  "h-10 w-12 rounded-xl text-xs font-bold transition-colors",
                  ativo
                    ? "bg-lime-accent text-ink-950"
                    : "border border-ink-700 text-ink-400 hover:border-ink-500",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {selected.map((day) => (
        <input key={day} type="hidden" name="weekdays" value={day} />
      ))}

      {comHorario && (
        <div className="space-y-3 rounded-xl border border-ink-800 bg-ink-850/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Aulas presenciais
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Aulas no pacote" hint="0 = sem pacote">
              <Input
                name="monthlyClasses"
                type="number"
                min={0}
                max={99}
                defaultValue={defaultPackage}
              />
            </Field>
            <Field label="Duração (min)">
              <Input
                name="durationMin"
                type="number"
                min={15}
                max={300}
                step={5}
                defaultValue={defaultDuration}
              />
            </Field>
          </div>

          {dias.length === 0 ? (
            <p className="text-xs text-ink-500">
              Marque os dias de treino acima para definir o horário de cada aula.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {dias.map((d) => (
                <Field key={d} label={`${WEEKDAY_LABELS[d]} — horário`}>
                  {/* key força o campo a renascer quando o dia volta a ser
                      marcado, para não ressuscitar o valor de uma marcação
                      anterior que o personal acabou de desfazer. */}
                  <Input
                    key={d}
                    name={`time_${d}`}
                    type="time"
                    defaultValue={defaultTimes[d] ?? ""}
                  />
                </Field>
              ))}
            </div>
          )}

          <p className="text-xs text-ink-500">
            Depois que o horário da aula termina, você recebe a pergunta “houve a aula?”. Ao
            confirmar, ela entra numerada na sua agenda e na do aluno. Dia sem horário continua na
            grade, só não gera a pergunta.
          </p>
        </div>
      )}
    </div>
  );
}
