"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { PascoDeleteDialog } from "@/components/pasco-delete-dialog";
import { PascoDetailSkeleton } from "@/components/pasco-detail-skeleton";
import { PascoDownloadAll } from "@/components/pasco-download-all";
import { PascoEngagementBar } from "@/components/pasco-engagement-bar";
import { PascoFileActions } from "@/components/pasco-file-actions";
import { PascoFileView } from "@/components/pasco-file-view";
import { PascoModerationActions } from "@/components/pasco-moderation-actions";
import { ReportPascoLink } from "@/components/report-pasco-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCourse } from "@/hooks/api/use-courses";
import { useCurrentUser } from "@/hooks/api/use-current-user";
import { useRecordPascoView } from "@/hooks/api/use-pasco-engagement";
import { usePasco } from "@/hooks/api/use-pascos";
import { trackAnalyticsEvent } from "@/lib/analytics/posthog";
import { formatEnumLabel } from "@/lib/catalog-labels";
import { formatDateTime } from "@/lib/dates";
import { buildPascoCreateHref } from "@/lib/pasco-create-href";
import {
  getPascoDisplayDescription,
  getPascoDisplayTitle,
  pascoOverviewBadges,
} from "@/lib/pasco-display";
import {
  canUserDeletePasco,
  canUserModifyPasco,
  isModeratorRole,
} from "@/lib/pasco-permissions";
import type {
  PascoDetailResponse,
  PascoFileWithSignedUrl,
} from "@/types/api/pascos";

