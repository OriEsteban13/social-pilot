# INTEGRATIONS.md — Integraciones y limitaciones

**Importante**: este documento resume el conocimiento general sobre cada API/servicio en el momento de escribir este código. Las plataformas cambian condiciones, scopes y precios con frecuencia. **Antes de dar por buena cualquier integración en producción, hay que volver a comprobar la documentación oficial vigente** y no asumir que lo aquí descrito sigue siendo exacto.

## Decisión: Metricool como vía de publicación, no adaptadores nativos por red

El plan inicial de este documento era construir un adaptador nativo por red social (LinkedIn, Meta, TikTok, X), cada uno con su propia app de desarrollador y su propio proceso de revisión — ver la sección "Alternativa: adaptadores nativos directos" más abajo, que se mantiene documentada por si hace falta en el futuro.

Se decidió en su lugar conectar con **Metricool** (plan Advanced, ~43€/mes) como backend de publicación:

- Metricool ya tiene apps aprobadas por cada plataforma — nos ahorramos el proceso de revisión de LinkedIn/Meta/TikTok/X, que era el cuello de botella real (semanas, no líneas de código).
- Su API cubre las 5 redes con una única integración, pensada explícitamente para agencias (gestión de varias marcas/clientes).
- El cliente conecta sus cuentas directamente en `app.metricool.com` (Metricool gestiona el OAuth con cada red); nosotros solo leemos/escribimos a través de su API con un token de cuenta compartido.

Todas las integraciones implementan la interfaz común `SocialAdapter` (`src/server/integrations/types.ts`):

```ts
interface SocialAdapter {
  platform: SocialPlatform
  connectAccount(input: ConnectAccountInput): Promise<SocialAccountRef>
  refreshToken(account: SocialAccountRef): Promise<TokenRefreshResult>
  validateConnection(account: SocialAccountRef): Promise<ConnectionStatus>
  createPost(input: CreatePostInput): Promise<DraftPostRef>
  uploadMedia(input: UploadMediaInput): Promise<MediaRef>
  schedulePost(input: SchedulePostInput): Promise<ScheduledPostRef>
  publishPost(input: PublishPostInput): Promise<PublishedPostRef>
  getPostStatus(externalId: string): Promise<PostStatus>
  deleteScheduledPost(externalId: string): Promise<void>
  fetchAnalytics(input: FetchAnalyticsInput): Promise<PlatformMetrics[]>
}
```

`src/server/integrations/registry.ts` resuelve el adaptador activo según `SOCIAL_PROVIDER`:
- `simulated` (por defecto): `SimulatedAdapter`, sin llamadas externas — permite construir y probar todo el producto (calendario, aprobaciones, programación, reintentos, analítica) sin credenciales.
- `metricool`: `MetricoolAdapter` (`src/server/integrations/metricool/`), real, para las 5 redes a la vez.

## MetricoolAdapter — estado y cómo activarlo

**Requisitos**: plan Metricool Advanced o superior (API no disponible en Free/Starter — confirmado en la documentación oficial de Metricool en julio 2026). Variables de entorno: `METRICOOL_USER_TOKEN`, `METRICOOL_USER_ID` (compartidas para toda la cuenta de Camaleonic). Por empresa: cada `Workspace` necesita su propio Brand ID de Metricool (`metricoolBlogId`, configurable en Configuración → Metricool dentro de la app).

