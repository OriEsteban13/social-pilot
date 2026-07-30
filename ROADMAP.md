# ROADMAP.md

## Estado actual

🟢 En construcción — Fase 1 (planificación) completa, Fase 2-3 (base + MVP visual) en curso en este mismo commit inicial.

## Fases

### Fase 1 — Planificación ✅
- [x] Arquitectura (`ARCHITECTURE.md`)
- [x] Modelo de datos (`DATABASE.md`)
- [x] Integraciones y limitaciones (`INTEGRATIONS.md`)
- [x] Roadmap (este documento)

### Fase 2 — Base del proyecto ✅
- [x] Next.js 14 (App Router) + TypeScript
- [x] Tailwind CSS + shadcn/ui + Lucide
- [x] ESLint + Prettier
- [x] `.env.example`
- [x] Prisma + schema completo (PostgreSQL vía Supabase, local y producción)
- [x] Cliente Supabase (Storage) conectado a un proyecto real; Auth sigue pendiente (ver Seguridad en `ARCHITECTURE.md`)
- [x] Layout principal (Home de workspaces + layout de workspace con sidebar)

### Fase 3 — MVP visual ✅ (con datos seed reales en DB, no mocks sueltos)
- [x] Home (lista de empresas/workspaces)
- [x] Dashboard por workspace
- [x] Calendario (mes/semana/lista + panel lateral de edición)
- [x] Ideas
- [x] Content Engine (crear + generar variantes por plataforma)
- [x] Brand Brain
- [x] Biblioteca
- [x] Automatizaciones
- [x] Analítica
- [x] Equipo / Configuración / Redes conectadas

### Fase 4 — Backend real
- [x] Modelo de datos aplicado (Prisma migrate / db push)
- [x] Server Actions con Zod para CRUD principal
- [x] Autorización por rol y workspace
- [ ] Subida de archivos de usuario (logos, PDFs para Brand Brain, etc.) — hoy son campos de URL que se pegan a mano (`brand-assets.tsx`), no una subida real. Lo único conectado a Supabase Storage por ahora es la subida automática de imágenes generadas por IA (`src/server/storage/supabase-storage.ts`), y solo cuando hace falta una URL pública real (ver Fase 5/6)
- [x] Cola de jobs (tabla `JobQueue` + worker)
- [x] Cron (Vercel Cron → `/api/cron/*`)
- [x] `AuditLog` en mutaciones sensibles

### Fase 5 — IA
- [x] Brand Brain: extracción estructurada desde `WebsiteSource` / `DocumentSource` (mock parser + `AnthropicAIProvider.analyzeWebsite` real con fetch de la web)
- [x] Generación de ideas (`MockAIProvider` por defecto; `AnthropicAIProvider` real vía `AI_PROVIDER=anthropic`)
- [x] Generación de copy multi-plataforma (real con Claude, salida estructurada con Zod)
- [x] Adaptación de tono/longitud/idioma
- [x] Content Score (0-100)
- [x] Generación de imágenes real: `OpenAIImageProvider` (`gpt-image-1`) o `FalImageProvider` (Flux vía fal.ai) — `IMAGE_PROVIDER=openai|fal` — ninguna probada contra la API real en este entorno, ver `INTEGRATIONS.md`
- [x] Generación de vídeo real: `FalVideoProvider` (Kling o Wan vía fal.ai) — `VIDEO_PROVIDER=fal`, modelo con `FAL_VIDEO_MODEL=kling|wan`. Llamada síncrona (ver riesgos); tampoco probada contra la API real
- [x] Artículos de blog (`BlogArticle`, contenido paralelo a las publicaciones sociales — sin límite de caracteres, sin adaptador de publicación): ideas de tipo "Artículo de blog" elegibles al generar ideas (`contentKind`), sección `/blog` con generación con IA, edición y flujo aprobar/solicitar cambios/marcar publicado (manual, sin integración con ningún CMS)

### Fase 6 — Integraciones sociales
- [x] Interfaz `SocialAdapter` común
- [x] `SimulatedAdapter` para las 5 redes
- [x] `MetricoolAdapter` real (las 5 redes vía una única integración, plan Advanced) — activar con `SOCIAL_PROVIDER=metricool`. No probado contra una cuenta real todavía (parseo de respuestas defensivo) — ver `INTEGRATIONS.md`
- [ ] Contratar el plan Metricool Advanced y conectar las cuentas reales de cada empresa en app.metricool.com
- [ ] Adaptadores nativos directos por red — documentados como alternativa futura en `INTEGRATIONS.md`, no necesarios mientras Metricool cubra las 5 redes

### Fase 7 — Automatización end-to-end
- [x] Motor de reglas (`Automation` + `AutomationRun`)
- [x] Aprobación individual / semanal / mensual
- [x] Publicación (simulada) con reintentos + backoff exponencial + idempotencia
- [x] Notificaciones in-app

### Fase 8 — Calidad
- [x] Tests unitarios de servicios críticos (content score, scheduler, adaptadores)
- [ ] Tests de integración con DB real (Postgres) — pendiente de entorno CI
- [ ] Tests e2e (Playwright) — pendiente
- [ ] Auditoría de seguridad formal — pendiente
- [ ] Auditoría de accesibilidad formal — pendiente (se ha cuidado semántica/contraste desde el inicio)

## MVP — criterios de aceptación

