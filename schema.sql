-- Meine Bibliothek · Supabase schema v0.2
-- Eigenes Supabase-Projekt: Meine Bibliothek

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  isbn text,
  cover_url text,
  status text not null default 'unread'
    check (status in ('reading','finished','unread','wishlist','abandoned')),
  rating numeric(2,1)
    check (rating is null or (rating >= 0 and rating <= 5)),
  pages integer check (pages is null or pages >= 0),
  current_page integer not null default 0 check (current_page >= 0),
  published_year integer check (published_year is null or published_year between 0 and 2200),
  started_at date,
  finished_at date,
  format text not null default 'ebook'
    check (format in ('ebook','print','audiobook')),
  language text,
  genres text[] not null default '{}',
  notes text not null default '',
  description text not null default '',
  description_source text not null default '',
  description_source_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_finished_after_started
    check (started_at is null or finished_at is null or finished_at >= started_at)
);

alter table public.books enable row level security;

grant select, insert, update, delete on public.books to authenticated;
revoke all on public.books from anon;

drop policy if exists books_select_own on public.books;
drop policy if exists books_insert_own on public.books;
drop policy if exists books_update_own on public.books;
drop policy if exists books_delete_own on public.books;

create policy books_select_own
on public.books for select
to authenticated
using ((select auth.uid()) = user_id);

create policy books_insert_own
on public.books for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy books_update_own
on public.books for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy books_delete_own
on public.books for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_finished_at_idx on public.books(user_id, finished_at desc);
create index if not exists books_status_idx on public.books(user_id, status);

create or replace function public.set_books_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_books_updated_at() from public, anon, authenticated;

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
before update on public.books
for each row execute function public.set_books_updated_at();

-- Zitatimport: ergänzender Tabellenaufbau seit V0.6
-- Bei einer Neuinstallation nach dem Hauptschema quotes-migration.sql ausführen.
