import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

type OwnerKind = 'Pessoa física' | 'Empresa' | 'Locadora';
type VehicleStatus = 'Ativo' | 'Em manutenção' | 'Parado' | 'Vendido';
type DriverStatus = 'Ativo' | 'Afastado' | 'Inativo';
type MaintenanceStatus = 'Aberta' | 'Concluída' | 'Cancelada';
type Tab = 'painel' | 'veiculos' | 'condutores' | 'km' | 'abastecimento' | 'manutencao' | 'donos';

type FleetOwner = {
  id: string;
  name: string;
  kind: OwnerKind;
  document: string | null;
  phone: string | null;
  notes: string | null;
};

type Vehicle = {
  id: string;
  owner_id: string | null;
  plate: string;
  renavam: string | null;
  ownership_type: string;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  category: string | null;
  fuel_type: string | null;
  current_km: number;
  next_service_km: number | null;
  status: VehicleStatus;
  notes: string | null;
};

type Driver = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnh_number: string | null;
  cnh_category: string | null;
  cnh_expiration: string | null;
  status: DriverStatus;
  notes: string | null;
};

type OdometerLog = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  log_date: string;
  km: number;
  origin: string | null;
  notes: string | null;
};

type FuelLog = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  fuel_date: string;
  km: number;
  liters: number;
  price_per_liter: number;
  total_cost: number;
  station: string | null;
};

