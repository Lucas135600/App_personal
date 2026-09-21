# LB Personal Trainner

Plataforma de assessoria, treino e acompanhamento de alunos — painel web para o personal e
aplicativo (web mobile) para o aluno.

> Marca: **Lucas Braz Personal** · Produto: **LB Personal Trainner**
> A arquitetura já nasce multi-tenant: toda entidade ligada ao aluno carrega `professionalId`,
> então outros profissionais podem ser adicionados depois sem migração de dados.

---

## Rodando

```bash
npm install
```

```bash
npm run dev
```

Abra <http://localhost:3000>. Não precisa instalar Postgres nem criar conta: o app sobe um
**PGlite** (o próprio Postgres compilado em WASM) em `data/pg` e o popula com os dados de
demonstração no primeiro acesso. As fotos ficam em `data/uploads/`.

O mesmo SQL roda no Supabase em produção — o que passa aqui passa lá.

Para rodar a build de produção localmente (`npm run build && npm start`), crie um `.env.local`:

```bash
node -e "console.log('LB_SESSION_SECRET='+require('crypto').randomBytes(32).toString('hex'))" > .env.local
```

O app **se recusa a subir em produção sem essa chave** — veja a seção de segurança.

Para testar no celular, use o IP da máquina na mesma rede — o dev server já escuta em `0.0.0.0`:

```bash
ipconfig
```

Depois acesse `http://SEU_IP:3000` no celular.

### Acessos de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Personal | `lucas@lbpersonal.com` | `lb123456` |
| Aluno | `joao@aluno.com` | `aluno123` |
| Aluno (check-in pendente) | `maria@aluno.com` | `aluno123` |
| Aluno (baixa adesão) | `pedro@aluno.com` | `aluno123` |

Outros alunos: `ana@`, `rafael@`, `carla@aluno.com` — todos com senha `aluno123`.

### Recriar a base

```bash
npm run seed:reset
```

Apaga `data/` por completo. O seed é recriado no próximo acesso.

---

## O que já está implementado (MVP)

### Área do personal (`/app`)

- **Dashboard** — não é uma lista de alunos: é uma central de atenção. Responde “quem precisa de
  mim hoje?” a partir de um motor de regras (check-in pendente/atrasado, dias sem treinar,
  avaliação vencida, foto mensal pendente, frequência baixa).
- **Alunos** — lista com busca e filtros (presencial / online / híbrido / check-in pendente /
  baixa frequência / avaliação pendente), cartão com radar de adesão.
- **Perfil do aluno** com abas: visão geral, treinos, check-ins, avaliações, evolução, anamnese,
  hábitos e histórico. A aba **Histórico** abre com um calendário de frequência do aluno: cada dia
  pintado mostra se ele treinou (com a letra do treino), faltou, estava previsto sem registro ou
  não tinha treino marcado. Navega por mês e soma previstas, realizadas, faltas e aproveitamento.
- **Prescrição de treino** — bloco ativo, treinos A/B/C, exercícios com séries, faixa de
  repetições, carga, descanso, RIR, cadência e observação.
- **Biblioteca de exercícios** — cadastro próprio, grupo muscular, equipamento, vídeo,
  instruções, erros comuns e dicas.
- **Check-ins** — painel semanal com respondidos / pendentes / atrasados e resposta do personal.
- **Avaliação física** — peso, altura, IMC calculado, gordura, massa magra, 6 circunferências,
  gráficos temporais.
- **Agenda** — calendário mensal navegável: cada dia mostra quem treina, com presença confirmada
  (bolinha cheia) ou apenas prevista (bolinha vazada). Clicar num dia abre o painel para registrar
  presença ou falta **naquela data**, não só hoje. Contadores de aulas da semana e do mês, mais uma
  tabela de previstas × realizadas por aluno — a base para fechar cobrança.

  A contagem separa **aulas presenciais** (presencial e híbrido, que ocupam seu horário) de
  **treinos online** (que o aluno registra sozinho). Somar os dois daria um número inútil para medir
  carga de trabalho. Aula presencial só conta como realizada quando você registra a presença.
