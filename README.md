# Camaleonic Social Pilot

> "Dedicar menos de 10 minutos por semana a gestionar todas las redes sociales de una empresa."

SaaS multi-empresa que centraliza y automatiza la creación y publicación de contenido en LinkedIn, Instagram, TikTok, Threads y X, con un Brand Brain propio por empresa, generación de ideas y copys con IA, calendario editorial con aprobación en bloque, y un motor de automatización con varios niveles de autonomía (Manual → Asistido → Piloto → Autopilot).

Documentación de referencia:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitectura, capas y decisiones de diseño.
- [`DATABASE.md`](./DATABASE.md) — modelo de datos.
- [`INTEGRATIONS.md`](./INTEGRATIONS.md) — estado real de cada integración social y sus limitaciones.
- [`ROADMAP.md`](./ROADMAP.md) — fases, criterios de aceptación del MVP y riesgos.

## Stack

Next.js 16 (App Router, React 19) · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 7 (PostgreSQL vía Supabase, tanto en local como en producción) · Zod · React Hook Form · Recharts · @dnd-kit · Vitest.

## Arranque rápido (desarrollo local)

Requiere un proyecto de Supabase (base de datos Postgres + Storage) — ver `DATABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` en `.env.example`. No requiere Docker ni claves de IA: los proveedores de IA/imagen/vídeo/redes sociales funcionan con adaptadores simulados por defecto.

```bash
npm install
npx prisma db push      # aplica el schema a tu proyecto de Supabase
npx prisma db seed      # datos demo (ver credenciales abajo)
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Inicia sesión con:

```
Email:    demo@camaleonicanalytics.com
Password: camaleonic2026
```

El seed crea 5 empresas de demo: **Camaleonic Survey** (completa: Brand Brain, ideas, contenido publicado con métricas, contenido pendiente de aprobación y contenido ya programado) y cuatro workspaces más ligeros (Camaleonic Analytics, Formula E, MIC Football, Reto Pelayo) con distintos niveles de automatización, para ver la Home con varios estados a la vez.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Tests unitarios (Vitest) |
| `npm run db:push` | Aplica `prisma/schema.prisma` a la base de datos |
| `npm run db:seed` | Repuebla los datos de demo |
| `npm run db:studio` | Explorador visual de la base de datos (Prisma Studio) |

## Modo de auth en desarrollo

No hay credenciales de Supabase configuradas en este entorno, así que la autenticación usa un modo "demo auth" local (registro/login con email + contraseña, sesión firmada por cookie — ver `src/server/auth/`). Es funcional de extremo a extremo, pero está pensado para sustituirse por Supabase Auth en producción; el resto de la aplicación (autorización por rol, `AuditLog`, etc.) no depende de qué proveedor de auth haya detrás.

## Qué es real y qué está simulado

- **IA**: por defecto (`AI_PROVIDER=mock`, como en este entorno) `MockAIProvider` genera ideas, copys, ajustes de tono/longitud y Content Score usando plantillas + los datos reales del Brand Brain — sin llamar a ningún LLM externo. Con `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` se activa `AnthropicAIProvider` (Claude real, salida estructurada con Zod) — implementado pero no probado contra la API real en este entorno, ver `INTEGRATIONS.md`.
- **Imagen**: por defecto (`IMAGE_PROVIDER=mock`) `MockImageProvider` genera un SVG con los colores y el nombre de marca — sin proveedor externo. Con `IMAGE_PROVIDER=openai` (`OPENAI_API_KEY`) o `IMAGE_PROVIDER=fal` (`FAL_KEY`, modelo Flux) se activa generación real — implementadas pero no probadas contra la API real aquí.
- **Vídeo**: por defecto (`VIDEO_PROVIDER=mock`) `MockVideoProvider` genera guion + storyboard estructurado, no un archivo de vídeo real. Con `VIDEO_PROVIDER=fal` + `FAL_KEY` se activa `FalVideoProvider` (Kling o Wan, según `FAL_VIDEO_MODEL`) — vídeo real vía fal.ai, tampoco probado contra la API real aquí. Ver `INTEGRATIONS.md` para la nota sobre llamadas síncronas potencialmente lentas.
- **Redes sociales**: por defecto (`SOCIAL_PROVIDER=simulated`) las 5 plataformas usan `SimulatedAdapter`, que implementa la interfaz `SocialAdapter` completa (conectar cuenta, publicar, programar, analítica...) sin credenciales reales. Con `SOCIAL_PROVIDER=metricool` + `METRICOOL_USER_TOKEN/USER_ID` (plan Metricool Advanced) se activa `MetricoolAdapter`, una única integración real para las 5 redes — implementado pero no probado contra una cuenta real todavía, ver [`INTEGRATIONS.md`](./INTEGRATIONS.md).
- **Cola de publicación**: la tabla `JobQueue` + `processDueJobs()` implementan reintentos con backoff exponencial e idempotencia. En producción se dispara desde Vercel Cron (`vercel.json` + `/api/cron/process-jobs`); en este entorno de desarrollo, sin worker persistente, también se procesa de forma oportunista al visitar el Dashboard o el Calendario de una empresa.

## Estructura

Ver la sección "Estructura de carpetas" de [`ARCHITECTURE.md`](./ARCHITECTURE.md). En resumen: `src/app` (rutas), `src/components` (UI), `src/server/services` (dominio), `src/server/ai` y `src/server/integrations` (adaptadores), `prisma/` (schema + seed).
