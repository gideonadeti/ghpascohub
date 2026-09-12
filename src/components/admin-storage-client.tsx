"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  useStorageCleanupFailures,
  useStorageCleanupRuns,
  useTriggerOrphanCleanup,
} from "@/hooks/api/use-admin";

function CleanupForm() {
  const triggerMutation = useTriggerOrphanCleanup();
  const [dryRun, setDryRun] = useState(true);
  const [courseId, setCourseId] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trigger orphan cleanup</CardTitle>
        <CardDescription>
          Scan Cloudinary for assets with no matching database record.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label htmlFor="dry-run" className="flex items-center gap-2">
            <Checkbox
              id="dry-run"
              checked={dryRun}
              onCheckedChange={(checked) => setDryRun(checked === true)}
            />
            Dry run (no deletions)
          </Label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="courseId">Course ID (optional)</Label>
          <Input
            id="courseId"
            placeholder="Limit scan to a specific course"
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            triggerMutation.mutate({
              dryRun,
              courseId: courseId.trim() || undefined,
            })
          }
          disabled={triggerMutation.isPending}
        >
          {triggerMutation.isPending ? <Spinner aria-hidden /> : null}
          {dryRun ? "Scan" : "Scan and delete"}
        </Button>
      </CardContent>
    </Card>
  );
}

function CleanupRunsTable() {
  const runsQuery = useStorageCleanupRuns();

  if (runsQuery.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (runsQuery.isError) {
    return (
      <p className="text-sm text-destructive">Could not load cleanup runs.</p>
    );
  }

  const runs = runsQuery.data?.runs ?? [];

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No cleanup runs yet.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Scanned</TableHead>
          <TableHead>Orphans</TableHead>
          <TableHead>Deleted</TableHead>
          <TableHead>Failures</TableHead>
          <TableHead>Type</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="text-muted-foreground">
              {new Date(run.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>{run.scanned}</TableCell>
            <TableCell>{run.orphanCount}</TableCell>
            <TableCell>{run.deletedCount}</TableCell>
            <TableCell>{run.failureCount}</TableCell>
            <TableCell>
              <Badge variant={run.dryRun ? "secondary" : "default"}>
                {run.dryRun ? "Dry run" : "Cleanup"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CleanupFailuresTable() {
  const failuresQuery = useStorageCleanupFailures(false);

  if (failuresQuery.isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (failuresQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load cleanup failures.
      </p>
    );
  }

  const failures = failuresQuery.data?.failures ?? [];

  if (failures.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No unresolved failures.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Public ID</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Resolved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {failures.map((failure) => (
          <TableRow key={failure.id}>
            <TableCell className="max-w-xs truncate font-mono text-xs">
              {failure.publicId}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{failure.source}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(failure.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {failure.resolvedAt ? (
                <Badge variant="secondary">Resolved</Badge>
              ) : (
                <Badge variant="destructive">Unresolved</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AdminStorageClient() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-sm text-muted-foreground">
          Manage Cloudinary storage and orphan cleanup.
        </p>
      </div>

      <CleanupForm />

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Recent runs</h2>
        <CleanupRunsTable />
      </div>

      <Separator />

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Unresolved failures</h2>
        <CleanupFailuresTable />
      </div>
    </div>
  );
}
