# ARCHITECTURE.md — Camaleonic Social Pilot

## 1. Resumen de la solución

**Camaleonic Social Pilot** (nombre provisional inicial: "Camaleonic Social Hub") es un SaaS multi-empresa (multi-workspace) que actúa como un "empleado virtual" de marketing y redes sociales: analiza la marca de cada empresa, genera ideas y contenidos adaptados a cada red social, los coloca en un calendario editorial, gestiona su aprobación y los publica automáticamente (o de forma asistida) en LinkedIn, Instagram, TikTok, Threads y X.

Filosofía de producto: **"Dedicar menos de 10 minutos por semana a gestionar todas las redes sociales de una empresa."**

El usuario entra, revisa el calendario generado por la IA, mueve lo que quiera y pulsa "Approve All". El sistema se encarga del resto.

### Principios de diseño

1. **Workspace-first**: todo cuelga de una empresa (Workspace). Un usuario puede pertenecer a varios workspaces. La Home lista empresas, no publicaciones.
2. **Brand Brain como fuente de verdad**: ninguna generación de IA debe inventar datos. Si falta información, el contenido se marca `NEEDS_VALIDATION` en lugar de alucinar.
3. **Arquitectura de adaptadores**: toda integración externa (redes sociales, proveedores de IA, generación de imagen/vídeo) pasa por una interfaz común. Hoy la mayoría de proveedores reales no están conectados (faltan credenciales); se usan adaptadores **simulados** que implementan la misma interfaz, de forma que activar la integración real en el futuro es un cambio de configuración, no de arquitectura.
4. **Niveles de automatización graduales**: Manual → Assisted → Pilot → Autopilot → Autopilot + Approval. El nivel se define por Workspace y opcionalmente por red social.
5. **Todo es revisable**: incluso en Autopilot, cada acción queda registrada (AuditLog) y es reversible mientras no se haya publicado.
6. **No monolito**: capas desacopladas — `core domain` (lógica de negocio pura), `adapters` (integraciones), `jobs` (trabajos en segundo plano), `ui` (Next.js App Router).

## 2. Arquitectura propuesta

```
┌──────────────────────────────────────────────────────────────────┐
│                          Next.js App Router                        │
│  ui/(marketing)  ui/(app)/w/[workspaceId]/*   ui/(auth)/*          │
│  Server Components + Server Actions + Route Handlers (API)         │
└───────────────┬───────────────────────────────┬────────────────────┘
                │                               │
       Server Actions / tRPC-like               │ Webhooks entrantes
       calls a "services"                       │ (estado de publicación)
                │                               │
┌───────────────▼───────────────────────────────▼────────────────────┐
│                         Domain / Services layer                     │
│  strategy · ideas · content · calendar · approvals · automations    │
│  brandBrain · analytics · contentScore · notifications              │
└───────────────┬───────────────────────────────┬────────────────────┘
                │                               │
     ┌──────────▼─────────┐          ┌──────────▼───────────┐
     │   AI Provider layer │          │  Social Adapter layer │
     │  (interface + impls)│          │ (interface + impls)   │
     │  OpenAI/Anthropic/  │          │ LinkedIn/Instagram/   │
     │  Mock                │          │ TikTok/Threads/X      │
     └──────────┬──────────┘          └──────────┬────────────┘
                │                               │
     ┌──────────▼───────────────────────────────▼────────────┐
     │              Job Queue (background workers)             │
     │  content-generation · publish · analytics-sync ·        │
     │  website-crawl · scheduled-cron                          │
     └──────────┬────────────────────────────────────────────┘
                │
     ┌──────────▼────────────┐
     │   PostgreSQL (Supabase) │
     │   + Storage (Supabase)  │
     └─────────────────────────┘
```

### Capas

