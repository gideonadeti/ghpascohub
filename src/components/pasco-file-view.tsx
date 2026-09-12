"use client";

import { ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContentInOverlay,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatPascoFileSize } from "@/lib/pasco-file-format";
import { getPascoFileViewKind } from "@/lib/pasco-file-types";
import { cn } from "@/lib/utils";
import type { PascoFileWithSignedUrl } from "@/types/api/pascos";

const PascoEmbedPdfViewer = dynamic(
  () =>
    import("@/components/pasco-embed-pdf-viewer").then(
      (module) => module.PascoEmbedPdfViewer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center" aria-busy="true">
        <Spinner aria-hidden />
        <span className="sr-only">Loading PDF viewer…</span>
      </div>
    ),
  },
);

type PascoFileViewProps = {
  file: PascoFileWithSignedUrl | null;
  onClose: () => void;
};

export function PascoFileView({ file, onClose }: PascoFileViewProps) {
  const viewKind = file ? getPascoFileViewKind(file.fileName) : null;
  const isOpen = file !== null && viewKind !== "download-only";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContentInOverlay
        overlayClassName="p-0 sm:p-6"
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-none",
          "h-[100dvh] max-h-[100dvh] w-full max-w-full rounded-none border-0 ring-0",
          "sm:h-[90vh] sm:max-h-[90vh] sm:max-w-6xl sm:rounded-2xl sm:ring-1",
        )}
        showCloseButton
      >
        {file ? (
          <>
            <DialogHeader className="shrink-0 border-b bg-background/95 px-3 py-2.5 pr-12 pt-[max(0.625rem,env(safe-area-inset-top))] backdrop-blur sm:px-4 sm:py-3">
              <DialogTitle className="truncate text-sm sm:text-base">
                {file.fileName}
              </DialogTitle>
              <DialogDescription className="sr-only">
                File preview
              </DialogDescription>
              <p className="truncate text-xs text-muted-foreground" aria-hidden>
                {formatPascoFileSize(file.fileSize)}
              </p>
            </DialogHeader>
            <div
              className="min-h-0 flex-1 bg-background sm:h-[calc(90vh-3.5rem)]"
              onWheel={(event) => event.stopPropagation()}
            >
              {viewKind === "pdf" ? (
                <PascoEmbedPdfViewer
                  key={file.fileUrl}
                  fileUrl={file.fileUrl}
                />
              ) : null}
              {viewKind === "image" ? (
                <div className="relative h-full bg-black">
                  <Image
                    src={file.fileUrl}
                    alt={file.fileName}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 72rem"
                  />
                </div>
              ) : null}
            </div>
            {viewKind === "pdf" ? (
              <DialogFooter className="shrink-0 flex-row items-center justify-end border-t bg-background/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur sm:justify-end sm:px-4 sm:py-3">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full sm:w-auto"
                  asChild
                >
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    Open in new tab
                  </a>
                </Button>
              </DialogFooter>
            ) : null}
          </>
        ) : null}
      </DialogContentInOverlay>
    </Dialog>
  );
}
