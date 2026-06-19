-- FrotaTB - Migration 003
-- Adiciona filiais e vincula veículos/condutores às filiais.
-- Rode no Supabase SQL Editor depois do schema.sql e do 002_fix_vehicle_costs_view.sql.

create table if not exists public.fleet_branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  city text,
  state text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.fleet_branches (name, code, city, state)
values ('Matriz', 'MATRIZ', null, null)
on conflict (name) do nothing;

alter table public.fleet_vehicles
add column if not exists branch_id uuid references public.fleet_branches(id) on delete set null;

alter table public.fleet_drivers
add column if not exists branch_id uuid references public.fleet_branches(id) on delete set null;

update public.fleet_vehicles
set branch_id = (select id from public.fleet_branches where name = 'Matriz' limit 1)
where branch_id is null;

update public.fleet_drivers
set branch_id = (select id from public.fleet_branches where name = 'Matriz' limit 1)
where branch_id is null;

create index if not exists idx_fleet_branches_name on public.fleet_branches(name);
create index if not exists idx_fleet_vehicles_branch_id on public.fleet_vehicles(branch_id);
create index if not exists idx_fleet_drivers_branch_id on public.fleet_drivers(branch_id);

drop trigger if exists trg_fleet_branches_updated_at on public.fleet_branches;
create trigger trg_fleet_branches_updated_at
before update on public.fleet_branches
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.fleet_branches to anon, authenticated;