- **UI (Next.js App Router + TypeScript)**: Server Components para lectura, Server Actions para mutaciones simples, Route Handlers (`/api/*`) para webhooks y llamadas que necesitan streaming (generación IA) o son invocadas por servicios externos (cron, webhooks de redes sociales).
- **Domain/Services** (`src/server/services/*`): lógica de negocio pura, independiente de Next.js y de proveedores concretos. Reciben adaptadores inyectados (patrón puerto-adaptador / hexagonal).
- **AI Provider layer** (`src/server/ai/*`): interfaz `AIProvider` con métodos por función (generar ideas, redactar, adaptar por plataforma, resumir, evaluar calidad, traducir, generar prompt visual, generar guion). Implementaciones: `MockAIProvider` (por defecto, determinista y basado en plantillas + Brand Brain), y adaptadores reales opcionales (`AnthropicProvider`, `OpenAIProvider`) activables por variable de entorno.
- **Social Adapter layer** (`src/server/integrations/*`): interfaz `SocialAdapter` común a las 5 redes. Implementación `SimulatedAdapter` por defecto; adaptadores reales (`LinkedInAdapter`, etc.) documentados en `INTEGRATIONS.md`, activables cuando existan credenciales OAuth.
- **Job Queue**: en MVP, cola ligera basada en tabla `JobQueue` en PostgreSQL con polling (patrón "poor man's queue": `SELECT ... FOR UPDATE SKIP LOCKED`), ejecutada por un worker Node desacoplado (`src/server/jobs/worker.ts`) y por Vercel Cron para los disparos programados. Preparado para migrar a una cola real (BullMQ + Redis, o Supabase Queues) sin cambiar la interfaz `enqueue/process`.
- **Persistencia**: PostgreSQL vía Supabase (DB + Auth + Storage) y Prisma como ORM/type-safety. RLS de Supabase como segunda capa de defensa además de la autorización a nivel de aplicación.

## 3. Stack tecnológico

**Frontend**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Lucide Icons · React Hook Form · Zod · Recharts · `@dnd-kit` para drag & drop del calendario.

**Backend**: Server Actions + Route Handlers · Prisma ORM · PostgreSQL (Supabase, tanto en desarrollo como en producción) · Supabase Storage · cola basada en tabla + worker Node · Vercel Cron. Autenticación propia (cookie firmada + scrypt) en vez de Supabase Auth por ahora — ver sección de seguridad más abajo.

**Calidad**: ESLint + Prettier · Vitest (unit) · Playwright (e2e, fase 8) · Zod para validación en todas las fronteras (Server Actions, Route Handlers).

**Infra**: Vercel (app + cron) · Supabase (db/auth/storage) · `.env.local` / `.env.example` · Docker Compose opcional para Postgres local.

## 4. Estructura de carpetas

```
camaleonic-social-pilot/
├── ARCHITECTURE.md
├── DATABASE.md
├── INTEGRATIONS.md
├── ROADMAP.md
├── README.md
├── docker-compose.yml            # Postgres local opcional
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── (marketing)/           # landing pública (fase posterior)
│   │   ├── (auth)/login/ register/ invite/
│   │   ├── (app)/
│   │   │   ├── page.tsx           # Home: lista de Workspaces
│   │   │   ├── new/               # crear empresa
│   │   │   └── w/[workspaceId]/
│   │   │       ├── layout.tsx     # sidebar + topbar del workspace
│   │   │       ├── page.tsx       # Dashboard
│   │   │       ├── calendar/
│   │   │       ├── create/        # Content Engine
│   │   │       ├── ideas/
│   │   │       ├── posts/
│   │   │       ├── automations/
│   │   │       ├── campaigns/
│   │   │       ├── analytics/
│   │   │       ├── brand-brain/
│   │   │       ├── library/
│   │   │       ├── accounts/      # redes conectadas
│   │   │       ├── team/
│   │   │       └── settings/
│   │   └── api/
│   │       ├── cron/*             # invocado por Vercel Cron
│   │       ├── webhooks/*         # callbacks de cada red social
│   │       └── jobs/*             # invocación manual de jobs (debug)
│   ├── components/
│   │   ├── ui/                    # shadcn/ui
│   │   ├── layout/
│   │   ├── calendar/
│   │   ├── content/
│   │   ├── charts/
│   │   └── shared/
│   ├── server/
│   │   ├── services/              # dominio (strategy, ideas, content, calendar...)
│   │   ├── ai/                    # AIProvider + implementaciones
│   │   ├── integrations/          # SocialAdapter + implementaciones por red
│   │   ├── media/                 # ImageProvider / VideoProvider
│   │   ├── jobs/                  # cola + workers + definiciones de job
│   │   ├── auth/                  # sesión, permisos, RLS helpers
│   │   └── db/                    # cliente Prisma singleton
│   ├── lib/                       # utils compartidos, zod schemas, constants
│   ├── data/                      # mocks/demo seeds usados por la UI en fase visual
│   └── types/
├── tests/
│   ├── unit/
│   └── e2e/
└── .env.example
```

