"use client";

import {
  type DocumentManagerPlugin,
  PDFViewer,
  type PDFViewerRef,
  type PluginRegistry,
  ZoomMode,
  type ZoomPlugin,
} from "@embedpdf/react-pdf-viewer";
import { useCallback, useRef } from "react";

type PascoEmbedPdfViewerProps = {
  fileUrl: string;
};

function fitActiveDocument(registry: PluginRegistry) {
  const documentManager = registry
    .getPlugin<DocumentManagerPlugin>("document-manager")
    ?.provides();
  const zoomPlugin = registry.getPlugin<ZoomPlugin>("zoom")?.provides();
  const documentId = documentManager?.getActiveDocumentId();

  if (!documentId || !zoomPlugin) {
    return;
  }

  zoomPlugin.forDocument(documentId).requestZoom(ZoomMode.FitWidth);
}

function scheduleInitialFit(registry: PluginRegistry) {
  requestAnimationFrame(() => {
    fitActiveDocument(registry);
  });

  window.setTimeout(() => {
    fitActiveDocument(registry);
  }, 200);
}

export function PascoEmbedPdfViewer({ fileUrl }: PascoEmbedPdfViewerProps) {
  const viewerRef = useRef<PDFViewerRef>(null);
  const initialFitDoneRef = useRef(false);

  const handleReady = useCallback((registry: PluginRegistry) => {
    if (initialFitDoneRef.current) {
      return;
    }

    initialFitDoneRef.current = true;
    scheduleInitialFit(registry);
  }, []);

  return (
    <div
      className="h-full min-h-0 w-full [touch-action:pan-x_pan-y_pinch-zoom]"
      onWheel={(event) => event.stopPropagation()}
    >
      <PDFViewer
        ref={viewerRef}
        key={fileUrl}
        className="h-full w-full"
        style={{ height: "100%", width: "100%", minHeight: 0 }}
        config={{
          src: fileUrl,
          tabBar: "never",
          theme: { preference: "system" },
          zoom: {
            defaultZoomLevel: ZoomMode.FitWidth,
          },
          disabledCategories: [
            "annotation",
            "redaction",
            "form",
            "print",
            "export",
            "insert",
            "document-open",
            "history",
            "security-unlock-overlay",
          ],
          permissions: {
            overrides: {
              print: false,
            },
          },
        }}
        onReady={handleReady}
      />
    </div>
  );
}
