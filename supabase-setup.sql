-- oji builder — Supabase setup
-- شغّل ده مرة واحدة في: Supabase Dashboard → SQL Editor → New query → Run

-- جدول المشاريع (مشروع لكل عميل)
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'مشروع بدون اسم',
  html        text not null default '',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

-- تفعيل أمان الصفوف: كل عميل يرى/يعدّل مشاريعه فقط (يمنع تسريب البيانات)
alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);
