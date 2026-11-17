import { useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetPoultrySummary, getGetPoultrySummaryQueryKey, useGetPoultryLots, getGetPoultryLotsQueryKey,
  useCreatePoultryLot, useUpdatePoultryLot, useCreatePoultryDispatch,
  useGetPoultryMovements, getGetPoultryMovementsQueryKey, useDeletePoultryMovement,
  useGetFeedingSummary, getGetFeedingSummaryQueryKey, useGetFeedRecipes, getGetFeedRecipesQueryKey,
  useCreateFeedRecipe, useUpdateFeedRecipe, useDeleteFeedRecipe,
  useGetFeedLogs, getGetFeedLogsQueryKey, useCreateFeedLog, useDeleteFeedLog,
  useGetProducts, getGetProductsQueryKey, getGetDashboardQueryKey, getGetMovementsQueryKey,
  useCreateProduct,
} from '@workspace/api-client-react';
import type { PoultryLot, PoultryMovement, FeedRecipe, FeedLog, Product } from '@workspace/api-client-react';
import {
  ArrowDownLeft, ArrowUpRight, Bird, ChevronLeft, ChevronRight, Coins, Egg, Plus,
  RotateCcw, Trash2, Pencil, Wheat, X,
} from 'lucide-react';

const cash = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
const day = () => new Date().toISOString().slice(0, 10);
const shortDate = (s: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${s.slice(0, 10)}T12:00:00`));
const kindName: Record<string, string> = { layers: 'Poedeiras', broilers: 'Corte', chicks: 'Pintinhos', other: 'Outras' };
const reasonName: Record<string, string> = { sale: 'Venda', transfer: 'Transferência', mortality: 'Mortalidade', other: 'Outro' };
const quickLotNames = ['Galpão 1 — Poedeiras', 'Galpão 2 — Corte', 'Pinteiro Novo'];
const quickBreeds = ['Isa Brown', 'Caipirão', 'Embrapa 051'];
const quickCounts = [50, 100, 150, 250];
const quickDispatchCounts = [1, 2, 5, 10, 20];
const quickFeedKg = [5, 10, 15, 25, 50];

function useRefresh() {
  const qc = useQueryClient();
  return (...keys: ReadonlyArray<readonly unknown[]>) => keys.forEach(queryKey => { void qc.invalidateQueries({ queryKey }); });
}

function FormModal({ title, eyebrow, close, children }: { title: string; eyebrow: string; close: () => void; children: ReactNode }) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="modal" role="dialog" aria-modal="true" aria-label={title} data-testid="dialog-form">
        <div className="modal-head">
          <div className="modal-head-titles">
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button modal-close-btn"
            aria-label="Fechar"
            onClick={close}
            data-testid="button-close-modal"
          >
            <X size={26} />
          </button>
        </div>
        <div className="modal-body-scroll">
          {children}
        </div>
      </section>
    </div>,
    document.body
  );
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
    <label className="field-label">Nome do lote<input autoFocus required value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex.: Galpão 1" data-testid="input-lot-label" />
      {!initial && <div className="suggestion-row">{quickLotNames.map(item => <button type="button" key={item} onClick={() => setLabel(item)} className="suggestion-chip">{item}</button>)}</div>}
    </label>
    {!initial && <div className="field-label">Tipo de ave<div className="choice-grid">{choices.map(k => <button type="button" key={k} onClick={() => setKind(k)} className={`choice-pill ${kind === k ? 'selected' : ''}`} data-testid={`choice-lot-${k}`}>{kindName[k]}</button>)}</div></div>}
    <div className="form-row">
      {!initial && <label className="field-label">Quantidade de aves<input required type="number" min="1" step="1" value={count} onChange={e => setCount(e.target.value)} placeholder="Qtd" data-testid="input-lot-count" />
        <div className="suggestion-row">{quickCounts.map(n => <button type="button" key={n} onClick={() => setCount(String(n))} className="suggestion-chip">+{n}</button>)}</div>
      </label>}
      {!initial && <label className="field-label">Chegada<input required type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} data-testid="input-lot-date" /></label>}
    </div>
    <div className="form-row">
      <label className="field-label">Raça <span className="optional">opcional</span><input value={breed} onChange={e => setBreed(e.target.value)} placeholder="Ex.: Isa Brown" />
        <div className="suggestion-row">{quickBreeds.map(b => <button type="button" key={b} onClick={() => setBreed(b)} className="suggestion-chip">{b}</button>)}</div>
      </label>
      <label className="field-label">Idade (semanas)<input type="number" min="0" step="1" value={age} onChange={e => setAge(e.target.value)} placeholder="Ex.: 8" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !label.trim() || (!initial && !count)} data-testid="button-save-lot">{busy ? 'Salvando…' : initial ? 'Salvar' : 'Cadastrar Lote'}</button></div>
  </form>;
}

function DispatchForm({ lot, busy, close, save }: { lot: PoultryLot; busy: boolean; close: () => void; save: (input: { quantity: number; movementDate: string; counterparty: string; reason: 'sale' | 'transfer' | 'mortality' | 'other' }) => void }) {
  const [quantity, setQuantity] = useState('');
  const [movementDate, setDate] = useState(day());
  const [reason, setReason] = useState<'sale' | 'transfer' | 'mortality' | 'other'>('sale');
  const [counterparty, setCounterparty] = useState('');
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); save({ quantity: Number(quantity), movementDate, counterparty: counterparty.trim(), reason }); }}>
    <div className="lot-capacity"><Bird size={28} /><span>{lot.label}</span><b>{lot.currentCount} aves</b></div>
    <div className="field-label">Motivo da saída<div className="choice-grid">{(['sale', 'transfer', 'mortality', 'other'] as const).map(r => <button type="button" key={r} className={`choice-pill ${reason === r ? 'selected' : ''}`} onClick={() => setReason(r)}>{reasonName[r]}</button>)}</div></div>
    <div className="form-row">
      <label className="field-label">Quantas aves saíram?<input required type="number" min="1" max={lot.currentCount} step="1" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Qtd" data-testid="input-dispatch-quantity" />
        <div className="suggestion-row">
          {quickDispatchCounts.filter(n => n <= lot.currentCount).map(n => <button type="button" key={n} onClick={() => setQuantity(String(n))} className="suggestion-chip">{n}</button>)}
          {lot.currentCount > 0 && <button type="button" onClick={() => setQuantity(String(lot.currentCount))} className="suggestion-chip">Todas ({lot.currentCount})</button>}
        </div>
      </label>
      <label className="field-label">Data<input required type="date" value={movementDate} onChange={e => setDate(e.target.value)} /></label>
    </div>
    <label className="field-label">Observação / Destino <span className="optional">opcional</span><input value={counterparty} onChange={e => setCounterparty(e.target.value)} placeholder="Comprador ou motivo" /></label>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={busy || !quantity || Number(quantity) > lot.currentCount} data-testid="button-save-dispatch">{busy ? 'Salvando…' : 'Confirmar Saída'}</button></div>
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
  const [subView, setSubView] = useState<'lots' | 'history'>('lots');

  const lots = lotsQuery.data ?? [];
  const movements = (movesQuery.data ?? []).slice().sort((a, b) => +new Date(b.movementDate) - +new Date(a.movementDate));

  const saveLot = (d: { label: string; kind: PoultryLot['kind']; receivedAt: string; source: string; breed: string; ageWeeks?: number; initialCount?: number }) => {
    if (editing) updateLot.mutate({ lotId: editing.id, data: { label: d.label, source: d.source || null, breed: d.breed || null, ageWeeks: d.ageWeeks ?? null } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey()); setModal(null); setEditing(undefined); } });
    else createLot.mutate({ data: { label: d.label, kind: d.kind, receivedAt: d.receivedAt, source: d.source || undefined, breed: d.breed || undefined, ageWeeks: d.ageWeeks, initialCount: d.initialCount! } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()); setModal(null); } });
  };
  const saveDispatch = (data: { quantity: number; movementDate: string; counterparty: string; reason: 'sale' | 'transfer' | 'mortality' | 'other' }) => selectedLot && dispatch.mutate({ lotId: selectedLot.id, data: { ...data, counterparty: data.counterparty || undefined } }, { onSuccess: () => { refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()); setModal(null); setSelectedLot(undefined); } });
  const remove = (m: PoultryMovement) => { if (window.confirm(`Excluir o registro de ${m.quantity} aves?`)) deleteMove.mutate({ movementId: m.id }, { onSuccess: () => refresh(getGetPoultryLotsQueryKey(), getGetPoultrySummaryQueryKey(), getGetPoultryMovementsQueryKey()) }); };

  return <div className="screen-panel">
    <div className="screen-header">
      <div>
        <span className="screen-kicker"><Egg size={22} /> TELA 3 · AVES DO PLANTEL</span>
        <h1>Aves no Galinheiro</h1>
      </div>
      <div className="screen-header-actions">
        <div className="big-stat-badge">
          <span>LOTES</span>
          <b data-testid="text-active-lots">{summary.data?.activeLotCount ?? 0}</b>
        </div>
        <div className="big-stat-badge highlight">
          <span>AVES VIVAS</span>
          <b data-testid="text-live-birds">{summary.data?.liveBirdCount ?? 0}</b>
        </div>
        <button className="button primary giant-btn" onClick={() => { setEditing(undefined); setModal('lot'); }} data-testid="button-new-lot">
          <Plus size={26} /> Novo Lote
        </button>
      </div>
    </div>

    <div className="subview-bar">
      <div className="segmented-giant">
        <button type="button" className={subView === 'lots' ? 'selected' : ''} onClick={() => setSubView('lots')}>
          Lotes ({lots.length})
        </button>
        <button type="button" className={subView === 'history' ? 'selected' : ''} onClick={() => setSubView('history')}>
          Saídas e Chegadas ({movements.length})
        </button>
      </div>
    </div>

    <div className="screen-body">
      {subView === 'lots' ? (
        lotsQuery.isLoading ? <div className="giant-empty">Carregando lotes…</div> :
        lotsQuery.isError ? <div className="giant-empty"><button className="button secondary" onClick={() => { void lotsQuery.refetch(); }} data-testid="button-retry"><RotateCcw size={24} /> Tentar de novo</button></div> :
        lots.length === 0 ? <div className="giant-empty"><p>Nenhum lote cadastrado.</p><button className="button primary giant-btn" onClick={() => setModal('lot')}><Plus size={26} /> Cadastrar 1º Lote</button></div> :
        <div className="giant-cards-grid two-cols">
          {lots.map(lot => (
            <article className="giant-lot-card" key={lot.id} data-testid={`card-poultry-lot-${lot.id}`}>
              <div className="giant-lot-top">
                <span className="giant-icon-box"><Bird size={32} /></span>
                <div className="giant-lot-info">
                  <b>{lot.label}</b>
                  <span>{kindName[lot.kind]}{lot.breed ? ` · ${lot.breed}` : ''} · Chegou {shortDate(lot.receivedAt)}</span>
                </div>
                <div className="giant-lot-count">
                  <strong>{lot.currentCount}</strong>
                  <small>de {lot.initialCount} aves</small>
                </div>
              </div>
              <div className="giant-lot-actions">
                <button className="button secondary giant-action-btn" onClick={() => { setSelectedLot(lot); setModal('dispatch'); }} disabled={lot.currentCount <= 0} data-testid={`button-dispatch-${lot.id}`}>
                  <ArrowUpRight size={24} /> Dar Saída / Baixa
                </button>
                <button className="icon-button giant-icon-btn" onClick={() => { setEditing(lot); setModal('lot'); }} aria-label={`Editar ${lot.label}`} data-testid={`button-edit-lot-${lot.id}`}>
                  <Pencil size={24} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        movements.length === 0 ? <div className="giant-empty">Nenhuma movimentação registrada.</div> :
        <div className="giant-list">
          {movements.map(m => (
            <div className="giant-list-row" key={m.id} data-testid={`row-poultry-movement-${m.id}`}>
              <span className={`giant-dir-badge ${m.direction}`}>
                {m.direction === 'in' ? <ArrowDownLeft size={26} /> : <ArrowUpRight size={26} />}
              </span>
              <div className="giant-row-main">
                <b>{m.lotLabel}</b>
                <span>{m.direction === 'in' ? 'Chegada' : reasonName[m.reason ?? 'other']}{m.counterparty ? ` · ${m.counterparty}` : ''} · {shortDate(m.movementDate)}</span>
              </div>
              <strong className={`giant-row-val ${m.direction}`}>{m.direction === 'in' ? '+' : '−'}{m.quantity} aves</strong>
              <button className="icon-button giant-icon-btn danger-icon" aria-label="Excluir movimento" onClick={() => remove(m)} disabled={deleteMove.isPending} data-testid={`button-delete-poultry-movement-${m.id}`}>
                <Trash2 size={24} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

    {modal === 'lot' && <FormModal title={editing ? 'Editar Lote' : 'Novo Lote de Aves'} eyebrow="AVES · PLANTEL" close={() => { setModal(null); setEditing(undefined); }}><PoultryLotForm key={editing?.id ?? 'new'} initial={editing} busy={createLot.isPending || updateLot.isPending} close={() => { setModal(null); setEditing(undefined); }} save={saveLot} /></FormModal>}
    {modal === 'dispatch' && selectedLot && <FormModal title="Registrar Saída de Aves" eyebrow="AVES · BAIXA" close={() => { setModal(null); setSelectedLot(undefined); }}><DispatchForm lot={selectedLot} busy={dispatch.isPending} close={() => { setModal(null); setSelectedLot(undefined); }} save={saveDispatch} /></FormModal>}
  </div>;
}

function QuickAddFeedForm({
  busy,
  close,
  onSaved,
}: {
  busy: boolean;
  close: () => void;
  onSaved?: (productName: string) => void;
}) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('50');
  const [cost, setCost] = useState('2.50');
  const [error, setError] = useState<string | null>(null);
  const createProduct = useCreateProduct();
  const refresh = useRefresh();

  const quickFeeds = ['Ração Postura', 'Ração Inicial', 'Ração Crescimento', 'Milho em Grão', 'Farelo de Soja', 'Núcleo Postura'];
  const quickQtys = [25, 50, 100, 250, 500];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da ração.');
      return;
    }
    const q = Number(quantity);
    if (!q || q <= 0) {
      setError('Informe uma quantidade válida em kg.');
      return;
    }
    setError(null);
    createProduct.mutate(
      {
        data: {
          name: name.trim(),
          category: 'feed',
          unit: 'kg',
          quantity: q,
          unitCost: cost ? Number(cost) : undefined,
        },
      },
      {
        onSuccess: () => {
          refresh(
            getGetProductsQueryKey(),
            getGetFeedRecipesQueryKey(),
            getGetDashboardQueryKey(),
            getGetMovementsQueryKey()
          );
          onSaved?.(name.trim());
          close();
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error ||
            err?.message ||
            'Erro ao adicionar ração ao estoque.';
          setError(msg);
        },
      }
    );
  };

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {error && (
        <div className="login-error" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}
      <label className="field-label">
        Nome da ração
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Ração Postura"
          data-testid="input-quick-feed-name"
        />
        <div className="suggestion-row">
          {quickFeeds.map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setName(f)}
              className="suggestion-chip"
            >
              {f}
            </button>
          ))}
        </div>
      </label>

      <div className="form-row">
        <label className="field-label">
          Quantidade (kg)
          <input
            required
            type="number"
            min="0.1"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="50"
            data-testid="input-quick-feed-qty"
          />
          <div className="suggestion-row">
            {quickQtys.map((kg) => (
              <button
                type="button"
                key={kg}
                onClick={() => setQuantity(String(kg))}
                className="suggestion-chip"
              >
                +{kg} kg
              </button>
            ))}
          </div>
        </label>

        <label className="field-label">
          Preço por kg (R$) <span className="optional">opcional</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Ex.: 2.50"
            data-testid="input-quick-feed-cost"
          />
        </label>
      </div>

      <p className="field-hint" style={{ marginTop: 4 }}>
        💡 Essa ração será cadastrada no seu estoque e ficará imediatamente pronta para você dar baixa ao servir suas aves.
      </p>

      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || createProduct.isPending || !name.trim()}
          data-testid="button-save-quick-feed"
        >
          {busy || createProduct.isPending ? 'Salvando no Estoque…' : 'Salvar no Estoque'}
        </button>
      </div>
    </form>
  );
}

function RecipeForm({
  initial,
  products,
  busy,
  close,
  save,
  openAddFeed,
}: {
  initial?: FeedRecipe;
  products: Product[];
  busy: boolean;
  close: () => void;
  save: (data: { name: string; ingredients: { productId: number; quantityKg: number }[] }) => void;
  openAddFeed: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [ingredients, setIngredients] = useState<{ productId: number; quantityKg: string }[]>(
    initial?.ingredients.map((i) => ({ productId: i.productId, quantityKg: String(i.quantityKg) })) ?? []
  );
  const [error, setError] = useState<string | null>(null);
  const addIngredient = (id: number) =>
    setIngredients((old) => (old.some((i) => i.productId === id) ? old : [...old, { productId: id, quantityKg: '' }]));
  const selectedIds = new Set(ingredients.map((i) => i.productId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da receita.');
      return;
    }
    const validIngs = ingredients
      .filter((i) => Number(i.quantityKg) > 0)
      .map((i) => ({ productId: i.productId, quantityKg: Number(i.quantityKg) }));
    if (!validIngs.length) {
      setError('Adicione pelo menos um ingrediente com peso válido em kg.');
      return;
    }
    setError(null);
    save({ name: name.trim(), ingredients: validIngs });
  };

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
      <label className="field-label">
        Nome da receita
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Ração Postura"
          data-testid="input-recipe-name"
        />
        {!initial && (
          <div className="suggestion-row">
            {['Mistura Postura', 'Mistura Engorda', 'Ração Pintinhos'].map((s) => (
              <button type="button" key={s} onClick={() => setName(s)} className="suggestion-chip">
                {s}
              </button>
            ))}
          </div>
        )}
      </label>
      <div className="field-label">
        Toque nos ingredientes (em kg)
        {products.length ? (
          <div className="ingredient-picks">
            {products.map((p) => (
              <button
                type="button"
                key={p.id}
                disabled={selectedIds.has(p.id)}
                onClick={() => addIngredient(p.id)}
                data-testid={`button-add-ingredient-${p.id}`}
              >
                <Plus size={20} />
                {p.name} ({p.quantity} kg)
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 8 }}>
            <p className="field-hint" style={{ marginBottom: 10 }}>
              Você ainda não tem ingredientes cadastrados no seu estoque.
            </p>
            <button
              type="button"
              className="button secondary giant-btn"
              onClick={openAddFeed}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Plus size={22} /> + Adicionar Ração / Ingrediente ao Estoque
            </button>
          </div>
        )}
      </div>
      {ingredients.map((item) => {
        const p = products.find((x) => x.id === item.productId);
        return (
          <div className="ingredient-line" key={item.productId}>
            <span>
              <b>{p?.name ?? `Item ${item.productId}`}</b>
              <small>Estoque: {p?.quantity ?? '—'} kg</small>
            </span>
            <label className="field-label">
              Quilos (kg)
              <input
                type="number"
                required
                min="0.01"
                step="any"
                value={item.quantityKg}
                onChange={(e) =>
                  setIngredients((old) =>
                    old.map((i) => (i.productId === item.productId ? { ...i, quantityKg: e.target.value } : i))
                  )
                }
                placeholder="kg"
              />
            </label>
            <button
              type="button"
              className="icon-button giant-icon-btn danger-icon"
              aria-label={`Remover ${p?.name ?? 'ingrediente'}`}
              onClick={() => setIngredients((old) => old.filter((i) => i.productId !== item.productId))}
            >
              <X size={24} />
            </button>
          </div>
        );
      })}
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || !name.trim() || !ingredients.length || ingredients.some((i) => !Number(i.quantityKg))}
          data-testid="button-save-recipe"
        >
          {busy ? 'Salvando…' : 'Salvar Receita'}
        </button>
      </div>
    </form>
  );
}

function FeedLogForm({
  lots,
  recipes,
  feedProducts,
  busy,
  close,
  save,
  openAddFeed,
  openNewLot,
}: {
  lots: PoultryLot[];
  recipes: FeedRecipe[];
  feedProducts: Product[];
  busy: boolean;
  close: () => void;
  save: (
    data: { lotId: number; recipeId: number; quantityKg: number; feedingDate: string },
    onError: (msg: string) => void
  ) => void;
  openAddFeed: () => void;
  openNewLot: () => void;
}) {
  const [lotId, setLot] = useState<number>(() => lots[0]?.id ?? 0);
  const [recipeId, setRecipe] = useState<number>(() => recipes[0]?.id ?? 0);
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(day());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if ((!lotId || !lots.some((l) => l.id === lotId)) && lots.length > 0) {
      setLot(lots[0].id);
    }
  }, [lots, lotId]);

  useEffect(() => {
    if ((!recipeId || !recipes.some((r) => r.id === recipeId)) && recipes.length > 0) {
      setRecipe(recipes[0].id);
    }
  }, [recipes, recipeId]);

  const selectedRecipe = recipes.find((r) => r.id === Number(recipeId));
  const estimatedCost =
    selectedRecipe?.costPerKg != null && Number(quantity) > 0
      ? selectedRecipe.costPerKg * Number(quantity)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotId) {
      setError('Selecione um lote de aves ativo.');
      return;
    }
    if (!recipeId) {
      setError('Selecione a ração a ser servida.');
      return;
    }
    const q = Number(quantity);
    if (!q || q <= 0) {
      setError('Informe a quantidade de ração em kg.');
      return;
    }
    setError(null);
    save(
      {
        lotId: Number(lotId),
        recipeId: Number(recipeId),
        quantityKg: q,
        feedingDate: date,
      },
      (msg) => setError(msg)
    );
  };

  if (!lots.length) {
    return (
      <div className="modal-form">
        <div className="login-error" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
          <b>Nenhum lote de aves ativo</b>
          <p style={{ marginTop: 6, fontSize: '0.95rem' }}>
            Para servir ração, é necessário ter pelo menos um lote de aves cadastrado no galinheiro.
          </p>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="button primary" onClick={openNewLot}>
            <Plus size={22} /> Cadastrar Lote Agora
          </button>
        </div>
      </div>
    );
  }

  if (!recipes.length) {
    return (
      <div className="modal-form">
        <div className="login-error" style={{ background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}>
          <b>Nenhuma ração no estoque</b>
          <p style={{ marginTop: 6, fontSize: '0.95rem' }}>
            Você ainda não cadastrou nenhuma ração no seu estoque para dar baixa.
          </p>
        </div>
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button type="button" className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button type="button" className="button primary" onClick={openAddFeed}>
            <Plus size={22} /> + Adicionar Ração ao Estoque
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="modal-form" onSubmit={handleSubmit}>
      {error && (
        <div className="login-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <label className="field-label">
        1. Escolha o lote de aves
        <div className="product-choice-list">
          {lots.map((l) => (
            <button
              type="button"
              key={l.id}
              className={`product-choice ${Number(lotId) === l.id ? 'selected' : ''}`}
              onClick={() => {
                setLot(l.id);
                setError(null);
              }}
            >
              <span className="product-choice-name">{l.label}</span>
              <span>{l.currentCount} aves</span>
            </button>
          ))}
        </div>
      </label>

      <label className="field-label">
        2. Escolha a ração
        <div className="product-choice-list">
          {recipes.map((r) => (
            <button
              type="button"
              key={r.id}
              className={`product-choice ${Number(recipeId) === r.id ? 'selected' : ''}`}
              onClick={() => {
                setRecipe(r.id);
                setError(null);
              }}
            >
              <span className="product-choice-name">{r.name}</span>
              <span>
                {r.costPerKg !== null
                  ? `${cash(r.costPerKg)}/kg`
                  : `${r.batchWeightKg} kg`}
              </span>
            </button>
          ))}
        </div>
      </label>

      {selectedRecipe && selectedRecipe.ingredients.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '-4px 0 8px 0' }}>
          {selectedRecipe.ingredients.map((ing) => (
            <span key={ing.productId} className="giant-ing-pill" style={{ fontSize: '0.88rem' }}>
              {ing.productName}: <b>{ing.availableQuantity ?? 0} kg disp.</b>
            </span>
          ))}
        </div>
      )}

      <div className="form-row">
        <label className="field-label">
          3. Quantos quilos (kg)?
          <input
            type="number"
            required
            min="0.01"
            step="any"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setError(null);
            }}
            placeholder="kg"
            data-testid="input-feed-quantity"
          />
          <div className="suggestion-row">
            {quickFeedKg.map((kg) => (
              <button
                type="button"
                key={kg}
                onClick={() => {
                  setQuantity(String(kg));
                  setError(null);
                }}
                className="suggestion-chip"
              >
                {kg} kg
              </button>
            ))}
          </div>
        </label>
        <label className="field-label">
          Data
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {estimatedCost !== null && (
            <span className="field-hint">
              Custo do trato: <b>{cash(estimatedCost)}</b>
            </span>
          )}
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || !lots.length || !recipes.length || !quantity}
          data-testid="button-save-feed-log"
        >
          {busy ? 'Dando Baixa…' : 'Confirmar Trato e Dar Baixa'}
        </button>
      </div>
    </form>
  );
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
  const [modal, setModal] = useState<'recipe' | 'log' | 'add-stock' | null>(null);
  const [editing, setEditing] = useState<FeedRecipe>();
  const [subView, setSubView] = useState<'recipes' | 'logs'>('recipes');

  const recipes = recipesQuery.data ?? [];
  const logs = (logsQuery.data ?? []).slice().sort((a, b) => +new Date(b.feedingDate) - +new Date(a.feedingDate));
  const feedProducts = (productsQuery.data ?? []).filter(
    (p) => p.category === 'feed' && (p.unit.toLowerCase().includes('kg') || p.unit.toLowerCase() === 'quilo')
  );

  const invalidateRecipe = () => refresh(getGetFeedRecipesQueryKey(), getGetProductsQueryKey(), getGetDashboardQueryKey());

  const saveRecipe = (d: { name: string; ingredients: { productId: number; quantityKg: number }[] }) => {
    if (editing) {
      updateRecipe.mutate(
        { recipeId: editing.id, data: d },
        {
          onSuccess: () => {
            invalidateRecipe();
            setModal(null);
            setEditing(undefined);
          },
        }
      );
    } else {
      createRecipe.mutate(
        { data: d },
        {
          onSuccess: () => {
            invalidateRecipe();
            setModal(null);
          },
        }
      );
    }
  };

  const saveLog = (
    d: { lotId: number; recipeId: number; quantityKg: number; feedingDate: string },
    onError: (msg: string) => void
  ) => {
    createLog.mutate(
      { data: d },
      {
        onSuccess: () => {
          refresh(
            getGetFeedLogsQueryKey(),
            getGetFeedingSummaryQueryKey(),
            getGetFeedRecipesQueryKey(),
            getGetProductsQueryKey(),
            getGetMovementsQueryKey(),
            getGetDashboardQueryKey()
          );
          setModal(null);
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error ||
            err?.message ||
            'Erro ao registrar trato e dar baixa no estoque.';
          onError(msg);
        },
      }
    );
  };

  const removeRecipe = (r: FeedRecipe) => {
    if (window.confirm(`Excluir a receita “${r.name}”?`)) {
      deleteRecipe.mutate({ recipeId: r.id }, { onSuccess: invalidateRecipe });
    }
  };

  const removeLog = (l: FeedLog) => {
    if (window.confirm(`Excluir o consumo de ${l.quantityKg} kg? O estoque será devolvido automaticamente.`)) {
      deleteLog.mutate(
        { logId: l.id },
        {
          onSuccess: () =>
            refresh(
              getGetFeedLogsQueryKey(),
              getGetFeedingSummaryQueryKey(),
              getGetFeedRecipesQueryKey(),
              getGetProductsQueryKey(),
              getGetMovementsQueryKey(),
              getGetDashboardQueryKey()
            ),
        }
      );
    }
  };

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <div>
          <span className="screen-kicker"><Wheat size={22} /> TELA 4 · RAÇÃO E TRATO</span>
          <h1>Alimentação Diária</h1>
        </div>
        <div className="screen-header-actions">
          <div className="big-stat-badge">
            <span>HOJE</span>
            <b>{(summary.data?.todayQuantityKg ?? 0).toLocaleString('pt-BR')} kg</b>
          </div>
          <div className="big-stat-badge highlight">
            <span>CUSTO MÊS</span>
            <b>{summary.data?.monthCost == null ? '—' : cash(summary.data.monthCost)}</b>
          </div>
          <button
            className="button primary giant-btn"
            onClick={() => setModal('add-stock')}
            data-testid="button-quick-add-feed"
          >
            <Plus size={24} /> Adicionar Ração
          </button>
          <button
            className="button secondary giant-btn"
            onClick={() => setModal('log')}
            data-testid="button-new-feed-log"
          >
            <Wheat size={24} /> Servir Ração
          </button>
          <button
            className="button secondary giant-btn"
            onClick={() => {
              setEditing(undefined);
              setModal('recipe');
            }}
            data-testid="button-new-recipe"
          >
            <Pencil size={24} /> Nova Receita
          </button>
        </div>
      </div>

      <div className="subview-bar">
        <div className="segmented-giant">
          <button
            type="button"
            className={subView === 'recipes' ? 'selected' : ''}
            onClick={() => setSubView('recipes')}
          >
            Receitas de Ração ({recipes.length})
          </button>
          <button
            type="button"
            className={subView === 'logs' ? 'selected' : ''}
            onClick={() => setSubView('logs')}
          >
            Consumo Diário ({logs.length})
          </button>
        </div>
      </div>

      <div className="screen-body">
        {subView === 'recipes' ? (
          recipes.length === 0 ? (
            <div className="giant-empty">
              <p>Nenhuma ração ou receita cadastrada ainda.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 12 }}>
                <button
                  className="button primary giant-btn"
                  onClick={() => setModal('add-stock')}
                >
                  <Plus size={24} /> + Adicionar Ração ao Estoque
                </button>
                <button
                  className="button secondary giant-btn"
                  onClick={() => setModal('recipe')}
                >
                  <Pencil size={24} /> Criar Receita Personalizada
                </button>
              </div>
            </div>
          ) : (
            <div className="giant-cards-grid two-cols">
              {recipes.map((r) => (
                <article className="giant-lot-card" key={r.id} data-testid={`card-recipe-${r.id}`}>
                  <div className="giant-lot-top">
                    <span className="giant-icon-box amber">
                      <Wheat size={30} />
                    </span>
                    <div className="giant-lot-info">
                      <b>{r.name}</b>
                      <span>
                        {r.batchWeightKg.toLocaleString('pt-BR')} kg por batida ·{' '}
                        {r.costPerKg !== null ? `${cash(r.costPerKg)}/kg` : 'Sem custo'}
                      </span>
                    </div>
                    <div className="giant-lot-actions-inline">
                      <button
                        className="icon-button giant-icon-btn"
                        aria-label={`Editar ${r.name}`}
                        onClick={() => {
                          setEditing(r);
                          setModal('recipe');
                        }}
                        data-testid={`button-edit-recipe-${r.id}`}
                      >
                        <Pencil size={24} />
                      </button>
                      <button
                        className="icon-button giant-icon-btn danger-icon"
                        aria-label={`Excluir ${r.name}`}
                        onClick={() => removeRecipe(r)}
                        disabled={deleteRecipe.isPending}
                        data-testid={`button-delete-recipe-${r.id}`}
                      >
                        <Trash2 size={24} />
                      </button>
                    </div>
                  </div>
                  <div className="giant-ingredients-wrap">
                    {r.ingredients.map((i) => (
                      <span key={i.productId} className="giant-ing-pill">
                        {i.productName}: <b>{i.quantityKg} kg</b>
                      </span>
                    ))}
                  </div>
                  <div className="giant-recipe-foot">
                    <Coins size={22} />
                    <b>
                      {r.costPerBatch === null
                        ? 'Informe o preço nos produtos'
                        : `Custo da batida: ${cash(r.costPerBatch)}`}
                    </b>
                  </div>
                </article>
              ))}
            </div>
          )
        ) : logs.length === 0 ? (
          <div className="giant-empty">
            <p>Nenhum trato registrado.</p>
            <button className="button primary giant-btn" onClick={() => setModal('log')}>
              <Wheat size={26} /> Servir Ração Agora
            </button>
          </div>
        ) : (
          <div className="giant-list">
            {logs.map((log) => (
              <article className="giant-list-row" key={log.id} data-testid={`row-feed-log-${log.id}`}>
                <span className="giant-dir-badge in">
                  <Wheat size={26} />
                </span>
                <div className="giant-row-main">
                  <b>{log.lotLabel}</b>
                  <span>
                    {log.recipeName} · {shortDate(log.feedingDate)}
                  </span>
                </div>
                <div className="giant-row-right">
                  <strong>{log.quantityKg.toLocaleString('pt-BR')} kg</strong>
                  <small>{log.totalCost === null ? '—' : cash(log.totalCost)}</small>
                </div>
                <button
                  className="icon-button giant-icon-btn danger-icon"
                  aria-label="Excluir consumo"
                  onClick={() => removeLog(log)}
                  disabled={deleteLog.isPending}
                  data-testid={`button-delete-feed-log-${log.id}`}
                >
                  <Trash2 size={24} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {modal === 'add-stock' && (
        <FormModal
          title="Adicionar Ração ao Estoque"
          eyebrow="RAÇÃO · ENTRADA"
          close={() => setModal(null)}
        >
          <QuickAddFeedForm
            busy={false}
            close={() => setModal(null)}
          />
        </FormModal>
      )}

      {modal === 'recipe' && (
        <FormModal
          title={editing ? 'Editar Receita' : 'Nova Receita de Ração'}
          eyebrow="RAÇÃO · FÓRMULA"
          close={() => {
            setModal(null);
            setEditing(undefined);
          }}
        >
          <RecipeForm
            key={editing?.id ?? 'new'}
            initial={editing}
            products={feedProducts}
            busy={createRecipe.isPending || updateRecipe.isPending}
            close={() => {
              setModal(null);
              setEditing(undefined);
            }}
            save={saveRecipe}
            openAddFeed={() => setModal('add-stock')}
          />
        </FormModal>
      )}

      {modal === 'log' && (
        <FormModal
          title="Servir Ração ao Lote"
          eyebrow="RAÇÃO · TRATO E BAIXA"
          close={() => setModal(null)}
        >
          <FeedLogForm
            lots={(lotsQuery.data ?? []).filter((l) => l.currentCount > 0)}
            recipes={recipes}
            feedProducts={feedProducts}
            busy={createLog.isPending}
            close={() => setModal(null)}
            save={saveLog}
            openAddFeed={() => setModal('add-stock')}
            openNewLot={() => {
              setModal(null);
              window.location.hash = '#/aves';
            }}
          />
        </FormModal>
      )}
    </div>
  );
}
