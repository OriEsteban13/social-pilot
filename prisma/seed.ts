/**
 * Seed de datos demo. Crea:
 *  - Un usuario demo (ver credenciales impresas al final).
 *  - "Camaleonic Survey": workspace completo (Brand Brain, pilares, redes,
 *    ideas, contenido publicado con métricas, contenido pendiente de
 *    aprobación y contenido ya programado) — el workspace principal de demo.
 *  - Cuatro workspaces adicionales más ligeros ("Camaleonic Analytics",
 *    "Formula E", "MIC Football", "Reto Pelayo") para poblar la Home con
 *    varios estados (Auto Pilot / Pending Approval / Manual).
 *
 * Ejecutar con: npx prisma db seed
 */

import { prisma } from "../src/server/db/client";
import { hashPassword } from "../src/server/auth/password";
import { getAIProvider } from "../src/server/ai/registry";
import { getImageProvider } from "../src/server/media/registry";
import { createWorkspace, updateAutomationLevel } from "../src/server/services/workspace";
import { updateBrandProfile, createPillar, addWebsiteSource, analyzeWebsiteSource, buildBrandContext } from "../src/server/services/brand-brain";
import { connectSocialAccount } from "../src/server/services/accounts";
import { generateVariantForPlatform, createContentFromIdea, attachMediaToVariant } from "../src/server/services/content";
import { requestApproval } from "../src/server/services/approvals";
import { createAutomation } from "../src/server/services/automations";
import { notify } from "../src/server/services/notifications";

const DEMO_EMAIL = "demo@camaleonicanalytics.com";
const DEMO_PASSWORD = "camaleonic2026";

function daysAgo(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}
function daysFromNow(n: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function ensureDemoUser() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email: DEMO_EMAIL, name: "Equipo Camaleonic", passwordHash: hashPassword(DEMO_PASSWORD) },
  });
}

interface TopicSeed {
  title: string;
  description: string;
  pillar: string;
  platform: "LINKEDIN" | "INSTAGRAM" | "TIKTOK" | "THREADS" | "X";
  stage: "published" | "pending" | "scheduled" | "idea";
}

const SURVEY_PILLARS = [
  { name: "Encuestas y formularios", description: "Cómo crear y optimizar encuestas y formularios efectivos", color: "#6366f1" },
  { name: "Inteligencia artificial", description: "IA aplicada al análisis de respuestas y automatización", color: "#0ea5e9" },
  { name: "Customer & Employee Experience", description: "NPS, CSAT, feedback de clientes, empleados y proveedores", color: "#10b981" },
  { name: "Producto y datos", description: "Dashboards, data collection y análisis de resultados", color: "#f59e0b" },
  { name: "Eventos y comunidad", description: "Eventos, casos de uso y novedades de producto", color: "#ec4899" },
];

