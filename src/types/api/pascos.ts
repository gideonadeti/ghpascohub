import type { Course } from "@/types/api/catalog";

export type StudyMode =
  | "FULL_TIME"
  | "PART_TIME"
  | "DISTANCE"
  | "EVENING"
  | "WEEKEND";

export type EducationLevel =
  | "LEVEL_100"
  | "LEVEL_200"
  | "LEVEL_300"
  | "LEVEL_400";

export type SemesterType = "FIRST_SEMESTER" | "SECOND_SEMESTER";

export type PascoType = "MID_SEM" | "END_OF_SEM" | "RESIT";

export type PascoContentType =
  | "QUESTIONS_ONLY"
  | "QUESTIONS_AND_ANSWERS"
  | "ANSWERS_ONLY";

export type SolutionCompleteness = "FULLY_SOLVED" | "PARTIALLY_SOLVED";

export type CloudinaryResourceType = "IMAGE" | "RAW";

export type PascoReactionType = "LIKE" | "DISLIKE";

export type PascoModerationStatus = "PUBLISHED" | "PENDING_REVIEW" | "REJECTED";

export type PascoModerationSource = "DISLIKES" | "MANUAL";

export type PascoListSortBy =
  | "createdAt"
  | "updatedAt"
  | "academicYear"
  | "likeCount"
  | "dislikeCount"
  | "downloadCount"
  | "viewCount";

export type PascoListSortOrder = "asc" | "desc";

export type PascoListFilters = {
  q?: string;
  institutionId?: string;
  programId?: string;
  courseId?: string;
  educationLevel?: EducationLevel;
  studyMode?: StudyMode;
  academicYear?: string;
  semesterType?: SemesterType;
  type?: PascoType;
  contentType?: PascoContentType;
  isComplete?: boolean;
  page?: number;
  limit?: number;
  sortBy?: PascoListSortBy;
  sortOrder?: PascoListSortOrder;
};

export type PascoListSearchMeta = {
  q?: string;
  parsedFilters: Partial<PascoListFilters>;
  ambiguous: boolean;
  matchedCourseCount: number;
  noCourseMatch: boolean;
  matchedCourses: Array<{
    id: string;
    code: string;
    title: string;
    institutionName: string;
    pascoCount: number;
  }>;
};

export type PascoCourseSummary = Pick<Course, "code" | "title"> & {
  institutionName?: string;
};

export type PascoFile = {
  id: string;
  pascoId: string;
  order: number;
  fileName: string;
  fileSize: number;
  resourceType: CloudinaryResourceType;
  createdAt: string;
  updatedAt: string;
};

/**
 * A pasco file whose `fileUrl` is a short-lived signed URL obtained from the
 * view/download endpoints. Raw storage URLs are never exposed by the API.
 */
export type PascoFileWithSignedUrl = PascoFile & { fileUrl: string };

export type Pasco = {
  id: string;
  courseId: string;
  uploaderId?: string | null;
  academicYear: string;
  description: string | null;
  educationLevel: EducationLevel;
  studyMode: StudyMode;
  semesterType: SemesterType;
  type: PascoType;
  contentType: PascoContentType;
  solutionCompleteness: SolutionCompleteness | null;
  isComplete: boolean;
  likeCount: number;
  dislikeCount: number;
  downloadCount: number;
  viewCount: number;
  files: PascoFile[];
  createdAt: string;
  updatedAt: string;
  viewerReaction?: PascoReactionType | null;
  course?: PascoCourseSummary;
  moderationStatus?: PascoModerationStatus;
  moderationSource?: PascoModerationSource;
  rejectionReason?: string;
  moderationNote?: string;
};

export type PascoListResponse = {
  pascos: Pasco[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  search?: PascoListSearchMeta;
  appliedCourse?: PascoCourseSummary;
};

export type MyPascoListFilters = {
  moderationStatus?: PascoModerationStatus;
  page?: number;
  limit?: number;
};

export type MyPascoListResponse = {
  pascos: Pasco[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PascoDetailResponse = {
  pasco: Pasco;
  displayTitle: string;
  course?: { code: string; title: string } | null;
};

export type PascoFileCreateInput = {
  order: number;
  publicId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  resourceType: CloudinaryResourceType;
  contentHash: string;
};

export type PascoFileComputeHashInput = {
  courseId: string;
  publicId: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  resourceType: CloudinaryResourceType;
};

export type PascoFileComputeHashResponse = {
  contentHash: string;
};

export type PascoFileDuplicate = {
  contentHash: string;
  fileName: string;
  pascoId: string;
};

export type PascoFileDuplicateCheckResponse = {
  duplicates: PascoFileDuplicate[];
  message?: string;
};

export type PascoCreateDuplicateErrorResponse = {
  error: "duplicate_file_content";
  message: string;
  duplicates: PascoFileDuplicate[];
};

export type PascoCreateInput = {
  courseId: string;
  files: PascoFileCreateInput[];
  academicYear: string;
  description?: string;
  educationLevel: EducationLevel;
  studyMode: StudyMode;
  semesterType: SemesterType;
  type: PascoType;
  contentType: PascoContentType;
  solutionCompleteness?: SolutionCompleteness | null;
  isComplete?: boolean;
};

export type PascoCreateResponse = {
  pasco: Pasco;
};

export type PascoFileExistingSyncInput = {
  id: string;
  order: number;
};

export type PascoFileSyncInput =
  | PascoFileCreateInput
  | PascoFileExistingSyncInput;

export type PascoUpdateInput = {
  courseId?: string;
  academicYear?: string;
  description?: string | null;
  educationLevel?: EducationLevel;
  studyMode?: StudyMode;
  semesterType?: SemesterType;
  type?: PascoType;
  contentType?: PascoContentType;
  solutionCompleteness?: SolutionCompleteness | null;
  isComplete?: boolean;
  files?: PascoFileSyncInput[];
};

export type PascoUpdateResponse = {
  pasco: Pasco;
  storageCleanupFailures?: string[];
};

export type PascoDeleteResponse = {
  success: true;
  storageCleanupFailures?: string[];
};

export type PascoReactionResponse = {
  likeCount: number;
  dislikeCount: number;
  viewerReaction: PascoReactionType | null;
};

export type PascoViewResponse = {
  viewCount: number;
  recorded: boolean;
};

export type PascoDownloadResponse = {
  downloadCount: number;
  fileUrl: string;
  fileName: string;
};

export type PascoFileViewResponse = {
  fileUrl: string;
  fileName: string;
};

export type ModerationPascoUploader = {
  id: string;
  name: string;
};

export type ModerationPascoListItem = Pasco & {
  course: PascoCourseSummary;
  uploader: ModerationPascoUploader | null;
  moderationStatus: PascoModerationStatus;
  moderationSource?: PascoModerationSource | null;
  rejectionReason?: string | null;
  moderationNote?: string | null;
};

export type ModerationPascoListResponse = {
  pascos: ModerationPascoListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ModerationPascoAction = "approve" | "reject" | "restore" | "flag";

export type ModerationPascoUpdateRequest = {
  action: ModerationPascoAction;
  reason?: string;
  note?: string;
};

export type ModerationPascoUpdateResponse = {
  moderationStatus: PascoModerationStatus;
};

export type ModerationSettingsResponse = {
  dislikeThreshold: number;
};
