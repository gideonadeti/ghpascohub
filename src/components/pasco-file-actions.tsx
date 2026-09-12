"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import type { LucideIcon } from "lucide-react";
import { Eye, File, FileImage, FileText } from "lucide-react";

import { PascoFileDownload } from "@/components/pasco-file-download";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePascoFileViewUrl } from "@/hooks/api/use-pasco-engagement";
import {
  formatPascoFileDisplayName,
  formatPascoFileSize,
} from "@/lib/pasco-file-format";
import {
  getPascoFileViewKind,
  type PascoFileViewKind,
} from "@/lib/pasco-file-types";
import type { PascoFile, PascoFileWithSignedUrl } from "@/types/api/pascos";

const COMPACT_BUTTON_CLASS =
  "min-h-11 w-full gap-1.5 sm:min-h-8 sm:w-auto sm:min-w-8 sm:px-3 sm:gap-1";

const FILE_TYPE_ICONS: Record<PascoFileViewKind, LucideIcon> = {
  pdf: FileText,
  image: FileImage,
  "download-only": File,
};

type PascoFileActionsProps = {
  pascoId: string;
  file: PascoFile;
  courseCode?: string;
  onView: (file: PascoFileWithSignedUrl) => void;
};

export function PascoFileActions({
  pascoId,
  file,
  courseCode,
  onView,
}: PascoFileActionsProps) {
  const { isSignedIn } = useAuth();
  const viewUrlMutation = usePascoFileViewUrl(pascoId);
  const viewKind = getPascoFileViewKind(file.fileName);
  const canView = viewKind !== "download-only";
  const TypeIcon = FILE_TYPE_ICONS[viewKind];
  const viewAriaLabel = `View ${file.fileName}`;

  async function handleView() {
    try {
      const result = await viewUrlMutation.mutateAsync(file.id);
      onView({
        ...file,
        fileUrl: result.fileUrl,
        fileName: result.fileName,
      });
    } catch {
      // Rejection already surfaced via the mutation's onError toast.
    }
  }

  function renderViewButton() {
    if (!canView) {
      return null;
    }

    const viewContent = viewUrlMutation.isPending ? (
      <Spinner aria-hidden />
    ) : (
      <>
        <Eye className="size-4" aria-hidden />
        <span>View</span>
      </>
    );

    if (isSignedIn !== true) {
      return (
        <SignInButton mode="modal">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={COMPACT_BUTTON_CLASS}
            aria-label={viewAriaLabel}
          >
            <Eye className="size-4" aria-hidden />
            <span>View</span>
          </Button>
        </SignInButton>
      );
    }

    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className={COMPACT_BUTTON_CLASS}
        aria-label={viewAriaLabel}
        disabled={viewUrlMutation.isPending}
        onClick={() => void handleView()}
      >
        {viewContent}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-2.5 sm:flex-1">
        <TypeIcon
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={file.fileName}>
            {formatPascoFileDisplayName(file)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPascoFileSize(file.fileSize)}
          </p>
        </div>
      </div>
      <div
        className={
          canView
            ? "grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-1"
            : "flex w-full justify-end sm:w-auto sm:shrink-0"
        }
      >
        {renderViewButton()}
        <PascoFileDownload
          pascoId={pascoId}
          file={file}
          courseCode={courseCode}
          compact
        />
      </div>
    </div>
  );
}
