/* Verifica, contra um Postgres de verdade e descartável, os invariantes que o
 * banco passou a garantir e que o arquivo JSON anterior não garantia.
 *
 * Roda sem nenhuma dependência externa:  npm run db:test
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { PGlite } from "@electric-sql/pglite";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lb-test-"));
const db = new PGlite(tmp);
await db.waitReady;
await db.exec(fs.readFileSync(path.join("src", "lib", "schema.sql"), "utf8"));

const q = async (t, p) => (await db.query(t, p)).rows;

let falhas = 0;
const ok = (cond, msg) => {
  if (!cond) falhas++;
  console.log(`${cond ? "  ok  " : " FALHA"} ${msg}`);
};

/* fixture mínima: um personal, um aluno, um treino com um exercício */
await q(`INSERT INTO users (id,email,password_hash,name,role,created_at)
         VALUES ('pro','p@x.com','h','Personal','personal',CURRENT_DATE)`);
await q(`INSERT INTO users (id,email,password_hash,name,role,professional_id,created_at)
         VALUES ('u1','a@x.com','h','Aluno','student','pro',CURRENT_DATE)`);
await q(`INSERT INTO students (id,user_id,professional_id,modality,start_date,training_days)
         VALUES ('s1','u1','pro','presencial',CURRENT_DATE - 30,'{1,3,5}')`);
await q(`INSERT INTO exercises (id,name) VALUES ('e1','Agachamento')`);
await q(`INSERT INTO training_plans (id,student_id,professional_id,start_date)
         VALUES ('p1','s1','pro',CURRENT_DATE - 30)`);
await q(`INSERT INTO workouts (id,plan_id,label,name) VALUES ('w1','p1','A','Pernas')`);
await q(`INSERT INTO workout_exercises (id,workout_id,exercise_id) VALUES ('we1','w1','e1')`);
await q(`INSERT INTO anamnesis (id,student_id,professional_id,answers)
         VALUES ('an1','s1','pro','{"objetivo_principal":"Hipertrofia","sono":"8 horas"}'::jsonb)`);

console.log("\n— presença: marcar várias vezes não duplica");
for (const v of [true, false, true]) {
  await q(`INSERT INTO attendance (id,student_id,professional_id,date,present)
           VALUES ($1,'s1','pro','2026-09-22',$2)
           ON CONFLICT (student_id,date) DO UPDATE SET present = EXCLUDED.present`,
    [`att${Math.random()}`, v]);
}
let r = await q(`SELECT count(*)::int n, bool_or(present) p FROM attendance
                 WHERE student_id='s1' AND date='2026-09-22'`);
ok(r[0].n === 1, `3 marcações, 1 linha (n=${r[0].n})`);
ok(r[0].p === true, "o último valor prevalece");

console.log("\n— hábito: alterna e não duplica");
for (let i = 0; i < 3; i++) {
  await q(`INSERT INTO habit_logs (id,student_id,date,water) VALUES ($1,'s1','2026-09-22',TRUE)
           ON CONFLICT (student_id,date) DO UPDATE SET water = NOT habit_logs.water`, [`h${i}`]);
}
r = await q(`SELECT count(*)::int n, bool_and(water) w FROM habit_logs
             WHERE student_id='s1' AND date='2026-09-22'`);
ok(r[0].n === 1, `3 toques, 1 linha (n=${r[0].n})`);
ok(r[0].w === true, "liga, desliga, liga");

console.log("\n— check-in: uma resposta por semana, garantido pelo banco");
await q(`INSERT INTO checkins (id,student_id,professional_id,week_start,status)
         VALUES ('c1','s1','pro','2026-09-14','pendente')`);
let erro = null;
try {
  await q(`INSERT INTO checkins (id,student_id,professional_id,week_start,status)
           VALUES ('c2','s1','pro','2026-09-14','pendente')`);
} catch (e) { erro = e; }
ok(erro !== null, "duplicata na mesma semana rejeitada");

console.log("\n— foto: um arquivo por mês e ângulo");
for (const f of ["a.jpg", "b.jpg"]) {
  await q(`INSERT INTO progress_photos (id,student_id,month,angle,file_name)
           VALUES ($1,'s1','2026-09','frente',$2)
           ON CONFLICT (student_id,month,angle) DO UPDATE SET file_name = EXCLUDED.file_name`,
    [`ph${f}`, f]);
}
r = await q(`SELECT count(*)::int n, max(file_name) f FROM progress_photos WHERE student_id='s1'`);
ok(r[0].n === 1 && r[0].f === "b.jpg", `substitui em vez de duplicar (${r[0].f})`);

console.log("\n— anamnese: salvar parte do formulário não apaga o resto");
await q(`INSERT INTO anamnesis (id,student_id,professional_id,answered_at,answers)
         VALUES ('an2','s1','pro',CURRENT_DATE,'{"sono":"5 horas"}'::jsonb)
         ON CONFLICT (student_id) DO UPDATE SET answers = anamnesis.answers || EXCLUDED.answers`);
r = await q(`SELECT answers->>'sono' s, answers->>'objetivo_principal' o FROM anamnesis WHERE student_id='s1'`);
ok(r[0].s === "5 horas", "campo enviado atualizado");
ok(r[0].o === "Hipertrofia", "campo ausente preservado");

console.log("\n— transação: sessão e séries entram juntas ou nenhuma entra");
const antes = (await q("SELECT count(*)::int n FROM workout_sessions"))[0].n;
try {
  await db.transaction(async (tx) => {
    await tx.query(`INSERT INTO workout_sessions (id,student_id,workout_id,started_at,session_date)
                    VALUES ('ses1','s1','w1',NOW(),CURRENT_DATE)`);
    await tx.query(`INSERT INTO workout_sets (id,session_id,workout_exercise_id,set_number,done_at)
                    VALUES ('st1','ses1','NAO_EXISTE',1,NOW())`);
  });
} catch { /* esperado: a série aponta para exercício inexistente */ }
const depois = (await q("SELECT count(*)::int n FROM workout_sessions"))[0].n;
ok(antes === depois, `série inválida desfez a sessão (${antes} → ${depois})`);

console.log("\n— exclusão em cascata");
await q(`INSERT INTO workout_sessions (id,student_id,workout_id,started_at,session_date)
         VALUES ('ses2','s1','w1',NOW(),CURRENT_DATE)`);
await q(`INSERT INTO workout_sets (id,session_id,workout_exercise_id,set_number,done_at)
         VALUES ('st2','ses2','we1',1,NOW())`);
await q("DELETE FROM workouts WHERE id='w1'");
const orfas = (await q("SELECT count(*)::int n FROM workout_sets"))[0].n
            + (await q("SELECT count(*)::int n FROM workout_exercises"))[0].n;
ok(orfas === 0, `apagar o treino não deixou linha órfã (${orfas})`);

console.log("\n— isolamento: um profissional não alcança aluno de outro");
await q(`INSERT INTO users (id,email,password_hash,name,role,created_at)
         VALUES ('pro2','p2@x.com','h','Outro','personal',CURRENT_DATE)`);
r = await q("SELECT count(*)::int n FROM students WHERE professional_id='pro2'");
ok(r[0].n === 0, "o outro profissional não enxerga o aluno s1");

await db.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(falhas === 0 ? "\ntodos os invariantes passaram" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
