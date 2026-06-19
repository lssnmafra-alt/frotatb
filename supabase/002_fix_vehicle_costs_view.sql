-- Correção da view de custos por veículo.
-- Rode este arquivo depois do schema.sql se quiser usar a view de relatório no Supabase.

create or replace view public.fleet_vehicle_costs as
with fuel as (
  select vehicle_id, coalesce(sum(total_cost), 0)::numeric(12,2) as fuel_cost
  from public.fleet_fuel_logs
  group by vehicle_id
),
maintenance as (
  select vehicle_id, coalesce(sum(cost), 0)::numeric(12,2) as maintenance_cost
  from public.fleet_maintenance
  group by vehicle_id
)
select
  v.id as vehicle_id,
  v.plate,
  v.make,
  v.model,
  v.status,
  v.current_km,
  coalesce(f.fuel_cost, 0)::numeric(12,2) as fuel_cost,
  coalesce(m.maintenance_cost, 0)::numeric(12,2) as maintenance_cost,
  (coalesce(f.fuel_cost, 0) + coalesce(m.maintenance_cost, 0))::numeric(12,2) as total_cost
from public.fleet_vehicles v
left join fuel f on f.vehicle_id = v.id
left join maintenance m on m.vehicle_id = v.id;

grant select on public.fleet_vehicle_costs to anon, authenticated;