- **Avisos** — central que junta duas coisas: os *alertas* calculados na hora pelo motor de regras
  ("quem precisa de ação") e a *atividade recente* dos alunos (treino concluído, check-in
  respondido, foto nova, anamnese preenchida). O contador de não lidos fica no menu.
- **Minha conta** — troca de nome, e-mail de acesso e senha. A troca de senha exige a senha atual.

### Aplicativo do aluno (`/aluno`)

- **Início** — “o que fazer hoje”: treino, check-in, foto do mês, hábitos, com barra de adesão
  da semana.
- **Execução do treino** — cronômetro de sessão, série a série com carga/reps/RPE, carga anterior
  sempre à vista, timer de descanso com +30s e pular, vídeo e instruções do movimento, RPE final
  de 1 a 10 e observações.
- **Check-in semanal** — escalas visuais, dor, peso e texto livre; dispara notificação ao personal.
- **Evolução** — gráficos de peso, cintura e frequência + fotos mensais (frente, lateral, costas)
  com comparação por cursor deslizante. A foto é redimensionada e comprimida no próprio celular
  antes do envio.
- **Hábitos** — água, alimentação, sono, passos e suplementação; grade semanal e consistência.
- **Anamnese** — formulário em 5 etapas curtas (objetivo, treino, saúde, rotina, esportivo).
- **Perfil** — plano, números e avisos.

### Decisões que valem registro

- **Check-in não é só do aluno online.** Alunos presenciais entram no mesmo ciclo, com presença
  registrada pelo personal na agenda e no fechamento do treino.
- **“Hábitos”, não “dieta”.** O módulo é registro e acompanhamento de hábitos, não prescrição
  nutricional — isso exige profissional habilitado.
- **Fotos de evolução são dado sensível.** Ficam fora da pasta pública: são servidas pela rota
  `/api/foto/[name]`, que valida a sessão e só entrega a imagem para o próprio aluno ou para o
  personal responsável por ele.
- **Nenhum conteúdo de terceiros.** A biblioteca vem com 24 exercícios descritos, mas sem vídeos:
  o campo fica vazio para você anexar material próprio ou licenciado.
- **A foto é comprimida antes de sair do celular.** Em `photo-uploader.tsx`, a imagem é
  redimensionada para no máximo 1280px e reencodada em JPEG a 82% de qualidade — medido, uma foto
  de 3,5 MB vira ~330 KB. Isso muda a ordem de grandeza da conta de storage: com 47 alunos × 3
  ângulos por mês, são ~500 MB por **ano** em vez de por mês. Se qualquer etapa falhar, o arquivo
  original é enviado como estava.
- **As fotos de demonstração são desenhadas por código**, não são fotos de pessoas. Um gerador de
  PNG puro (`placeholder-photo.ts`, sem dependências) cria silhuetas cuja cintura afina mês a mês,
  só para a tela de comparação ter conteúdo antes de existir foto real.

---

## Stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| Web | Next.js 15 (App Router) + React 19 + TypeScript | server components e server actions eliminam quase toda a camada de API no MVP |
| Estilo | Tailwind CSS v4 | design system por tokens em `globals.css` |
| Gráficos | SVG próprio (`src/components/charts.tsx`) | zero dependência, renderiza no servidor, leve no celular |
| Dados | Postgres — Supabase em produção, PGlite em desenvolvimento | mesmo SQL nos dois; desenvolver não exige conta nem instalação |
| Sessão | cookie HttpOnly assinado com HMAC | sem dependência de auth externa no MVP |

### Como os dados são lidos

`getDb()` devolve um retrato do banco **já limitado ao profissional da sessão** — um punhado de
consultas fixo, independente da quantidade de alunos. Buscar aluno por aluno daria dezenas de
idas ao banco por tela, e em serverless cada ida custa latência de rede. O `cache()` do React
garante uma carga por requisição mesmo quando a página chama `getDb()` em vários lugares.

O escopo é o próprio isolamento multi-tenant: um profissional nunca carrega linha de outro.

