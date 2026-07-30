/**
 * Valores "enum" del dominio, modelados como String en la base de datos
 * (SQLite no soporta enums nativos — ver prisma/schema.prisma). Esta es la
 * única fuente de verdad para las listas de valores válidos; se usa tanto
 * para tipos TypeScript como para validación Zod.
 */

export const ROLES = ["OWNER", "ADMIN", "EDITOR", "REVIEWER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const AUTOMATION_LEVELS = [
  "MANUAL",
  "ASSISTED",
  "PILOT",
  "AUTOPILOT",
  "AUTOPILOT_APPROVAL",
] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

export const SOCIAL_PLATFORMS = ["LINKEDIN", "INSTAGRAM", "TIKTOK", "THREADS", "X"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const CONTENT_FORMATS = [
  "POST",
  "CAROUSEL",
  "REEL",
  "STORY",
  "THREAD",
  "VIDEO",
  "POLL",
  "DOCUMENT",
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const CONTENT_STATUSES = [
  "IDEA",
  "DRAFT",
  "GENERATING",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "ERROR",
  "CANCELLED",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const IDEA_STATUSES = ["NEW", "SAVED", "REJECTED", "CONVERTED"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const CONTENT_KINDS = ["SOCIAL_POST", "BLOG_ARTICLE"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export const BLOG_ARTICLE_STATUSES = ["DRAFT", "PENDING_REVIEW", "CHANGES_REQUESTED", "APPROVED", "PUBLISHED"] as const;
export type BlogArticleStatus = (typeof BLOG_ARTICLE_STATUSES)[number];

export const IDEA_SOURCE_TYPES = [
  "WEBSITE",
  "DOCUMENT",
  "NEWS",
  "TREND",
  "MANUAL",
  "PERFORMANCE",
  "FAQ",
  "SUCCESS_CASE",
  "EVENT",
] as const;
export type IdeaSourceType = (typeof IDEA_SOURCE_TYPES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const APPROVAL_SCOPES = ["ITEM", "WEEK", "MONTH"] as const;
export type ApprovalScope = (typeof APPROVAL_SCOPES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "CHANGES_REQUESTED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const MEDIA_TYPES = ["IMAGE", "VIDEO", "DOCUMENT", "TEMPLATE"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const BRAND_ASSET_TYPES = [
  "LOGO",
  "BRAND_BOOK",
  "COLOR_PALETTE",
  "FONT",
  "EXAMPLE_POST",
  "PRESENTATION",
  "OTHER",
] as const;
export type BrandAssetType = (typeof BRAND_ASSET_TYPES)[number];

export const AUTOMATION_STATUSES = ["ACTIVE", "PAUSED"] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const SOCIAL_ACCOUNT_STATUSES = ["CONNECTED", "EXPIRED", "ERROR", "DISCONNECTED"] as const;
export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

export const SCHEDULED_POST_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED", "MANUAL_REQUIRED"] as const;
export type ScheduledPostStatus = (typeof SCHEDULED_POST_STATUSES)[number];

export const TONES = [
  "FORMAL",
  "CERCANO",
  "TECNICO",
  "COMERCIAL",
  "EDUCATIVO",
  "INSPIRADOR",
  "CORPORATIVO",
  "PERSONALIZADO",
] as const;
export type Tone = (typeof TONES)[number];

export const NOTIFICATION_CHANNELS = ["IN_APP", "EMAIL"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ── Etiquetas legibles para la UI ───────────────────────────────────────────

export const AUTOMATION_LEVEL_LABELS: Record<AutomationLevel, string> = {
  MANUAL: "Manual",
  ASSISTED: "Asistido",
  PILOT: "Piloto",
  AUTOPILOT: "Autopilot",
  AUTOPILOT_APPROVAL: "Autopilot + Aprobación",
};

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  LINKEDIN: "LinkedIn",
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  THREADS: "Threads",
  X: "X",
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  IDEA: "Idea",
  DRAFT: "Borrador",
  GENERATING: "Generando",
  PENDING_REVIEW: "Pendiente de revisión",
  CHANGES_REQUESTED: "Cambios solicitados",
  APPROVED: "Aprobado",
  SCHEDULED: "Programado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  ERROR: "Error",
  CANCELLED: "Cancelado",
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  EDITOR: "Editor",
  REVIEWER: "Revisor",
  VIEWER: "Visor",
};

export const CONTENT_FORMAT_LABELS: Record<ContentFormat, string> = {
  POST: "Post",
  CAROUSEL: "Carrusel",
  REEL: "Reel",
  STORY: "Story",
  THREAD: "Hilo",
  VIDEO: "Vídeo",
  POLL: "Encuesta",
  DOCUMENT: "Documento",
};

export const TONE_LABELS: Record<Tone, string> = {
  FORMAL: "Formal",
  CERCANO: "Cercano",
  TECNICO: "Técnico",
  COMERCIAL: "Comercial",
  EDUCATIVO: "Educativo",
  INSPIRADOR: "Inspirador",
  CORPORATIVO: "Corporativo",
  PERSONALIZADO: "Personalizado",
};

export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  SOCIAL_POST: "Publicación en redes",
  BLOG_ARTICLE: "Artículo de blog",
};

export const BLOG_ARTICLE_STATUS_LABELS: Record<BlogArticleStatus, string> = {
  DRAFT: "Borrador",
  PENDING_REVIEW: "Pendiente de revisión",
  CHANGES_REQUESTED: "Cambios solicitados",
  APPROVED: "Aprobado",
  PUBLISHED: "Publicado",
};

export const PILLAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
];
