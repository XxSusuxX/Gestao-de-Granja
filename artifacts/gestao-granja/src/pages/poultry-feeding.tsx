import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPoultrySummary, getGetPoultrySummaryQueryKey, useGetPoultryLots, getGetPoultryLotsQueryKey,
  useCreatePoultryLot, useUpdatePoultryLot, useCreatePoultryDispatch,
  useGetPoultryMovements, getGetPoultryMovementsQueryKey, useDeletePoultryMovement,
  useGetFeedingSummary, getGetFeedingSummaryQueryKey, useGetFeedRecipes, getGetFeedRecipesQueryKey,
  useCreateFeedRecipe, useUpdateFeedRecipe, useDeleteFeedRecipe,
  useGetFeedLogs, getGetFeedLogsQueryKey, useCreateFeedLog, useDeleteFeedLog,
  useGetProducts, getGetProductsQueryKey,
} from '@workspace/api-client-react';
import type { PoultryLot, PoultryMovement, FeedRecipe, FeedLog, Product } from '@workspace/api-client-react';
import { ArrowDownLeft, ArrowUpRight, Bird, Coins, Egg, Plus, RotateCcw, Trash2, Pencil, Wheat, X } from 'lucide-react';

const cash = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const day = () => new Date().toISOString().slice(0, 10);
const shortDate = (s: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${s.slice(0, 10)}T12:00:00`));
const kindName: Record<string, string> = { layers: 'Poedeiras', broilers: 'Frangos de corte', chicks: 'Pintinhos', other: 'Outras aves' };
const reasonName: Record<string, string> = { sale: 'Venda', transfer: 'Transferência', mortality: 'Mortalidade', other: 'Outro' };

function useRefresh() {
  const qc = useQueryClient();
  return (...keys: ReadonlyArray<readonly unknown[]>) => keys.forEach(queryKey => { void qc.invalidateQueries({ queryKey }); });
}

function PanelState({ loading, error, retry, empty, children }: { loading: boolean; error: boolean; retry: () => void; empty: boolean; children: ReactNode }) {
  if (loading) return <div className="skeleton-panel" aria-label="Carregando dados"><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>;
  if (error) return <div className="empty-state"><div className="empty-mark"><RotateCcw size={21} /></div><h3>Não foi possível carregar</h3><p>Confira a conexão e tente novamente.</p><button className="button secondary" onClick={retry} data-testid="button-retry">Tentar de novo</button></div>;
  if (empty) return <div className="mini-empty">Ainda não há registros por aqui.</div>;
  return <>{children}</>;
}

function FormModal({ title, eyebrow, close, children }: { title: string; eyebrow: string; close: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title} data-testid="dialog-form">
      <div className="modal-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={close} data-testid="button-close-modal"><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}

function PoultryLotForm({ initial, busy, close, save }: { initial?: PoultryLot; busy: boolean; close: () => void; save: (data: { label: string; kind: PoultryLot['kind']; receivedAt: string; source: string; breed: string; ageWeeks?: number; initialCount?: number }) => void }) {
  const [label, setLabel] = useState(initial?.label ?? '');
  const [kind, setKind] = useState<PoultryLot['kind']>(initial?.kind ?? 'layers');
  const [receivedAt, setReceivedAt] = useState(initial?.receivedAt.slice(0, 10) ?? day());
  const [source, setSource] = useState(initial?.source ?? '');
  const [breed, setBreed] = useState(initial?.breed ?? '');
  const [age, setAge] = useState(initial?.ageWeeks?.toString() ?? '');
  const [count, setCount] = useState(initial?.initialCount.toString() ?? '');
  const choices: PoultryLot['kind'][] = ['layers', 'broilers', 'chicks', 'other'];
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); save({ label: label.trim(), kind, receivedAt, source: source.trim(), breed: breed.trim(), ageWeeks: age ? Number(age) : undefined, initialCount: initial ? undefined : Number(count) }); }}>
    <label className="field-label">Nome do lote<input autoFocus required value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex.: Galpão 1 — lote de abril" data-testid="input-lot-label" /></label>
    {!initial && <div className="field-label">Tipo de criação<div className="choice-grid">{choices.map(k => <button type="button" key={k} onClick={() => setKind(k)} className={`choice-pill ${kind === k ? 'selected' : ''}`} data-testid={`choice-lot-${k}`}>{kindName[k]}</button>)}</div></div>}
    <div className="form-row">
      {!initial && <label className="field-label">Aves recebidas<input required type="number" min="1" step="1" value={count} onChange={e => setCount(e.target.value)} placeholder="Quantidade" data-testid="input-lot-count" /></label>}
      {!initial && <label className="field-label">Data de chegada<input required type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} data-testid="input-lot-date" /></label>}
      <label className="field-label">Idade em semanas <span className="optional">opcional</span><input type="number" min="0" step="1" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex.: 8" /></label>
    </div>
    <div className="form-row"><label className="field-label">Origem <span className="optional">opcional</span><input value={source} onChange={e => setSource(e.target.value)} placeholder="Fornecedor ou sítio" /></label><label className="field-label">Raça <span className="optional">opcional</span><input value={breed} onChange={e => setBreed(e.target.value)} placeholder="Ex.: Isa Brown" /></label></div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !label.trim() || (!initial && !count)} data-testid="button-save-lot">{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Registrar chegada'}</button></div>
  </form>;
}

function DispatchForm({ lot, busy, close, save }: { lot: PoultryLot; busy: boolean; close: () => void; save: (input: { quantity: number; movementDate: string; counterparty: string; reason: 'sale' | 'transfer' | 'mortality' | 'other' }) => void }) {
  const [quantity, setQuantity] = useState('');
  const [movementDate, setDate] = useState(day());
  const [reason, setReason] = useState<'sale' | 'transfer' | 'mortality' | 'other'>('sale');
  const [counterparty, setCounterparty] = useState('');
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); save({ quantity: Number(quantity), movementDate, counterparty: counterparty.trim(), reason }); }}>
    <div className="lot-capacity"><Bird size={18} />{lot.label}<b>{lot.currentCount} aves no lote</b></div>
    <div className="field-label">Motivo da saída<div className="choice-grid">{(['sale', 'transfer', 'mortality', 'other'] as const).map(r => <button type="button" key={r} className={`choice-pill ${reason === r ? 'selected' : ''}`} onClick={() => setReason(r)}>{reasonName[r]}</button>)}</div></div>
    <div className="form-row"><label className="field-label">Quantidade<input required type="number" min="1" max={lot.currentCount} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quantas aves?" data-testid="input-dispatch-quantity" /></label><label className="field-label">Data<input required type="date" value={movementDate} onChange={e => setDate(e.target.value)} /></label></div>
    <label className="field-label">{reason === 'sale' ? 'Para quem?' : 'Destino / observação'} <span className="optional">opcional</span><input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="Nome ou anotação curta" /></label>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !quantity || Number(quantity) > lot.currentCount} data-testid="button-save-dispatch">{busy ? 'Registrando…' : 'Registrar saída'}</button></div>
  </form>;
}

export function PoultryPage() {
  const summary = useGetPoultrySummary();
  const lotsQuery = useGetPoultryLots();
  const movesQuery = useGetPoultryMovements();
  const createLot = useCreatePoultryLot();
  const updateLot = useUpdatePoultryLot();
  const dispatch = useCreatePoultryDispatch();
  const deleteMove = useDeletePoultryMovement();
  const refresh = useRefresh();
  const [modal, setModal] = useState<'lot' | 'dispatch' | null>(null);
  const [editing, setEditing] = useState<PoultryLot>();
  const [selectedLot, setSelectedLot] = useState<PoultryLot>();
  const [history, setHistory] = useState<'recent' | 'all'>('recent');
  const lots = lotsQuery.data ?? [];
  const movements = (movesQuery.data ?? []).slice().sort((a, b) => +new Date(b.movementDate) - +new Date(a.movementDate)).slice(0, history === 'recent' ? 6 : undefined);
  const saveLot = (d: { label: string; kind: PoultryLot['kind']; receivedAt: string; source: string; breed: string; ageWeeks?: number; initialCount?: number }) => {
    if (editing) updateLot.mutate({ lotId: editing.id, data: { label: d.label, source: d.source || null, breed: d.breed || null, ageWeeks: d.ageWeeks ?? null } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey()); setModal(null); setEditing(undefined); } });
    else createLot.mutate({ data: { label: d.label, kind: d.kind, receivedAt: d.receivedAt, source: d.source || undefined, breed: d.breed || undefined, ageWeeks: d.ageWeeks, initialCount: d.initialCount! } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()); setModal(null); } });
  };
  const saveDispatch = (data: { quantity: number; movementDate: string; counterparty: string; reason: 'sale' | 'transfer' | 'mortality' | 'other' }) => selectedLot && dispatch.mutate({ lotId: selectedLot.id, data: { ...data, counterparty: data.counterparty || undefined } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()); setModal(null); setSelectedLot(undefined); } });
  const remove = (m: PoultryMovement) => { if (window.confirm(`Excluir o registro de ${m.quantity} aves?`)) deleteMove.mutate({ movementId: m.id }, { onSuccess: () => refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()) }); };
  const reload = () => { void summary.refetch(); void lotsQuery.refetch(); void movesQuery.refetch(); };
  return <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">CADERNO DO GALINHEIRO</div><h1>As aves da granja</h1><p>Entradas, saídas e lotes num só lugar.</p></div><div className="heading-action"><button className="button primary" onClick={() => { setEditing(undefined); setModal('lot'); }} data-testid="button-new-lot"><Plus size={17} />Novo lote</button></div></div>
    <section className="flock-hero"><div><span className="hero-kicker"><Egg size={15} /> RETRATO DO PLANTEL</span><h2>Um lote de cada vez.</h2><p>Registre a chegada e acompanhe quantas aves seguem no galinheiro.</p></div><div className="flock-numbers"><div><span>LOTES ATIVOS</span><b data-testid="text-active-lots">{summary.isLoading ? '—' : summary.data?.activeLotCount ?? '—'}</b></div><div><span>AVES NO PLANTEL</span><b data-testid="text-live-birds">{summary.isLoading ? '—' : summary.data?.liveBirdCount ?? '—'}</b></div></div></section>
    <div className="poultry-layout">
      <section className="surface-card"><div className="section-title-row"><div><div className="eyebrow">LOTES CADASTRADOS</div><h2>Quem está no galinheiro</h2></div><button className="button secondary compact-button" onClick={() => { setEditing(undefined); setModal('lot'); }}><Plus size={15} />Adicionar</button></div>
        <PanelState loading={lotsQuery.isLoading || summary.isLoading} error={lotsQuery.isError || summary.isError} retry={reload} empty={!lotsQuery.isLoading && !lotsQuery.isError && !lots.length}>{lots.map(lot => <article className="lot-card" key={lot.id} data-testid={`card-poultry-lot-${lot.id}`}><div className="lot-card-top"><span className="lot-icon"><Bird size={19} /></span><div className="lot-title"><b>{lot.label}</b><small>{kindName[lot.kind]}{lot.breed ? ` · ${lot.breed}` : ''}</small></div><span className="lot-count">{lot.currentCount}<small>aves</small></span></div><div className="lot-meta"><span>Chegaram {shortDate(lot.receivedAt)}</span>{lot.ageWeeks !== null && <span>{lot.ageWeeks} sem.</span>}{lot.source && <span>De {lot.source}</span>}</div><div className="lot-actions"><button className="button secondary" onClick={() => { setSelectedLot(lot); setModal('dispatch'); }} disabled={lot.currentCount <= 0} data-testid={`button-dispatch-${lot.id}`}><ArrowUpRight size={15} />Registrar saída</button><button className="icon-button small-icon" onClick={() => { setEditing(lot); setModal('lot'); }} aria-label={`Editar ${lot.label}`} data-testid={`button-edit-lot-${lot.id}`}><Pencil size={15} /></button></div></article>)}</PanelState>
      </section>
      <section className="surface-card flock-history"><div className="section-title-row"><div><div className="eyebrow">CADERNO DE MOVIMENTOS</div><h2>Chegadas e saídas</h2></div><div className="segmented"><button className={history === 'recent' ? 'selected' : ''} onClick={() => setHistory('recent')}>Recentes</button><button className={history === 'all' ? 'selected' : ''} onClick={() => setHistory('all')}>Tudo</button></div></div>
        <PanelState loading={movesQuery.isLoading} error={movesQuery.isError} retry={() => { void movesQuery.refetch(); }} empty={!movesQuery.isLoading && !movesQuery.isError && !(movesQuery.data ?? []).length}>{movements.map(m => <div className="flock-movement" key={m.id} data-testid={`row-poultry-movement-${m.id}`}><span className={`flock-movement-icon ${m.direction}`}>{m.direction === 'in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</span><span className="flock-movement-detail"><b>{m.lotLabel}</b><small>{m.direction === 'in' ? 'Chegada' : reasonName[m.reason ?? 'other']}{m.counterparty ? ` · ${m.counterparty}` : ''} · {shortDate(m.movementDate)}</small></span><b className={`flock-quantity ${m.direction}`}>{m.direction === 'in' ? '+' : '−'}{m.quantity}</b><button className="icon-button small-icon danger-icon" aria-label="Excluir movimento" onClick={() => remove(m)} disabled={deleteMove.isPending} data-testid={`button-delete-poultry-movement-${m.id}`}><Trash2 size={15} /></button></div>)}</PanelState>
      </section>
    </div>
    {modal === 'lot' && <FormModal title={editing ? 'Editar lote' : 'Registrar chegada'} eyebrow="AVES · LOTE" close={() => { setModal(null); setEditing(undefined); }}><PoultryLotForm key={editing?.id ?? 'new'} initial={editing} busy={createLot.isPending || updateLot.isPending} close={() => { setModal(null); setEditing(undefined); }} save={saveLot} /></FormModal>}
    {modal === 'dispatch' && selectedLot && <FormModal title="Registrar saída" eyebrow="AVES · MOVIMENTO" close={() => { setModal(null); setSelectedLot(undefined); }}><DispatchForm lot={selectedLot} busy={dispatch.isPending} close={() => { setModal(null); setSelectedLot(undefined); }} save={saveDispatch} /></FormModal>}
  </div>;
}

function RecipeForm({ initial, products, busy, close, save }: { initial?: FeedRecipe; products: Product[]; busy: boolean; close: () => void; save: (data: { name: string; ingredients: { productId: number; quantityKg: number }[] }) => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ingredients, setIngredients] = useState<{ productId: number; quantityKg: string }[]>(initial?.ingredients.map(i => ({ productId: i.productId, quantityKg: String(i.quantityKg) })) ?? []);
  const addIngredient = (id: number) => setIngredients(old => old.some(i => i.productId === id) ? old : [...old, { productId: id, quantityKg: '' }]);
  const selectedIds = new Set(ingredients.map(i => i.productId));
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); save({ name: name.trim(), ingredients: ingredients.filter(i => Number(i.quantityKg) > 0).map(i => ({ productId: i.productId, quantityKg: Number(i.quantityKg) })) }); }}>
    <label className="field-label">Nome da receita<input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Mistura de postura" data-testid="input-recipe-name" /></label>
    <div className="field-label">Ingredientes <span className="optional">adicione os produtos do estoque</span>
      {products.length ? <div className="ingredient-picks">{products.map(p => <button type="button" key={p.id} disabled={selectedIds.has(p.id)} onClick={() => addIngredient(p.id)} data-testid={`button-add-ingredient-${p.id}`}><Plus size={14} />{p.name}<small>{p.quantity} {p.unit}</small></button>)}</div> : <p className="field-hint">Cadastre produtos de alimentação no estoque primeiro.</p>}
    </div>
    {ingredients.map(item => { const p = products.find(x => x.id === item.productId); return <div className="ingredient-line" key={item.productId}><span><b>{p?.name ?? `Produto ${item.productId}`}</b><small>Disponível: {p?.quantity ?? '—'} {p?.unit ?? ''}</small></span><label className="field-label">Quantidade (kg)<input type="number" required min="0.01" step="any" value={item.quantityKg} onChange={e => setIngredients(old => old.map(i => i.productId === item.productId ? { ...i, quantityKg: e.target.value } : i))} placeholder="kg" /></label><button type="button" className="icon-button small-icon danger-icon" aria-label={`Remover ${p?.name ?? 'ingrediente'}`} onClick={() => setIngredients(old => old.filter(i => i.productId !== item.productId))}><X size={15} /></button></div>; })}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !name.trim() || !ingredients.length || ingredients.some(i => !Number(i.quantityKg))} data-testid="button-save-recipe">{busy ? 'Salvando…' : initial ? 'Salvar receita' : 'Salvar receita'}</button></div>
  </form>;
}

function FeedLogForm({ lots, recipes, busy, close, save }: { lots: PoultryLot[]; recipes: FeedRecipe[]; busy: boolean; close: () => void; save: (data: { lotId: number; recipeId: number; quantityKg: number; feedingDate: string }) => void }) {
  const [lotId, setLot] = useState(lots[0]?.id ?? 0);
  const [recipeId, setRecipe] = useState(recipes[0]?.id ?? 0);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(day());
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); save({ lotId: Number(lotId), recipeId: Number(recipeId), quantityKg: Number(quantity), feedingDate: date }); }}>
    {!lots.length || !recipes.length ? <p className="field-hint">Para registrar o consumo, cadastre um lote de aves e uma receita primeiro.</p> : <>
      <label className="field-label">Qual lote recebeu a ração?<div className="product-choice-list">{lots.map(l => <button type="button" key={l.id} className={`product-choice ${Number(lotId) === l.id ? 'selected' : ''}`} onClick={() => setLot(l.id)}><span className="product-choice-name">{l.label}</span><span>{l.currentCount} aves</span></button>)}</div></label>
      <label className="field-label">Qual receita?<div className="product-choice-list">{recipes.map(r => <button type="button" key={r.id} className={`product-choice ${Number(recipeId) === r.id ? 'selected' : ''}`} onClick={() => setRecipe(r.id)}><span className="product-choice-name">{r.name}</span><span>{r.costPerKg !== null ? `${cash(r.costPerKg)}/kg` : `${r.batchWeightKg} kg por lote`}</span></button>)}</div></label>
      <div className="form-row"><label className="field-label">Quantidade usada<input type="number" required min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="kg" data-testid="input-feed-quantity" /></label><label className="field-label">Data<input type="date" required value={date} onChange={e => setDate(e.target.value)} /></label></div>
    </>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !lots.length || !recipes.length || !quantity} data-testid="button-save-feed-log">{busy ? 'Registrando…' : 'Registrar consumo'}</button></div>
  </form>;
}

export function FeedingPage() {
  const summary = useGetFeedingSummary();
  const recipesQuery = useGetFeedRecipes();
  const logsQuery = useGetFeedLogs();
  const lotsQuery = useGetPoultryLots();
  const productsQuery = useGetProducts();
  const createRecipe = useCreateFeedRecipe();
  const updateRecipe = useUpdateFeedRecipe();
  const deleteRecipe = useDeleteFeedRecipe();
  const createLog = useCreateFeedLog();
  const deleteLog = useDeleteFeedLog();
  const refresh = useRefresh();
  const [modal, setModal] = useState<'recipe' | 'log' | null>(null);
  const [editing, setEditing] = useState<FeedRecipe>();
  const recipes = recipesQuery.data ?? [];
  const logs = (logsQuery.data ?? []).slice().sort((a, b) => +new Date(b.feedingDate) - +new Date(a.feedingDate));
  const invalidateRecipe = () => refresh(getGetFeedRecipesQueryKey(), getGetProductsQueryKey());
  const saveRecipe = (d: { name: string; ingredients: { productId: number; quantityKg: number }[] }) => {
    if (editing) updateRecipe.mutate({ recipeId: editing.id, data: d }, { onSuccess: () => { invalidateRecipe(); setModal(null); setEditing(undefined); } });
    else createRecipe.mutate({ data: d }, { onSuccess: () => { invalidateRecipe(); setModal(null); } });
  };
  const saveLog = (d: { lotId: number; recipeId: number; quantityKg: number; feedingDate: string }) => createLog.mutate({ data: d }, { onSuccess: () => { refresh(getGetFeedLogsQueryKey(), getGetFeedingSummaryQueryKey(), getGetFeedRecipesQueryKey(), getGetProductsQueryKey()); setModal(null); } });
  const removeRecipe = (r: FeedRecipe) => { if (window.confirm(`Excluir a receita “${r.name}”?`)) deleteRecipe.mutate({ recipeId: r.id }, { onSuccess: invalidateRecipe }); };
  const removeLog = (l: FeedLog) => { if (window.confirm(`Excluir o consumo de ${l.quantityKg} kg?`)) deleteLog.mutate({ logId: l.id }, { onSuccess: () => refresh(getGetFeedLogsQueryKey(), getGetFeedingSummaryQueryKey(), getGetFeedRecipesQueryKey(), getGetProductsQueryKey()) }); };
  const retry = () => { void summary.refetch(); void recipesQuery.refetch(); void logsQuery.refetch(); };
  return <div className="page-content">
    <div className="page-heading"><div><div className="eyebrow">CADERNO DE ALIMENTAÇÃO</div><h1>Ração, do jeito certo</h1><p>Receitas, consumo por lote e custo sem fazer conta no papel.</p></div><div className="heading-action"><button className="button secondary" onClick={() => setModal('log')} data-testid="button-new-feed-log"><Wheat size={16} />Anotar consumo</button><button className="button primary" onClick={() => { setEditing(undefined); setModal('recipe'); }} data-testid="button-new-recipe"><Plus size={17} />Nova receita</button></div></div>
    {summary.isError && <div className="query-warning" role="alert" data-testid="status-feeding-summary-error">O resumo do consumo não carregou. <button onClick={() => { void summary.refetch(); }} data-testid="button-retry-feeding-summary">Tentar novamente</button></div>}
    <div className="feeding-banner"><div className="feed-banner-copy"><span className="hero-kicker"><Wheat size={15} /> CUIDADO DE TODO DIA</span><h2>Alimentar bem começa<br />com uma boa anotação.</h2><p>Veja o que cada lote consumiu e quanto isso representa.</p></div><div className="feeding-stats">
      <div><span>CONSUMO HOJE</span><b>{summary.isLoading ? '—' : `${(summary.data?.todayQuantityKg ?? 0).toLocaleString('pt-BR')} kg`}</b><small>{summary.data?.logsToday ?? 0} registros</small></div>
      <div><span>CUSTO DE HOJE</span><b>{summary.isLoading ? '—' : summary.data?.todayCost === null || summary.data?.todayCost === undefined ? '—' : cash(summary.data.todayCost)}</b><small>com custo conhecido</small></div>
      <div><span>CUSTO NO MÊS</span><b>{summary.isLoading ? '—' : summary.data?.monthCost === null || summary.data?.monthCost === undefined ? '—' : cash(summary.data.monthCost)}</b><small>consumo registrado</small></div>
    </div></div>
    <div className="feeding-columns">
      <section className="surface-card recipe-section"><div className="section-title-row"><div><div className="eyebrow">MISTURAS DA GRANJA</div><h2>Receitas de ração</h2></div><button className="icon-add-button" onClick={() => { setEditing(undefined); setModal('recipe'); }} aria-label="Nova receita" data-testid="button-add-recipe"><Plus size={19} /></button></div>
        <PanelState loading={recipesQuery.isLoading} error={recipesQuery.isError} retry={retry} empty={!recipesQuery.isLoading && !recipesQuery.isError && !recipes.length}>{recipes.map(r => <article className="recipe-card" key={r.id} data-testid={`card-recipe-${r.id}`}><div className="recipe-card-head"><span className="recipe-mark"><Wheat size={18} /></span><div><b>{r.name}</b><small>{r.batchWeightKg.toLocaleString('pt-BR')} kg por mistura</small></div><div className="recipe-actions"><button className="icon-button small-icon" aria-label={`Editar ${r.name}`} onClick={() => { setEditing(r); setModal('recipe'); }} data-testid={`button-edit-recipe-${r.id}`}><Pencil size={15} /></button><button className="icon-button small-icon danger-icon" aria-label={`Excluir ${r.name}`} onClick={() => removeRecipe(r)} disabled={deleteRecipe.isPending} data-testid={`button-delete-recipe-${r.id}`}><Trash2 size={15} /></button></div></div><div className="recipe-ingredients">{r.ingredients.map(i => <span key={i.productId}>{i.productName}<b>{i.quantityKg.toLocaleString('pt-BR')} kg</b></span>)}</div><div className="recipe-cost"><span><Coins size={14} /> Custo da mistura</span><b>{r.costPerBatch === null ? 'Sem custo informado' : `${cash(r.costPerBatch)} por lote`} {r.costPerKg !== null && <small>· {cash(r.costPerKg)}/kg</small>}</b></div></article>)}</PanelState>
        {recipes.length > 0 && <div className="recipe-footnote">O custo usa o valor por unidade cadastrado nos produtos do estoque.</div>}
      </section>
      <section className="surface-card logs-section"><div className="section-title-row"><div><div className="eyebrow">HISTÓRICO DE CONSUMO</div><h2>O que foi servido</h2></div><button className="button secondary compact-button" onClick={() => setModal('log')}><Plus size={15} />Anotar</button></div>
        <PanelState loading={logsQuery.isLoading} error={logsQuery.isError} retry={() => { void logsQuery.refetch(); }} empty={!logsQuery.isLoading && !logsQuery.isError && !logs.length}>{logs.map(log => <article className="feed-log-row" key={log.id} data-testid={`row-feed-log-${log.id}`}><span className="feed-log-icon"><Wheat size={17} /></span><span className="feed-log-copy"><b>{log.lotLabel}</b><small>{log.recipeName} · {shortDate(log.feedingDate)}</small></span><span className="feed-log-total"><b>{log.quantityKg.toLocaleString('pt-BR')} kg</b><small>{log.totalCost === null ? 'Custo indisponível' : cash(log.totalCost)}</small></span><button className="icon-button small-icon danger-icon" aria-label="Excluir consumo" onClick={() => removeLog(log)} disabled={deleteLog.isPending} data-testid={`button-delete-feed-log-${log.id}`}><Trash2 size={15} /></button></article>)}</PanelState>
      </section>
    </div>
    {modal === 'recipe' && <FormModal title={editing ? 'Editar receita' : 'Nova receita'} eyebrow="ALIMENTAÇÃO · MISTURA" close={() => { setModal(null); setEditing(undefined); }}><RecipeForm key={editing?.id ?? 'new'} initial={editing} products={(productsQuery.data ?? []).filter(p => p.category === 'feed')} busy={createRecipe.isPending || updateRecipe.isPending} close={() => { setModal(null); setEditing(undefined); }} save={saveRecipe} /></FormModal>}
    {modal === 'log' && <FormModal title="Anotar consumo" eyebrow="ALIMENTAÇÃO · REGISTRO" close={() => setModal(null)}><FeedLogForm lots={(lotsQuery.data ?? []).filter(l => l.currentCount > 0)} recipes={recipes} busy={createLog.isPending} close={() => setModal(null)} save={saveLog} /></FormModal>}
  </div>;
}