import { createClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import * as XLSX from 'xlsx';

type Theme = 'light' | 'dark';
type OwnerKind = 'Pessoa física' | 'Empresa' | 'Locadora';
type VehicleStatus = 'Ativo' | 'Em manutenção' | 'Parado' | 'Vendido';
type DriverStatus = 'Ativo' | 'Afastado' | 'Inativo';
type MaintenanceStatus = 'Aberta' | 'Concluída' | 'Cancelada';
type Tab = 'painel' | 'veiculos' | 'condutores' | 'km' | 'manutencao' | 'donos' | 'filiais';

type Branch = {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
};

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
  branch_id: string | null;
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
  branch_id: string | null;
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

type ChartPoint = {
  label: string;
  value: number;
  detail?: string;
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

function dateBR(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');
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

function normalizeText(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return `${month}/${year.slice(2)}`;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('painel');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('frotatb:theme') as Theme) || 'light');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [owners, setOwners] = useState<FleetOwner[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);

  useEffect(() => {
    localStorage.setItem('frotatb:theme', theme);
  }, [theme]);

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);
  const ownerMap = useMemo(() => new Map(owners.map((owner) => [owner.id, owner])), [owners]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const driverMap = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const searchTerm = normalizeText(search);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const sameBranch = selectedBranch === 'all' || vehicle.branch_id === selectedBranch;
      const sameStatus = statusFilter === 'all' || vehicle.status === statusFilter;
      const text = normalizeText(`${vehicle.plate} ${vehicle.make} ${vehicle.model} ${vehicle.year ?? ''} ${vehicle.category ?? ''}`);
      const sameSearch = !searchTerm || text.includes(searchTerm);
      return sameBranch && sameStatus && sameSearch;
    });
  }, [vehicles, selectedBranch, statusFilter, searchTerm]);

  const filteredVehicleIds = useMemo(() => new Set(filteredVehicles.map((vehicle) => vehicle.id)), [filteredVehicles]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => {
      const sameBranch = selectedBranch === 'all' || driver.branch_id === selectedBranch;
      const text = normalizeText(`${driver.name} ${driver.phone ?? ''} ${driver.email ?? ''} ${driver.cnh_category ?? ''}`);
      return sameBranch && (!searchTerm || text.includes(searchTerm));
    });
  }, [drivers, selectedBranch, searchTerm]);

  const filteredOdometerLogs = useMemo(
    () => odometerLogs.filter((log) => filteredVehicleIds.has(log.vehicle_id)),
    [odometerLogs, filteredVehicleIds],
  );

  const filteredMaintenances = useMemo(
    () => maintenances.filter((item) => filteredVehicleIds.has(item.vehicle_id)),
    [maintenances, filteredVehicleIds],
  );

  const activeVehicles = filteredVehicles.filter((vehicle) => vehicle.status === 'Ativo').length;
  const maintenanceVehicles = filteredVehicles.filter((vehicle) => vehicle.status === 'Em manutenção').length;
  const stoppedVehicles = filteredVehicles.filter((vehicle) => vehicle.status === 'Parado').length;
  const totalMaintenance = filteredMaintenances.reduce((total, item) => total + Number(item.cost ?? 0), 0);
  const averageKm = filteredVehicles.length ? Math.round(filteredVehicles.reduce((total, vehicle) => total + vehicle.current_km, 0) / filteredVehicles.length) : 0;

  const revisionAlerts = useMemo(
    () =>
      filteredVehicles
        .filter((vehicle) => vehicle.next_service_km !== null)
        .map((vehicle) => ({
          vehicle,
          remaining: Number(vehicle.next_service_km) - Number(vehicle.current_km),
        }))
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, 7),
    [filteredVehicles],
  );

  const statusChart = useMemo<ChartPoint[]>(() => {
    const count = (status: VehicleStatus) => filteredVehicles.filter((vehicle) => vehicle.status === status).length;
    return [
      { label: 'Ativo', value: count('Ativo') },
      { label: 'Manutenção', value: count('Em manutenção') },
      { label: 'Parado', value: count('Parado') },
      { label: 'Vendido', value: count('Vendido') },
    ].filter((item) => item.value > 0);
  }, [filteredVehicles]);

  const branchChart = useMemo<ChartPoint[]>(() => {
    const source = selectedBranch === 'all' ? vehicles : filteredVehicles;
    return branches
      .map((branch) => ({
        label: branch.name,
        value: source.filter((vehicle) => vehicle.branch_id === branch.id).length,
        detail: `${branch.city ?? ''}${branch.state ? `/${branch.state}` : ''}`,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [branches, filteredVehicles, selectedBranch, vehicles]);

  const kmChart = useMemo<ChartPoint[]>(() => {
    return [...filteredVehicles]
      .sort((a, b) => b.current_km - a.current_km)
      .slice(0, 8)
      .map((vehicle) => ({ label: vehicle.plate, value: vehicle.current_km, detail: `${vehicle.make} ${vehicle.model}` }));
  }, [filteredVehicles]);

  const maintenanceChart = useMemo<ChartPoint[]>(() => {
    const values = new Map<string, number>();
    filteredMaintenances.forEach((item) => {
      const key = monthKey(item.maintenance_date);
      values.set(key, (values.get(key) ?? 0) + Number(item.cost ?? 0));
    });
    return [...values.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({ label: monthLabel(key), value, detail: money(value) }));
  }, [filteredMaintenances]);

  const latestMovements = useMemo(() => {
    const kms = filteredOdometerLogs.map((log) => ({
      id: log.id,
      date: log.log_date,
      type: 'KM',
      vehicle: vehicleMap.get(log.vehicle_id)?.plate ?? 'Veículo removido',
      description: `${km(log.km)} · ${log.origin || 'Atualização de odômetro'}`,
      amount: null as number | null,
    }));

    const services = filteredMaintenances.map((item) => ({
      id: item.id,
      date: item.maintenance_date,
      type: 'Manutenção',
      vehicle: vehicleMap.get(item.vehicle_id)?.plate ?? 'Veículo removido',
      description: item.description,
      amount: Number(item.cost ?? 0),
    }));

    return [...kms, ...services]
      .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime())
      .slice(0, 10);
  }, [filteredMaintenances, filteredOdometerLogs, vehicleMap]);

  async function loadData() {
    if (!supabase) return;
    setLoading(true);
    setMessage('');

    const results = await Promise.all([
      supabase.from('fleet_branches').select('*').order('name'),
      supabase.from('fleet_owners').select('*').order('name'),
      supabase.from('fleet_vehicles').select('*').order('plate'),
      supabase.from('fleet_drivers').select('*').order('name'),
      supabase.from('fleet_odometer_logs').select('*').order('log_date', { ascending: false }).limit(150),
      supabase.from('fleet_maintenance').select('*').order('maintenance_date', { ascending: false }).limit(150),
    ]);

    const error = firstError(results);
    if (error) {
      setMessage(`Erro ao carregar dados: ${error}. Rode a migration supabase/003_filiais_design.sql no Supabase.`);
    } else {
      setBranches((results[0].data ?? []) as Branch[]);
      setOwners((results[1].data ?? []) as FleetOwner[]);
      setVehicles((results[2].data ?? []) as Vehicle[]);
      setDrivers((results[3].data ?? []) as Driver[]);
      setOdometerLogs((results[4].data ?? []) as OdometerLog[]);
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

  function exportExcel() {
    const workbook = XLSX.utils.book_new();

    const resumo = [
      { indicador: 'Filial filtrada', valor: selectedBranch === 'all' ? 'Todas' : branchMap.get(selectedBranch)?.name ?? '-' },
      { indicador: 'Veículos filtrados', valor: filteredVehicles.length },
      { indicador: 'Veículos ativos', valor: activeVehicles },
      { indicador: 'Em manutenção', valor: maintenanceVehicles },
      { indicador: 'Parados', valor: stoppedVehicles },
      { indicador: 'KM médio', valor: averageKm },
      { indicador: 'Custo manutenção', valor: totalMaintenance },
    ];

    const veiculos = filteredVehicles.map((vehicle) => ({
      filial: vehicle.branch_id ? branchMap.get(vehicle.branch_id)?.name ?? '' : '',
      placa: vehicle.plate,
      marca: vehicle.make,
      modelo: vehicle.model,
      ano: vehicle.year ?? '',
      status: vehicle.status,
      km_atual: vehicle.current_km,
      proxima_revisao_km: vehicle.next_service_km ?? '',
      dono_locadora: vehicle.owner_id ? ownerMap.get(vehicle.owner_id)?.name ?? '' : '',
      tipo: vehicle.ownership_type,
      categoria: vehicle.category ?? '',
      combustivel: vehicle.fuel_type ?? '',
      renavam: vehicle.renavam ?? '',
      observacoes: vehicle.notes ?? '',
    }));

    const condutores = filteredDrivers.map((driver) => ({
      filial: driver.branch_id ? branchMap.get(driver.branch_id)?.name ?? '' : '',
      nome: driver.name,
      telefone: driver.phone ?? '',
      email: driver.email ?? '',
      cnh: driver.cnh_number ?? '',
      categoria_cnh: driver.cnh_category ?? '',
      vencimento_cnh: driver.cnh_expiration ?? '',
      status: driver.status,
    }));

    const manutencoes = filteredMaintenances.map((item) => ({
      placa: vehicleMap.get(item.vehicle_id)?.plate ?? '',
      data: item.maintenance_date,
      finalizada_em: item.finished_at ?? '',
      km: item.km ?? '',
      status: item.status,
      tipo: item.service_type,
      descricao: item.description,
      fornecedor: item.provider ?? '',
      custo: item.cost,
      proxima_revisao_km: item.next_service_km ?? '',
    }));

    const hodometro = filteredOdometerLogs.map((log) => ({
      placa: vehicleMap.get(log.vehicle_id)?.plate ?? '',
      condutor: log.driver_id ? driverMap.get(log.driver_id)?.name ?? '' : '',
      data: log.log_date,
      km: log.km,
      origem: log.origin ?? '',
      observacoes: log.notes ?? '',
    }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(resumo), 'Resumo');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(veiculos), 'Veículos');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(condutores), 'Condutores');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(manutencoes), 'Manutenção');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(hodometro), 'KM');

    XLSX.writeFile(workbook, `controle-frota-tracbel-${todayISO()}.xlsx`);
  }

  if (!hasSupabaseConfig) {
    return (
      <main className="app-shell narrow" data-theme={theme}>
        <section className="setup-card">
          <p className="eyebrow">Configuração necessária</p>
          <h1>Controle de Frota Tracbel</h1>
          <p>Conecte o Supabase para usar o controle interno.</p>
          <pre>{`VITE_SUPABASE_URL=https://seu-projeto.supabase.co\nVITE_SUPABASE_ANON_KEY=sua-chave-anon`}</pre>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand-mark" aria-label="Tracbel">Tracbel<span /></div>
        <div className="topbar-copy">
          <p className="eyebrow">Controle interno</p>
          <h1>Controle de Frota Tracbel</h1>
          <p>Visão por filial, status, quilometragem, condutores e manutenção.</p>
        </div>
        <div className="topbar-actions">
          <button className="secondary" onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}>
            {theme === 'light' ? 'Modo escuro' : 'Modo claro'}
          </button>
          <button className="secondary" onClick={exportExcel}>Exportar Excel</button>
          <button className="secondary" onClick={loadData} disabled={loading || saving}>{loading ? 'Carregando...' : 'Atualizar'}</button>
        </div>
      </header>

      <section className="filters-card">
        <label>
          Filial
          <select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}>
            <option value="all">Todas as filiais</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label>
          Status do veículo
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Todos os status</option>
            <option value="Ativo">Ativo</option>
            <option value="Em manutenção">Em manutenção</option>
            <option value="Parado">Parado</option>
            <option value="Vendido">Vendido</option>
          </select>
        </label>
        <label>
          Buscar
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Placa, modelo, condutor..." />
        </label>
      </section>

      {message && <div className="notice">{message}</div>}

      <nav className="tabs">
        <button className={tab === 'painel' ? 'active' : ''} onClick={() => setTab('painel')}>Painel</button>
        <button className={tab === 'veiculos' ? 'active' : ''} onClick={() => setTab('veiculos')}>Veículos</button>
        <button className={tab === 'condutores' ? 'active' : ''} onClick={() => setTab('condutores')}>Condutores</button>
        <button className={tab === 'km' ? 'active' : ''} onClick={() => setTab('km')}>Atualizar KM</button>
        <button className={tab === 'manutencao' ? 'active' : ''} onClick={() => setTab('manutencao')}>Manutenção</button>
        <button className={tab === 'donos' ? 'active' : ''} onClick={() => setTab('donos')}>Donos/Locadoras</button>
        <button className={tab === 'filiais' ? 'active' : ''} onClick={() => setTab('filiais')}>Filiais</button>
      </nav>

      {tab === 'painel' && (
        <section className="dashboard-grid">
          <Metric title="Veículos" value={filteredVehicles.length} detail={`${activeVehicles} ativos · ${maintenanceVehicles} manutenção · ${stoppedVehicles} parados`} />
          <Metric title="Condutores" value={filteredDrivers.length} detail={`${filteredDrivers.filter((driver) => driver.status === 'Ativo').length} ativos no filtro`} />
          <Metric title="KM médio" value={km(averageKm)} detail="média dos veículos filtrados" />
          <Metric title="Manutenção" value={money(totalMaintenance)} detail={`${filteredMaintenances.length} lançamentos`} />

          <section className="card chart-card">
            <SectionTitle title="Status da frota" subtitle="clique/hover para destacar" />
            <DonutChart data={statusChart} emptyText="Sem veículos no filtro." />
          </section>

          <section className="card chart-card">
            <SectionTitle title="Veículos por filial" subtitle="distribuição atual" />
            <InteractiveBarChart data={branchChart} valueFormatter={(value) => `${value} veículos`} emptyText="Cadastre filiais e veículos." />
          </section>

          <section className="card chart-card">
            <SectionTitle title="Ranking de KM" subtitle="maior quilometragem" />
            <InteractiveBarChart data={kmChart} valueFormatter={km} emptyText="Sem KM registrado." />
          </section>

          <section className="card chart-card">
            <SectionTitle title="Custo de manutenção" subtitle="últimos meses" />
            <InteractiveBarChart data={maintenanceChart} valueFormatter={money} emptyText="Sem custos de manutenção." />
          </section>

          <section className="card wide-card">
            <SectionTitle title="Próximas revisões" subtitle="alerta por quilometragem" />
            {revisionAlerts.length === 0 ? <Empty text="Nenhum alerta de revisão." /> : (
              <div className="revision-grid">
                {revisionAlerts.map(({ vehicle, remaining }) => (
                  <article key={vehicle.id} className={`revision-card ${remaining <= 0 ? 'danger-row' : remaining <= 1000 ? 'warning-row' : ''}`}>
                    <strong>{vehicle.plate}</strong>
                    <span>{vehicle.make} {vehicle.model}</span>
                    <small>{remaining <= 0 ? `Passou ${km(Math.abs(remaining))}` : `Faltam ${km(remaining)}`}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card wide-card">
            <SectionTitle title="Últimos lançamentos" subtitle="KM e manutenção" />
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
            <SectionTitle title="Novo veículo" subtitle="filial, dono, modelo e KM" />
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_vehicles', {
              branch_id: field(form, 'branch_id'),
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
              <BranchSelect branches={branches} />
              <OwnerSelect owners={owners} />
              <label>Placa<input name="plate" required placeholder="ABC-1D23" /></label>
              <label>Marca<input name="make" required placeholder="Fiat, VW, Volvo..." /></label>
              <label>Modelo<input name="model" required placeholder="Strada, FH, Hilux..." /></label>
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
            <SectionTitle title="Veículos" subtitle={`${filteredVehicles.length} registros no filtro`} />
            {filteredVehicles.length === 0 ? <Empty text="Nenhum veículo encontrado." /> : filteredVehicles.map((vehicle) => (
              <article className="record vehicle-record" key={vehicle.id}>
                <div className="record-main"><strong>{vehicle.plate}</strong><b className={`badge ${statusClass(vehicle.status)}`}>{vehicle.status}</b></div>
                <span>{vehicle.make} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ''}</span>
                <small>Filial: {vehicle.branch_id ? branchMap.get(vehicle.branch_id)?.name ?? 'Não encontrada' : 'Não informada'}</small>
                <small>Dono/locadora: {vehicle.owner_id ? ownerMap.get(vehicle.owner_id)?.name ?? 'Não encontrado' : 'Não informado'}</small>
                <small>KM: {km(vehicle.current_km)} · Revisão: {vehicle.next_service_km ? km(vehicle.next_service_km) : 'Não definida'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_vehicles', vehicle.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'condutores' && (
        <section className="page-grid">
          <section className="card form-card">
            <SectionTitle title="Novo condutor" subtitle="filial, CNH e contato" />
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_drivers', {
              branch_id: field(form, 'branch_id'),
              name: field(form, 'name') ?? '',
              phone: field(form, 'phone'),
              email: field(form, 'email'),
              cnh_number: field(form, 'cnh_number'),
              cnh_category: field(form, 'cnh_category'),
              cnh_expiration: field(form, 'cnh_expiration'),
              status: field(form, 'status') ?? 'Ativo',
              notes: field(form, 'notes'),
            }))}>
              <BranchSelect branches={branches} />
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
            <SectionTitle title="Condutores" subtitle={`${filteredDrivers.length} registros no filtro`} />
            {filteredDrivers.length === 0 ? <Empty text="Nenhum condutor encontrado." /> : filteredDrivers.map((driver) => (
              <article className="record" key={driver.id}>
                <div className="record-main"><strong>{driver.name}</strong><b className={`badge ${statusClass(driver.status)}`}>{driver.status}</b></div>
                <span>{driver.phone || 'Sem telefone'} {driver.email ? `· ${driver.email}` : ''}</span>
                <small>Filial: {driver.branch_id ? branchMap.get(driver.branch_id)?.name ?? 'Não encontrada' : 'Não informada'}</small>
                <small>CNH: {driver.cnh_number || '-'} · Categoria: {driver.cnh_category || '-'} · Vence: {dateBR(driver.cnh_expiration)}</small>
                <button className="ghost danger" onClick={() => remove('fleet_drivers', driver.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'km' && (
        <section className="page-grid one">
          <section className="card form-card">
            <SectionTitle title="Atualizar quilometragem" subtitle="lançamento simples de odômetro" />
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_odometer_logs', {
              vehicle_id: field(form, 'vehicle_id'),
              driver_id: field(form, 'driver_id'),
              log_date: field(form, 'log_date') ?? todayISO(),
              km: num(form, 'km'),
              origin: field(form, 'origin'),
              notes: field(form, 'notes'),
            }))}>
              <VehicleSelect vehicles={filteredVehicles} />
              <DriverSelect drivers={filteredDrivers} />
              <label>Data<input name="log_date" type="date" defaultValue={todayISO()} required /></label>
              <label>KM atual<input name="km" type="number" min="0" required /></label>
              <label>Origem<input name="origin" placeholder="Retorno de rota, conferência..." /></label>
              <label className="full">Observações<textarea name="notes" /></label>
              <button disabled={saving || filteredVehicles.length === 0}>Salvar KM</button>
            </form>
          </section>
        </section>
      )}

      {tab === 'manutencao' && (
        <section className="page-grid">
          <section className="card form-card">
            <SectionTitle title="Registrar manutenção" subtitle="status, custo e próxima revisão" />
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
              <VehicleSelect vehicles={filteredVehicles} />
              <label>Data<input name="maintenance_date" type="date" defaultValue={todayISO()} required /></label>
              <label>Finalizada em<input name="finished_at" type="date" /></label>
              <label>KM<input name="km" type="number" min="0" /></label>
              <label>Status<select name="status" defaultValue="Aberta"><option>Aberta</option><option>Concluída</option><option>Cancelada</option></select></label>
              <label>Tipo<input name="service_type" defaultValue="Preventiva" /></label>
              <label>Custo<input name="cost" type="number" min="0" step="0.01" /></label>
              <label>Próxima revisão em KM<input name="next_service_km" type="number" min="0" /></label>
              <label>Oficina/fornecedor<input name="provider" /></label>
              <label className="full">Serviço/descrição<textarea name="description" required /></label>
              <button disabled={saving || filteredVehicles.length === 0}>Salvar manutenção</button>
            </form>
          </section>

          <section className="card list-card">
            <SectionTitle title="Manutenções" subtitle={`${filteredMaintenances.length} registros no filtro`} />
            {filteredMaintenances.length === 0 ? <Empty text="Nenhuma manutenção encontrada." /> : filteredMaintenances.slice(0, 30).map((item) => (
              <article className="record" key={item.id}>
                <div className="record-main"><strong>{vehicleMap.get(item.vehicle_id)?.plate ?? 'Veículo removido'}</strong><b className={`badge ${statusClass(item.status)}`}>{item.status}</b></div>
                <span>{item.description}</span>
                <small>{dateBR(item.maintenance_date)} · {item.service_type} · {item.provider || 'Fornecedor não informado'}</small>
                <small>Custo: {money(item.cost)} · KM: {item.km ? km(item.km) : '-'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_maintenance', item.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'donos' && (
        <section className="page-grid">
          <section className="card form-card">
            <SectionTitle title="Dono ou locadora" subtitle="quem responde pelo veículo" />
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
            <SectionTitle title="Donos e locadoras" subtitle={`${owners.length} registros`} />
            {owners.length === 0 ? <Empty text="Nenhum dono/locadora cadastrado." /> : owners.map((owner) => (
              <article className="record" key={owner.id}>
                <div className="record-main"><strong>{owner.name}</strong><b className="badge ok">{owner.kind}</b></div>
                <small>Documento: {owner.document || '-'} · Telefone: {owner.phone || '-'}</small>
                <button className="ghost danger" onClick={() => remove('fleet_owners', owner.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}

      {tab === 'filiais' && (
        <section className="page-grid">
          <section className="card form-card">
            <SectionTitle title="Nova filial" subtitle="base operacional" />
            <form onSubmit={(event) => submit(event, (form) => insert('fleet_branches', {
              name: field(form, 'name') ?? '',
              code: field(form, 'code'),
              city: field(form, 'city'),
              state: field(form, 'state'),
              is_active: true,
            }))}>
              <label>Nome da filial<input name="name" required placeholder="Belém, Matriz, Oficina..." /></label>
              <label>Código<input name="code" placeholder="BEL, MATRIZ..." /></label>
              <label>Cidade<input name="city" /></label>
              <label>UF<input name="state" maxLength={2} /></label>
              <button disabled={saving}>Salvar filial</button>
            </form>
          </section>

          <section className="card list-card">
            <SectionTitle title="Filiais" subtitle={`${branches.length} registros`} />
            {branches.length === 0 ? <Empty text="Nenhuma filial cadastrada." /> : branches.map((branch) => (
              <article className="record" key={branch.id}>
                <div className="record-main"><strong>{branch.name}</strong><b className="badge ok">{branch.code || 'Sem código'}</b></div>
                <small>{branch.city || '-'} {branch.state ? `/${branch.state}` : ''}</small>
                <small>{vehicles.filter((vehicle) => vehicle.branch_id === branch.id).length} veículos vinculados</small>
                <button className="ghost danger" onClick={() => remove('fleet_branches', branch.id)}>Remover</button>
              </article>
            ))}
          </section>
        </section>
      )}
    </main>
  );
}

function Metric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <span>{subtitle}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function BranchSelect({ branches }: { branches: Branch[] }) {
  return (
    <label>
      Filial
      <select name="branch_id" defaultValue="">
        <option value="">Não informada</option>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
    </label>
  );
}

function OwnerSelect({ owners }: { owners: FleetOwner[] }) {
  return (
    <label>
      Dono/locadora
      <select name="owner_id" defaultValue="">
        <option value="">Não informado</option>
        {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} · {owner.kind}</option>)}
      </select>
    </label>
  );
}

function VehicleSelect({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <label>
      Veículo
      <select name="vehicle_id" required>
        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.make} {vehicle.model} · {km(vehicle.current_km)}</option>)}
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
        {drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
      </select>
    </label>
  );
}

function DonutChart({ data, emptyText }: { data: ChartPoint[]; emptyText: string }) {
  const [active, setActive] = useState(0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 42;
  let offset = 0;

  if (data.length === 0 || total === 0) return <Empty text={emptyText} />;

  return (
    <div className="donut-layout">
      <svg className="donut" viewBox="0 0 120 120" role="img" aria-label="Gráfico de status">
        <circle cx="60" cy="60" r="42" className="donut-bg" />
        {data.map((item, index) => {
          const dash = (item.value / total) * circumference;
          const segment = (
            <circle
              key={item.label}
              cx="60"
              cy="60"
              r="42"
              className={`donut-segment segment-${index % 5} ${active === index ? 'active' : ''}`}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              onMouseEnter={() => setActive(index)}
              onClick={() => setActive(index)}
            />
          );
          offset += dash;
          return segment;
        })}
        <text x="60" y="56" textAnchor="middle" className="donut-total">{total}</text>
        <text x="60" y="72" textAnchor="middle" className="donut-caption">veículos</text>
      </svg>
      <div className="chart-legend">
        {data.map((item, index) => (
          <button key={item.label} className={active === index ? 'active' : ''} onMouseEnter={() => setActive(index)} onClick={() => setActive(index)}>
            <span className={`legend-dot segment-bg-${index % 5}`} />
            <strong>{item.label}</strong>
            <small>{item.value}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function InteractiveBarChart({ data, valueFormatter, emptyText }: { data: ChartPoint[]; valueFormatter: (value: number) => string; emptyText: string }) {
  const [active, setActive] = useState(0);
  const max = Math.max(1, ...data.map((item) => item.value));

  if (data.length === 0) return <Empty text={emptyText} />;

  return (
    <div className="bar-chart">
      {data.map((item, index) => (
        <button
          type="button"
          key={`${item.label}-${index}`}
          className={`bar-row ${active === index ? 'active' : ''}`}
          onMouseEnter={() => setActive(index)}
          onClick={() => setActive(index)}
        >
          <span className="bar-label">{item.label}</span>
          <span className="bar-track"><i style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} /></span>
          <strong>{valueFormatter(item.value)}</strong>
          {item.detail && <small>{item.detail}</small>}
        </button>
      ))}
    </div>
  );
}
