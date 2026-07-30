# DATABASE.md — Modelo de datos

Esquema completo en `prisma/schema.prisma`. Este documento resume entidades, relaciones e índices clave. Motor: PostgreSQL (proyecto de Supabase, tanto en desarrollo como en producción — antes de la migración se usó SQLite local; ver `src/server/db/client.ts` para el driver adapter activo, `@prisma/adapter-pg`).

## Entidades

### Identidad y organización
- **User** — cuenta de usuario (vinculada a Supabase Auth `id`). `email`, `name`, `avatarUrl`.
- **Workspace** — una empresa/cliente. `name`, `slug`, `logoUrl`, `website`, `industry`, `country`, `languages[]`, `automationLevel`, `status`.
- **Membership** — N:M entre `User` y `Workspace` con `role` (`OWNER|ADMIN|EDITOR|REVIEWER|VIEWER`), `invitedEmail`, `invitedAt`, `acceptedAt`.
- **AuditLog** — `workspaceId`, `userId?`, `action`, `entityType`, `entityId`, `metadata (json)`, `createdAt`.

### Brand Brain
- **BrandProfile** — 1:1 con Workspace. Descripción, tono, valores, claims, audiencias, diferenciadores, palabras permitidas/prohibidas, colores, tipografías.
- **BrandAsset** — logos, brand book, ejemplos de publicaciones, imágenes de referencia. `type`, `url`, `metadata`.
- **ContentPillar** — pilares de contenido del workspace (`name`, `description`, `targetSharePct`, `color`).
- **WebsiteSource** — URLs analizadas de la web del cliente. `url`, `lastCrawledAt`, `extractedSummary`, `status`.
- **DocumentSource** — PDFs, PPTX, docs subidos para nutrir el Brand Brain. `fileUrl`, `type`, `extractedText`, `status`.

### Estrategia y contenido
- **Campaign** — agrupación de contenidos con objetivo y rango de fechas.
- **ContentIdea** — idea generada o manual. `title`, `description`, `pillarId`, `goal`, `audience`, `recommendedPlatform`, `recommendedFormat`, `priority`, `recommendedDate`, `rationale`, `cta`, `status (NEW|SAVED|REJECTED|CONVERTED)`, `sourceType (WEBSITE|DOCUMENT|NEWS|TREND|MANUAL|PERFORMANCE)`, `contentKind (SOCIAL_POST|BLOG_ARTICLE)` — determina si "convertir" crea un `ContentItem` (redes) o un `BlogArticle` (web); si es `BLOG_ARTICLE`, `recommendedPlatform`/`recommendedFormat` quedan vacíos.
- **ContentItem** — pieza de contenido "maestra" (puede generar varias `ContentVariant`, una por plataforma). `ideaId?`, `campaignId?`, `status` (ver máquina de estados abajo), `contentScore`, `ownerId`.
- **ContentVariant** — versión específica por plataforma de un `ContentItem`. `platform`, `format (POST|CAROUSEL|REEL|STORY|THREAD|VIDEO|POLL|DOCUMENT)`, `body`, `hashtags[]`, `cta`, `altText`, `mediaAssetIds[]`, `charCount`, `needsValidation (bool)`.
- **BlogArticle** — artículo de blog para la web de la empresa; tipo de contenido paralelo a `ContentItem`/`ContentVariant`, sin límite de caracteres y sin adaptador de publicación (no hay integración con ningún CMS). `ideaId?`, `pillarId?`, `ownerId?`, `title`, `metaDescription`, `body`, `tags[]`, `cta`, `wordCount`, `needsValidation (bool)`, `status (DRAFT|PENDING_REVIEW|CHANGES_REQUESTED|APPROVED|PUBLISHED)`, `publishedAt?` (se marca manualmente al aprobar, ver `src/server/services/blog.ts`).
- **MediaAsset** — biblioteca multimedia. `type (IMAGE|VIDEO|DOCUMENT|TEMPLATE)`, `url`, `thumbnailUrl`, `tags[]`, `folder`, `sourceGenerator?`.

