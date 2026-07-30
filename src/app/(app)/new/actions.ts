"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { createWorkspace, updateAutomationLevel } from "@/server/services/workspace";
import { updateBrandProfile, createPillar } from "@/server/services/brand-brain";
import { connectSocialAccount } from "@/server/services/accounts";
import { generateIdeas } from "@/server/services/ideas";
import { logAudit } from "@/server/services/audit";
import { AUTOMATION_LEVELS, SOCIAL_PLATFORMS, TONES } from "@/lib/enums";

export interface OnboardingState {
  error?: string;
}

const onboardingSchema = z.object({
  name: z.string().min(2, "Indica el nombre de la empresa."),
  website: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  languages: z.array(z.string()).default(["es"]),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).default([]),
  tone: z.enum(TONES).default("CERCANO"),
  brandColors: z.array(z.string()).default([]),
  differentiators: z.array(z.string()).default([]),
  claims: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  automationLevel: z.enum(AUTOMATION_LEVELS).default("ASSISTED"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

const GOAL_TO_PILLARS: Record<string, { name: string; description: string }[]> = {
  Notoriedad: [{ name: "Marca", description: "Contenido que refuerza quiénes somos y qué nos diferencia." }],
  "Captación de leads": [{ name: "Producto", description: "Funcionalidades y motivos para probar el producto." }],
  "Generación de tráfico": [{ name: "Educativo", description: "Contenido que enseña y dirige a la web." }],
  "Posicionamiento experto": [{ name: "Opinión del sector", description: "Puntos de vista y análisis del sector." }],
  "Lanzamiento de producto": [{ name: "Lanzamientos", description: "Novedades y anuncios de producto." }],
  "Employer branding": [{ name: "Cultura de empresa", description: "Vida interna, equipo y valores." }],
  Engagement: [{ name: "Preguntas frecuentes", description: "Contenido conversacional y de comunidad." }],
  Conversión: [{ name: "Casos de éxito", description: "Resultados reales conseguidos por clientes." }],
  "Comunicación corporativa": [{ name: "Noticias", description: "Novedades corporativas y comunicados." }],
};

const DEFAULT_PILLARS = [
  { name: "Educativo", description: "Contenido que enseña sobre el sector." },
  { name: "Casos de éxito", description: "Resultados obtenidos por clientes." },
  { name: "Producto", description: "Funcionalidades y novedades del producto." },
];

export async function completeOnboarding(input: OnboardingInput): Promise<OnboardingState> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos introducidos." };
  }
  const data = parsed.data;
  const user = await requireUser();

  const workspace = await createWorkspace({
    ownerId: user.id,
    name: data.name,
    website: data.website || undefined,
    industry: data.industry || undefined,
    country: data.country || undefined,
    languages: data.languages,
  });

  await updateBrandProfile(workspace.id, user.id, {
    tone: data.tone,
    brandColors: data.brandColors,
    differentiators: data.differentiators,
    claims: data.claims,
  });

  const pillarsToCreate = data.goals.length
    ? data.goals.flatMap((goal) => GOAL_TO_PILLARS[goal] ?? [])
    : DEFAULT_PILLARS;
  const uniquePillars = Array.from(new Map(pillarsToCreate.map((p) => [p.name, p])).values()).slice(0, 5);
  for (const pillar of uniquePillars.length ? uniquePillars : DEFAULT_PILLARS) {
    await createPillar(workspace.id, pillar).catch(() => undefined);
  }

  for (const platform of data.platforms) {
    await connectSocialAccount(workspace.id, platform, user.id);
  }

  await updateAutomationLevel(workspace.id, user.id, data.automationLevel);

  await generateIdeas({ workspaceId: workspace.id, count: 6, sourceHint: "onboarding", goals: data.goals });

  await logAudit({ workspaceId: workspace.id, userId: user.id, action: "onboarding.completed", entityType: "Workspace", entityId: workspace.id });

  redirect(`/w/${workspace.id}?onboarded=1`);
}
