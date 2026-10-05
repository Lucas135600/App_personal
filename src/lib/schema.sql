-- Esquema do LB Personal Trainner.
--
-- Multi-tenant desde o início: tudo que pertence a um aluno carrega
-- professional_id, para que outros profissionais possam usar a mesma base sem
-- migração. As buscas do dia a dia são sempre "por profissional" ou "por aluno",
-- e os índices no fim do arquivo seguem exatamente esses caminhos.
--
-- Datas de calendário (dia de treino, check-in, avaliação) são DATE, não
-- timestamp: elas representam um dia no fuso do personal, e guardar como
-- timestamp faria o dia mudar conforme o servidor.

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('personal', 'student')),
  professional_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  avatar_color    TEXT NOT NULL DEFAULT '#9aa1ac',
  created_at      DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS students (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  birth_date      DATE,
  phone           TEXT NOT NULL DEFAULT '',
  modality        TEXT NOT NULL CHECK (modality IN ('presencial', 'online', 'hibrido')),
  goal            TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  start_date      DATE NOT NULL,
  training_days   SMALLINT[] NOT NULL DEFAULT '{}',
  notes           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS exercises (
  id              TEXT PRIMARY KEY,
  professional_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- NULL = biblioteca base
  name            TEXT NOT NULL,
  muscle_group    TEXT NOT NULL DEFAULT '',
  equipment       TEXT NOT NULL DEFAULT '',
  video_url       TEXT NOT NULL DEFAULT '',
  instructions    TEXT NOT NULL DEFAULT '',
  common_mistakes TEXT NOT NULL DEFAULT '',
  tips            TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS training_plans (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  goal            TEXT NOT NULL DEFAULT '',
  start_date      DATE,
  end_date        DATE,
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS workouts (
  id                TEXT PRIMARY KEY,
  plan_id           TEXT NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
  label             TEXT NOT NULL DEFAULT 'A',
  name              TEXT NOT NULL DEFAULT '',
  weekdays          SMALLINT[] NOT NULL DEFAULT '{}',
  order_index       INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER NOT NULL DEFAULT 50
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id           TEXT PRIMARY KEY,
  workout_id   TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  order_index  INTEGER NOT NULL DEFAULT 0,
  sets         INTEGER NOT NULL DEFAULT 3,
  reps_min     INTEGER NOT NULL DEFAULT 8,
  reps_max     INTEGER NOT NULL DEFAULT 12,
  load         NUMERIC(7, 2) NOT NULL DEFAULT 0,
  rest_seconds INTEGER NOT NULL DEFAULT 60,
  rir          INTEGER NOT NULL DEFAULT 2,
  cadence      TEXT NOT NULL DEFAULT '',
  method       TEXT NOT NULL DEFAULT '',
  notes        TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  workout_id  TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  -- dia do treino no fuso do personal; é por ele que a agenda conta
  session_date DATE NOT NULL,
  rpe         INTEGER,
  notes       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number          INTEGER NOT NULL,
  load                NUMERIC(7, 2) NOT NULL DEFAULT 0,
  reps                INTEGER NOT NULL DEFAULT 0,
  rpe                 INTEGER,
  done_at             TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pendente', 'respondido', 'atrasado')),
  answered_at     DATE,
  answers         JSONB,
  coach_reply     TEXT NOT NULL DEFAULT '',
  UNIQUE (student_id, week_start)
);

CREATE TABLE IF NOT EXISTS assessments (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  weight          NUMERIC(6, 2),
  height          NUMERIC(4, 2),
  body_fat        NUMERIC(5, 2),
  muscle_mass     NUMERIC(6, 2),
  measurements    JSONB NOT NULL DEFAULT '{}',
  notes           TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  angle      TEXT NOT NULL CHECK (angle IN ('frente', 'lateral', 'costas')),
  -- chave no storage; o arquivo nunca fica no banco
  file_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, month, angle)
);

/* Hábitos do dia. Cada coluna tem três estados, não dois:
     0 = o aluno ainda não respondeu
     1 = cumpriu a meta
     2 = não cumpriu
   A diferença entre 0 e 2 importa: "não respondi" não pode contar como falha
   no cálculo de consistência, senão todo dia futuro nasce reprovado. */
CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  water      SMALLINT NOT NULL DEFAULT 0,
  nutrition  SMALLINT NOT NULL DEFAULT 0,
  sleep      SMALLINT NOT NULL DEFAULT 0,
  steps      SMALLINT NOT NULL DEFAULT 0,
  supplement SMALLINT NOT NULL DEFAULT 0,
  notes      TEXT NOT NULL DEFAULT '',
  UNIQUE (student_id, date)
);

/* Bases criadas antes desta mudança têm as colunas como BOOLEAN. Converte no
   lugar, preservando o histórico: o que estava marcado vira "cumpriu". O bloco
   é idempotente — em base nova ou já convertida não faz nada. */
DO $$
DECLARE coluna TEXT;
BEGIN
  FOREACH coluna IN ARRAY ARRAY['water', 'nutrition', 'sleep', 'steps', 'supplement'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'habit_logs' AND column_name = coluna AND data_type = 'boolean'
    ) THEN
      EXECUTE format(
        'ALTER TABLE habit_logs
           ALTER COLUMN %I DROP DEFAULT,
           ALTER COLUMN %I TYPE SMALLINT USING (CASE WHEN %I THEN 1 ELSE 0 END),
           ALTER COLUMN %I SET DEFAULT 0',
        coluna, coluna, coluna, coluna);
    END IF;
  END LOOP;
END $$;

/* Desafios entre alunos. Duelo (1x1) ou grupo, sempre dentro do mesmo
   profissional — um aluno nunca disputa com aluno de outro personal.

   Dois tipos de meta convivem aqui, e a diferença define o resto do módulo:

   - Automática (treinos, hábitos): o app já mede. Nada a registrar, nada a
     validar, impossível de burlar esquecendo de postar.
   - Manual (cardio, abdominais, corrida): só o aluno sabe. Ele registra, e o
     desafio pode exigir foto como comprovação.

   O placar nunca é guardado: sai da soma dos registros e dos treinos que já
   existem. Um contador gravado viraria uma segunda verdade, que ficaria
   errada em silêncio assim que um registro fosse corrigido ou apagado. */
CREATE TABLE IF NOT EXISTS challenges (
  id              TEXT PRIMARY KEY,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('duelo', 'grupo')),
  goal            TEXT NOT NULL CHECK (goal IN
                    ('treinos', 'habitos', 'cardio_min', 'abdominais', 'corrida_km')),
  -- 'diario'/'semanal' contam períodos em que a meta foi batida;
  -- 'total' soma tudo no intervalo e o maior número vence.
  period          TEXT NOT NULL DEFAULT 'total' CHECK (period IN ('diario', 'semanal', 'total')),
  -- meta por período; 0 quando o desafio é só somar
  target          NUMERIC(8, 2) NOT NULL DEFAULT 0,
  require_photo   BOOLEAN NOT NULL DEFAULT FALSE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  created_at      DATE NOT NULL DEFAULT CURRENT_DATE,
  CHECK (end_date >= start_date)
);