### Calendario, aprobación y publicación
- **CalendarEntry** — entrada de calendario, referencia a `ContentVariant`, `scheduledAt`, `status`.
- **Approval** — solicitud de aprobación (individual, semanal o mensual). `scope (ITEM|WEEK|MONTH)`, `status (PENDING|APPROVED|CHANGES_REQUESTED|REJECTED)`, `requestedById`, `decidedById`, `publicReviewToken?`.
- **Comment** — comentarios sobre un `ContentItem` o `Approval`.
- **ScheduledPost** — instancia programada de una `ContentVariant` en una `SocialAccount`. `scheduledAt`, `status`, `attempts`, `lastError`.
- **PublishedPost** — resultado real de publicación. `externalId`, `externalUrl`, `publishedAt`, `rawResponse (json)`, `simulated (bool)`.
- **SocialAccount** — cuenta social conectada. `platform`, `externalAccountId`, `handle`, `status (CONNECTED|EXPIRED|ERROR|DISCONNECTED)`, `automationLevelOverride?`.
- **IntegrationToken** — 1:1 con `SocialAccount`. `accessTokenEncrypted`, `refreshTokenEncrypted`, `expiresAt`, `scopes[]`.

### Automatización
- **Automation** — regla. `name`, `trigger`, `conditions (json)`, `actions (json)`, `frequency`, `platforms[]`, `requiresApproval (bool)`, `status (ACTIVE|PAUSED)`.
- **AutomationRun** — ejecución de una `Automation`. `startedAt`, `finishedAt`, `status`, `resultSummary`, `errorLog`.
- **JobQueue** — cola genérica de trabajos en segundo plano. `type`, `payload (json)`, `status (PENDING|RUNNING|DONE|FAILED|RETRY)`, `attempts`, `runAfter`, `lockedAt`.

### Analítica
- **SocialMetric** — métrica cruda por `PublishedPost` y fecha de captura. `impressions`, `reach`, `likes`, `comments`, `shares`, `saves`, `clicks`, `videoViews`, `watchTime`, `newFollowers`.
- **AnalyticsSnapshot** — agregado periódico (semanal/mensual) por workspace/plataforma/pilar/campaña, precalculado para el dashboard y los informes de IA.

### IA y notificaciones
- **PromptTemplate** — plantilla versionada usada por el `AIProvider`. `key`, `version`, `template`, `variables[]`.
- **AIProvider** (config, no el código) — registro de qué proveedor de IA está activo por función y workspace.
- **MediaProvider** — registro de proveedor de imagen/vídeo activo.
- **Notification** — `userId`, `workspaceId`, `type`, `payload`, `readAt`, `channel (IN_APP|EMAIL)`.

## Relaciones clave

- `Workspace` 1—N `Membership`, `SocialAccount`, `ContentIdea`, `ContentItem`, `BlogArticle`, `Campaign`, `Automation`, `MediaAsset`, `AuditLog`.
- `ContentItem` 1—N `ContentVariant`; `ContentVariant` 1—1 `CalendarEntry` (opcional); `CalendarEntry` 1—N `ScheduledPost` (normalmente 1, pero permite reintentos como filas separadas si se desea histórico); `ScheduledPost` 1—1 `PublishedPost` (al completarse).
- `SocialAccount` 1—1 `IntegrationToken`; `SocialAccount` 1—N `ScheduledPost`, `PublishedPost`, `SocialMetric` (vía `PublishedPost`).
- `ContentIdea` 1—0..1 `ContentItem` **o** 1—0..1 `BlogArticle` (al convertirse, según `contentKind`, nunca ambos).
- `Approval` N—1 `ContentItem` o rango (`WEEK`/`MONTH` referencian un conjunto de `CalendarEntry` vía tabla puente `ApprovalTarget`).
- `Automation` 1—N `AutomationRun`.

## Índices y restricciones (resumen)

- `Membership`: única `(userId, workspaceId)`.
- `SocialAccount`: única `(workspaceId, platform, externalAccountId)`.
- `IntegrationToken`: única `(socialAccountId)`.
- `CalendarEntry`: índice `(workspaceId, scheduledAt)` para vistas de calendario.
- `ScheduledPost`: índice `(status, runAfter)` para el worker de publicación; única `(calendarEntryId, socialAccountId)` para evitar duplicados (idempotencia).
- `SocialMetric`: única `(publishedPostId, capturedAt)`.
- `JobQueue`: índice `(status, runAfter)`.
- Todas las tablas con datos de workspace incluyen `workspaceId` indexado, usado tanto por RLS como por las queries de aplicación.

## Máquina de estados de `ContentItem` / `CalendarEntry`

```
IDEA → DRAFT → GENERATING → PENDING_REVIEW → (CHANGES_REQUESTED → DRAFT)
                                   ↓
                               APPROVED → SCHEDULED → PUBLISHING → PUBLISHED
                                                              ↘ ERROR
                               (en cualquier punto) → CANCELLED
```

Este enum (`ContentStatus`) es compartido por `ContentItem` y `CalendarEntry` para simplificar las vistas del calendario.
