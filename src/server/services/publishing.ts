import { prisma } from "@/server/db/client";
import { getSocialAdapter } from "@/server/integrations/registry";
import { ensureAccountForPlatform } from "./accounts";
import { variantHashtags } from "./content";
import { notify } from "./notifications";
import { logAudit } from "./audit";
import { jsonRecord } from "@/lib/json";
import type { SocialPlatform } from "@/lib/enums";

const MAX_ATTEMPTS = 5;
const JOB_TYPE_PUBLISH = "publish-scheduled-post";

/**
 * Registra (o reutiliza, de forma idempotente) el `ScheduledPost` y el job
 * de publicación para una entrada de calendario ya aprobada. La publicación
 * real ocurre en `processDueJobs()`, invocado por Vercel Cron en producción
 * (`/api/cron/process-jobs`) y, en este entorno de desarrollo sin worker
 * persistente, también de forma oportunista al cargar Dashboard/Calendario
 * — ver comentario en esa función.
 */
export async function enqueueScheduledPost(calendarEntryId: string) {
  const entry = await prisma.calendarEntry.findUniqueOrThrow({
    where: { id: calendarEntryId },
    include: { contentVariant: true },
  });

  const account = entry.socialAccountId
    ? await prisma.socialAccount.findUniqueOrThrow({ where: { id: entry.socialAccountId } })
    : await ensureAccountForPlatform(entry.workspaceId, entry.contentVariant.platform as SocialPlatform);

  if (!entry.socialAccountId) {
    await prisma.calendarEntry.update({ where: { id: entry.id }, data: { socialAccountId: account.id } });
  }

  const scheduledPost = await prisma.scheduledPost.upsert({
    where: { calendarEntryId_socialAccountId: { calendarEntryId, socialAccountId: account.id } },
    create: {
      calendarEntryId,
      socialAccountId: account.id,
      scheduledAt: entry.scheduledAt,
      idempotencyKey: `sched_${calendarEntryId}`,
      status: "PENDING",
    },
    update: { scheduledAt: entry.scheduledAt, status: "PENDING", attempts: 0, lastError: null },
  });

  await prisma.jobQueue.create({
    data: {
      type: JOB_TYPE_PUBLISH,
      payload: jsonRecord({ scheduledPostId: scheduledPost.id }),
      runAfter: entry.scheduledAt,
      status: "PENDING",
    },
  });

  return scheduledPost;
}