const SURVEY_TOPICS: TopicSeed[] = [
  { title: "5 errores habituales al diseñar una encuesta de satisfacción", description: "Guía práctica para evitar sesgos y mejorar la tasa de respuesta en encuestas.", pillar: "Encuestas y formularios", platform: "LINKEDIN", stage: "published" },
  { title: "Formularios inteligentes: menos preguntas, más respuestas", description: "Cómo el diseño adaptativo de formularios mejora la tasa de finalización.", pillar: "Encuestas y formularios", platform: "INSTAGRAM", stage: "published" },
  { title: "Así usa la IA de Camaleonic Survey el análisis de texto libre", description: "Demostración de cómo la IA clasifica automáticamente respuestas abiertas.", pillar: "Inteligencia artificial", platform: "LINKEDIN", stage: "published" },
  { title: "Automatiza el envío de encuestas tras cada interacción", description: "Flujo de automatización que dispara encuestas post-compra o post-soporte.", pillar: "Inteligencia artificial", platform: "TIKTOK", stage: "published" },
  { title: "NPS vs CSAT: qué métrica usar y cuándo", description: "Comparativa práctica entre Net Promoter Score y Customer Satisfaction Score.", pillar: "Customer & Employee Experience", platform: "LINKEDIN", stage: "published" },
  { title: "Feedback de proveedores: la métrica que nadie mide", description: "Por qué escuchar a tus proveedores mejora la cadena de suministro.", pillar: "Customer & Employee Experience", platform: "THREADS", stage: "published" },
  { title: "Employee experience: escuchar para retener talento", description: "Cómo las encuestas internas reducen la rotación de personal.", pillar: "Customer & Employee Experience", platform: "X", stage: "published" },
  { title: "Dashboards en tiempo real: de la respuesta al insight en segundos", description: "Cómo transformamos datos de encuestas en paneles accionables al instante.", pillar: "Producto y datos", platform: "INSTAGRAM", stage: "pending" },
  { title: "Data collection multicanal: web, email, QR y punto de venta", description: "Recoge respuestas allá donde esté tu cliente, con un único panel.", pillar: "Producto y datos", platform: "LINKEDIN", stage: "pending" },
  { title: "Cómo leer un análisis de resultados sin ser data analyst", description: "Tres claves para interpretar informes de encuestas sin conocimientos técnicos.", pillar: "Producto y datos", platform: "TIKTOK", stage: "pending" },
  { title: "Nos vemos en el próximo evento del sector CX", description: "Camaleonic Survey estará presente compartiendo casos de uso reales.", pillar: "Eventos y comunidad", platform: "X", stage: "pending" },
  { title: "Caso de uso: cómo una cadena de retail mejoró su CSAT un 18%", description: "Resultados reales de un cliente tras implementar encuestas post-venta.", pillar: "Eventos y comunidad", platform: "LINKEDIN", stage: "scheduled" },
  { title: "Nueva funcionalidad: alertas automáticas ante respuestas negativas", description: "Anuncio de producto: notificaciones en tiempo real cuando baja la satisfacción.", pillar: "Inteligencia artificial", platform: "INSTAGRAM", stage: "scheduled" },
  { title: "Guía rápida: tu primera encuesta en menos de 5 minutos", description: "Tutorial paso a paso para crear y lanzar una encuesta desde cero.", pillar: "Encuestas y formularios", platform: "THREADS", stage: "scheduled" },
  { title: "Preguntas frecuentes sobre protección de datos en encuestas", description: "Resolvemos las dudas más habituales sobre RGPD y datos de encuestados.", pillar: "Encuestas y formularios", platform: "LINKEDIN", stage: "idea" },
  { title: "El futuro del feedback: encuestas conversacionales con IA", description: "Cómo la IA generativa está cambiando la forma de recoger feedback.", pillar: "Inteligencia artificial", platform: "X", stage: "idea" },
];

