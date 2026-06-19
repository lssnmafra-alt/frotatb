import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';

type VehicleStatus = 'Ativo' | 'Manutenção' | 'Parado';
type DriverStatus = 'Disponível' | 'Em rota' | 'Afastado';

type Vehicle = {
  id: string;
  plate: string;
  model: string;
  category: string;
  year: number;
  odometer: number;
  nextRevisionKm: number;
  status: VehicleStatus;
  notes: string;
};

type Driver = {
  id: string;
  name: string;
  phone: string;
  cnh: string;
  status: DriverStatus;
};

type Maintenance = {
  id: string;
  vehicleId: string;
  date: string;
  odometer: number;
  description: string;
  cost: number;
  nextDueKm: number;
};

type FuelLog = {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  odometer: number;
  liters: number;
  pricePerLiter: number;
  station: string;
};

type Tab = 'dashboard' | 'vehicles' | 'drivers' | 'operation';

const seedVehicles: Vehicle[] = [
  {
    id: 'vehicle-1',
    plate: 'ABC-1D23',
    model: 'Fiat Strada Freedom',
    category: 'Utilitário',
    year: 2023,
    odometer: 38200,
    nextRevisionKm: 40000,
    status: 'Ativo',
    notes: 'Veículo principal para entregas urbanas.',
  },
  {
    id: 'vehicle-2',
    plate: 'TBX-4F89',
    model: 'Volkswagen Delivery',
    category: 'Caminhão leve',
    year: 2021,
    odometer: 78950,
    nextRevisionKm: 80000,
    status: 'Manutenção',
    notes: 'Aguardando revisão de freio.',
  },
];

const seedDrivers: Driver[] = [
  {
    id: 'driver-1',
    name: 'Carlos Almeida',
    phone: '(91) 90000-1001',
    cnh: 'AD',
    status: 'Disponível',
  },
  {
    id: 'driver-2',
    name: 'Renata Souza',
    phone: '(91) 90000-1002',
    cnh: 'B',
    status: 'Em rota',
  },
];

const seedMaintenances: Maintenance[] = [
  {
    id: 'maintenance-1',
    vehicleId: 'vehicle-1',
    date: '2026-06-05',
    odometer: 36500,
    description: 'Troca de óleo e filtros',
    cost: 420,
    nextDueKm: 40000,
  },
  {
    id: 'maintenance-2',
    vehicleId: 'vehicle-2',
    date: '2026-06-10',
    odometer: 78800,
    description: 'Diagnóstico do sistema de freio',
    cost: 180,
    nextDueKm: 80000,
  },
];

