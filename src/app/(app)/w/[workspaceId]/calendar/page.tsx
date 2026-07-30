import { listCalendarEntries } from "@/server/services/calendar";
import { listPendingApprovals } from "@/server/services/approvals";
import { monthGridDays, startOfMonth } from "@/lib/calendar-grid";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { ApprovalsBanner } from "@/components/calendar/approvals-banner";

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { workspaceId } = await params;
  const { month } = await searchParams;

  const anchor = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const grid = monthGridDays(anchor);
  const from = grid[0];
  const to = grid[grid.length - 1];

  const [entries, pendingApprovals] = await Promise.all([
    listCalendarEntries(workspaceId, { from, to }),
    listPendingApprovals(workspaceId),
  ]);

  return (
    <div className="flex h-full flex-col">
      {pendingApprovals.length > 0 && (
        <ApprovalsBanner workspaceId={workspaceId} approvals={pendingApprovals} />
      )}
      <CalendarBoard workspaceId={workspaceId} monthAnchor={startOfMonth(anchor).toISOString()} entries={entries} />
    </div>
  );
}