async function seedCamaleonicSurvey(ownerId: string) {
  const workspace = await createWorkspace({
    ownerId,
    name: "Camaleonic Survey",
    website: "https://www.camaleonicsurvey.com",
    industry: "SaaS de encuestas y feedback",
    country: "España",
    languages: ["es", "en"],
  });

  await updateBrandProfile(workspace.id, ownerId, {
    description:
      "AI-powered platform for creating surveys and forms, collecting data and transforming responses into actionable insights.",
    valueProposition: "La forma más rápida de escuchar a tus clientes, empleados y proveedores, y convertir sus respuestas en decisiones.",
    tone: "CERCANO",
    targetAudiences: ["Responsables de experiencia de cliente", "Equipos de RRHH", "Product managers", "Agencias de investigación"],
    differentiators: ["Análisis con IA incluido", "Implantación sin código", "Dashboards en tiempo real", "Soporte cercano en español"],
    claims: ["De la respuesta al insight en segundos", "Escucha que se convierte en acción"],
    allowedTerms: ["insight", "feedback accionable", "experiencia de cliente"],
    forbiddenTerms: ["gratis para siempre", "sin límites"],
    brandColors: ["#6366f1", "#10b981"],
    competitors: ["Typeform", "SurveyMonkey", "Qualtrics"],
    authorizedClients: ["Cliente retail demo", "Cliente SaaS demo"],
  });

  const pillarByName = new Map<string, string>();
  for (const pillar of SURVEY_PILLARS) {
    const created = await createPillar(workspace.id, pillar);
    pillarByName.set(pillar.name, created.id);
  }

  const websiteSource = await addWebsiteSource(workspace.id, "https://www.camaleonicsurvey.com");
  await analyzeWebsiteSource(websiteSource.id);

  for (const platform of ["LINKEDIN", "INSTAGRAM", "TIKTOK", "THREADS", "X"] as const) {
    await connectSocialAccount(workspace.id, platform, ownerId);
  }

  const brand = await buildBrandContext(workspace.id);
  const imageProvider = getImageProvider();

  const pendingItemIds: string[] = [];
  let publishedOffset = 21; // días atrás para el primer publicado, decreciente

  for (const topic of SURVEY_TOPICS) {
    const pillarId = pillarByName.get(topic.pillar);

    const idea = await prisma.contentIdea.create({
      data: {
        workspaceId: workspace.id,
        title: topic.title,
        description: topic.description,
        pillarId,
        recommendedPlatform: topic.platform,
        recommendedFormat: topic.platform === "TIKTOK" ? "VIDEO" : "POST",
        priority: "MEDIUM",
        rationale: `Refuerza el pilar "${topic.pillar}" y conecta con búsquedas activas del sector CX.`,
        cta: "Descubre más en camaleonicsurvey.com",
        sourceType: "MANUAL",
        status: topic.stage === "idea" ? "NEW" : "CONVERTED",
      },
    });

    if (topic.stage === "idea") continue;

    const contentItem = await createContentFromIdea(idea, ownerId);
    await prisma.contentItem.update({ where: { id: contentItem.id }, data: { pillarId } });

    const { variant } = await generateVariantForPlatform({
      contentItemId: contentItem.id,
      platform: topic.platform,
      format: topic.platform === "TIKTOK" ? "VIDEO" : "POST",
      brief: topic.title,
      campaignGoal: "Conversión",
    });

    const image = await imageProvider.generateImage({
      prompt: topic.title,
      aspectRatio: topic.platform === "INSTAGRAM" || topic.platform === "TIKTOK" ? "4:5" : "1.91:1",
      headline: topic.title,
      brandName: brand.workspaceName,
      brandColors: ["#6366f1", "#10b981"],
    });
    const mediaAsset = await prisma.mediaAsset.create({
      data: { workspaceId: workspace.id, type: "IMAGE", url: image.url, width: image.width, height: image.height, sourceGenerator: "mock-image-provider:seed", folder: "seed" },
    });
    await attachMediaToVariant(variant.id, mediaAsset.id);

    const account = await prisma.socialAccount.findFirstOrThrow({ where: { workspaceId: workspace.id, platform: topic.platform } });

    if (topic.stage === "published") {
      const scheduledAt = daysAgo(publishedOffset);
      publishedOffset -= 3;

      await prisma.contentItem.update({ where: { id: contentItem.id }, data: { status: "PUBLISHED" } });
      const calendarEntry = await prisma.calendarEntry.create({
        data: {
          workspaceId: workspace.id,
          contentItemId: contentItem.id,
          contentVariantId: variant.id,
          socialAccountId: account.id,
          scheduledAt,
          status: "PUBLISHED",
        },
      });
      const scheduledPost = await prisma.scheduledPost.create({
        data: {
          calendarEntryId: calendarEntry.id,
          socialAccountId: account.id,
          scheduledAt,
          status: "DONE",
          idempotencyKey: `seed_${contentItem.id}`,
        },
      });
      const impressions = 800 + Math.floor(Math.random() * 4000);
      const publishedPost = await prisma.publishedPost.create({
        data: {
          scheduledPostId: scheduledPost.id,
          externalId: `sim_seed_${contentItem.id}`,
          externalUrl: `https://example.com/sim/${contentItem.id}`,
          publishedAt: scheduledAt,
          simulated: true,
          rawResponse: { simulated: true, seed: true },
        },
      });
      await prisma.socialMetric.create({
        data: {
          publishedPostId: publishedPost.id,
          capturedAt: new Date(scheduledAt.getTime() + 1000 * 60 * 60 * 24),
          impressions,
          reach: Math.round(impressions * 0.8),
          likes: Math.round(impressions * 0.045),
          comments: Math.round(impressions * 0.008),
          shares: Math.round(impressions * 0.006),
          saves: Math.round(impressions * 0.01),
          clicks: Math.round(impressions * 0.02),
          newFollowers: Math.round(impressions * 0.003),
        },
      });
    }

    if (topic.stage === "pending") {
      const scheduledAt = daysFromNow(Math.floor(Math.random() * 4) + 1, 11);
      await prisma.calendarEntry.create({
        data: {
          workspaceId: workspace.id,
          contentItemId: contentItem.id,
          contentVariantId: variant.id,
          socialAccountId: account.id,
          scheduledAt,
          status: "PENDING_REVIEW",
        },
      });
      pendingItemIds.push(contentItem.id);
    }

    if (topic.stage === "scheduled") {
      const scheduledAt = daysFromNow(Math.floor(Math.random() * 5) + 5, 12);
      await prisma.contentItem.update({ where: { id: contentItem.id }, data: { status: "APPROVED" } });
      const calendarEntry = await prisma.calendarEntry.create({
        data: {
          workspaceId: workspace.id,
          contentItemId: contentItem.id,
          contentVariantId: variant.id,
          socialAccountId: account.id,
          scheduledAt,
          status: "SCHEDULED",
        },
      });
      const scheduledPost = await prisma.scheduledPost.create({
        data: {
          calendarEntryId: calendarEntry.id,
          socialAccountId: account.id,
          scheduledAt,
          status: "PENDING",
          idempotencyKey: `seed_${contentItem.id}`,
        },
      });
      await prisma.jobQueue.create({
        data: { type: "publish-scheduled-post", payload: { scheduledPostId: scheduledPost.id }, runAfter: scheduledAt, status: "PENDING" },
      });
    }
  }

  if (pendingItemIds.length > 0) {
    await requestApproval({ workspaceId: workspace.id, contentItemIds: pendingItemIds, scope: "WEEK", requestedById: ownerId });
  }

  await updateAutomationLevel(workspace.id, ownerId, "PILOT");

  await createAutomation(workspace.id, {
    name: "Generar contenido cada semana",
    trigger: "WEEKLY_GENERATE",
    frequency: "Cada viernes",
    platforms: ["LINKEDIN", "INSTAGRAM", "TIKTOK", "THREADS", "X"],
    requiresApproval: true,
  });
  await createAutomation(workspace.id, {
    name: "Publicar automáticamente lo aprobado",
    trigger: "ON_APPROVAL_PUBLISH",
    frequency: "Continuo",
    platforms: ["LINKEDIN", "INSTAGRAM", "TIKTOK", "THREADS", "X"],
    requiresApproval: false,
  });

  await notify({
    workspaceId: workspace.id,
    type: "approval.requested",
    title: "Contenido de la semana listo para aprobar",
    body: `${pendingItemIds.length} publicaciones esperando revisión.`,
  });
  await notify({
    workspaceId: workspace.id,
    type: "post.published",
    title: "Publicado en LinkedIn (simulado)",
    body: "5 errores habituales al diseñar una encuesta de satisfacción",
  });

  return workspace;
}