**Verificado antes de escribir el adaptador** (leyendo el código fuente de un cliente de referencia de esta API, `github.com/Purple-Horizons/metricool-cli`, ya que Metricool no publica SDK oficial de Node ni ejemplos de respuesta completos en su documentación pública):
- Base URL: `https://app.metricool.com/api`. Auth: query params `userToken` + `userId` (+ `blogId` por marca) y cabecera `X-Mc-Auth` con el mismo token.
- Crear/programar/publicar: `POST /v2/scheduler/posts`, body `{ text, providers: [{network}], publicationDate: {dateTime, timezone}, draft, autoPublish, media }`. `autoPublish: true` publica de verdad en la fecha indicada; `draft: true` la deja pendiente de revisión en el planner de Metricool.
- Borrar programada: `DELETE /v2/scheduler/posts/{id}`.
- Analítica por publicación: `GET /v2/analytics/posts/{network}?from&to`.
- Normalizar una imagen (URL pública) antes de adjuntarla: `GET /actions/normalize/image/url?url=...`.
- Nombres de red de Metricool: iguales a los nuestros salvo **X, que sigue llamándose `twitter`** en su API (ver `src/server/integrations/metricool/networks.ts`).

**Verificado contra una cuenta real** (julio de 2026, cuenta de Camaleonic con plan Advanced):
- Auth y `GET /admin/simpleProfiles` (lista de marcas) — responden 200 con datos reales.
- ~~`GET /v2/settings/brands/{blogId}/connections`~~ — **devuelve 404, retirada.** Las redes conectadas de una marca están en `data.networksData` dentro de `GET /v2/settings/brands/{blogId}` (sin sufijo), con clave `"<red>Data"` (p.ej. `tiktokData`, no `tiktok`) — confirmado con una cuenta real con TikTok conectado: `{ username, providerUserId, accountType, profileURL, picture }` (sin `id`/`active`/`status`, no hacen falta — ver comentario en `findConnection()`). `connectAccount()` verificado de extremo a extremo contra la API real con esta red.
- `POST /v2/scheduler/posts` (crear/publicar) no se ha probado todavía con una publicación real — el body documentado arriba coincide con el cliente de referencia, pero antes de confiar en un `autoPublish: true` en producción, probar primero con `draft: true`.

**No verificado todavía**: forma exacta de la respuesta de `POST /v2/scheduler/posts` (qué clave trae el id del post creado) y de `GET /v2/analytics/posts/{network}`. El adaptador parsea estos campos de forma defensiva (varios nombres candidatos). `publishPost()` tampoco puede devolver la URL final de la red social de forma síncrona (Metricool la publica poco después de la llamada, de forma asíncrona en su propio scheduler); de momento se devuelve un enlace al planner de Metricool en su lugar.

**Limitación de medios**: Metricool necesita una URL pública para las imágenes — no acepta `data:` URIs. `MetricoolAdapter` rechaza explícitamente cualquier `data:` URI antes de llamar a la API (mensaje de error claro, en vez de dejar que Metricool falle de forma opaca). `MockImageProvider` sigue generando SVG en base64 (solo para desarrollo, no compatible con Metricool). De los proveedores reales:
- `FalImageProvider` (Flux) devuelve una URL pública real directamente — compatible con Metricool sin pasos adicionales.
- `OpenAIImageProvider` (`gpt-image-1`) solo devuelve base64 — si `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` están configurados, la imagen se sube a Supabase Storage y se usa esa URL pública; si no, cae a `data:` URI (rompe con `SOCIAL_PROVIDER=metricool`). Requiere un bucket público creado a mano en el panel de Supabase — ver `.env.example`.

**X/Twitter en Metricool**: requiere un add-on de pago aparte (~5€/cuenta conectada) sobre el plan Advanced.

## Alternativa: adaptadores nativos directos (no implementados)

Si en el futuro Metricool se queda corto para alguna plataforma en concreto, esta es la alternativa: un adaptador nativo por red, con su propia app de desarrollador. Se documenta aquí el conocimiento recopilado inicialmente, sin implementar.