## 5. Modelo de Workspaces

Cada empresa es un `Workspace` (equivalente a "Organization" del enunciado original, renombrado para reflejar el producto final). Un `Workspace` agrupa: Brand Brain, estrategia, cuentas sociales, calendario, campañas, automatizaciones, biblioteca, analítica y equipo. Los usuarios tienen `Membership` con rol (`OWNER`, `ADMIN`, `EDITOR`, `REVIEWER`, `VIEWER`) por workspace — un mismo usuario puede tener roles distintos en distintas empresas.

La Home (`/`) lista los workspaces del usuario con su estado global (`Autopilot`, `Pending Approval`, `Manual`, etc.) y un botón "+ Nueva Empresa" que lanza el onboarding.

## 6. Niveles de automatización (Automation Level)

| Nivel | Comportamiento |
|---|---|
| `MANUAL` | El usuario crea, edita y publica cada contenido. |
| `ASSISTED` | La IA prepara el contenido; el usuario aprueba pieza a pieza. |
| `PILOT` | La IA genera y programa según reglas aprobadas; requiere aprobación en bloque (semana/mes) antes de publicar. |
| `AUTOPILOT` | La IA genera, programa y publica sin aprobación previa, dentro de las reglas y el Content Score mínimo definidos. |
| `AUTOPILOT_APPROVAL` | Como Autopilot, pero solicita una única aprobación en bloque semanal o mensual antes de publicar ("piloto automático con validación"). |

Se define a nivel de `Workspace` y puede sobrescribirse por `SocialAccount`.

## 7. Seguridad

- Autenticación propia (`src/server/auth/`): cookie de sesión firmada con HMAC-SHA256 + contraseñas con scrypt (no texto plano). Pendiente de migrar a Supabase Auth (email/password + magic link) — no es imprescindible mientras el acceso esté limitado al propio equipo. Sesión validada en cada Server Action.
- Autorización: a nivel de aplicación, por Workspace (`requireWorkspaceAccess(userId, workspaceId, roles)`), verificada en cada Server Action/Route Handler — no depende de Row Level Security de Postgres (RLS no está activado; sería una segunda capa de defensa a añadir si se migra a Supabase Auth).
- Tokens de integración (`IntegrationToken`) cifrados en reposo con AES-256-GCM (clave en `TOKEN_ENCRYPTION_KEY`, nunca en el repo).
- Validación de entrada con Zod en todas las Server Actions y Route Handlers.
- Rate limiting básico en Route Handlers públicos (webhooks, enlaces de revisión sin cuenta).
- CSRF: Server Actions de Next.js ya incluyen protección; Route Handlers de mutación exigen header custom + origen validado.
- Confirmación explícita (modal) para: publicar inmediatamente, activar Autopilot, eliminar cuentas conectadas, eliminar workspace.
- `AuditLog` inmutable por cada cambio de estado relevante (aprobación, publicación, cambio de rol, cambio de nivel de automatización).
- RGPD: exportación y borrado de datos por Workspace (fase posterior), datos de terceros (redes sociales) limitados a lo necesario para operar.

## 8. Qué NO se implementa todavía (y por qué)

Ver `INTEGRATIONS.md` para el detalle plataforma a plataforma. En resumen: no hay credenciales OAuth reales de LinkedIn/Instagram/TikTok/Threads/X ni claves de proveedores de imagen/vídeo en este entorno, por lo que el MVP usa adaptadores simulados que:

- Generan una respuesta con la misma forma que la API real (`externalId`, `url`, `status`).
- Registran la acción como si se hubiera publicado, marcando claramente `simulated: true` en el registro.
- Dejan preparada la superficie (variables de entorno, tipos, mapeo de scopes) para activar la integración real sin tocar el dominio.
