-- Bookfolio v0.7: idempotent, preserves all existing book and quote records.
alter table public.books
  add column if not exists description text not null default '',
  add column if not exists description_source text not null default '',
  add column if not exists description_source_url text not null default '';