| Plataforma | Publicación vía API oficial | Analítica vía API | Limitación principal conocida |
|---|---|---|---|
| LinkedIn | Sí (Marketing API / Community Management API, cuentas de empresa) | Sí, agregada, con retraso | Requiere app revisada por LinkedIn y permisos `w_organization_social`; cuentas personales muy limitadas. |
| Instagram | Sí (Instagram Graph API, solo cuentas Business/Creator vinculadas a una Página de Facebook) | Sí (Insights) | Sin cuenta Business+Página de FB vinculada, no hay API de publicación. Stories con soporte limitado. |
| TikTok | Sí (Content Posting API, requiere aprobación de la app) | Parcial (TikTok for Business / Display API) | Acceso de publicación directa exige revisión y aprobación explícita de TikTok por app y por caso de uso. |
| Threads | Sí (Threads API, lanzada por Meta) | Limitada | API relativamente nueva y con endpoints más reducidos que Instagram; sujeta a cambios frecuentes. |
| X (Twitter) | Sí (API v2) | Sí, según nivel de acceso | Los niveles de pago (Free/Basic/Pro/Enterprise) limitan drásticamente el volumen; el nivel gratuito es muy restrictivo. |

## Estrategia de fallback cuando algo no se puede publicar

Cuando una funcionalidad no está disponible (vía Metricool o vía API directa), el adaptador debe:

1. Generar igualmente el contenido (copy + medios) y dejarlo `READY_TO_PUBLISH`.
2. Marcar el `ScheduledPost` como `MANUAL_REQUIRED` con un motivo explícito.
3. Ofrecer exportación (descarga de imagen/vídeo + copy + hashtags listos para copiar/pegar).
4. Crear una `Notification` de tipo recordatorio en la fecha/hora programada.

## Proveedores de IA e imagen/vídeo

- **AI Provider** (`src/server/ai/`): interfaz común (`AIProvider`). Implementación por defecto `MockAIProvider` (plantillas + datos reales del Brand Brain, sin llamadas externas). Las reglas de marca/idioma compartidas por los proveedores reales viven en `src/server/ai/providers/shared-prompts.ts`. Dos implementaciones reales:
  - `AnthropicAIProvider` (`src/server/ai/providers/anthropic.ts`), activable con `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` — usa `client.messages.parse()` con salida estructurada (Zod) para ideas, copys, Content Score, análisis de web y resumen de rendimiento. Mejor calidad de redacción y traducción real entre idiomas; recomendado para producción.
  - `GroqAIProvider` (`src/server/ai/providers/groq.ts`), activable con `AI_PROVIDER=groq` + `GROQ_API_KEY` — inferencia muy rápida/barata sobre modelos open-weight de terceros vía la API de Groq (compatible con OpenAI). Modelo por defecto `openai/gpt-oss-120b` (configurable con `GROQ_MODEL`). **Importante**: el catálogo de modelos disponible varía por cuenta — en la cuenta de Camaleonic, ni `moonshotai/kimi-k2-instruct-0905` ni `llama-3.3-70b-versatile` (ambos "estándar" en la documentación pública) estaban disponibles (404 `model_not_found`); antes de cambiar `GROQ_MODEL`, comprobar el catálogo REAL de la cuenta con `GET https://api.groq.com/openai/v1/models` + `Authorization: Bearer $GROQ_API_KEY` (no basta con mirar `console.groq.com/docs/models`, que lista el catálogo general). Usa `response_format: {type: "json_object"}` (no "Structured Outputs" estricto) para funcionar igual con cualquier modelo, describiendo el JSON Schema como texto en el prompt (vía `z.toJSONSchema()`, nativo de Zod 4) y validando la respuesta con el propio esquema Zod (`schema.parse(...)`) antes de usarla — más robusto que depender de que el modelo concreto soporte `json_schema`. Reutiliza los mismos esquemas Zod que Anthropic (`anthropic-schemas.ts`). Calidad de redacción algo por debajo de Claude al ser un modelo open-weight — revisar el contenido generado con más atención, sobre todo al principio.
  Ambas implementaciones: `analyzeWebsite` descarga y extrae texto real de la URL (`src/server/ai/website-fetch.ts`) antes de analizarlo. Nunca inventan datos de negocio: el prompt instruye explícitamente a no fabricar cifras/clientes/resultados fuera del Brand Brain, y si el contexto es insuficiente devuelven `needsValidation: true`. No se han podido probar contra la API real en este entorno (sin claves configuradas) — verificar con una llamada real antes de activarlas en producción.