/* Quem foi convidado e o que respondeu. Recusar é uma resposta registrada,
   não uma linha apagada: sem isso o convite reapareceria para sempre. */
CREATE TABLE IF NOT EXISTS challenge_members (
  id           TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'convidado'
               CHECK (status IN ('convidado', 'aceito', 'recusado', 'saiu')),
  responded_at DATE,
  UNIQUE (challenge_id, student_id)
);

/* Registros das metas manuais. Um por aluno por dia: registrar de novo no
   mesmo dia corrige o valor em vez de somar duas vezes, que é o que o aluno
   espera quando percebe que digitou errado. */
CREATE TABLE IF NOT EXISTS challenge_entries (
  id              TEXT PRIMARY KEY,
  challenge_id    TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  value           NUMERIC(8, 2) NOT NULL DEFAULT 0,
  -- chave no storage; visível para os participantes do desafio, e só
  photo_file_name TEXT NOT NULL DEFAULT '',
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_id, student_id, date)
);

/* Perfil visível para os outros alunos do mesmo personal. Desligado por
   padrão: aparecer numa lista para estranhos tem que ser escolha, não
   consequência de ter se cadastrado. Quem liga passa a ver e a ser visto —
   simétrico de propósito, para ninguém garimpar sem se expor. */
/* Senha de primeiro acesso: quem entra com ela troca antes de usar o app.
   O personal gera e enxerga essa senha para entregar ao aluno — e é justamente
   por isso que ela não pode virar a senha permanente de uma conta com dado de
   saúde de terceiro. */
