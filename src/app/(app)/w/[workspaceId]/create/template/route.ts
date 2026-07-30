import { NextResponse } from "next/server";
import { requireUser, requireWorkspaceAccess } from "@/server/auth/session";
import { getPillars } from "@/server/services/brand-brain";
import { buildImportTemplateWorkbook } from "@/server/services/bulk-import";

export async function GET(_request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const user = await requireUser();
  await requireWorkspaceAccess(user.id, workspaceId);

  const pillars = await getPillars(workspaceId);
  const buffer = buildImportTemplateWorkbook(pillars.map((p) => p.name));

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-importacion-ideas.xlsx"',
    },
  });
}