- [x] Registro / login (Supabase Auth; en dev sin credenciales reales se usa un usuario demo fijo para no bloquear el desarrollo — ver README)
- [x] Crear un workspace (empresa)
- [x] Configurar Brand Brain básico
- [x] Generar ideas
- [x] Crear una publicación
- [x] Generar versión para cada red
- [x] Añadir imagen
- [x] Mover en el calendario (drag & drop)
- [x] Enviar a aprobación
- [x] Aprobarla
- [x] Programarla
- [x] Simular su publicación
- [x] Dashboard con estado
- [x] Generar automáticamente una semana de contenidos ("Generate Week" — versión reducida de "Generate Next Month")
- [x] Responsive escritorio/móvil

## Riesgos identificados

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Sin cuenta de Metricool contratada todavía en este entorno | `MetricoolAdapter` implementado pero no probado contra la API real | `SOCIAL_PROVIDER=simulated` por defecto; activar `metricool` en cuanto se contrate el plan Advanced |
| Metricool no acepta `data:` URIs para imágenes | `MetricoolAdapter` ahora falla con un error claro (en vez de un fallo opaco de la API) si detecta un `data:` URI en los medios | Con `IMAGE_PROVIDER=fal` funciona sin pasos adicionales; con `IMAGE_PROVIDER=openai` requiere Supabase Storage configurado (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + bucket público creado a mano) — ver `INTEGRATIONS.md` |
| ~~Subida a Supabase Storage no probada contra un proyecto real~~ | — | Verificado contra un proyecto real: subida, URL pública y borrado, todo OK (bucket `Media`, público) |
| Dependencia de un proveedor externo (Metricool) para publicar | Si Metricool cambia condiciones/precio o pierde acceso a una red, nos arrastra | Adaptadores nativos directos documentados como alternativa en `INTEGRATIONS.md` si hiciera falta |
| `FalVideoProvider.generateVideo()` es una llamada síncrona que puede tardar más de lo habitual en HTTP | Riesgo de timeout en despliegue serverless con límite de duración estricto | Documentado en `INTEGRATIONS.md`; migrar a la cola de jobs existente (`JobQueue`) si da problemas en producción |
| Cola de jobs basada en tabla (no Redis) | Menor throughput a gran escala | Válido para MVP; interfaz `enqueue/process` migrable a BullMQ sin tocar servicios |
| RLS de Postgres no activado (autorización solo a nivel de aplicación) | Si un endpoint olvidara comprobar permisos, no habría red de seguridad en la propia base de datos | Activar RLS en Supabase como defensa en profundidad antes de dar acceso a clientes reales; mientras tanto, autorización verificada en cada Server Action/Route Handler (`requireWorkspaceAccess`) |
| Autenticación propia (cookie + scrypt) en vez de Supabase Auth | Sin verificación de email, reset de contraseña ni OAuth | Válido mientras el acceso esté limitado al propio equipo; migrar a Supabase Auth antes de abrir a clientes externos |
| `AnthropicAIProvider` / `GroqAIProvider` / `OpenAIImageProvider` / `FalImageProvider` / `FalVideoProvider` no probados contra la API real en este entorno (sin claves configuradas) | Posibles ajustes de prompt/parseo la primera vez que se activen con una clave real | Errores propagados con mensaje claro (no fallback silencioso a mock); cubierto por tests unitarios de la lógica pura (mapeo de tamaños, extracción de texto de la web, construcción de prompts, conversión Zod→JSON Schema en el caso de Groq) |

## Próximos pasos recomendados tras este MVP

1. Contratar el plan Metricool Advanced, conectar las cuentas reales de cada empresa en app.metricool.com, configurar `SOCIAL_PROVIDER=metricool` + `METRICOOL_USER_TOKEN/USER_ID` + el Brand ID de cada workspace, y verificar `publishPost`/`fetchAnalytics` contra una publicación real.
2. ~~Conectar Supabase real y migrar de SQLite a Postgres~~ — hecho: proyecto `camaleonic-social-pilot` en Supabase (Postgres vía Transaction pooler + Storage con bucket `Media`). Pendiente: activar Supabase Auth (sigue con el sistema propio) y RLS.
3. ~~Conectar un proveedor de IA real~~ — hecho: `AnthropicAIProvider` (`AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`, mejor calidad) y `GroqAIProvider` (`AI_PROVIDER=groq` + `GROQ_API_KEY`, más barato/rápido, modelos open-weight de terceros) implementados. Pendiente: probar ambos contra la API real y ajustar prompts según los primeros resultados.
4. ~~Conectar un proveedor de generación de imágenes real~~ — hecho: `OpenAIImageProvider` (`gpt-image-1`) y `FalImageProvider` (Flux vía fal.ai) implementados. Pendiente: verificar la forma de la respuesta contra la API real y, a medio plazo, mover las imágenes generadas de data URI a Supabase Storage (más eficiente a partir de cierto volumen).
5. ~~Evaluar proveedor de generación de vídeo~~ — hecho: `FalVideoProvider` implementado (`VIDEO_PROVIDER=fal` + `FAL_KEY`, modelo Kling o Wan). Pendiente: probar contra una cuenta real y, si el volumen crece, mover la llamada a la cola de jobs para evitar timeouts en serverless.
6. Añadir tests e2e y auditoría de seguridad antes de dar acceso a clientes reales.