const seedFuelLogs: FuelLog[] = [
  {
    id: 'fuel-1',
    vehicleId: 'vehicle-1',
    driverId: 'driver-1',
    date: '2026-06-12',
    odometer: 37920,
    liters: 44,
    pricePerLiter: 6.12,
    station: 'Posto Centro',
  },
  {
    id: 'fuel-2',
    vehicleId: 'vehicle-2',
    driverId: 'driver-2',
    date: '2026-06-14',
    odometer: 78950,
    liters: 72,
    pricePerLiter: 6.08,
    station: 'Posto Rodovia',
  },
];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatKm(value: number) {
  return `${value.toLocaleString('pt-BR')} km`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getString(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

function getNumber(form: FormData, name: string) {
  const value = Number(form.get(name));
  return Number.isFinite(value) ? value : 0;
}

function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}

function Badge({ label }: { label: VehicleStatus | DriverStatus }) {
  const tone = label === 'Ativo' || label === 'Disponível' ? 'success' : label === 'Manutenção' || label === 'Em rota' ? 'warning' : 'danger';
  return <span className={`badge ${tone}`}>{label}</span>;
}

function StatCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [vehicles, setVehicles] = usePersistentState<Vehicle[]>('frotatb:vehicles', seedVehicles);
  const [drivers, setDrivers] = usePersistentState<Driver[]>('frotatb:drivers', seedDrivers);
  const [maintenances, setMaintenances] = usePersistentState<Maintenance[]>('frotatb:maintenances', seedMaintenances);
  const [fuelLogs, setFuelLogs] = usePersistentState<FuelLog[]>('frotatb:fuelLogs', seedFuelLogs);

  const vehicleMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const driverMap = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const totalFuelCost = useMemo(
    () => fuelLogs.reduce((total, item) => total + item.liters * item.pricePerLiter, 0),
    [fuelLogs],
  );

  const totalMaintenanceCost = useMemo(
    () => maintenances.reduce((total, item) => total + item.cost, 0),
    [maintenances],
  );

  const currentMonthCost = useMemo(() => {
    const now = new Date();
    const isCurrentMonth = (date: string) => {
      const parsed = new Date(`${date}T00:00:00`);
      return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
    };

    const fuel = fuelLogs
      .filter((item) => isCurrentMonth(item.date))
      .reduce((total, item) => total + item.liters * item.pricePerLiter, 0);

    const maintenance = maintenances
      .filter((item) => isCurrentMonth(item.date))
      .reduce((total, item) => total + item.cost, 0);

    return fuel + maintenance;
  }, [fuelLogs, maintenances]);

  const totalLiters = useMemo(() => fuelLogs.reduce((total, item) => total + item.liters, 0), [fuelLogs]);

  const revisionAlerts = useMemo(
    () =>
      vehicles
        .map((vehicle) => {
          const kmsLeft = vehicle.nextRevisionKm - vehicle.odometer;
          const severity = vehicle.status === 'Manutenção' || kmsLeft <= 0 ? 'danger' : kmsLeft <= 1000 ? 'warning' : 'ok';
          return { vehicle, kmsLeft, severity };
        })
        .sort((a, b) => a.kmsLeft - b.kmsLeft),
    [vehicles],
  );

  const vehicleCosts = useMemo(
    () =>
      vehicles.map((vehicle) => {
        const fuel = fuelLogs
          .filter((item) => item.vehicleId === vehicle.id)
          .reduce((total, item) => total + item.liters * item.pricePerLiter, 0);
        const maintenance = maintenances
          .filter((item) => item.vehicleId === vehicle.id)
          .reduce((total, item) => total + item.cost, 0);
        return {
          vehicle,
          fuel,
          maintenance,
          total: fuel + maintenance,
        };
      }),
    [fuelLogs, maintenances, vehicles],
  );

  const maxVehicleCost = Math.max(1, ...vehicleCosts.map((item) => item.total));

  const recentOperations = useMemo(() => {
    const maintenanceOperations = maintenances.map((item) => ({
      id: item.id,
      date: item.date,
      title: item.description,
      type: 'Manutenção',
      amount: item.cost,
      vehicle: vehicleMap.get(item.vehicleId)?.plate ?? 'Veículo removido',
    }));

    const fuelOperations = fuelLogs.map((item) => ({
      id: item.id,
      date: item.date,
      title: `${item.liters.toLocaleString('pt-BR')} L em ${item.station || 'posto não informado'}`,
      type: 'Abastecimento',
      amount: item.liters * item.pricePerLiter,
      vehicle: vehicleMap.get(item.vehicleId)?.plate ?? 'Veículo removido',
    }));

    return [...maintenanceOperations, ...fuelOperations]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [fuelLogs, maintenances, vehicleMap]);

  function updateVehicleMileage(vehicleId: string, odometer: number) {
    setVehicles((current) =>
      current.map((vehicle) =>
        vehicle.id === vehicleId
          ? {
              ...vehicle,
              odometer: Math.max(vehicle.odometer, odometer),
            }
          : vehicle,
      ),
    );
  }

  function addVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vehicle: Vehicle = {
      id: uid('vehicle'),
      plate: getString(form, 'plate').toUpperCase(),
      model: getString(form, 'model'),
      category: getString(form, 'category') || 'Não informado',
      year: getNumber(form, 'year') || new Date().getFullYear(),
      odometer: getNumber(form, 'odometer'),
      nextRevisionKm: getNumber(form, 'nextRevisionKm'),
      status: (getString(form, 'status') as VehicleStatus) || 'Ativo',
      notes: getString(form, 'notes'),
    };

    setVehicles((current) => [vehicle, ...current]);
    event.currentTarget.reset();
  }

  function addDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const driver: Driver = {
      id: uid('driver'),
      name: getString(form, 'name'),
      phone: getString(form, 'phone'),
      cnh: getString(form, 'cnh').toUpperCase(),
      status: (getString(form, 'status') as DriverStatus) || 'Disponível',
    };

    setDrivers((current) => [driver, ...current]);
    event.currentTarget.reset();
  }

  function addMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vehicleId = getString(form, 'vehicleId');
    const odometer = getNumber(form, 'odometer');
    const nextDueKm = getNumber(form, 'nextDueKm');

    const maintenance: Maintenance = {
      id: uid('maintenance'),
      vehicleId,
      date: getString(form, 'date') || todayISO(),
      odometer,
      description: getString(form, 'description'),
      cost: getNumber(form, 'cost'),
      nextDueKm,
    };

    setMaintenances((current) => [maintenance, ...current]);
    updateVehicleMileage(vehicleId, odometer);
    if (nextDueKm > 0) {
      setVehicles((current) => current.map((vehicle) => (vehicle.id === vehicleId ? { ...vehicle, nextRevisionKm: nextDueKm } : vehicle)));
    }
    event.currentTarget.reset();
  }

  function addFuelLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const vehicleId = getString(form, 'vehicleId');
    const odometer = getNumber(form, 'odometer');

    const fuelLog: FuelLog = {
      id: uid('fuel'),
      vehicleId,
      driverId: getString(form, 'driverId'),
      date: getString(form, 'date') || todayISO(),
      odometer,
      liters: getNumber(form, 'liters'),
      pricePerLiter: getNumber(form, 'pricePerLiter'),
      station: getString(form, 'station'),
    };

    setFuelLogs((current) => [fuelLog, ...current]);
    updateVehicleMileage(vehicleId, odometer);
    event.currentTarget.reset();
  }

  function removeVehicle(vehicleId: string) {
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== vehicleId));
    setMaintenances((current) => current.filter((item) => item.vehicleId !== vehicleId));
    setFuelLogs((current) => current.filter((item) => item.vehicleId !== vehicleId));
  }

  function resetDemoData() {
    const confirmed = window.confirm('Isso vai apagar os dados atuais deste navegador e restaurar os exemplos. Continuar?');
    if (!confirmed) return;
    setVehicles(seedVehicles);
    setDrivers(seedDrivers);
    setMaintenances(seedMaintenances);
    setFuelLogs(seedFuelLogs);
  }

  function exportBackup() {
    const payload = {
      exportedAt: new Date().toISOString(),
      vehicles,
      drivers,
      maintenances,
      fuelLogs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `backup-frotatb-${todayISO()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">FrotaTB</p>
          <h1>Controle de frota simples, rápido e organizado.</h1>
          <p className="hero-copy">
            Cadastre veículos e motoristas, registre abastecimentos, acompanhe manutenções e veja custos por veículo em um painel direto.
          </p>
        </div>
        <div className="hero-card">
          <span>Custo geral registrado</span>
          <strong>{formatCurrency(totalFuelCost + totalMaintenanceCost)}</strong>
          <small>{vehicles.length} veículos · {drivers.length} motoristas</small>
        </div>
      </header>

      <nav className="tabs" aria-label="Navegação principal">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Painel</button>
        <button className={activeTab === 'vehicles' ? 'active' : ''} onClick={() => setActiveTab('vehicles')}>Veículos</button>
        <button className={activeTab === 'drivers' ? 'active' : ''} onClick={() => setActiveTab('drivers')}>Motoristas</button>
        <button className={activeTab === 'operation' ? 'active' : ''} onClick={() => setActiveTab('operation')}>Operação</button>
      </nav>

      {activeTab === 'dashboard' && (
        <section className="screen-grid">
          <div className="stats-grid">
            <StatCard title="Veículos cadastrados" value={String(vehicles.length)} detail={`${vehicles.filter((vehicle) => vehicle.status === 'Ativo').length} ativos`} />
            <StatCard title="Custo neste mês" value={formatCurrency(currentMonthCost)} detail="Abastecimento + manutenção" />
            <StatCard title="Combustível registrado" value={`${totalLiters.toLocaleString('pt-BR')} L`} detail={formatCurrency(totalFuelCost)} />
            <StatCard title="Manutenções" value={String(maintenances.length)} detail={formatCurrency(totalMaintenanceCost)} />
          </div>

          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Custos por veículo</p>
                <h2>Onde o dinheiro está indo</h2>
              </div>
              <button className="secondary-button" onClick={exportBackup}>Exportar backup</button>
            </div>

            {vehicleCosts.length === 0 ? (
              <EmptyState text="Cadastre o primeiro veículo para começar o controle." />
            ) : (
              <div className="cost-list">
                {vehicleCosts.map((item) => (
                  <article className="cost-row" key={item.vehicle.id}>
                    <div className="cost-row-main">
                      <strong>{item.vehicle.plate}</strong>
                      <span>{item.vehicle.model}</span>
                    </div>
                    <div className="cost-bar" aria-label={`Custo total ${formatCurrency(item.total)}`}>
                      <span style={{ width: `${Math.max(6, (item.total / maxVehicleCost) * 100)}%` }} />
                    </div>
                    <div className="cost-row-values">
                      <span>Combustível {formatCurrency(item.fuel)}</span>
                      <span>Manutenção {formatCurrency(item.maintenance)}</span>
                      <strong>{formatCurrency(item.total)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Alertas</p>
                <h2>Próximas revisões</h2>
              </div>
            </div>
            <div className="alert-list">
              {revisionAlerts.map((item) => (
                <article className={`alert-card ${item.severity}`} key={item.vehicle.id}>
                  <strong>{item.vehicle.plate}</strong>
                  <span>{item.vehicle.model}</span>
                  <small>
                    {item.kmsLeft <= 0 ? `Passou ${formatKm(Math.abs(item.kmsLeft))}` : `Faltam ${formatKm(item.kmsLeft)}`}
                  </small>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Últimos lançamentos</h2>
              </div>
            </div>
            {recentOperations.length === 0 ? (
              <EmptyState text="Nenhum lançamento ainda." />
            ) : (
              <div className="timeline">
                {recentOperations.map((operation) => (
                  <article key={`${operation.type}-${operation.id}`}>
                    <span>{operation.type}</span>
                    <strong>{operation.title}</strong>
                    <small>{operation.vehicle} · {new Date(`${operation.date}T00:00:00`).toLocaleDateString('pt-BR')} · {formatCurrency(operation.amount)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === 'vehicles' && (
        <section className="screen-grid">
          <section className="panel form-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Novo veículo</h2>
              </div>
            </div>
            <form onSubmit={addVehicle} className="form-grid">
              <label>
                Placa
                <input name="plate" placeholder="ABC-1D23" required />
              </label>
              <label>
                Modelo
                <input name="model" placeholder="Fiat Strada" required />
              </label>
              <label>
                Categoria
                <input name="category" placeholder="Utilitário, caminhão, moto..." />
              </label>
              <label>
                Ano
                <input name="year" type="number" min="1970" max="2100" placeholder="2024" />
              </label>
              <label>
                Km atual
                <input name="odometer" type="number" min="0" placeholder="0" required />
              </label>
              <label>
                Próxima revisão em km
                <input name="nextRevisionKm" type="number" min="0" placeholder="10000" required />
              </label>
              <label>
                Status
                <select name="status" defaultValue="Ativo">
                  <option>Ativo</option>
                  <option>Manutenção</option>
                  <option>Parado</option>
                </select>
              </label>
              <label className="full-field">
                Observações
                <textarea name="notes" placeholder="Seguro, pneus, documento, detalhes importantes..." />
              </label>
              <button type="submit" className="primary-button">Cadastrar veículo</button>
            </form>
          </section>

          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Garagem</p>
                <h2>Veículos cadastrados</h2>
              </div>
            </div>
            {vehicles.length === 0 ? (
              <EmptyState text="Nenhum veículo cadastrado." />
            ) : (
              <div className="vehicle-grid">
                {vehicles.map((vehicle) => (
                  <article className="vehicle-card" key={vehicle.id}>
                    <div className="vehicle-card-top">
                      <div>
                        <strong>{vehicle.plate}</strong>
                        <span>{vehicle.model}</span>
                      </div>
                      <Badge label={vehicle.status} />
                    </div>
                    <dl>
                      <div><dt>Categoria</dt><dd>{vehicle.category}</dd></div>
                      <div><dt>Ano</dt><dd>{vehicle.year}</dd></div>
                      <div><dt>Km atual</dt><dd>{formatKm(vehicle.odometer)}</dd></div>
                      <div><dt>Próxima revisão</dt><dd>{formatKm(vehicle.nextRevisionKm)}</dd></div>
                    </dl>
                    {vehicle.notes && <p>{vehicle.notes}</p>}
                    <button className="danger-button" onClick={() => removeVehicle(vehicle.id)}>Remover</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === 'drivers' && (
        <section className="screen-grid">
          <section className="panel form-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Novo motorista</h2>
              </div>
            </div>
            <form onSubmit={addDriver} className="form-grid">
              <label>
                Nome
                <input name="name" placeholder="Nome completo" required />
              </label>
              <label>
                Telefone
                <input name="phone" placeholder="(91) 90000-0000" />
              </label>
              <label>
                CNH
                <input name="cnh" placeholder="B, C, D, E, AD..." required />
              </label>
              <label>
                Status
                <select name="status" defaultValue="Disponível">
                  <option>Disponível</option>
                  <option>Em rota</option>
                  <option>Afastado</option>
                </select>
              </label>
              <button type="submit" className="primary-button">Cadastrar motorista</button>
            </form>
          </section>

          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Equipe</p>
                <h2>Motoristas cadastrados</h2>
              </div>
            </div>
            {drivers.length === 0 ? (
              <EmptyState text="Nenhum motorista cadastrado." />
            ) : (
              <div className="driver-list">
                {drivers.map((driver) => (
                  <article className="driver-card" key={driver.id}>
                    <div>
                      <strong>{driver.name}</strong>
                      <span>{driver.phone || 'Telefone não informado'} · CNH {driver.cnh}</span>
                    </div>
                    <Badge label={driver.status} />
                    <button className="ghost-button" onClick={() => setDrivers((current) => current.filter((item) => item.id !== driver.id))}>Remover</button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {activeTab === 'operation' && (
        <section className="screen-grid">
          <section className="panel form-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Operação</p>
                <h2>Registrar abastecimento</h2>
              </div>
            </div>
            <form onSubmit={addFuelLog} className="form-grid">
              <label>
                Veículo
                <select name="vehicleId" required>
                  {vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}
                </select>
              </label>
              <label>
                Motorista
                <select name="driverId" defaultValue="">
                  <option value="">Sem motorista</option>
                  {drivers.map((driver) => <option value={driver.id} key={driver.id}>{driver.name}</option>)}
                </select>
              </label>
              <label>
                Data
                <input name="date" type="date" defaultValue={todayISO()} required />
              </label>
              <label>
                Km no abastecimento
                <input name="odometer" type="number" min="0" required />
              </label>
              <label>
                Litros
                <input name="liters" type="number" min="0" step="0.01" required />
              </label>
              <label>
                Preço por litro
                <input name="pricePerLiter" type="number" min="0" step="0.01" required />
              </label>
              <label className="full-field">
                Posto
                <input name="station" placeholder="Nome do posto" />
              </label>
              <button type="submit" className="primary-button" disabled={vehicles.length === 0}>Salvar abastecimento</button>
            </form>
          </section>

          <section className="panel form-panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Oficina</p>
                <h2>Registrar manutenção</h2>
              </div>
            </div>
            <form onSubmit={addMaintenance} className="form-grid">
              <label>
                Veículo
                <select name="vehicleId" required>
                  {vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.plate} · {vehicle.model}</option>)}
                </select>
              </label>
              <label>
                Data
                <input name="date" type="date" defaultValue={todayISO()} required />
              </label>
              <label>
                Km da manutenção
                <input name="odometer" type="number" min="0" required />
              </label>
              <label>
                Custo
                <input name="cost" type="number" min="0" step="0.01" required />
              </label>
              <label>
                Próxima revisão em km
                <input name="nextDueKm" type="number" min="0" required />
              </label>
              <label className="full-field">
                Serviço realizado
                <textarea name="description" placeholder="Troca de óleo, freio, pneus..." required />
              </label>
              <button type="submit" className="primary-button" disabled={vehicles.length === 0}>Salvar manutenção</button>
            </form>
          </section>

          <section className="panel wide">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Histórico</p>
                <h2>Lançamentos recentes</h2>
              </div>
              <button className="secondary-button" onClick={resetDemoData}>Restaurar exemplos</button>
            </div>
            {recentOperations.length === 0 ? (
              <EmptyState text="Sem abastecimentos ou manutenções." />
            ) : (
              <div className="operation-table">
                <div className="table-head">
                  <span>Tipo</span>
                  <span>Veículo</span>
                  <span>Descrição</span>
                  <span>Valor</span>
                </div>
                {recentOperations.map((operation) => (
                  <div className="table-row" key={`${operation.type}-${operation.id}`}>
                    <span>{operation.type}</span>
                    <span>{operation.vehicle}</span>
                    <span>{operation.title}</span>
                    <strong>{formatCurrency(operation.amount)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      <footer className="footer-note">
        Dados salvos no navegador. Próximo passo recomendado: conectar com Supabase para login, banco de dados e acesso por equipe.
      </footer>
    </main>
  );
}
