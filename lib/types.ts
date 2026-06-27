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

export type UserRole = "agent" | "supervisor" | "quality" | "admin" | "owner";

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