/* Administrador: o dono do aplicativo e os sócios que ele liberar.
   É uma marca à parte de `role`, não um terceiro papel, porque o dono também
   é personal — virar 'admin' o expulsaria das telas de aluno dele. */
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

/* Planos de assinatura que o personal enxerga. Só o administrador cadastra.
   Preço em CENTAVOS, inteiro. Dinheiro em ponto flutuante acumula erro de
   arredondamento: 39.90 não existe exatamente em binário, e a soma de doze
   parcelas fecha alguns centavos fora. */
CREATE TABLE IF NOT EXISTS subscription_plans (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  months           INTEGER NOT NULL CHECK (months > 0),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  -- preço "de" riscado; 0 = sem desconto. O percentual sai da conta, não é
  -- guardado: guardado, ficaria mentindo assim que um dos dois mudasse.
  list_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (list_price_cents >= 0),
  installments     INTEGER NOT NULL DEFAULT 1 CHECK (installments > 0),
  description      TEXT NOT NULL DEFAULT '',
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  order_index      INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students ADD COLUMN IF NOT EXISTS public_profile BOOLEAN NOT NULL DEFAULT FALSE;

/* Consentimentos, um registro por decisão — nunca sobrescreve.
   A LGPD exige poder provar QUANDO a pessoa consentiu e COM QUAL texto, e
   exige que ela possa revogar. Guardar só o estado atual perderia as duas
   coisas: o histórico é o que sustenta a prova, e a revogação é só mais uma
   linha. O estado vigente é a linha mais recente de cada tipo. */
CREATE TABLE IF NOT EXISTS consents (
  id         TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  -- 'dados': tratar dado de saúde. 'imagem': usar fotos para avaliação.
  kind       TEXT NOT NULL CHECK (kind IN ('dados', 'imagem')),
  granted    BOOLEAN NOT NULL,
  -- versão do texto que a pessoa leu; se o texto mudar, o consentimento antigo
  -- continua provando o que foi aceito naquele dia
  version    TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* Metas que o personal define para cada aluno. Uma linha por aluno: são
   orientações vigentes, não histórico. */
CREATE TABLE IF NOT EXISTS habit_targets (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- em mililitros: inteiro evita o arredondamento de 3,5 L virar 3,4999
  water_ml        INTEGER NOT NULL DEFAULT 0,
  nutrition       TEXT NOT NULL DEFAULT '',
  supplement      TEXT NOT NULL DEFAULT '',
  updated_at      DATE
);

CREATE TABLE IF NOT EXISTS attendance (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  present         BOOLEAN NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  UNIQUE (student_id, date)
);

CREATE TABLE IF NOT EXISTS anamnesis (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answered_at     DATE,
  answers         JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '',
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Índices seguindo os acessos reais das telas ----------------------------------

CREATE INDEX IF NOT EXISTS idx_students_professional ON students(professional_id);
CREATE INDEX IF NOT EXISTS idx_exercises_professional ON exercises(professional_id);
CREATE INDEX IF NOT EXISTS idx_plans_student ON training_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_workouts_plan ON workouts(plan_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_date ON workout_sessions(student_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON workout_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sets_session ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON workout_sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_checkins_student ON checkins(student_id, week_start);
CREATE INDEX IF NOT EXISTS idx_checkins_professional_week ON checkins(professional_id, week_start);
CREATE INDEX IF NOT EXISTS idx_assessments_student ON assessments(student_id, date);
CREATE INDEX IF NOT EXISTS idx_photos_student ON progress_photos(student_id, month);
CREATE INDEX IF NOT EXISTS idx_habits_student_date ON habit_logs(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_professional_date ON attendance(professional_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_habit_targets_professional ON habit_targets(professional_id);
CREATE INDEX IF NOT EXISTS idx_consents_student ON consents(student_id, kind, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_professional ON challenges(professional_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_members_student ON challenge_members(student_id, status);
CREATE INDEX IF NOT EXISTS idx_challenge_members_challenge ON challenge_members(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_challenge ON challenge_entries(challenge_id, date);
CREATE INDEX IF NOT EXISTS idx_plans_ativos ON subscription_plans(active, order_index);

/* ------------------------------------------------- aulas presenciais (horário) */

/* Horário fixo da aula presencial, um registro por dia da semana.
   Ficou em tabela própria, e não como coluna em students, porque o mesmo aluno
   pode treinar terça às 18h e quinta às 7h — um único horário por aluno
   obrigaria a mentir em um dos dois dias.

   `students.training_days` continua sendo a grade (quais dias o aluno treina);
   esta tabela diz A QUE HORAS, e só existe para quem ocupa horário do personal.
   Dia sem linha aqui é dia de treino sem hora marcada: aparece na agenda, mas
   não gera cobrança de confirmação, porque não há horário para terminar.

   start_time é TEXT 'HH:MM' no fuso do personal, pelo mesmo motivo que as datas
   de calendário são DATE: é um horário comercial ("terça às 18h"), não um
   instante no tempo, e guardar como timestamptz faria a aula mudar de hora
   conforme o servidor. */
CREATE TABLE IF NOT EXISTS class_schedule (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  professional_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time      TEXT NOT NULL CHECK (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min    SMALLINT NOT NULL DEFAULT 60 CHECK (duration_min > 0),
  UNIQUE (student_id, weekday)
);

/* Tamanho do pacote de aulas contratado. 0 = aluno sem pacote (online, ou
   presencial em avulso), e aí a numeração "aula 4/12" simplesmente não aparece.
   O ciclo não é o mês civil: fecha quando completa o pacote — ao bater 12/12, a
   aula seguinte volta a ser 1/12. É assim que o aluno conta o que pagou. */
ALTER TABLE students ADD COLUMN IF NOT EXISTS monthly_classes SMALLINT NOT NULL DEFAULT 0;

/* A confirmação da aula pelo personal, em cima da presença que já existia.

   reason: '' aula dada | 'falta_aluno' | 'cancelada' | 'remarcada'
   consumes: se a aula saiu do pacote contratado.

   Os dois andam juntos mas não são a mesma coisa: aula dada e falta do aluno
   descontam do pacote (o horário foi reservado e perdido); cancelamento e
   remarcação não descontam. Guardar `consumes` em vez de deduzir de `reason`
   deixa o personal corrigir um caso fora da regra sem o app discordar depois.

   DEFAULT TRUE preenche o histórico que já existia: presença contava aula, e
   falta registrada antes desta tela era falta do aluno. */
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS reason       TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS consumes     BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS start_time   TEXT NOT NULL DEFAULT '';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_class_schedule_professional ON class_schedule(professional_id, weekday);
CREATE INDEX IF NOT EXISTS idx_class_schedule_student ON class_schedule(student_id);
