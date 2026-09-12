import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { PageContainer } from "@/components/layout/page-container";
import { PascoDetailPage } from "@/components/pasco-detail-page";
import { formatEnumLabel, formatProgramLabel } from "@/lib/catalog-labels";
import { getCourseBreadcrumbById, getCourseById } from "@/lib/courses";
import { getPascoDisplayTitle } from "@/lib/pasco-display";
import { getViewerReactionsForPascos } from "@/lib/pasco-engagement";
import { filtersToSearchParams } from "@/lib/pasco-list-query";
import { getPascoById, serializePasco } from "@/lib/pascos";
import {
  breadcrumbJsonLd,
  pascoJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";

import type { PascoDetailResponse } from "@/types/api/pascos";

const getCachedPascoById = cache(getPascoById);

type PascoDetailRouteProps = {
  params: Promise<{ pascoId: string }>;
};

export async function generateMetadata({
  params,
}: PascoDetailRouteProps): Promise<Metadata> {
  const { pascoId } = await params;
  const result = await getCachedPascoById(pascoId);

  if (!result.success) {
    return {
      title: "Pasco",
    };
  }

  const courseResult = await getCourseById(result.pasco.courseId);
  const course = courseResult.success ? courseResult.course : null;
  const title = getPascoDisplayTitle(result.pasco, course);

  const pasco = result.pasco;
  const courseLabel = course
    ? `${course.code} ${course.title}`
    : "past exam paper";
  const description = `Download ${courseLabel} ${formatEnumLabel(pasco.educationLevel)} ${formatEnumLabel(pasco.semesterType)} ${formatEnumLabel(pasco.type)} past questions (${pasco.academicYear}). Free university exam paper from Uni Pasco Hub.`;

  return {
    title,
    description,
    alternates: { canonical: `/pascos/${pascoId}` },
  };
}

async function getPascoData(pascoId: string) {
  const result = await getCachedPascoById(pascoId);

  if (!result.success) {
    return null;
  }

  const courseResult = await getCourseBreadcrumbById(result.pasco.courseId);
  const course = courseResult.success ? courseResult.course : null;

  return { pasco: result.pasco, course };
}

export default async function PascoDetailRoute({
  params,
}: PascoDetailRouteProps) {
  const { pascoId } = await params;
  const data = await getPascoData(pascoId);

  if (!data) {
    notFound();
  }

  const { userId } = await auth();
  const viewerReaction = userId
    ? ((await getViewerReactionsForPascos(userId, [pascoId])).get(pascoId) ??
      null)
    : undefined;

  const selectedProgram = data.course?.programs[0];
  const institutionBrowseHref = data.course
    ? `/pascos?${filtersToSearchParams({ institutionId: data.course.institution.id }).toString()}`
    : "/pascos";
  const programBrowseHref = selectedProgram
    ? `/pascos?${filtersToSearchParams({ programId: selectedProgram.id }).toString()}`
    : "/pascos";
  const courseBrowseHref = data.course
    ? `/pascos?${filtersToSearchParams({ courseId: data.course.id }).toString()}`
    : "/pascos";
  const breadcrumbItems = [
    { name: "Home", href: "/" },
    { name: "Browse pascos", href: "/pascos" },
    ...(data.course
      ? [
          {
            name: data.course.institution.name,
            href: institutionBrowseHref,
          },
          ...(selectedProgram
            ? [
                {
                  name: formatProgramLabel(selectedProgram),
                  href: programBrowseHref,
                },
              ]
            : []),
          {
            name: `${data.course.code} — ${data.course.title}`,
            href: courseBrowseHref,
          },
        ]
      : []),
    {
      name: `${data.pasco.academicYear} · ${formatEnumLabel(data.pasco.semesterType)} · ${formatEnumLabel(data.pasco.type)}`,
      href: `/pascos/${pascoId}`,
    },
  ];
  const breadcrumb = breadcrumbJsonLd(breadcrumbItems);

  const pascoSchema = pascoJsonLd(data.pasco, data.course);

  const serialized = serializePasco(data.pasco, { viewerReaction });
  const displayTitle = getPascoDisplayTitle(data.pasco, data.course);
  const course = data.course
    ? { code: data.course.code, title: data.course.title }
    : null;
  const initialData: PascoDetailResponse = {
    pasco: serialized,
    displayTitle,
    course,
  };

  return (
    <PageContainer width="narrow" className="space-y-8">
      <Breadcrumbs items={breadcrumbItems} />
      <script
        type="application/ld+json"
        /* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD serialized via serializeJsonLd (escapes <, >, &, line separators) */
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        /* biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD serialized via serializeJsonLd (escapes <, >, &, line separators) */
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(pascoSchema) }}
      />
      <PascoDetailPage initialData={initialData} />
    </PageContainer>
  );
}
