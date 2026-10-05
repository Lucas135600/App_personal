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

console.log("\n— hábito: cicla entre três estados e não duplica");
const toque = (i) =>
  q(`INSERT INTO habit_logs (id,student_id,date,water) VALUES ($1,'s1','2026-09-22',1)
     ON CONFLICT (student_id,date) DO UPDATE
        SET water = CASE habit_logs.water WHEN 1 THEN 2 WHEN 2 THEN 0 ELSE 1 END`, [`h${i}`]);
const estadoAgua = async () =>
  (await q(`SELECT water FROM habit_logs WHERE student_id='s1' AND date='2026-09-22'`))[0].water;

await toque(0);
ok((await estadoAgua()) === 1, "1º toque = cumpriu");
await toque(1);
ok((await estadoAgua()) === 2, "2º toque = não cumpriu");
await toque(2);
ok((await estadoAgua()) === 0, "3º toque volta ao neutro");
await toque(3);
ok((await estadoAgua()) === 1, "4º toque recomeça o ciclo");

r = await q(`SELECT count(*)::int n FROM habit_logs WHERE student_id='s1' AND date='2026-09-22'`);
ok(r[0].n === 1, `4 toques, 1 linha (n=${r[0].n})`);

console.log("\n— meta de hábito: uma por aluno, a segunda atualiza a primeira");
for (const [ml, nota] of [[3000, "primeira"], [3500, "revisada"]]) {
  await q(`INSERT INTO habit_targets (id,student_id,professional_id,water_ml,nutrition,supplement,updated_at)
           VALUES ($1,'s1','pro',$2,$3,'','2026-09-22')
           ON CONFLICT (student_id) DO UPDATE
              SET water_ml = EXCLUDED.water_ml, nutrition = EXCLUDED.nutrition`,
    [`hbt_${ml}`, ml, nota]);
}
r = await q("SELECT count(*)::int n, max(water_ml)::int ml, max(nutrition) nt FROM habit_targets WHERE student_id='s1'");
ok(r[0].n === 1, `2 gravações, 1 linha (n=${r[0].n})`);
ok(r[0].ml === 3500 && r[0].nt === "revisada", "a meta mais recente prevalece");

console.log("\n— desafio: convite responde uma vez e não ressuscita");
await q(`INSERT INTO challenges (id,professional_id,created_by,name,kind,goal,period,target,require_photo,start_date,end_date)
         VALUES ('chl1','pro','s1','Teste','duelo','cardio_min','diario',30,TRUE,'2026-09-01','2026-09-30')`);
await q(`INSERT INTO challenge_members (id,challenge_id,student_id) VALUES ('m1','chl1','s1')`);
await q(`UPDATE challenge_members SET status='aceito' WHERE challenge_id='chl1' AND student_id='s1' AND status='convidado'`);
await q(`UPDATE challenge_members SET status='recusado' WHERE challenge_id='chl1' AND student_id='s1' AND status='convidado'`);
r = await q("SELECT status FROM challenge_members WHERE id='m1'");
ok(r[0].status === "aceito", `resposta repetida nao sobrescreve (${r[0].status})`);

let erroC = null;
try {
  await q(`INSERT INTO challenge_members (id,challenge_id,student_id) VALUES ('m2','chl1','s1')`);
} catch (e) { erroC = e; }
ok(erroC !== null, "mesma pessoa duas vezes no desafio e rejeitada");

console.log("\n— registro: um por dia, regravar corrige em vez de somar");
for (const [v, foto] of [[20, ''], [35, 'f.jpg'], [40, '']]) {
  await q(`INSERT INTO challenge_entries (id,challenge_id,student_id,date,value,photo_file_name)
           VALUES ($1,'chl1','s1','2026-09-10',$2,$3)
           ON CONFLICT (challenge_id,student_id,date) DO UPDATE
              SET value = EXCLUDED.value,
                  photo_file_name = COALESCE(NULLIF(EXCLUDED.photo_file_name,''), challenge_entries.photo_file_name)`,
    [`e${v}`, v, foto]);
}
r = await q("SELECT count(*)::int n, max(value)::float v, max(photo_file_name) f FROM challenge_entries WHERE challenge_id='chl1'");
ok(r[0].n === 1, `3 registros no mesmo dia, 1 linha (n=${r[0].n})`);
ok(r[0].v === 40, `vale o ultimo valor (${r[0].v})`);
ok(r[0].f === "f.jpg", "regravar sem foto nao apaga a comprovacao anterior");

console.log("\n— desafio: o banco recusa periodo e meta invalidos");
erroC = null;
try {
  await q(`INSERT INTO challenges (id,professional_id,created_by,name,kind,goal,period,target,start_date,end_date)
           VALUES ('chl2','pro','s1','Invertido','duelo','abdominais','diario',50,'2026-09-30','2026-09-01')`);
} catch (e) { erroC = e; }
ok(erroC !== null, "fim antes do inicio e rejeitado");

erroC = null;
try {
  await q(`INSERT INTO challenges (id,professional_id,created_by,name,kind,goal,period,target,start_date,end_date)
           VALUES ('chl3','pro','s1','X','duelo','natacao','diario',50,'2026-09-01','2026-09-30')`);
} catch (e) { erroC = e; }
ok(erroC !== null, "meta fora da lista fechada e rejeitada");


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

console.log("\n— horário da aula: um por dia da semana, hora válida");
await q(`INSERT INTO class_schedule (id,student_id,professional_id,weekday,start_time)
         VALUES ('c1','s1','pro',1,'18:00')`);
let recusouDuplicata = false;
try {
  await q(`INSERT INTO class_schedule (id,student_id,professional_id,weekday,start_time)
           VALUES ('c2','s1','pro',1,'19:00')`);
} catch { recusouDuplicata = true; }
ok(recusouDuplicata, "dois horários no mesmo dia da semana são rejeitados");

let recusouHora = false;
try {
  await q(`INSERT INTO class_schedule (id,student_id,professional_id,weekday,start_time)
           VALUES ('c3','s1','pro',2,'18h')`);
} catch { recusouHora = true; }
ok(recusouHora, "hora fora do formato HH:MM é rejeitada");

console.log("\n— aula: histórico antigo continua descontando do pacote");
await q(`INSERT INTO attendance (id,student_id,professional_id,date,present)
         VALUES ('a9','s1','pro',CURRENT_DATE - 20,TRUE)`);
r = await q("SELECT consumes, reason FROM attendance WHERE id='a9'");
ok(r[0].consumes === true, "registro sem motivo nasce descontando o pacote");
ok(r[0].reason === "", "registro sem motivo nasce como aula realizada");

await q(`INSERT INTO attendance (id,student_id,professional_id,date,present,reason,consumes)
         VALUES ('a10','s1','pro',CURRENT_DATE - 19,FALSE,'cancelada',FALSE)`);
r = await q("SELECT count(*)::int n FROM attendance WHERE id IN ('a9','a10') AND consumes");
ok(r[0].n === 1, `aula cancelada não entra na conta do pacote (${r[0].n})`);

console.log("\n— pacote: apagar o aluno não deixa horário órfão");
await q("DELETE FROM students WHERE id='s1'");
r = await q("SELECT count(*)::int n FROM class_schedule");
ok(r[0].n === 0, `grade de horários removida junto (${r[0].n})`);

await db.close();
fs.rmSync(tmp, { recursive: true, force: true });

console.log(falhas === 0 ? "\ntodos os invariantes passaram" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