export function PascoDetailPage({
  initialData,
}: {
  initialData?: PascoDetailResponse;
}) {
  const params = useParams<{ pascoId: string }>();
  const pascoId = params.pascoId ?? "";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewFile, setViewFile] = useState<PascoFileWithSignedUrl | null>(null);
  const pascoQuery = usePasco(pascoId, initialData);
  const courseId = pascoQuery.data?.pasco.courseId ?? "";
  const courseQuery = useCourse(courseId);
  const currentUser = useCurrentUser();
  useRecordPascoView(pascoId, pascoQuery.isSuccess);

  const courseCode = courseQuery.data?.course?.code;
  const trackedViewRef = useRef(false);

  useEffect(() => {
    if (
      !pascoQuery.isSuccess ||
      trackedViewRef.current ||
      courseQuery.isFetching
    ) {
      return;
    }

    trackedViewRef.current = true;
    trackAnalyticsEvent("pasco_viewed", {
      pasco_id: pascoId,
      course_code: courseCode,
    });
  }, [pascoQuery.isSuccess, courseQuery.isFetching, courseCode, pascoId]);

  if (pascoQuery.isPending) {
    return <PascoDetailSkeleton />;
  }

  if (pascoQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load pasco</AlertTitle>
        <AlertDescription>{pascoQuery.error.message}</AlertDescription>
      </Alert>
    );
  }

  const pasco = pascoQuery.data.pasco;
  const displayCourse = initialData?.course ?? null;
  const course = courseQuery.data?.course ?? displayCourse;
  const courseLabel = course
    ? `${course.code} — ${course.title}`
    : pasco.courseId;
  const user = currentUser.data?.user;
  const canEdit = user && canUserModifyPasco(user, pasco);
  const canDelete = user && canUserDeletePasco(user, pasco);
  const isModerator = isModeratorRole(user?.role);
  const moderationStatus = pasco.moderationStatus;
  const isUploader = user?.id === pasco.uploaderId;
  const isUploaderPending = moderationStatus === "PENDING_REVIEW" && isUploader;
  const isUploaderRejected = moderationStatus === "REJECTED" && isUploader;
  const uploadAnotherHref =
    isUploader && courseQuery.data?.course
      ? buildPascoCreateHref({
          institutionId: courseQuery.data.course.institutionId,
          programId: courseQuery.data.course.programIds[0],
        })
      : null;

  return (
    <div className="space-y-8">
      {isUploaderPending ? (
        <Alert>
          <AlertTitle>Under review</AlertTitle>
          <AlertDescription>
            This pasco is hidden from other students while moderators review it.
          </AlertDescription>
        </Alert>
      ) : null}

      {isUploaderRejected ? (
        <Alert variant="destructive">
          <AlertTitle>Not published</AlertTitle>
          <AlertDescription className="space-y-2">
            {pasco.rejectionReason ? (
              <p>Moderators rejected this pasco: {pasco.rejectionReason}</p>
            ) : (
              <p>Moderators rejected this pasco.</p>
            )}
            <p>
              You can{" "}
              <Link
                href={`/pascos/${pascoId}/edit`}
                className="font-medium underline underline-offset-4"
              >
                edit it
              </Link>{" "}
              and resubmit for review.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {isModerator && moderationStatus && moderationStatus !== "PUBLISHED" ? (
        <Alert>
          <AlertTitle>
            Moderation: {formatEnumLabel(moderationStatus)}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              {moderationStatus === "PENDING_REVIEW"
                ? pasco.moderationSource === "MANUAL"
                  ? "This pasco was manually sent for review."
                  : "This pasco was flagged after receiving enough dislikes."
                : "This pasco was rejected and remains hidden from students."}
            </p>
            {pasco.moderationNote ? (
              <p className="text-sm">Note: {pasco.moderationNote}</p>
            ) : null}
            {pasco.rejectionReason ? (
              <p className="text-sm">Reason: {pasco.rejectionReason}</p>
            ) : null}
            <PascoModerationActions
              pascoId={pascoId}
              status={moderationStatus}
            />
          </AlertDescription>
        </Alert>
      ) : null}

      {isModerator && moderationStatus === "PUBLISHED" ? (
        <Alert>
          <AlertTitle>Moderator actions</AlertTitle>
          <AlertDescription>
            <PascoModerationActions pascoId={pascoId} status="PUBLISHED" />
          </AlertDescription>
        </Alert>
      ) : null}

      <PageHeader
        title={initialData?.displayTitle ?? getPascoDisplayTitle(pasco, course)}
        description={getPascoDisplayDescription(pasco, course)}
        actions={
          <>
            <ReportPascoLink pascoId={pascoId} />
            {uploadAnotherHref ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={uploadAnotherHref}>Upload another</Link>
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/pascos/${pascoId}/edit`}>Edit</Link>
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <PascoDeleteDialog
        pascoId={pascoId}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />

      <Card className="w-full">
        <CardContent className="space-y-8 pt-6">
          <Section title="Overview">
            <div className="flex flex-wrap gap-1.5">
              {pascoOverviewBadges.map((key) => (
                <Badge key={key} variant="secondary">
                  {formatEnumLabel(pasco[key])}
                </Badge>
              ))}
            </div>
          </Section>

          <Section title="Details">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Course</dt>
                <dd>{courseLabel}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Academic year</dt>
                <dd>{pasco.academicYear}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Education level</dt>
                <dd>{formatEnumLabel(pasco.educationLevel)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Study mode</dt>
                <dd>{formatEnumLabel(pasco.studyMode)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Semester</dt>
                <dd>{formatEnumLabel(pasco.semesterType)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{formatEnumLabel(pasco.type)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Content type</dt>
                <dd>{formatEnumLabel(pasco.contentType)}</dd>
              </div>
              {pasco.solutionCompleteness && (
                <div>
                  <dt className="text-muted-foreground">
                    Solution completeness
                  </dt>
                  <dd>{formatEnumLabel(pasco.solutionCompleteness)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">Complete upload</dt>
                <dd>{pasco.isComplete ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDateTime(pasco.createdAt)}</dd>
              </div>
            </dl>
          </Section>

          {pasco.description ? (
            <Section title="Description">
              <p className="text-sm text-muted-foreground sm:text-base">
                {pasco.description}
              </p>
            </Section>
          ) : null}

          <Section
            title="Files"
            actions={
              pasco.files.length >= 2 ? (
                <PascoDownloadAll
                  pascoId={pascoId}
                  files={pasco.files}
                  course={course}
                />
              ) : null
            }
          >
            {pasco.files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No files attached to this pasco.
              </p>
            ) : (
              <ul className="space-y-2">
                {pasco.files.map((file) => (
                  <li key={file.id}>
                    <PascoFileActions
                      pascoId={pascoId}
                      file={file}
                      courseCode={course?.code}
                      onView={setViewFile}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Engagement">
            <PascoEngagementBar pascoId={pascoId} pasco={pasco} />
          </Section>
        </CardContent>
      </Card>

      <PascoFileView file={viewFile} onClose={() => setViewFile(null)} />
    </div>
  );
}