async function seedLightWorkspace(
  ownerId: string,
  params: {
    name: string;
    website: string;
    industry: string;
    description: string;
    automationLevel: "MANUAL" | "ASSISTED" | "PILOT" | "AUTOPILOT" | "AUTOPILOT_APPROVAL";
    pillars: { name: string; description: string; color: string }[];
    ideaTitles: string[];
    withPublished: boolean;
  }
) {
  const workspace = await createWorkspace({
    ownerId,
    name: params.name,
    website: params.website,
    industry: params.industry,
    country: "España",
    languages: ["es"],
  });

  await updateBrandProfile(workspace.id, ownerId, {
    description: params.description,
    tone: "CERCANO",
    brandColors: ["#0ea5e9", "#6366f1"],
  });

  const pillarIds: string[] = [];
  for (const pillar of params.pillars) {
    const created = await createPillar(workspace.id, pillar);
    pillarIds.push(created.id);
  }

  for (const title of params.ideaTitles) {
    await prisma.contentIdea.create({
      data: {
        workspaceId: workspace.id,
        title,
        description: title,
        pillarId: pillarIds[0],
        recommendedPlatform: "LINKEDIN",
        recommendedFormat: "POST",
        priority: "MEDIUM",
        status: "NEW",
        sourceType: "MANUAL",
      },
    });
  }

  await connectSocialAccount(workspace.id, "LINKEDIN", ownerId);
  await connectSocialAccount(workspace.id, "INSTAGRAM", ownerId);

  if (params.withPublished) {
    const brand = await buildBrandContext(workspace.id);
    const provider = getAIProvider();
    const draft = await provider.generateVariant({ brand, platform: "LINKEDIN", format: "POST", brief: params.ideaTitles[0] ?? params.name });

    const contentItem = await prisma.contentItem.create({
      data: { workspaceId: workspace.id, title: params.ideaTitles[0] ?? params.name, status: "PUBLISHED", pillarId: pillarIds[0] },
    });
    const variant = await prisma.contentVariant.create({
      data: { contentItemId: contentItem.id, platform: "LINKEDIN", format: "POST", body: draft.body, hashtags: draft.hashtags, cta: draft.cta, charCount: draft.charCount },
    });
    const account = await prisma.socialAccount.findFirstOrThrow({ where: { workspaceId: workspace.id, platform: "LINKEDIN" } });
    const scheduledAt = daysAgo(5);
    const calendarEntry = await prisma.calendarEntry.create({
      data: { workspaceId: workspace.id, contentItemId: contentItem.id, contentVariantId: variant.id, socialAccountId: account.id, scheduledAt, status: "PUBLISHED" },
    });
    const scheduledPost = await prisma.scheduledPost.create({
      data: { calendarEntryId: calendarEntry.id, socialAccountId: account.id, scheduledAt, status: "DONE", idempotencyKey: `seed_${contentItem.id}` },
    });
    const publishedPost = await prisma.publishedPost.create({
      data: { scheduledPostId: scheduledPost.id, externalId: `sim_${contentItem.id}`, externalUrl: `https://example.com/sim/${contentItem.id}`, publishedAt: scheduledAt, simulated: true },
    });
    await prisma.socialMetric.create({
      data: { publishedPostId: publishedPost.id, capturedAt: new Date(scheduledAt.getTime() + 86400000), impressions: 1200, reach: 950, likes: 60, comments: 8, shares: 5, clicks: 30, newFollowers: 4 },
    });
  }

  await updateAutomationLevel(workspace.id, ownerId, params.automationLevel);
  return workspace;
}