As escritas não passam por aí. Cada uma é um comando SQL dirigido em `repo-write.ts`, e as que
tocam mais de uma tabela vão em transação. É a diferença que mais importa em relação ao arquivo
JSON anterior: lá toda escrita regravava o arquivo inteiro, e dois alunos salvando ao mesmo
tempo perdiam uma das gravações.

### Segurança

**Segredo de sessão obrigatório.** O cookie é assinado com `LB_SESSION_SECRET`. Existe um valor
de desenvolvimento, mas ele é público neste repositório: quem o lê forja o cookie de qualquer
usuário, inclusive o do personal. Por isso, em produção, a aplicação falha na inicialização se a
chave não estiver definida — alto e cedo, em vez de silenciosamente insegura.

**Senhas em scrypt.** O projeto usava SHA-256 sem sal, que uma GPU testa aos bilhões por segundo.
Agora cada verificação custa ~63 ms e exige memória, o que inviabiliza força bruta em escala.
Senhas no formato antigo **continuam entrando e são regravadas em scrypt no primeiro login**, sem
ninguém precisar redefinir nada.

**Fotos nunca saem por URL pública.** O bucket é privado e não usamos link assinado — link vaza se
for copiado, e isto é dado de saúde. Quem decide se a imagem pode ser vista é a rota `/api/foto`,
validando a sessão a cada requisição.

### Verificando o banco

```bash
npm run db:test
```

Sobe um Postgres descartável e confere os invariantes que o banco passou a garantir: presença e
hábito não duplicam, check-in é único por semana, foto é única por mês e ângulo, salvar parte da
anamnese não apaga o resto, sessão e séries entram juntas ou nenhuma entra, apagar treino não
deixa linha órfã, e um profissional não alcança aluno de outro.

---

## Estrutura

```
src/
  app/
    login/                    login + formulário
    app/                      painel do personal
      alunos/[id]/tabs.tsx    as 8 abas do perfil do aluno
      avisos/ conta/ checkins/ exercicios/ agenda/
    aluno/                    aplicativo do aluno (mobile first)
      treinos/[id]/runner.tsx execução do treino
      checkin/ evolucao/ habitos/ anamnese/ perfil/
    api/foto/[name]/          entrega autenticada das fotos de evolução
  components/                 design system, gráficos, navegação
  lib/
    types.ts                  modelo de dados
    schema.sql                as 15 tabelas, com índices e restrições
    sql.ts                    conexão: Postgres em produção, PGlite em desenvolvimento
    repo.ts                   leitura: SQL -> domínio, e o retrato por profissional
    repo-write.ts             escrita: um comando dirigido por operação de negócio
    scope.ts                  getDb() — retrato limitado à sessão
    db.ts                     ids, hash de senha e arquivos
    seed.ts                   dados de demonstração
    seed-photos.ts            gera as fotos de evolução da demonstração
    placeholder-photo.ts      encoder PNG + silhueta sintética (sem dependências)
    queries.ts                visões derivadas: adesão, alertas, séries temporais
    anamnesis.ts              definição das etapas da anamnese
    actions/                  server actions (auth, personal, student)
scripts/reset-db.mjs
data/                         base local e uploads (fora do git)
```

---

## App no celular (PWA)

A plataforma é instalável na tela inicial do Android e do iPhone, **sem loja e sem conta de
desenvolvedor**. Você manda um link, o aluno instala em menos de um minuto.

| Peça | Onde |
| --- | --- |
| Manifest | [src/app/manifest.ts](src/app/manifest.ts) — nome, ícones, cor, atalhos |
| Service worker | [public/sw.js](public/sw.js) |
| Página offline | [public/offline.html](public/offline.html) |
| Registro + faixa de instalação | [src/components/pwa.tsx](src/components/pwa.tsx) |
| Instruções para o aluno | `/instalar` — [src/app/instalar/page.tsx](src/app/instalar/page.tsx) |
| Ícones | `npm run icons` gera `public/icons/` por código, sem arquivo de design |

### O que o service worker faz — e o que ele deliberadamente não faz

Este app é **multiusuário e autenticado**, então cache agressivo seria um defeito, não uma
otimização:

