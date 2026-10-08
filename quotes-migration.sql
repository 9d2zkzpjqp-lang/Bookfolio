-- Meine Bibliothek V0.6: Zitate in einer separaten, privat geschützten Tabelle.
-- Die Migration ist im bestehenden Supabase-Projekt "Meine Bibliothek" bereits angewendet.
create table if not exists public.book_quotes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 book_id uuid not null references public.books(id) on delete cascade,
 body text not null check (length(trim(body)) > 0),
 chapter text not null default '',
 marked_at text,
 source text not null default 'manual' check (source in ('tolino','yomu','manual')),
 source_url text,
 location text,
 fingerprint text not null,
 created_at timestamptz not null default now(),
 constraint book_quotes_uniq unique (user_id,book_id,fingerprint)
);
create index if not exists book_quotes_book_user on public.book_quotes(book_id,user_id);
alter table public.book_quotes enable row level security;
revoke all on public.book_quotes from anon;
grant select,insert,update,delete on public.book_quotes to authenticated;
drop policy if exists book_quotes_select_own on public.book_quotes;
drop policy if exists book_quotes_insert_own on public.book_quotes;
drop policy if exists book_quotes_update_own on public.book_quotes;
drop policy if exists book_quotes_delete_own on public.book_quotes;
create policy book_quotes_select_own on public.book_quotes for select to authenticated
  using ((select auth.uid())=user_id and exists (select 1 from public.books b where b.id=book_id and b.user_id=(select auth.uid())));
create policy book_quotes_insert_own on public.book_quotes for insert to authenticated
  with check ((select auth.uid())=user_id and exists (select 1 from public.books b where b.id=book_id and b.user_id=(select auth.uid())));
create policy book_quotes_update_own on public.book_quotes for update to authenticated
  using ((select auth.uid())=user_id and exists (select 1 from public.books b where b.id=book_id and b.user_id=(select auth.uid())))
  with check ((select auth.uid())=user_id and exists (select 1 from public.books b where b.id=book_id and b.user_id=(select auth.uid())));
create policy book_quotes_delete_own on public.book_quotes for delete to authenticated
  using ((select auth.uid())=user_id and exists (select 1 from public.books b where b.id=book_id and b.user_id=(select auth.uid())));
