import { History, Lock, LockOpen, LogOut, Plus, Save, Settings } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, downloadFile, uploadFile } from './api';
import { FlowEditor } from './flow/FlowEditor';
import { CeBlock, CeDocument, Project, ProjectLock, Rate, User, VersionRecord } from './types';

type View = 'projects' | 'templates';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="screen center">Загрузка...</div>;
  }

  if (!user) {
    return <AuthScreen onAuth={setUser} />;
  }

  return <Workspace user={user} onLogout={() => setUser(null)} />;
}

function AuthScreen({ onAuth }: { onAuth: (user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const result = await api<{ user: User }>(mode === 'login' ? '/auth/login' : '/auth/register', {
        method: 'POST',
        body: JSON.stringify({ login, password, displayName })
      });
      onAuth(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    }
  }

  return (
    <div className="screen auth-layout">
      <form className="auth-panel" onSubmit={submit}>
        <div>
          <h1>Flow Estimate</h1>
          <p>CE, проекты, шаблоны и ставки</p>
        </div>
        <label>
          Логин
          <input value={login} onChange={(event) => setLogin(event.target.value)} autoFocus />
        </label>
        {mode === 'register' && (
          <label>
            Имя пользователя
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
        )}
        <label>
          Пароль
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" type="submit">
          {mode === 'login' ? 'Войти' : 'Создать пользователя'}
        </button>
        <button className="link-button" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Нужен новый пользователь' : 'Уже есть пользователь'}
        </button>
      </form>
    </div>
  );
}

function Workspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [rates, setRates] = useState<Rate[]>([]);

  async function load() {
    const [projectList, templateList, rateList] = await Promise.all([
      api<Project[]>('/projects'),
      api<Project[]>('/templates'),
      api<Rate[]>('/rates')
    ]);
    setProjects(projectList);
    setTemplates(templateList);
    setRates(rateList);
  }

  useEffect(() => {
    void load();
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    onLogout();
  }

  async function createProject(type: View) {
    const name = type === 'projects' ? 'Новый проект' : 'Новый шаблон';
    const project = await api<Project>(type === 'projects' ? '/projects' : '/templates', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    await load();
    setSelected(project);
  }

  async function openProject(project: Project) {
    const full = await api<Project>(`/projects/${project.id}`);
    setSelected(full);
  }

  const list = view === 'projects' ? projects : templates;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Flow Estimate</strong>
          <span>{user.displayName}</span>
        </div>
        <div className="segmented">
          <button className={view === 'projects' ? 'active' : ''} onClick={() => setView('projects')}>Проекты</button>
          <button className={view === 'templates' ? 'active' : ''} onClick={() => setView('templates')}>Шаблоны</button>
        </div>
        <button className="primary icon-button" onClick={() => createProject(view)}>
          <Plus size={16} /> Создать
        </button>
        <div className="list">
          {list.map((project) => (
            <button key={project.id} className="list-item" onClick={() => openProject(project)}>
              <strong>{project.name}</strong>
              <span>{project.owner?.displayName ?? 'Без владельца'}</span>
            </button>
          ))}
        </div>
        <button className="ghost icon-button" onClick={logout}>
          <LogOut size={16} /> Выйти
        </button>
      </aside>
      <main className="main">
        {selected ? (
          <ProjectEditor
            user={user}
            project={selected}
            rates={rates}
            reloadRates={load}
            onProjectChanged={setSelected}
            onReload={load}
            onReloadProject={async () => {
              const full = await api<Project>(`/projects/${selected.id}`);
              setSelected(full);
            }}
          />
        ) : (
          <div className="empty-state">Выберите проект или шаблон</div>
        )}
      </main>
    </div>
  );
}

function ProjectEditor({
  user,
  project,
  rates,
  reloadRates,
  onProjectChanged,
  onReload,
  onReloadProject
}: {
  user: User;
  project: Project;
  rates: Rate[];
  reloadRates: () => Promise<void>;
  onProjectChanged: (project: Project) => void;
  onReload: () => Promise<void>;
  onReloadProject: () => Promise<void>;
}) {
  const [ce, setCe] = useState<CeDocument | null>(project.ceDocument ?? null);
  const [saving, setSaving] = useState(false);
  const [ceDirty, setCeDirty] = useState(false);
  const [ceSaveStatus, setCeSaveStatus] = useState('');
  const [tab, setTab] = useState<'ce' | 'flow' | 'history'>('ce');
  const [lockState, setLockState] = useState<ProjectLock | null>(null);

  const canEdit = lockState?.userId === user.id;

  useEffect(() => {
    api<ProjectLock | null>(`/projects/${project.id}/lock`).then(setLockState).catch(() => setLockState(null));
  }, [project.id]);

  useEffect(() => {
    if (!canEdit) return;
    const timer = window.setInterval(() => {
      api<ProjectLock>(`/projects/${project.id}/lock/heartbeat`, { method: 'POST' })
        .then(setLockState)
        .catch(() => setLockState(null));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [canEdit, project.id]);

  useEffect(() => {
    setCe(project.ceDocument ?? null);
  }, [project]);

  const warnings = useMemo(() => ce?.totals?.warnings ?? [], [ce]);

  async function saveCe() {
    if (!ce) return;
    const comment = promptRequired('Комментарий к версии CE');
    if (!comment) return;
    setSaving(true);
    try {
      const saved = await api<CeDocument>(`/projects/${project.id}/ce`, {
        method: 'PATCH',
        body: JSON.stringify({
          requisites: ce.requisites,
          blocks: ce.blocks,
          ratesSnapshot: ce.ratesSnapshot,
          adjustments: ce.adjustments,
          comment
        })
      });
      setCe(saved);
      onProjectChanged({ ...project, ceDocument: saved });
    } finally {
      setSaving(false);
    }
  }

  async function autosaveCe() {
    if (!ce || !canEdit || !ceDirty) return;
    const saved = await api<CeDocument>(`/projects/${project.id}/ce`, {
      method: 'PATCH',
      body: JSON.stringify({
        requisites: ce.requisites,
        blocks: ce.blocks,
        ratesSnapshot: ce.ratesSnapshot,
        adjustments: ce.adjustments,
        comment: 'Автосохранено',
        autosave: true
      })
    });
    setCe(saved);
    setCeDirty(false);
    setCeSaveStatus(`Автосохранено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`);
    onProjectChanged({ ...project, ceDocument: saved });
  }

  useEffect(() => {
    if (!canEdit || !ceDirty || !ce) return;
    const timer = window.setInterval(() => {
      void autosaveCe().catch(() => setCeSaveStatus('Автосохранение не удалось'));
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, ceDirty, ce, project.id]);

  async function createTemplate() {
    const template = await api<Project>(`/projects/${project.id}/create-template`, { method: 'POST' });
    await onReload();
    onProjectChanged(template);
  }

  async function createProjectFromTemplate() {
    const created = await api<Project>(`/templates/${project.id}/create-project`, { method: 'POST' });
    await onReload();
    onProjectChanged(created);
  }

  async function acquireLock() {
    try {
      const lock = await api<ProjectLock>(`/projects/${project.id}/lock`, { method: 'POST' });
      setLockState(lock);
    } catch {
      const lock = await api<ProjectLock | null>(`/projects/${project.id}/lock`);
      setLockState(lock);
      window.alert(lock ? `Проект сейчас редактирует ${lock.displayName}. Дождитесь снятия блокировки.` : 'Не удалось получить блокировку.');
    }
  }

  async function releaseLock() {
    await api(`/projects/${project.id}/lock`, { method: 'DELETE' });
    setLockState(null);
  }

  async function exportPdf() {
    const format = window.prompt('Формат листа flow: A4, A3, A2 или A1', 'A3') || 'A3';
    await downloadFile(`/projects/${project.id}/export/pdf?flowPage=${encodeURIComponent(format.toUpperCase())}`);
  }

  async function exportXlsx() {
    await downloadFile(`/projects/${project.id}/export/xlsx`);
  }

  async function exportZip() {
    await downloadFile(`/projects/${project.id}/export/archive`);
  }

  async function importZip(file: File) {
    const imported = await uploadFile<Project>('/projects/import', file);
    await onReload();
    onProjectChanged(imported);
  }

  function updateBlock(nextBlock: CeBlock) {
    if (!ce) return;
    setCe(recalculateCe({ ...ce, blocks: ce.blocks.map((block) => (block.id === nextBlock.id ? nextBlock : block)) }));
    setCeDirty(true);
    setCeSaveStatus('Есть несохраненные изменения');
  }

  if (!ce) {
    return <div className="empty-state">CE не найден</div>;
  }

  return (
    <div className="project-layout">
      <header className="project-header">
        <div>
          <h2>{project.name}</h2>
          <p>{project.type === 'TEMPLATE' ? 'Шаблон' : 'Проект'} · {project.currency}</p>
        </div>
        <div className="header-actions">
          {lockState ? (
            <span className={canEdit ? 'lock-badge editable' : 'lock-badge'}>
              <Lock size={14} /> {canEdit ? 'Режим редактирования' : `Редактирует ${lockState.displayName}`}
            </span>
          ) : (
            <span className="lock-badge"><LockOpen size={14} /> Просмотр</span>
          )}
          {canEdit ? (
            <button className="ghost" onClick={releaseLock}>Выйти из редактирования</button>
          ) : (
            <button className="ghost" onClick={acquireLock}>Редактировать</button>
          )}
          {project.type === 'PROJECT' ? (
            <button className="ghost" onClick={createTemplate}>Сохранить как шаблон</button>
          ) : (
            <button className="ghost" onClick={createProjectFromTemplate}>Создать проект</button>
          )}
          <button className="ghost" onClick={exportPdf}>PDF</button>
          <button className="ghost" onClick={exportXlsx}>Excel</button>
          <button className="ghost" onClick={exportZip}>ZIP</button>
          <label className="ghost import-button">
            Import ZIP
            <input type="file" accept=".zip" onChange={(event) => event.target.files?.[0] && importZip(event.target.files[0])} />
          </label>
          <button className="primary icon-button" onClick={saveCe} disabled={saving || !canEdit}>
            <Save size={16} /> {saving ? 'Сохранение...' : 'Сохранить CE'}
          </button>
          {ceSaveStatus && <span className={ceDirty ? 'dirty-badge' : 'saved-badge'}>{ceSaveStatus}</span>}
        </div>
      </header>
      <div className="tabs">
        <button className={tab === 'ce' ? 'active' : ''} onClick={() => setTab('ce')}>CE</button>
        <button className={tab === 'flow' ? 'active' : ''} onClick={() => setTab('flow')}>Flow</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
      </div>
      {tab === 'ce' ? (
        <>
          {warnings.length > 0 && <div className="warning">{warnings.join(', ')}</div>}
          <section className="panel">
            <h3>Реквизиты</h3>
            <div className="requisites-grid">
              {['date', 'client', 'brand', 'manager', 'period'].map((key) => (
                <label key={key}>
                  {labelFor(key)}
                  <input
                    value={String(ce.requisites[key] ?? '')}
                    disabled={!canEdit}
                    onChange={(event) => {
                      setCe(recalculateCe({ ...ce, requisites: { ...ce.requisites, [key]: event.target.value } }));
                      setCeDirty(true);
                      setCeSaveStatus('Есть несохраненные изменения');
                    }}
                  />
                </label>
              ))}
              <label>
                Стоимость услуг
                <input value={formatMoney(Number(ce.requisites.serviceCost ?? 0))} readOnly />
              </label>
            </div>
          </section>
          <div className="work-grid">
            <section className="panel">
              <h3>CE</h3>
              {ce.blocks.map((block) => (
                <CeBlockEditor key={block.id} block={block} onChange={updateBlock} readOnly={!canEdit} />
              ))}
              <div className="total-line">
                <span>Итого без НДС</span>
                <strong>{formatMoney(ce.totals.totalWithoutVat)} ₸</strong>
              </div>
            </section>
            <RatesPanel rates={rates} reloadRates={reloadRates} />
          </div>
        </>
      ) : (
        tab === 'flow' ? (
          <FlowEditor projectId={project.id} readOnly={!canEdit} onCeUpdated={(nextCe) => {
            setCe(nextCe);
            onProjectChanged({ ...project, ceDocument: nextCe });
          }} />
        ) : (
          <HistoryPanel projectId={project.id} onRestored={onReloadProject} />
        )
      )}
    </div>
  );
}

function CeBlockEditor({ block, onChange, readOnly }: { block: CeBlock; onChange: (block: CeBlock) => void; readOnly: boolean }) {
  function patchLine(lineId: string, patch: Record<string, unknown>) {
    onChange({
      ...block,
      lines: block.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line))
    });
  }

  return (
    <div className="ce-block">
      <div className="block-title">
        <strong>{block.title}</strong>
      </div>
      <div className="ce-table">
        <div className="ce-row head">
          <span>Услуга</span>
          <span>Ставка</span>
          <span>Кол-во</span>
          <span>Всего</span>
        </div>
        {block.lines.map((line) => (
          <div className="ce-row" key={line.id}>
            <input value={line.service} disabled={readOnly} onChange={(event) => patchLine(line.id, { service: event.target.value })} />
            <input type="number" disabled={readOnly} value={line.rate ?? ''} onChange={(event) => patchLine(line.id, { rate: toNumber(event.target.value) })} />
            <input type="number" disabled={readOnly} value={line.quantity ?? ''} onChange={(event) => patchLine(line.id, { quantity: toNumber(event.target.value) })} />
            <span>{line.total === null ? '—' : formatMoney(line.total)}</span>
          </div>
        ))}
      </div>
      <div className="adjustments">
        <label>
          Срочность
          <input type="number" disabled={readOnly} step="0.1" value={block.urgencyCoefficient} onChange={(event) => onChange({ ...block, urgencyCoefficient: Number(event.target.value) })} />
        </label>
        <label>
          Сложность
          <input type="number" disabled={readOnly} step="0.1" value={block.complexityCoefficient} onChange={(event) => onChange({ ...block, complexityCoefficient: Number(event.target.value) })} />
        </label>
        <label>
          Скидка
          <input type="number" disabled={readOnly} value={block.discount} onChange={(event) => onChange({ ...block, discount: Number(event.target.value) })} />
        </label>
        <label>
          Наценка
          <input type="number" disabled={readOnly} value={block.markup} onChange={(event) => onChange({ ...block, markup: Number(event.target.value) })} />
        </label>
      </div>
      <div className="block-total">
        <span>Итого блока</span>
        <strong>{formatMoney(block.total)} ₸</strong>
      </div>
    </div>
  );
}

function RatesPanel({ rates, reloadRates }: { rates: Rate[]; reloadRates: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('custom');

  async function addRate(event: FormEvent) {
    event.preventDefault();
    await api('/rates', {
      method: 'POST',
      body: JSON.stringify({ name, code, amount: Number(amount), category })
    });
    setName('');
    setCode('');
    setAmount('');
    await reloadRates();
  }

  return (
    <aside className="panel rates-panel">
      <h3><Settings size={16} /> Ставки</h3>
      <div className="rate-list">
        {rates.map((rate) => (
          <div key={rate.id} className="rate-row">
            <span>{rate.name}</span>
            <strong>{formatMoney(rate.amount)} ₸</strong>
          </div>
        ))}
      </div>
      <form className="rate-form" onSubmit={addRate}>
        <input placeholder="Код" value={code} onChange={(event) => setCode(event.target.value)} />
        <input placeholder="Название" value={name} onChange={(event) => setName(event.target.value)} />
        <input placeholder="Ставка" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
        <input placeholder="Категория" value={category} onChange={(event) => setCategory(event.target.value)} />
        <button className="primary" type="submit">Добавить ставку</button>
      </form>
    </aside>
  );
}

function HistoryPanel({ projectId, onRestored }: { projectId: string; onRestored: () => Promise<void> }) {
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  async function load() {
    setVersions(await api<VersionRecord[]>(`/projects/${projectId}/versions`));
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  async function restore(versionId: string) {
    const comment = promptRequired('Комментарий к откату версии');
    if (!comment) return;
    await api(`/projects/${projectId}/versions/${versionId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    });
    await onRestored();
    await load();
  }

  async function restoreSelected() {
    if (!selectedVersionId) return;
    await restore(selectedVersionId);
  }

  return (
    <section className="panel">
      <h3><History size={16} /> История изменений</h3>
      <div className="history-toolbar">
        <select value={selectedVersionId} onChange={(event) => setSelectedVersionId(event.target.value)}>
          <option value="">Выберите версию</option>
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              {new Date(version.createdAt).toLocaleString('ru-RU')} · {version.user?.displayName ?? version.userId} · {version.comment || version.actionType}
            </option>
          ))}
        </select>
        <button className="primary" onClick={restoreSelected} disabled={!selectedVersionId}>Откатить выбранную</button>
      </div>
      <div className="version-list">
        {versions.length === 0 && <div className="empty-inline">История пока пустая</div>}
        {versions.map((version) => (
          <div className="version-row" key={version.id}>
            <div>
              <strong>{version.actionType}</strong>
              <span>{new Date(version.createdAt).toLocaleString('ru-RU')} · {version.user?.displayName ?? version.userId}</span>
              <p>{version.comment}</p>
            </div>
            <button className="ghost" onClick={() => restore(version.id)}>Откатить</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function labelFor(key: string) {
  const labels: Record<string, string> = {
    date: 'Дата',
    client: 'Клиент',
    brand: 'Наименование / бренд',
    manager: 'Ответственный менеджер',
    period: 'Период'
  };
  return labels[key] ?? key;
}

function toNumber(value: string) {
  return value === '' ? null : Number(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function promptRequired(title: string) {
  const value = window.prompt(title);
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) {
    window.alert('Комментарий обязателен.');
    return null;
  }
  return trimmed;
}

function recalculateCe(ce: CeDocument): CeDocument {
  const blocks = ce.blocks.map((block) => {
    const lines = block.lines.map((line) => {
      const hasValue = line.rate !== null && line.quantity !== null;
      return {
        ...line,
        total: hasValue ? Number(line.rate) * Number(line.quantity) : null
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + (line.total ?? 0), 0);
    const adjusted = subtotal * Number(block.urgencyCoefficient || 1) * Number(block.complexityCoefficient || 1);
    const total = Math.max(0, adjusted + Number(block.markup || 0) - Number(block.discount || 0));

    return {
      ...block,
      lines,
      subtotal,
      total
    };
  });

  const totalWithoutVat = blocks.reduce((sum, block) => sum + block.total, 0);

  return {
    ...ce,
    blocks,
    requisites: {
      ...ce.requisites,
      serviceCost: totalWithoutVat
    },
    totals: {
      subtotal: totalWithoutVat,
      totalWithoutVat,
      warnings: totalWithoutVat === 0 ? ['Общий итог CE равен нулю'] : []
    }
  };
}
