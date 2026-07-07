export interface ContentBlock {
  type: "text" | "image" | "link";
  text?: string;
  url?: string | null;
  filename?: string;
  title?: string;
}

export interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  slug: string;
  search_keywords: string[];
  body_text: string;
  content_blocks: ContentBlock[];
  page_start: number | null;
  page_end: number | null;
  word_count: number;
  source_version: string | null;
  updated_at: string;
}

export interface ChapterImage {
  id: string;
  chapter_id: string;
  filename: string;
  storage_path: string;
  page: number | null;
  width: number | null;
  height: number | null;
  sort_order: number;
}

export interface ChapterWithImages extends Chapter {
  chapter_images: ChapterImage[];
}

export interface SearchResult {
  id: string;
  chapter_number: number;
  title: string;
  slug: string;
  snippet: string;
  rank: number;
}

export type UserRole = "editor" | "admin" | "owner" | "quality" | "supervisor" | "agent";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ProcedureReviewStatus = "draft" | "needs_review" | "approved" | "archived";
export type SourceConfidence = "needs_review" | "source_backed" | "approved";

export interface ProcedureCard {
  id: string;
  chapter_id: string | null;
  title: string;
  slug: string;
  category: string;
  service_code: string | null;
  service_type: string | null;
  summary: string | null;
  when_to_use: string | null;
  channels: JsonValue[];
  cut_off_time: string | null;
  who_can_action: JsonValue[];
  required_information: JsonValue[];
  system_steps: JsonValue[];
  passenger_advice: JsonValue[];
  allowed: JsonValue[];
  not_allowed: JsonValue[];
  escalation_points: JsonValue[];
  fees_charges: string | null;
  agent_action: JsonValue[];
  rules: JsonValue[];
  exceptions: JsonValue[];
  required_approval: string | null;
  customer_script: string | null;
  sprint_comment_template: string | null;
  salesforce_classification: string | null;
  source_pages: number[];
  source_version: string | null;
  source_updated_at: string | null;
  keywords: string[];
  aliases: string[];
  priority: number;
  review_status: ProcedureReviewStatus;
  is_published: boolean;
  show_on_homepage: boolean;
  homepage_order: number;
  source_confidence: SourceConfidence;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcedureEditHistory {
  id: string;
  procedure_id: string | null;
  edited_by: string | null;
  previous_data: JsonValue | null;
  new_data: JsonValue | null;
  created_at: string;
}

export interface EditHistoryEntry {
  id: string;
  chapter_id: string;
  edited_by_email: string | null;
  change_type: "manual_edit" | "pdf_sync" | "rollback";
  previous_body_text: string | null;
  new_body_text: string | null;
  previous_content_blocks?: ContentBlock[] | null;
  new_content_blocks?: ContentBlock[] | null;
  previous_keywords: string[] | null;
  new_keywords: string[] | null;
  source_version: string | null;
  created_at: string;
}