type Maintenance = {
  id: string;
  vehicle_id: string;
  maintenance_date: string;
  finished_at: string | null;
  km: number | null;
  status: MaintenanceStatus;
  service_type: string;
  description: string;
  provider: string | null;
  cost: number;
  next_service_km: number | null;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = hasSupabaseConfig ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!) : null;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function km(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('pt-BR')} km`;
}

function field(form: FormData, name: string) {
  const value = String(form.get(name) ?? '').trim();
  return value.length > 0 ? value : null;
}

function num(form: FormData, name: string) {
  const raw = String(form.get(name) ?? '').replace(',', '.');
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function nullableNum(form: FormData, name: string) {
  const value = field(form, name);
  if (!value) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function statusClass(status: string) {
  if (['Ativo', 'Concluída'].includes(status)) return 'ok';
  if (['Em manutenção', 'Aberta', 'Afastado'].includes(status)) return 'warn';
  return 'bad';
}

function firstError(results: Array<{ error: { message: string } | null }>) {
  return results.find((result) => result.error)?.error?.message ?? null;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('painel');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [owners, setOwners] = useState<FleetOwner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

  const ownerMap = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const driverMap = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const activeVehicles = vehicles.filter((vehicle) => vehicle.status === 'Ativo').length;
  const maintenanceVehicles = vehicles.filter((vehicle) => vehicle.status === 'Em manutenção').length;
  const totalFuel = fuelLogs.reduce((total, log) => total + Number(log.total_cost ?? 0), 0);
  const totalMaintenance = maintenances.reduce((total, item) => total + Number(item.cost ?? 0), 0);
  const totalCost = totalFuel + totalMaintenance;

  const revisionAlerts = useMemo(
    () =>
      vehicles
        .filter((vehicle) => vehicle.next_service_km !== null)
        .map((vehicle) => ({
          vehicle,
          remaining: Number(vehicle.next_service_km) - Number(vehicle.current_km),
        }))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 6),
    [vehicles],
  );

  const latestMovements = useMemo(() => {
    const kms = odometerLogs.map((log) => ({
      id: log.id,
      date: log.log_date,
      type: 'KM',
      vehicle: vehicleMap.get(log.vehicle_id)?.plate ?? 'Veículo removido',
      description: `${km(log.km)} · ${log.origin || 'Atualização de odômetro'}`,
      amount: null as number | null,
    }));

    const fuels = fuelLogs.map((log) => ({
      id: log.id,
      date: log.fuel_date,
      type: 'Abastecimento',
      vehicle: vehicleMap.get(log.vehicle_id)?.plate ?? 'Veículo removido',
      description: `${log.liters.toLocaleString('pt-BR')} L · ${log.station || 'Posto não informado'}`,
      amount: Number(log.total_cost ?? 0),
    }));

    const services = maintenances.map((item) => ({
      id: item.id,
      date: item.maintenance_date,
      type: 'Manutenção',
      vehicle: vehicleMap.get(item.vehicle_id)?.plate ?? 'Veículo removido',
      description: item.description,
      amount: Number(item.cost ?? 0),
    }));

    return [...kms, ...fuels, ...services]
      .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
      .slice(0, 10);
  }, [fuelLogs, maintenances, odometerLogs, vehicleMap]);

  async function loadData() {
    if (!supabase) return;
    setLoading(true);
    setMessage('');

    const results = await Promise.all([
      supabase.from('fleet_owners').select('*').order('name'),
      supabase.from('fleet_vehicles').select('*').order('plate'),
      supabase.from('fleet_drivers').select('*').order('name'),
      supabase.from('fleet_odometer_logs').select('*').order('log_date', { ascending: false }).limit(80),
      supabase.from('fleet_fuel_logs').select('*').order('fuel_date', { ascending: false }).limit(80),
      supabase.from('fleet_maintenance').select('*').order('maintenance_date', { ascending: false }).limit(80),
    ]);

    const error = firstError(results);
    if (error) {
      setMessage(`Erro ao carregar dados: ${error}`);
    } else {
      setOwners((results[0].data ?? []) as FleetOwner[]);
      setVehicles((results[1].data ?? []) as Vehicle[]);
      setDrivers((results[2].data ?? []) as Driver[]);
      setOdometerLogs((results[3].data ?? []) as OdometerLog[]);
      setFuelLogs((results[4].data ?? []) as FuelLog[]);
      setMaintenances((results[5].data ?? []) as Maintenance[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>, action: (form: FormData) => Promise<void>) {
    event.preventDefault();
    if (!supabase) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setMessage('');

    try {
      await action(form);
      formElement.reset();
      await loadData();
      setMessage('Salvo com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro inesperado ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function insert(table: string, payload: Record<string, unknown>) {
    if (!supabase) return;
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw new Error(error.message);
  }

  async function remove(table: string, id: string) {
    if (!supabase) return;
    const confirmed = window.confirm('Remover este registro?');
    if (!confirmed) return;
    setSaving(true);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) setMessage(error.message);
    await loadData();
    setSaving(false);
  }

  if (!hasSupabaseConfig) {
    return (
      <main className="app-shell narrow">
        <section className="setup-card">
          <p className="eyebrow">Configuração necessária</p>
          <h1>Conecte o Supabase para usar o controle de frota.</h1>
          <p>
            Crie um projeto no Supabase, rode o arquivo <strong>supabase/schema.sql</strong> no SQL Editor e cadastre estas variáveis na Vercel:
          </p>
          <pre>{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co\nVITE_SUPABASE_ANON_KEY=sua-chave-anon`}</pre>
          <p>Depois faça novo deploy.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Controle interno</p>
          <h1>FrotaTB</h1>
          <p>Controle simples de veículos, condutores, KM, manutenção, donos e locadoras.</p>
        </div>
        <button className="secondary" onClick={loadData} disabled={loading || saving}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </header>

      {message && <div className="notice">{message}</div>}

      <nav className="tabs">
        <button className={tab === 'painel' ? 'active' : ''} onClick={() => setTab('painel')}>Painel</button>
        <button className={tab === 'veiculos' ? 'active' : ''} onClick={() => setTab('veiculos')}>Veículos</button>
        <button className={tab === 'condutores' ? 'active' : ''} onClick={() => setTab('condutores')}>Condutores</button>
        <button className={tab === 'km' ? 'active' : ''} onClick={() => setTab('km')}>Atualizar KM</button>
        <button className={tab === 'abastecimento' ? 'active' : ''} onClick={() => setTab('abastecimento')}>Abastecimento</button>
        <button className={tab === 'manutencao' ? 'active' : ''} onClick={() => setTab('manutencao')}>Manutenção</button>
        <button className={tab === 'donos' ? 'active' : ''} onClick={() => setTab('donos')}>Donos/Locadoras</button>
      </nav>

      {tab === 'painel' && (
        <section className="page-grid">
          <div className="metric"><span>Veículos</span><strong>{vehicles.length}</strong><small>{activeVehicles} ativos · {maintenanceVehicles} em manutenção</small></div>
          <div className="metric"><span>Condutores</span><strong>{drivers.length}</strong><small>{drivers.filter((driver) => driver.status === 'Ativo').length} ativos</small></div>
          <div className="metric"><span>Combustível</span><strong>{money(totalFuel)}</strong><small>{fuelLogs.length} registros</small></div>
          <div className="metric"><span>Manutenção</span><strong>{money(totalMaintenance)}</strong><small>Total geral: {money(totalCost)}</small></div>

          <section className="card wide">
            <div className="section-title"><h2>Próximas revisões</h2><span>por quilometragem</span></div>
            {revisionAlerts.length === 0 ? <Empty text="Nenhum alerta de revisão." /> : (
              <div className="compact-list">
                {revisionAlerts.map(({ vehicle, remaining }) => (
                  <article key={vehicle.id} className={remaining <= 0 ? 'danger-row' : remaining <= 1000 ? 'warning-row' : ''}>
                    <strong>{vehicle.plate}</strong>
                    <span>{vehicle.make} {vehicle.model}</span>
                    <small>{remaining <= 0 ? `Passou ${km(Math.abs(remaining))}` : `Faltam ${km(remaining)}`}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card wide">
            <div className="section-title"><h2>Últimos lançamentos</h2><span>KM, abastecimento e manutenção</span></div>
            {latestMovements.length === 0 ? <Empty text="Nenhum lançamento ainda." /> : (
              <div className="table movements">
                <div className="table-head"><span>Tipo</span><span>Veículo</span><span>Descrição</span><span>Valor</span></div>
                {latestMovements.map((item) => (
                  <div className="table-row" key={`${item.type}-${item.id}`}>
                    <span>{item.type}</span>
                    <strong>{item.vehicle}</strong>
                    <span>{item.description}</span>
                    <span>{item.amount === null ? '-' : money(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {tab === 'veiculos' && (
        <section className="page-grid">
          <section className="card form-card">
            <div className="section-title"><h2>Novo veículo</h2><span>ano, modelo, dono e status</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_vehicles', {
              owner_id: field(form, 'owner_id'),
              plate: String(field(form, 'plate') ?? '').toUpperCase(),
              renavam: field(form, 'renavam'),
              ownership_type: field(form, 'ownership_type') ?? 'Próprio',
              make: field(form, 'make') ?? '',
              model: field(form, 'model') ?? '',
              year: nullableNum(form, 'year'),
              color: field(form, 'color'),
              category: field(form, 'category'),
              fuel_type: field(form, 'fuel_type'),
              current_km: num(form, 'current_km'),
              next_service_km: nullableNum(form, 'next_service_km'),
              status: field(form, 'status') ?? 'Ativo',
              notes: field(form, 'notes'),
            }))}>
              <VehicleSelectOwners owners={owners} />
              <label>Placa<input name="plate" required placeholder="ABC-1D23" /></label>
              <label>Marca<input name="make" required placeholder="Fiat, VW, Toyota..." /></label>
              <label>Modelo<input name="model" required placeholder="Strada, Hilux..." /></label>
              <label>Ano<input name="year" type="number" min="1970" max="2100" /></label>
              <label>KM atual<input name="current_km" type="number" min="0" required /></label>
              <label>Próxima revisão em KM<input name="next_service_km" type="number" min="0" /></label>
              <label>Status<select name="status" defaultValue="Ativo"><option>Ativo</option><option>Em manutenção</option><option>Parado</option><option>Vendido</option></select></label>
              <label>Tipo<select name="ownership_type" defaultValue="Próprio"><option>Próprio</option><option>Locado</option><option>Terceiro</option></select></label>
              <label>RENAVAM<input name="renavam" /></label>
              <label>Cor<input name="color" /></label>
              <label>Categoria<input name="category" placeholder="Carro, moto, caminhão..." /></label>
              <label>Combustível<input name="fuel_type" placeholder="Flex, Diesel, Gasolina..." /></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving}>Salvar veículo</button>
            </form>
          </section>

          <section className="card list-card">
            <div className="section-title"><h2>Veículos cadastrados</h2><span>{vehicles.length} registros</span></div>
            {vehicles.length === 0 ? <Empty text="Nenhum veículo cadastrado." /> : vehicles.map((vehicle) => (
              <article className="record" key={vehicle.id}>
                <div><strong>{vehicle.plate}</strong><span>{vehicle.make} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ''}</span></div>
                <b className={`badge ${statusClass(vehicle.status)}`}>{vehicle.status}</b>
                <small>Dono/locadora: {vehicle.owner_id ? ownerMap.get(vehicle.owner_id)?.name ?? 'Não encontrado' : 'Não informado'}</small>
                <small>Tipo: {vehicle.ownership_type} · KM: {km(vehicle.current_km)} · Revisão: {vehicle.next_service_km ? km(vehicle.next_service_km) : 'Não definida'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_vehicles', vehicle.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'condutores' && (
        <section className="page-grid">
          <section className="card form-card">
            <div className="section-title"><h2>Novo condutor</h2><span>CNH e contato</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_drivers', {
              name: field(form, 'name') ?? '',
              phone: field(form, 'phone'),
              email: field(form, 'email'),
              cnh_number: field(form, 'cnh_number'),
              cnh_category: field(form, 'cnh_category'),
              cnh_expiration: field(form, 'cnh_expiration'),
              status: field(form, 'status') ?? 'Ativo',
              notes: field(form, 'notes'),
            }))}>
              <label>Nome<input name="name" required /></label>
              <label>Telefone<input name="phone" /></label>
              <label>E-mail<input name="email" type="email" /></label>
              <label>CNH<input name="cnh_number" /></label>
              <label>Categoria CNH<input name="cnh_category" placeholder="A, B, C, D, E" /></label>
              <label>Vencimento CNH<input name="cnh_expiration" type="date" /></label>
              <label>Status<select name="status" defaultValue="Ativo"><option>Ativo</option><option>Afastado</option><option>Inativo</option></select></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving}>Salvar condutor</button>
            </form>
          </section>

          <section className="card list-card">
            <div className="section-title"><h2>Condutores</h2><span>{drivers.length} registros</span></div>
            {drivers.length === 0 ? <Empty text="Nenhum condutor cadastrado." /> : drivers.map((driver) => (
              <article className="record" key={driver.id}>
                <div><strong>{driver.name}</strong><span>{driver.phone || 'Sem telefone'} {driver.email ? `· ${driver.email}` : ''}</span></div>
                <b className={`badge ${statusClass(driver.status)}`}>{driver.status}</b>
                <small>CNH: {driver.cnh_number || '-'} · Categoria: {driver.cnh_category || '-'} · Vence: {driver.cnh_expiration || '-'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_drivers', driver.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'km' && (
        <section className="page-grid one">
          <section className="card form-card">
            <div className="section-title"><h2>Atualizar quilometragem</h2><span>lançamento simples de odômetro</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_odometer_logs', {
              vehicle_id: field(form, 'vehicle_id'),
              driver_id: field(form, 'driver_id'),
              log_date: field(form, 'log_date') ?? todayISO(),
              km: num(form, 'km'),
              origin: field(form, 'origin'),
              notes: field(form, 'notes'),
            }))}>
              <VehicleSelect vehicles={vehicles} />
              <DriverSelect drivers={drivers} />
              <label>Data<input name="log_date" type="date" defaultValue={todayISO()} required /></label>
              <label>KM atual<input name="km" type="number" min="0" required /></label>
              <label>Origem<input name="origin" placeholder="Retorno de rota, conferência..." /></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving || vehicles.length === 0}>Salvar KM</button>
            </form>
          </section>
        </section>
      )}

      {tab === 'abastecimento' && (
        <section className="page-grid one">
          <section className="card form-card">
            <div className="section-title"><h2>Novo abastecimento</h2><span>litros, preço e KM</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_fuel_logs', {
              vehicle_id: field(form, 'vehicle_id'),
              driver_id: field(form, 'driver_id'),
              fuel_date: field(form, 'fuel_date') ?? todayISO(),
              km: num(form, 'km'),
              liters: num(form, 'liters'),
              price_per_liter: num(form, 'price_per_liter'),
              station: field(form, 'station'),
              notes: field(form, 'notes'),
            }))}>
              <VehicleSelect vehicles={vehicles} />
              <DriverSelect drivers={drivers} />
              <label>Data<input name="fuel_date" type="date" defaultValue={todayISO()} required /></label>
              <label>KM<input name="km" type="number" min="0" required /></label>
              <label>Litros<input name="liters" type="number" min="0" step="0.001" required /></label>
              <label>Preço por litro<input name="price_per_liter" type="number" min="0" step="0.01" required /></label>
              <label>Posto<input name="station" /></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving || vehicles.length === 0}>Salvar abastecimento</button>
            </form>
          </section>
        </section>
      )}

      {tab === 'manutencao' && (
        <section className="page-grid one">
          <section className="card form-card">
            <div className="section-title"><h2>Registrar manutenção</h2><span>status, custo e próxima revisão</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_maintenance', {
              vehicle_id: field(form, 'vehicle_id'),
              maintenance_date: field(form, 'maintenance_date') ?? todayISO(),
              finished_at: field(form, 'finished_at'),
              km: nullableNum(form, 'km'),
              status: field(form, 'status') ?? 'Aberta',
              service_type: field(form, 'service_type') ?? 'Preventiva',
              description: field(form, 'description') ?? '',
              provider: field(form, 'provider'),
              cost: num(form, 'cost'),
              next_service_km: nullableNum(form, 'next_service_km'),
            }))}>
              <VehicleSelect vehicles={vehicles} />
              <label>Data<input name="maintenance_date" type="date" defaultValue={todayISO()} required /></label>
              <label>Finalizada em<input name="finished_at" type="date" /></label>
              <label>KM<input name="km" type="number" min="0" /></label>
              <label>Status<select name="status" defaultValue="Aberta"><option>Aberta</option><option>Concluída</option><option>Cancelada</option></select></label>
              <label>Tipo<input name="service_type" defaultValue="Preventiva" /></label>
              <label>Custo<input name="cost" type="number" min="0" step="0.01" /></label>
              <label>Próxima revisão em KM<input name="next_service_km" type="number" min="0" /></label>
              <label>Oficina/fornecedor<input name="provider" /></label>
              <label className="full">Serviço/descrição<textarea name="description" required /></label>
              <button disabled={saving || vehicles.length === 0}>Salvar manutenção</button>
            </form>
          </section>
        </section>
      )}

      {tab === 'donos' && (
        <section className="page-grid">
          <section className="card form-card">
            <div className="section-title"><h2>Dono ou locadora</h2><span>quem responde pelo veículo</span></div>
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_owners', {
              name: field(form, 'name') ?? '',
              kind: field(form, 'kind') ?? 'Pessoa física',
              document: field(form, 'document'),
              phone: field(form, 'phone'),
              notes: field(form, 'notes'),
            }))}>
              <label>Nome<input name="name" required /></label>
              <label>Tipo<select name="kind" defaultValue="Pessoa física"><option>Pessoa física</option><option>Empresa</option><option>Locadora</option></select></label>
              <label>CPF/CNPJ<input name="document" /></label>
              <label>Telefone<input name="phone" /></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving}>Salvar dono/locadora</button>
            </form>
          </section>

          <section className="card list-card">
            <div className="section-title"><h2>Donos e locadoras</h2><span>{owners.length} registros</span></div>
            {owners.length === 0 ? <Empty text="Nenhum dono/locadora cadastrado." /> : owners.map((owner) => (
              <article className="record" key={owner.id}>
                <div><strong>{owner.name}</strong><span>{owner.kind} · {owner.phone || 'Sem telefone'}</span></div>
                <small>Documento: {owner.document || '-'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_owners', owner.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}
    </main>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function VehicleSelect({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <label>
      Veículo
      <select name="vehicle_id" required>
        {vehicles.map((vehicle) => (
          <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model} · {km(vehicle.current_km)}</option>
        ))}
      </select>
    </label>
  );
}

function DriverSelect({ drivers }: { drivers: Driver[] }) {
  return (
    <label>
      Condutor
      <select name="driver_id" defaultValue="">
        <option value="">Não informado</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>{driver.name}</option>
        ))}
      </select>
    </label>
  );
}

function VehicleSelectOwners({ owners }: { owners: FleetOwner[] }) {
  return (
    <label>
      Dono/locadora
      <select name="owner_id" defaultValue="">
        <option value="">Não informado</option>
        {owners.map((owner) => (
          <option key={owner.id} value={owner.id}>{owner.name} · {owner.kind}</option>
        ))}
      </select>
    </label>
  );
}
