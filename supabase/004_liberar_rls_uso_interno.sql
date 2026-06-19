-- FrotaTB - Migration 004
-- Corrige erro: new row violates row-level security policy for table "fleet_branches"
--
-- Uso interno / Supabase cru:
-- Desativa RLS nas tabelas do controle de frota e garante permissões para anon/authenticated.
-- Rode este arquivo no Supabase SQL Editor.
--
-- ATENÇÃO: isso é adequado para uso interno simples.
-- Se o sistema ficar público ou tiver dados sensíveis, use autenticação + políticas RLS específicas.

alter table if exists public.fleet_branches disable row level security;
alter table if exists public.fleet_owners disable row level security;
alter table if exists public.fleet_drivers disable row level security;
alter table if exists public.fleet_vehicles disable row level security;
alter table if exists public.fleet_odometer_logs disable row level security;
alter table if exists public.fleet_maintenance disable row level security;
alter table if exists public.fleet_vehicle_documents disable row level security;
alter table if exists public.fleet_incidents disable row level security;
alter table if exists public.fleet_fuel_logs disable row level security;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.fleet_branches to anon, authenticated;
grant select, insert, update, delete on public.fleet_owners to anon, authenticated;
grant select, insert, update, delete on public.fleet_drivers to anon, authenticated;
grant select, insert, update, delete on public.fleet_vehicles to anon, authenticated;
grant select, insert, update, delete on public.fleet_odometer_logs to anon, authenticated;
grant select, insert, update, delete on public.fleet_maintenance to anon, authenticated;
grant select, insert, update, delete on public.fleet_vehicle_documents to anon, authenticated;
grant select, insert, update, delete on public.fleet_incidents to anon, authenticated;
grant select, insert, update, delete on public.fleet_fuel_logs to anon, authenticated;

grant select on public.fleet_vehicle_costs to anon, authenticated;