- **HTML nunca é cacheado.** Se fosse, a tela de um aluno reapareceria para outro no mesmo
  aparelho, e o treino velho continuaria na tela depois de você atualizar. Navegação é sempre
  rede, com a página offline como último recurso.
- **`/api/foto/*` nunca entra em cache** — foto de evolução é dado sensível.
- **Server actions (POST) não são interceptadas.**
- Só entram em cache os estáticos do build (`/_next/static/`, com hash no nome) e os ícones.

O service worker **só é registrado em produção**. Em `npm run dev` o Next troca os chunks a cada
salvamento e um worker ativo deixaria a tela velha na sua frente.

### Testando a instalação

```bash
npm run build
```

```bash
npm start
```

Abra `/instalar`. No Chrome, DevTools → Application → Service Workers deve mostrar o worker
ativo, e o menu do navegador deve oferecer "Instalar aplicativo".

### O que falta para o aluno instalar de verdade

Um **endereço público em HTTPS**. Service worker e instalação só funcionam em HTTPS (ou em
`localhost`, para teste). Enquanto a plataforma estiver no seu computador, não há link para
mandar. Resolver a hospedagem resolve o app no celular junto — é a mesma tarefa.

### Onde ficam as fotos

`storage.ts` decide sozinho: em desenvolvimento grava em `data/uploads`, em produção envia para o
Supabase Storage. Disco de servidor serverless é efêmero e somente leitura, então em produção o
arquivo não pode ficar no servidor.

### E o APK / a App Store?

- **iOS não tem APK.** O equivalente é um `.ipa`, que exige macOS com Xcode para compilar e conta
  Apple Developer paga para distribuir. O PWA é o único caminho sem isso.
- **APK Android é possível** depois da hospedagem, empacotando o site como TWA (Bubblewrap) ou
  Capacitor. Mas seria uma casca apontando para a mesma URL: como as telas são renderizadas no
  servidor, o APK não roda sozinho. Ganha-se a presença na Play Store, não funcionalidade.
- Ordem certa: **hospedar → PWA (já pronto) → avaliar a Play Store depois**, se fizer diferença
  comercial para você.

## Sobre notificação por e-mail

A plataforma **não envia e-mail**. Toda notificação é in-app: os eventos viram linhas em
`notifications` e aparecem em `/app/avisos` (personal) e no perfil do aluno.

Para enviar por e-mail faltam três coisas, e a terceira é a que manda:

1. um provedor de disparo (Resend, Brevo, SES) — a faixa gratuita cobre este volume;
2. a chave de API em `.env.local`, que fica com você, não no código;
3. **a plataforma hospedada.** Rodando no localhost, só sai e-mail com o PC ligado e o
   `npm run dev` aberto. Um resumo diário que falha nos dias em que a máquina estava desligada é
   pior que não ter resumo — por isso o e-mail vem depois da migração, não antes.

Quando for, o formato deve ser **um resumo por dia** ("3 treinos, 2 check-ins, Pedro sem treinar
há 9 dias"), não um e-mail por evento: com algumas dezenas de alunos, notificação por evento vira
caixa de entrada entupida e deixa de ser lida.

## Próximos passos sugeridos

1. **Mensagens** personal ↔ aluno (a tabela de notificações já existe).
2. **Notificações push e resumo diário por e-mail** — hoje os avisos são in-app; o passo é Web
   Push (PWA) e um digest diário, ambos dependentes da hospedagem.
3. **PWA** — manifest e service worker para instalar no celular sem loja.
4. **Migração para Postgres/Supabase** — trocar `db.ts` por um client real, mantendo `queries.ts`.
5. **Gamificação** — conquistas e sequência (a sequência já é calculada na tela de treino concluído).
6. **App nativo** (React Native/Expo) reaproveitando a mesma API.
7. **LGPD** — termo de consentimento no primeiro acesso, exportação e exclusão de dados do aluno.

> IA fica para depois do MVP, como planejado: resumo semanal do aluno, detecção de queda de
> adesão e sugestão de ajuste de treino — sempre como apoio à decisão, nunca substituindo
> prescrição profissional.