async function main() {
  console.log("Sembrando datos demo…");
  const user = await ensureDemoUser();

  const survey = await seedCamaleonicSurvey(user.id);
  console.log(`✔ Workspace "Camaleonic Survey" creado (${survey.id})`);

  const analytics = await seedLightWorkspace(user.id, {
    name: "Camaleonic Analytics",
    website: "https://www.camaleonicanalytics.com",
    industry: "Consultoría de datos y analítica",
    description: "Consultora especializada en analítica de datos, dashboards e inteligencia de negocio para empresas deportivas y de consumo.",
    automationLevel: "AUTOPILOT",
    pillars: [
      { name: "Casos de éxito", description: "Proyectos de analítica entregados a clientes", color: "#0ea5e9" },
      { name: "Datos y opinión", description: "Opinión y tendencias del sector de datos", color: "#6366f1" },
    ],
    ideaTitles: ["Cómo medimos el ROI de un proyecto de datos", "Tendencias en Business Intelligence para 2026"],
    withPublished: true,
  });
  console.log(`✔ Workspace "Camaleonic Analytics" creado (${analytics.id})`);

  const formulaE = await seedLightWorkspace(user.id, {
    name: "Formula E",
    website: "https://www.fiaformulae.com",
    industry: "Motorsport eléctrico",
    description: "Campeonato mundial de monoplazas eléctricos.",
    automationLevel: "ASSISTED",
    pillars: [{ name: "Carreras", description: "Resultados y momentos destacados de cada Gran Premio", color: "#f59e0b" }],
    ideaTitles: ["Resumen del último E-Prix", "Datos curiosos sobre los monoplazas eléctricos"],
    withPublished: false,
  });
  console.log(`✔ Workspace "Formula E" creado (${formulaE.id})`);

  const micFootball = await seedLightWorkspace(user.id, {
    name: "MIC Football",
    website: "https://www.micfootball.com",
    industry: "Torneo internacional de fútbol base",
    description: "Torneo internacional de fútbol base para clubes y selecciones jóvenes.",
    automationLevel: "MANUAL",
    pillars: [{ name: "Torneo", description: "Novedades y resultados del torneo", color: "#10b981" }],
    ideaTitles: ["Calendario de la próxima edición del torneo"],
    withPublished: false,
  });
  console.log(`✔ Workspace "MIC Football" creado (${micFootball.id})`);

  const retoPelayo = await seedLightWorkspace(user.id, {
    name: "Reto Pelayo",
    website: "https://www.retopelayolife.com",
    industry: "Evento deportivo solidario",
    description: "Reto deportivo solidario que combina deporte, naturaleza y causas sociales.",
    automationLevel: "MANUAL",
    pillars: [{ name: "Comunidad", description: "Historias de participantes y causas solidarias", color: "#ec4899" }],
    ideaTitles: ["Historias de participantes de la última edición"],
    withPublished: false,
  });
  console.log(`✔ Workspace "Reto Pelayo" creado (${retoPelayo.id})`);

  console.log("\nListo. Inicia sesión con:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
