"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/lib/enums";
import type { Role } from "@/lib/enums";
import { inviteMemberAction, updateMemberRoleAction, removeMemberAction } from "@/app/(app)/w/[workspaceId]/team/actions";

export interface MemberData {
  id: string;
  role: string;
  invitedEmail: string | null;
  acceptedAt: Date | string | null;
  user: { id: string; name: string | null; email: string };
}

export function TeamBoard({ workspaceId, members, currentUserId }: { workspaceId: string; members: MemberData[]; currentUserId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [isPending, startTransition] = useTransition();

  function invite() {
    if (!email.trim()) return;
    startTransition(async () => {
      await inviteMemberAction(workspaceId, email, role);
      setEmail("");
      toast.success("Invitación enviada");
      router.refresh();
    });
  }

  function changeRole(membershipId: string, newRole: Role) {
    startTransition(async () => {
      await updateMemberRoleAction(workspaceId, membershipId, newRole);
      router.refresh();
    });
  }

  function remove(membershipId: string) {
    startTransition(async () => {
      await removeMemberAction(workspaceId, membershipId);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 p-4">
          <div className="min-w-48 flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground">Email a invitar</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@empresa.com" />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={invite} disabled={isPending || !email.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Invitar
          </Button>
        </CardContent>
      </Card>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <p className="font-medium">{member.user.name ?? member.invitedEmail ?? member.user.email}</p>
                  <p className="text-xs text-muted-foreground">{member.user.email}</p>
                </TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(v) => changeRole(member.id, v as Role)}
                    disabled={isPending || member.role === "OWNER"}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{member.acceptedAt ? "Activo" : "Invitación pendiente"}</TableCell>
                <TableCell className="text-right">
                  {member.role !== "OWNER" && member.user.id !== currentUserId && (
                    <Button size="icon" variant="ghost" onClick={() => remove(member.id)} disabled={isPending}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
