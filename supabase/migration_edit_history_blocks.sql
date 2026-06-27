-- ============================================================
-- Migration: store full content blocks in edit history
-- Run once in Supabase SQL Editor.
-- This makes restore safer for chapters with inline images and links.
-- ============================================================

alter table edit_history
  add column if not exists previous_content_blocks jsonb,
  add column if not exists new_content_blocks jsonb;