- **Image Provider** (`src/server/media/`): interfaz `ImageProvider`. Implementación por defecto `MockImageProvider` (SVG con los colores y el nombre de marca, sin coste — genera un `data:` URI, no una URL pública, ver limitación de Metricool arriba). Dos implementaciones reales:
  - `OpenAIImageProvider` (`src/server/media/providers/openai-image.ts`, modelo `gpt-image-1`), activable con `IMAGE_PROVIDER=openai` + `OPENAI_API_KEY`. Sube el resultado a Supabase Storage (`src/server/storage/supabase-storage.ts`) cuando está configurado, para obtener una URL pública real.
  - `FalImageProvider` (`src/server/media/providers/fal-image.ts`, modelo Flux vía fal.ai), activable con `IMAGE_PROVIDER=fal` + `FAL_KEY`. Devuelve una URL pública real (`https://v3.fal.media/...`) directamente, sin necesitar Storage.
  Ninguna de las dos se ha probado contra una cuenta real en este entorno (sin claves configuradas) — verificar antes de producción, incluida la subida a Supabase Storage.
- **Video Provider** (`src/server/media/`): interfaz `VideoProvider`; implementación por defecto `MockVideoProvider` que genera guion + storyboard (texto estructurado) y un placeholder de vídeo, sin renderizar vídeo real (`status: "SCRIPT_READY"`). Implementación real `FalVideoProvider` (`src/server/media/providers/fal-video.ts`), activable con `VIDEO_PROVIDER=fal` + `FAL_KEY`, modelo configurable con `FAL_VIDEO_MODEL`:
  - `kling` (por defecto) — Kling 2.1 Master, mejor calidad visual, ~0.07$/segundo.
  - `wan` — Wan 2.5, más económico, ~0.05$/segundo a 480p.
  Devuelve `status: "VIDEO_READY"` + `videoUrl` cuando hay un vídeo real. **Llamada síncrona**: `fal.subscribe()` espera (con polling interno) a que el vídeo termine de renderizarse, lo que puede tardar bastante más que una petición HTTP normal — para el volumen del MVP se invoca directamente desde el Server Action que la dispara; en un despliegue serverless con límite de duración estricto, debería moverse a la cola de jobs existente (`JobQueue` + `processDueJobs`) en vez de bloquear la petición. Tampoco probado contra una cuenta real.
- **fal.ai** (https://fal.ai) es un agregador de pago por uso (sin suscripción) que da acceso a cientos de modelos de imagen y vídeo, incluyendo chinos (Kling, Wan, MiniMax/Hailuo) y occidentales (Flux, Runway...) bajo una única API — mismo patrón de decisión que con Metricool: una integración, muchos proveedores reales detrás.

## Variables de entorno relevantes (ver `.env.example`)

```
AI_PROVIDER=mock            # mock | anthropic | groq
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b
IMAGE_PROVIDER=mock         # mock | openai | fal
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=   # necesario para que openai produzca URL pública (si no, data: URI)
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=media
VIDEO_PROVIDER=mock         # mock | fal
FAL_KEY=
FAL_IMAGE_MODEL=fal-ai/flux/schnell
FAL_VIDEO_MODEL=kling       # kling | wan
SOCIAL_PROVIDER=simulated   # simulated | metricool
METRICOOL_USER_TOKEN=
METRICOOL_USER_ID=
METRICOOL_TIMEZONE=Europe/Madrid
TOKEN_ENCRYPTION_KEY=
```

Cada `Workspace` necesita además su `metricoolBlogId` (Configuración → Metricool) cuando `SOCIAL_PROVIDER=metricool`.