async function publishScheduledPost(scheduledPostId: string) {
  const scheduledPost = await prisma.scheduledPost.findUniqueOrThrow({
    where: { id: scheduledPostId },
    include: {
      socialAccount: true,
      calendarEntry: { include: { contentVariant: { include: { mediaAssets: true } }, contentItem: true } },
    },
  });

  const { calendarEntry, socialAccount } = scheduledPost;
  const platform = socialAccount.platform as SocialPlatform;
  const adapter = getSocialAdapter(platform);

  await prisma.scheduledPost.update({ where: { id: scheduledPostId }, data: { status: "RUNNING" } });
  await prisma.calendarEntry.update({ where: { id: calendarEntry.id }, data: { status: "PUBLISHING" } });
  await prisma.contentItem.update({ where: { id: calendarEntry.contentItemId }, data: { status: "PUBLISHING" } });

  try {
    const result = await adapter.publishPost({
      accountRef: { externalAccountId: socialAccount.externalAccountId },
      body: calendarEntry.contentVariant.body,
      mediaUrls: calendarEntry.contentVariant.mediaAssets.map((m) => m.url),
      format: calendarEntry.contentVariant.format,
      hashtags: variantHashtags(calendarEntry.contentVariant),
      idempotencyKey: scheduledPost.idempotencyKey,
    });

    await prisma.publishedPost.upsert({
      where: { scheduledPostId },
      create: {
        scheduledPostId,
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        publishedAt: result.publishedAt,
        simulated: result.simulated,
        rawResponse: jsonRecord(result.rawResponse),
      },
      update: {
        externalId: result.externalId,
        externalUrl: result.externalUrl,
        publishedAt: result.publishedAt,
        rawResponse: jsonRecord(result.rawResponse),
      },
    });

    await prisma.scheduledPost.update({ where: { id: scheduledPostId }, data: { status: "DONE" } });
    await prisma.calendarEntry.update({ where: { id: calendarEntry.id }, data: { status: "PUBLISHED" } });
    await prisma.contentItem.update({ where: { id: calendarEntry.contentItemId }, data: { status: "PUBLISHED" } });

    await notify({
      workspaceId: calendarEntry.workspaceId,
      type: "post.published",
      title: `Publicado en ${platform}${result.simulated ? " (simulado)" : ""}`,
      body: calendarEntry.contentVariant.body.slice(0, 120),
      payload: { externalUrl: result.externalUrl },
    });

    await logAudit({
      workspaceId: calendarEntry.workspaceId,
      action: "post.published",
      entityType: "ScheduledPost",
      entityId: scheduledPostId,
      metadata: { platform, simulated: result.simulated },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al publicar.";
    const attempts = scheduledPost.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;

    await prisma.scheduledPost.update({
      where: { id: scheduledPostId },
      data: { status: failed ? "FAILED" : "PENDING", attempts, lastError: message },
    });
    await prisma.calendarEntry.update({ where: { id: calendarEntry.id }, data: { status: failed ? "ERROR" : "SCHEDULED" } });
    await prisma.contentItem.update({ where: { id: calendarEntry.contentItemId }, data: { status: failed ? "ERROR" : "APPROVED" } });

    if (failed) {
      await notify({
        workspaceId: calendarEntry.workspaceId,
        type: "post.error",
        title: `Error al publicar en ${platform}`,
        body: message,
      });
    }

    throw error;
  }
}

function backoffSeconds(attempts: number): number {
  return Math.min(60 * 30, 30 * 2 ** attempts); // 30s, 60s, 120s... tope 30min
}

/**
 * Procesa los jobs de la cola cuyo `runAfter` ya venció. En producción se
 * invoca desde Vercel Cron (`/api/cron/process-jobs`, cada pocos minutos).
 * En este entorno de desarrollo, sin proceso worker persistente, también se
 * invoca de forma oportunista desde el Dashboard y el Calendario al
 * renderizarse, para que la simulación de publicación sea visible sin tener
 * que levantar un worker aparte — ver ROADMAP.md, "Riesgos identificados".
 */
export async function processDueJobs(limit = 10) {
  const dueJobs = await prisma.jobQueue.findMany({
    where: { status: { in: ["PENDING", "RETRY"] }, runAfter: { lte: new Date() } },
    orderBy: { runAfter: "asc" },
    take: limit,
  });

  const results: { jobId: string; ok: boolean }[] = [];

  for (const job of dueJobs) {
    await prisma.jobQueue.update({ where: { id: job.id }, data: { status: "RUNNING", lockedAt: new Date() } });

    try {
      if (job.type === JOB_TYPE_PUBLISH) {
        const payload = job.payload as { scheduledPostId: string };
        await publishScheduledPost(payload.scheduledPostId);
      }
      await prisma.jobQueue.update({ where: { id: job.id }, data: { status: "DONE" } });
      results.push({ jobId: job.id, ok: true });
    } catch (error) {
      const attempts = job.attempts + 1;
      const message = error instanceof Error ? error.message : "Error desconocido.";
      const willRetry = attempts < job.maxAttempts;
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: willRetry ? "RETRY" : "FAILED",
          attempts,
          lastError: message,
          runAfter: willRetry ? new Date(Date.now() + backoffSeconds(attempts) * 1000) : job.runAfter,
        },
      });
      results.push({ jobId: job.id, ok: false });
    }
  }

  return results;
}

export async function cancelScheduledPost(calendarEntryId: string) {
  const scheduledPosts = await prisma.scheduledPost.findMany({ where: { calendarEntryId }, select: { id: true } });
  const scheduledPostIds = new Set(scheduledPosts.map((s) => s.id));

  if (scheduledPostIds.size > 0) {
    const pendingJobs = await prisma.jobQueue.findMany({
      where: { type: JOB_TYPE_PUBLISH, status: { in: ["PENDING", "RETRY"] } },
      select: { id: true, payload: true },
    });
    const jobIdsToCancel = pendingJobs
      .filter((job) => scheduledPostIds.has((job.payload as { scheduledPostId?: string })?.scheduledPostId ?? ""))
      .map((job) => job.id);
    if (jobIdsToCancel.length > 0) {
      await prisma.jobQueue.updateMany({ where: { id: { in: jobIdsToCancel } }, data: { status: "DONE" } });
    }
  }

  await prisma.scheduledPost.deleteMany({ where: { calendarEntryId } });
  await prisma.calendarEntry.update({ where: { id: calendarEntryId }, data: { status: "CANCELLED" } });
}
