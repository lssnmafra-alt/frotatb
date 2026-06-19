-- FrotaTB - SQL completo para Supabase cru
-- Como usar:
-- 1. Abra o Supabase > SQL Editor.
-- 2. Cole este arquivo inteiro.
-- 3. Execute.
-- 4. Na Vercel, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
--
-- Observação de segurança:
-- Este schema é simples para controle INTERNO sem login.
-- Ele deixa as tabelas acessíveis pela anon key do Supabase.
-- Se o sistema for exposto publicamente, adicione autenticação e RLS antes de usar dados sensíveis.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.fleet_owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'Pessoa física' check (kind in ('Pessoa física', 'Empresa', 'Locadora')),
  document text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_drivers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  cnh_number text,
  cnh_category text,
  cnh_expiration date,
  status text not null default 'Ativo' check (status in ('Ativo', 'Afastado', 'Inativo')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.fleet_owners(id) on delete set null,
  plate text not null unique,
  renavam text,
  ownership_type text not null default 'Próprio' check (ownership_type in ('Próprio', 'Locado', 'Terceiro')),
  make text not null,
  model text not null,
  year integer check (year is null or year between 1970 and 2100),
  color text,
  category text,
  fuel_type text,
  current_km integer not null default 0 check (current_km >= 0),
  next_service_km integer check (next_service_km is null or next_service_km >= 0),
  status text not null default 'Ativo' check (status in ('Ativo', 'Em manutenção', 'Parado', 'Vendido')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_odometer_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  driver_id uuid references public.fleet_drivers(id) on delete set null,
  log_date date not null default current_date,
  km integer not null check (km >= 0),
  origin text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  driver_id uuid references public.fleet_drivers(id) on delete set null,
  fuel_date date not null default current_date,
  km integer not null check (km >= 0),
  liters numeric(10,3) not null check (liters > 0),
  price_per_liter numeric(10,2) not null check (price_per_liter >= 0),
  total_cost numeric(12,2) generated always as (round(liters * price_per_liter, 2)) stored,
  station text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_maintenance (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  maintenance_date date not null default current_date,
  finished_at date,
  km integer check (km is null or km >= 0),
  status text not null default 'Aberta' check (status in ('Aberta', 'Concluída', 'Cancelada')),
  service_type text not null default 'Preventiva',
  description text not null,
  provider text,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  next_service_km integer check (next_service_km is null or next_service_km >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  document_type text not null,
  identifier text,
  due_date date,
  file_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_incidents (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles(id) on delete cascade,
  driver_id uuid references public.fleet_drivers(id) on delete set null,
  incident_date date not null default current_date,
  incident_type text not null default 'Ocorrência',
  description text not null,
  cost numeric(12,2) not null default 0 check (cost >= 0),
  status text not null default 'Aberta' check (status in ('Aberta', 'Resolvida', 'Cancelada')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fleet_vehicles_owner_id on public.fleet_vehicles(owner_id);
create index if not exists idx_fleet_vehicles_plate on public.fleet_vehicles(plate);
create index if not exists idx_fleet_vehicles_status on public.fleet_vehicles(status);
create index if not exists idx_fleet_odometer_vehicle_date on public.fleet_odometer_logs(vehicle_id, log_date desc);
create index if not exists idx_fleet_fuel_vehicle_date on public.fleet_fuel_logs(vehicle_id, fuel_date desc);
create index if not exists idx_fleet_maintenance_vehicle_date on public.fleet_maintenance(vehicle_id, maintenance_date desc);
create index if not exists idx_fleet_documents_due_date on public.fleet_vehicle_documents(due_date);

create or replace function public.fleet_update_vehicle_km()
returns trigger
language plpgsql
as $$
begin
  update public.fleet_vehicles
     set current_km = greatest(current_km, new.km),
         updated_at = now()
   where id = new.vehicle_id;

  return new;
end;
$$;

create or replace function public.fleet_update_vehicle_from_maintenance()
returns trigger
language plpgsql
as $$
begin
  update public.fleet_vehicles
     set current_km = case
           when new.km is null then current_km
           else greatest(current_km, new.km)
         end,
         next_service_km = coalesce(new.next_service_km, next_service_km),
         status = case
           when new.status = 'Aberta' then 'Em manutenção'
           when new.status in ('Concluída', 'Cancelada') and not exists (
             select 1
               from public.fleet_maintenance m
              where m.vehicle_id = new.vehicle_id
                and m.status = 'Aberta'
                and m.id <> new.id
           ) then 'Ativo'
           else status
         end,
         updated_at = now()
   where id = new.vehicle_id;

  return new;
end;
$$;

drop trigger if exists trg_fleet_owners_updated_at on public.fleet_owners;
create trigger trg_fleet_owners_updated_at
before update on public.fleet_owners
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_drivers_updated_at on public.fleet_drivers;
create trigger trg_fleet_drivers_updated_at
before update on public.fleet_drivers
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_vehicles_updated_at on public.fleet_vehicles;
create trigger trg_fleet_vehicles_updated_at
before update on public.fleet_vehicles
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_odometer_updated_at on public.fleet_odometer_logs;
create trigger trg_fleet_odometer_updated_at
before update on public.fleet_odometer_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_fuel_updated_at on public.fleet_fuel_logs;
create trigger trg_fleet_fuel_updated_at
before update on public.fleet_fuel_logs
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_maintenance_updated_at on public.fleet_maintenance;
create trigger trg_fleet_maintenance_updated_at
before update on public.fleet_maintenance
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_documents_updated_at on public.fleet_vehicle_documents;
create trigger trg_fleet_documents_updated_at
before update on public.fleet_vehicle_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_incidents_updated_at on public.fleet_incidents;
create trigger trg_fleet_incidents_updated_at
before update on public.fleet_incidents
for each row execute function public.set_updated_at();

drop trigger if exists trg_fleet_odometer_update_vehicle_km on public.fleet_odometer_logs;
create trigger trg_fleet_odometer_update_vehicle_km
after insert or update of km, vehicle_id on public.fleet_odometer_logs
for each row execute function public.fleet_update_vehicle_km();

drop trigger if exists trg_fleet_fuel_update_vehicle_km on public.fleet_fuel_logs;
create trigger trg_fleet_fuel_update_vehicle_km
after insert or update of km, vehicle_id on public.fleet_fuel_logs
for each row execute function public.fleet_update_vehicle_km();

drop trigger if exists trg_fleet_maintenance_update_vehicle on public.fleet_maintenance;
create trigger trg_fleet_maintenance_update_vehicle
after insert or update of km, next_service_km, status, vehicle_id on public.fleet_maintenance
for each row execute function public.fleet_update_vehicle_from_maintenance();

-- Permissões simples para uso interno pelo frontend com anon key.
-- Para uso com login/RLS no futuro, substitua por políticas de segurança.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fleet_owners to anon, authenticated;
grant select, insert, update, delete on public.fleet_drivers to anon, authenticated;
grant select, insert, update, delete on public.fleet_vehicles to anon, authenticated;
grant select, insert, update, delete on public.fleet_odometer_logs to anon, authenticated;
grant select, insert, update, delete on public.fleet_fuel_logs to anon, authenticated;
grant select, insert, update, delete on public.fleet_maintenance to anon, authenticated;
grant select, insert, update, delete on public.fleet_vehicle_documents to anon, authenticated;
grant select, insert, update, delete on public.fleet_incidents to anon, authenticated;

-- Views úteis para relatórios no Supabase.
create or replace view public.fleet_vehicle_costs as
select
  v.id as vehicle_id,
  v.plate,
  v.make,
  v.model,
  v.status,
  v.current_km,
  coalesce(sum(f.total_cost), 0)::numeric(12,2) as fuel_cost,
  coalesce(sum(distinct m.cost), 0)::numeric(12,2) as maintenance_cost
from public.fleet_vehicles v
left join public.fleet_fuel_logs f on f.vehicle_id = v.id
left join public.fleet_maintenance m on m.vehicle_id = v.id
group by v.id, v.plate, v.make, v.model, v.status, v.current_km;

grant select on public.fleet_vehicle_costs to anon, authenticated;
