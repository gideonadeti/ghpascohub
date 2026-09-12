"use client";

import { useState } from "react";
import { PascoBrowsePagination } from "@/components/pasco-browse-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminUsersList,
  usePromoteToModerator,
} from "@/hooks/api/use-admin";

const roleBadgeVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ADMIN: "destructive",
  MODERATOR: "secondary",
  CONTRIBUTOR: "outline",
  NORMAL_USER: "default",
};

const USERS_PAGE_SIZE = 20;

export function AdminUsersClient() {
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const usersQuery = useAdminUsersList(
    roleFilter
      ? { role: roleFilter, page, limit: USERS_PAGE_SIZE }
      : { page, limit: USERS_PAGE_SIZE },
  );
  const promoteMutation = usePromoteToModerator();

  const users = usersQuery.data?.users ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setPage(1);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          {total} user{total !== 1 ? "s" : ""} total.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["", "NORMAL_USER", "CONTRIBUTOR", "MODERATOR", "ADMIN"].map(
          (role) => (
            <Button
              key={role}
              variant={roleFilter === role ? "default" : "outline"}
              size="sm"
              onClick={() => handleRoleFilterChange(role)}
            >
              {role || "All"}
            </Button>
          ),
        )}
      </div>

      {usersQuery.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : usersQuery.isError ? (
        <p className="text-sm text-destructive">Could not load users.</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>School</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>
                    <Badge variant={roleBadgeVariant[user.role] ?? "default"}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.school ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role === "NORMAL_USER" ||
                    user.role === "CONTRIBUTOR" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => promoteMutation.mutate(user.id)}
                        disabled={promoteMutation.isPending}
                      >
                        {promoteMutation.isPending ? (
                          <Spinner aria-hidden />
                        ) : null}
                        Promote to moderator
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {user.role === "ADMIN" ? "—" : "Already moderator"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PascoBrowsePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
