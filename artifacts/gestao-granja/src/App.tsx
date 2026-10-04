import { type ReactNode, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Check, ChevronRight,
  CircleDollarSign, ClipboardList, Coins, CreditCard, Egg, Layers3, Leaf, Menu, Package,
  Plus, Search, Sprout, Trash2, TrendingDown, TrendingUp, Wallet, X, Pencil, AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useGetDashboard, getGetDashboardQueryKey, useGetProducts, getGetProductsQueryKey,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useGetMovements,
  getGetMovementsQueryKey, useCreateMovement, useDeleteMovement, useGetFinanceEntries,
  getGetFinanceEntriesQueryKey, useCreateFinanceEntry, useUpdateFinanceEntry,
  useDeleteFinanceEntry,
} from '@workspace/api-client-react';
import type { Product, Movement, FinanceEntry } from '@workspace/api-client-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import NotFound from '@/pages/not-found';
import { PoultryPage, FeedingPage } from '@/pages/poultry-feeding';

const queryClient = new QueryClient();

const categoryNames: Record<string, string> = {
  feed: 'Alimentação', medicine: 'Remédios', supplies: 'Insumos',
  equipment: 'Equipamentos', other: 'Outros',
};
const quickProducts = ['Ração', 'Milho', 'Soja', 'Núcleo', 'Sal', 'Calcário', 'Remédios'];
const financeCategories = ['Ração e alimentação', 'Remédios', 'Insumos', 'Equipamentos', 'Venda de ovos', 'Outros'];
const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateBR = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
const today = () => new Date().toISOString().slice(0, 10);

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const active = location === '/estoque' ? 'estoque' : location === '/contas' ? 'contas' : location === '/aves' ? 'aves' : location === '/alimentacao' ? 'alimentacao' : 'inicio';
  const nav = [
    { id: 'inicio', href: '/', label: 'Visão geral', icon: Sprout },
    { id: 'estoque', href: '/estoque', label: 'Estoque', icon: Package },
    { id: 'aves', href: '/aves', label: 'Aves', icon: Egg },
    { id: 'alimentacao', href: '/alimentacao', label: 'Alimentação', icon: Leaf },
    { id: 'contas', href: '/contas', label: 'Contas', icon: Wallet },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <Link href="/" className="brand" onClick={() => setMobileMenu(false)}>
        <span className="brand-mark"><Egg size={21} strokeWidth={1.8} /></span>
        <span><strong>granja</strong><small>caderno do dia a dia</small></span>
      </Link>
      <div className="farm-label">MINHA GRANJA</div>
      <nav className="side-nav" aria-label="Navegação principal">
        {nav.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => setMobileMenu(false)} data-testid={`link-${id}`}>
          <Icon size={19} strokeWidth={1.8} /><span>{label}</span>{active === id && <span className="nav-active-dot" />}
        </Link>)}
      </nav>
      <div className="sidebar-note">
        <div className="note-icon"><Leaf size={16} /></div>
        <p>Um registro de cada vez.<br /><b>A rotina fica mais leve.</b></p>
      </div>
      <div className="sidebar-bottom"><span className="sun-dot" />Feito para a vida no campo</div>
    </aside>
    {mobileMenu && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu-button" aria-label="Abrir menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={21} /></button>
        <div className="breadcrumb">Minha granja <ChevronRight size={14} /> <span>{nav.find(n => n.id === active)?.label}</span></div>
        <div className="today-chip"><CalendarDays size={15} />{new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</div>
      </header>
      <div className="page-wrap">{children}</div>
    </main>
    <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
      {nav.map(({ id, href, label, icon: Icon }) => <Link key={id} href={href} className={active === id ? 'mobile-active' : ''} data-testid={`mobile-link-${id}`}><Icon size={20} /><span>{label}</span></Link>)}
    </nav>
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function LoadingPanel() {
  return <div className="skeleton-panel" aria-label="Carregando"><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>;
}
function ErrorPanel({ retry }: { retry: () => void }) {
  return <div className="empty-state"><div className="empty-mark"><RotateCcw size={22} /></div><h3>Não foi possível carregar</h3><p>Confira sua conexão e tente novamente.</p><button className="button secondary" onClick={retry}>Tentar de novo</button></div>;
}
function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-mark"><ClipboardList size={23} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>
      {children}
    </section>
  </div>;
}

function ProductForm({ initial, onSave, busy, onClose }: { initial?: Product; onSave: (data: { name: string; category: Product['category']; unit: string; quantity: number; minimumQuantity: number | null; unitCost: number | null }) => void; busy: boolean; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Product['category']>(initial?.category ?? 'feed');
  const [unit, setUnit] = useState(initial?.unit ?? 'kg');
  const [quantity, setQuantity] = useState(initial?.quantity.toString() ?? '');
  const [minimum, setMinimum] = useState(initial?.minimumQuantity?.toString() ?? '');
  const [unitCost, setUnitCost] = useState(initial?.unitCost?.toString() ?? '');
  const categoryOptions: { key: Product['category']; label: string }[] = [
    { key: 'feed', label: 'Alimentação' }, { key: 'medicine', label: 'Remédios' },
    { key: 'supplies', label: 'Insumos' }, { key: 'equipment', label: 'Equipamentos' }, { key: 'other', label: 'Outros' },
  ];
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ name: name.trim(), category, unit, quantity: Number(quantity), minimumQuantity: minimum ? Number(minimum) : null, unitCost: unitCost ? Number(unitCost) : null }); }}>
    <label className="field-label">Nome do produto<input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Ração postura" />
      {!initial && <div className="suggestion-row">{quickProducts.map(item => <button type="button" key={item} onClick={() => { setName(item); setCategory(item === 'Remédios' ? 'medicine' : item === 'Ração' ? 'feed' : 'supplies'); }} className="suggestion-chip">{item}</button>)}</div>}
    </label>
    <div className="field-label">Escolha o tipo<div className="choice-grid">{categoryOptions.map(opt => <button type="button" key={opt.key} className={`choice-pill ${category === opt.key ? 'selected' : ''}`} onClick={() => setCategory(opt.key)}>{opt.label}</button>)}</div></div>
    <div className="form-row">
      <label className="field-label">{initial ? 'Quantidade atual' : 'Quantidade'}<input required type="number" min="0" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" disabled={!!initial} />{initial && <span className="field-hint">Para ajustar, registre uma entrada ou saída.</span>}</label>
      <label className="field-label">Unidade<select value={unit} onChange={e => setUnit(e.target.value)}><option value="kg">Quilos (kg)</option><option value="un">Unidades</option><option value="L">Litros (L)</option><option value="saco">Sacos</option><option value="dúzia">Dúzias</option></select></label>
    </div>
    <label className="field-label">Avisar quando chegar a<input type="number" min="0" step="any" value={minimum} onChange={e => setMinimum(e.target.value)} placeholder="Opcional — estoque mínimo" /></label>
    <label className="field-label">Custo por unidade <span className="optional">opcional · usado nas receitas</span><input type="number" min="0" step="0.01" value={unitCost} onChange={e => setUnitCost(e.target.value)} placeholder="R$ 0,00" /></label>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !name.trim() || !quantity}>{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Adicionar ao estoque'}</button></div>
  </form>;
}

function MovementForm({ products, onSave, busy, onClose, preferred }: { products: Product[]; onSave: (data: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => void; busy: boolean; onClose: () => void; preferred?: 'in' | 'out' }) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [direction, setDirection] = useState<'in' | 'out'>(preferred ?? 'in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ productId: Number(productId), direction, quantity: Number(quantity), note: note.trim() }); }}>
    <div className="field-label">O que você vai registrar?<div className="toggle-row">
      <button type="button" className={`toggle-choice ${direction === 'in' ? 'selected in' : ''}`} onClick={() => setDirection('in')}><ArrowDownLeft size={17} />Entrou</button>
      <button type="button" className={`toggle-choice ${direction === 'out' ? 'selected out' : ''}`} onClick={() => setDirection('out')}><ArrowUpRight size={17} />Saiu</button>
    </div></div>
    <div className="field-label">Escolha o produto{products.length ? <div className="product-choice-list">{products.map(p => <button type="button" key={p.id} className={`product-choice ${Number(productId) === p.id ? 'selected' : ''}`} onClick={() => setProductId(p.id)}><span className="product-choice-name">{p.name}</span><span>{p.quantity} {p.unit}</span></button>)}</div> : <p className="field-hint">Adicione um produto ao estoque primeiro.</p>}</div>
    <div className="form-row">
      <label className="field-label">Quantidade<input type="number" required min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quanto?" /></label>
      <label className="field-label">Observação <span className="optional">opcional</span><input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex.: compra no mercado" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !products.length || !quantity}>{busy ? 'Registrando…' : 'Registrar movimento'}</button></div>
  </form>;
}

function FinanceForm({ onSave, busy, onClose, initial }: { onSave: (data: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => void; busy: boolean; onClose: () => void; initial?: FinanceEntry }) {
  const [kind, setKind] = useState<'payable' | 'receivable'>(initial?.kind ?? 'payable');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate.slice(0, 10) ?? today());
  const [category, setCategory] = useState(initial?.category ?? financeCategories[0]);
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ kind, description: description.trim(), amount: Number(amount), dueDate, category }); }}>
    <div className="field-label">É uma conta a…<div className="toggle-row">
      <button type="button" className={`toggle-choice ${kind === 'payable' ? 'selected out' : ''}`} onClick={() => setKind('payable')}><ArrowUpRight size={17} />Pagar</button>
      <button type="button" className={`toggle-choice ${kind === 'receivable' ? 'selected in' : ''}`} onClick={() => setKind('receivable')}><ArrowDownLeft size={17} />Receber</button>
    </div></div>
    <label className="field-label">Do que se trata?<input autoFocus required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Compra de ração" /></label>
    <div className="field-label">Categoria<div className="choice-grid">{financeCategories.map(item => <button type="button" key={item} className={`choice-pill ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <div className="form-row">
      <label className="field-label">Valor<input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="R$ 0,00" /></label>
      <label className="field-label">Vencimento<input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !description.trim() || !amount}>{busy ? 'Salvando…' : initial ? 'Salvar alterações' : 'Adicionar conta'}</button></div>
  </form>;
}

function useRefresh() {
  const qc = useQueryClient();
  return (...keys: ReadonlyArray<readonly unknown[]>) => keys.forEach(queryKey => { void qc.invalidateQueries({ queryKey }); });
}

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const { data: products = [] } = useGetProducts();
  const { data: movements = [] } = useGetMovements();
  const { data: finance = [] } = useGetFinanceEntries();
  const createMove = useCreateMovement();
  const createFinance = useCreateFinanceEntry();
  const createProduct = useCreateProduct();
  const refresh = useRefresh();
  const [modal, setModal] = useState<'movement' | 'finance' | 'product' | null>(null);
  const [preferred, setPreferred] = useState<'in' | 'out'>('in');
  const pendingBills = data?.pendingPayables ?? 0;
  const dueIn = data?.pendingReceivables ?? 0;
  const todayLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const onMovement = (input: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => createMove.mutate({ data: input }, { onSuccess: () => { refresh(getGetMovementsQueryKey(), getGetProductsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const onFinance = (input: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => createFinance.mutate({ data: input }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const onProduct = (input: { name: string; category: Product['category']; unit: string; quantity: number; minimumQuantity: number | null; unitCost: number | null }) => createProduct.mutate({ data: input }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const recent = (data?.recentFinanceEntries ?? []).slice(0, 4);
  return <div className="page-content">
    <PageHeading eyebrow="UM DIA DE CADA VEZ" title="Bom dia, vamos cuidar?" subtitle={`Seu resumo de hoje · ${todayLabel}`} />
    {isLoading ? <LoadingPanel /> : isError || !data ? <ErrorPanel retry={() => { void refetch(); }} /> : <>
      <section className="welcome-band">
        <div className="welcome-text"><span className="welcome-kicker"><span className="sun-dot" /> ROTINA EM DIA</span><h2>Um olhar rápido,<br /><em>e você já sabe.</em></h2><p>Estoque, contas e pequenos cuidados — tudo no seu lugar.</p></div>
        <div className="welcome-art" aria-hidden="true"><div className="art-sun" /><div className="art-hill hill-one" /><div className="art-hill hill-two" /><div className="coop"><div className="coop-roof" /><div className="coop-body"><span /><span /><span /></div><div className="coop-door" /></div><div className="art-grass">〰　〰　〰</div></div>
        <div className="welcome-date"><CalendarDays size={14} />{new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(new Date())}</div>
      </section>
      <section className="quick-actions" aria-label="Ações rápidas">
        <button className="quick-action quick-green" onClick={() => { setPreferred('in'); setModal('movement'); }} data-testid="button-entrada"><span className="quick-icon"><ArrowDownLeft size={20} /></span><span><b>Entrada no estoque</b><small>Chegou produto novo?</small></span><ChevronRight size={17} /></button>
        <button className="quick-action quick-amber" onClick={() => { setPreferred('out'); setModal('movement'); }} data-testid="button-saida"><span className="quick-icon"><ArrowUpRight size={20} /></span><span><b>Saída do estoque</b><small>Usou algum produto?</small></span><ChevronRight size={17} /></button>
        <button className="quick-action quick-paper" onClick={() => setModal('finance')} data-testid="button-conta"><span className="quick-icon"><CircleDollarSign size={20} /></span><span><b>Anotar uma conta</b><small>A pagar ou a receber</small></span><ChevronRight size={17} /></button>
      </section>
      <section className="stats-grid">
        <div className="stat-card"><span className="stat-symbol green"><Package size={18} /></span><span className="stat-caption">PRODUTOS NO ESTOQUE</span><strong>{data.productCount}</strong><span className="stat-foot">itens acompanhados</span></div>
        <div className={`stat-card ${data.lowStockCount ? 'attention' : ''}`}><span className="stat-symbol amber"><AlertTriangle size={18} /></span><span className="stat-caption">PRECISAM DE ATENÇÃO</span><strong>{data.lowStockCount}</strong><span className="stat-foot">{data.lowStockCount ? 'abaixo do estoque mínimo' : 'estoque está tranquilo'}</span></div>
        <div className="stat-card"><span className="stat-symbol coral"><TrendingDown size={18} /></span><span className="stat-caption">CONTAS A PAGAR</span><strong>{money(pendingBills)}</strong><span className="stat-foot">em aberto</span></div>
        <div className="stat-card"><span className="stat-symbol blue"><TrendingUp size={18} /></span><span className="stat-caption">CONTAS A RECEBER</span><strong>{money(dueIn)}</strong><span className="stat-foot">em aberto</span></div>
      </section>
      <div className="dashboard-columns">
        <section className="surface-card low-stock-card">
          <div className="section-title-row"><div><div className="eyebrow">OLHO NO ESTOQUE</div><h2>Hora de repor?</h2></div><Link href="/estoque" className="text-link">Ver estoque <ChevronRight size={15} /></Link></div>
          {data.lowStockProducts.length ? <div className="low-stock-list">{data.lowStockProducts.slice(0, 4).map(product => <div className="low-stock-row" key={product.id}><span className="product-initial"><Package size={17} /></span><span className="low-prod-text"><b>{product.name}</b><small>{categoryNames[product.category] ?? product.category}</small></span><span className="low-prod-qty"><b>{product.quantity} {product.unit}</b><small>Mín. {product.minimumQuantity} {product.unit}</small></span><span className="stock-alert">Repor</span></div>)}</div> : <div className="calm-stock"><span><Check size={18} /></span><div><b>Tudo em ordem por aqui</b><small>Nenhum produto abaixo do mínimo.</small></div></div>}
        </section>
        <section className="surface-card recent-card">
          <div className="section-title-row"><div><div className="eyebrow">MOVIMENTAÇÃO</div><h2>Últimas contas</h2></div><Link href="/contas" className="text-link">Ver todas <ChevronRight size={15} /></Link></div>
          {recent.length ? <div className="recent-list">{recent.map(entry => <div className="recent-row" key={entry.id}><span className={`finance-mark ${entry.kind}`}><CircleDollarSign size={17} /></span><span className="recent-info"><b>{entry.description}</b><small>{entry.kind === 'payable' ? 'A pagar' : 'A receber'} · {dateBR(entry.dueDate)}</small></span><b className={`recent-amount ${entry.kind}`}>{entry.kind === 'payable' ? '−' : '+'}{money(entry.amount)}</b></div>)}</div> : <div className="mini-empty">Suas contas registradas aparecem aqui.</div>}
        </section>
      </div>
      <section className="notebook-strip"><div className="strip-icon"><Activity size={18} /></div><div><b>Seu caderno está ficando completo</b><span>{movements.length} {movements.length === 1 ? 'movimento registrado' : 'movimentos registrados'} · {finance.length} {finance.length === 1 ? 'conta anotada' : 'contas anotadas'}</span></div><button className="strip-action" onClick={() => setModal('product')}>Adicionar produto <Plus size={15} /></button></section>
    </>}
    {modal === 'movement' && <Modal title={preferred === 'in' ? 'Registrar entrada' : 'Registrar saída'} eyebrow="ESTOQUE · MOVIMENTO" onClose={() => setModal(null)}><MovementForm products={products} preferred={preferred} onClose={() => setModal(null)} busy={createMove.isPending} onSave={onMovement} /></Modal>}
    {modal === 'finance' && <Modal title="Anotar uma conta" eyebrow="CONTAS · NOVO REGISTRO" onClose={() => setModal(null)}><FinanceForm onClose={() => setModal(null)} busy={createFinance.isPending} onSave={onFinance} /></Modal>}
    {modal === 'product' && <Modal title="Novo produto" eyebrow="ESTOQUE · CADASTRO" onClose={() => setModal(null)}><ProductForm onClose={() => setModal(null)} busy={createProduct.isPending} onSave={onProduct} /></Modal>}
  </div>;
}

function StockPage() {
  const { data: products, isLoading, isError, refetch } = useGetProducts();
  const { data: movements, isLoading: movementsLoading } = useGetMovements();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createMovement = useCreateMovement();
  const deleteMovement = useDeleteMovement();
  const refresh = useRefresh();
  const [modal, setModal] = useState<'product' | 'movement' | null>(null);
  const [editing, setEditing] = useState<Product | undefined>();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('todos');
  const [movementTab, setMovementTab] = useState<'recent' | 'all'>('recent');
  const list = products ?? [];
  const visibleProducts = useMemo(() => list.filter(p => (filter === 'todos' || p.category === filter) && p.name.toLowerCase().includes(search.toLowerCase())), [list, filter, search]);
  const saveProduct = (input: { name: string; category: Product['category']; unit: string; quantity: number; minimumQuantity: number | null; unitCost: number | null }) => {
    if (editing) updateProduct.mutate({ productId: editing.id, data: { name: input.name, category: input.category, unit: input.unit, minimumQuantity: input.minimumQuantity, unitCost: input.unitCost } }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()); setEditing(undefined); setModal(null); } });
    else createProduct.mutate({ data: input }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  };
  const onMovement = (input: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => createMovement.mutate({ data: input }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetMovementsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const removeProduct = (p: Product) => { if (window.confirm(`Remover ${p.name} do estoque?`)) deleteProduct.mutate({ productId: p.id }, { onSuccess: () => refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()) }); };
  const removeMovement = (m: Movement) => { if (window.confirm('Excluir este movimento? O estoque será ajustado de volta.')) deleteMovement.mutate({ movementId: m.id }, { onSuccess: () => refresh(getGetMovementsQueryKey(), getGetProductsQueryKey(), getGetDashboardQueryKey()) }); };
  const cats = [['todos', 'Tudo'], ['feed', 'Alimentação'], ['medicine', 'Remédios'], ['supplies', 'Insumos'], ['equipment', 'Equipamentos'], ['other', 'Outros']];
  const currentMovements = (movements ?? []).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, movementTab === 'recent' ? 5 : undefined);
  return <div className="page-content">
    <PageHeading eyebrow="CADERNO DE ESTOQUE" title="O que temos à mão" subtitle="Produtos e insumos da sua granja, sem complicação." action={<><button className="button secondary" onClick={() => setModal('movement')}><ArrowLeftRight size={17} />Registrar movimento</button><button className="button primary" onClick={() => { setEditing(undefined); setModal('product'); }}><Plus size={17} />Novo produto</button></>} />
    <div className="stock-summary-row"><div className="stock-summary"><span className="summary-icon"><Layers3 size={18} /></span><span><small>PRODUTOS CADASTRADOS</small><b>{isLoading ? '—' : list.length}</b></span></div><div className="stock-summary"><span className="summary-icon warn"><AlertTriangle size={18} /></span><span><small>PRECISAM DE REPOSIÇÃO</small><b>{isLoading ? '—' : list.filter(p => p.minimumQuantity !== null && p.quantity <= p.minimumQuantity).length}</b></span></div><div className="stock-summary note-summary"><span>REGISTRE entradas quando comprar<br />e saídas quando usar.</span></div></div>
    <section className="surface-card stock-card">
      <div className="stock-toolbar"><div><div className="eyebrow">SEUS PRODUTOS</div><h2>Estoque atual</h2></div><label className="search-box"><Search size={17} /><input data-testid="input-search-products" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto" /></label></div>
      <div className="filter-tabs">{cats.map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`filter-tab ${filter === key ? 'selected' : ''}`}>{label}</button>)}</div>
      {isLoading ? <LoadingPanel /> : isError ? <ErrorPanel retry={() => { void refetch(); }} /> : visibleProducts.length === 0 ? <EmptyState title={search || filter !== 'todos' ? 'Nenhum produto encontrado' : 'Seu estoque começa por aqui'} text={search || filter !== 'todos' ? 'Tente outra busca ou categoria.' : 'Cadastre ração, remédios e outros itens que usa na granja.'} action={!search && filter === 'todos' ? <button className="button primary" onClick={() => setModal('product')}><Plus size={17} />Cadastrar primeiro produto</button> : undefined} /> : <>
        <div className="product-list-heading"><span>PRODUTO</span><span>QUANTIDADE ATUAL</span><span>SITUAÇÃO</span><span /></div>
        <div className="product-list">{visibleProducts.map(p => {
          const low = p.minimumQuantity !== null && p.quantity <= p.minimumQuantity;
          return <article className="product-row" key={p.id} data-testid={`row-product-${p.id}`}>
            <span className={`prod-avatar category-${p.category}`}><Package size={19} /></span>
            <span className="product-main"><b>{p.name}</b><small>{categoryNames[p.category] ?? p.category}</small></span>
            <span className="product-quantity"><b>{p.quantity}</b><small>{p.unit}</small>{p.minimumQuantity !== null && <em>Mín. {p.minimumQuantity} {p.unit}</em>}</span>
            <span><span className={`status-pill ${low ? 'status-low' : 'status-ok'}`}><span />{low ? 'Repor' : 'Em dia'}</span></span>
            <span className="row-actions"><button className="icon-button small-icon" aria-label={`Editar ${p.name}`} onClick={() => { setEditing(p); setModal('product'); }}><Pencil size={16} /></button><button className="icon-button small-icon danger-icon" aria-label={`Excluir ${p.name}`} onClick={() => removeProduct(p)} disabled={deleteProduct.isPending}><Trash2 size={16} /></button></span>
          </article>;
        })}</div>
      </>}
    </section>
    <section className="surface-card movements-card">
      <div className="section-title-row"><div><div className="eyebrow">HISTÓRICO DO ESTOQUE</div><h2>Entradas e saídas</h2></div><div className="segmented"><button className={movementTab === 'recent' ? 'selected' : ''} onClick={() => setMovementTab('recent')}>Recentes</button><button className={movementTab === 'all' ? 'selected' : ''} onClick={() => setMovementTab('all')}>Ver tudo</button></div></div>
      {movementsLoading ? <LoadingPanel /> : currentMovements.length ? <div className="movement-list">{currentMovements.map(m => <div className="movement-row" key={m.id}><span className={`movement-icon ${m.direction}`}><ArrowLeftRight size={17} /></span><span className="movement-detail"><b>{m.productName}</b><small>{m.note || (m.direction === 'in' ? 'Entrada no estoque' : 'Saída do estoque')} · {dateBR(m.createdAt)}</small></span><b className={`movement-qty ${m.direction}`}>{m.direction === 'in' ? '+' : '−'}{m.quantity}</b><button className="icon-button small-icon danger-icon" aria-label="Excluir movimento" onClick={() => removeMovement(m)}><Trash2 size={15} /></button></div>)}</div> : <div className="mini-empty">Ainda não há movimentos registrados.</div>}
    </section>
    {modal === 'product' && <Modal title={editing ? 'Editar produto' : 'Novo produto'} eyebrow="ESTOQUE · PRODUTO" onClose={() => { setModal(null); setEditing(undefined); }}><ProductForm key={editing?.id ?? 'new'} initial={editing} onClose={() => { setModal(null); setEditing(undefined); }} busy={createProduct.isPending || updateProduct.isPending} onSave={saveProduct} /></Modal>}
    {modal === 'movement' && <Modal title="Registrar movimento" eyebrow="ESTOQUE · ENTRADA OU SAÍDA" onClose={() => setModal(null)}><MovementForm products={list} onClose={() => setModal(null)} busy={createMovement.isPending} onSave={onMovement} /></Modal>}
  </div>;
}

function FinancePage() {
  const { data: entries, isLoading, isError, refetch } = useGetFinanceEntries();
  const createEntry = useCreateFinanceEntry();
  const updateEntry = useUpdateFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();
  const refresh = useRefresh();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | undefined>();
  const [tab, setTab] = useState<'all' | 'payable' | 'receivable'>('all');
  const rows = entries ?? [];
  const filtered = rows.filter(e => tab === 'all' || e.kind === tab).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const payables = rows.filter(e => e.kind === 'payable' && e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const receivables = rows.filter(e => e.kind === 'receivable' && e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const save = (input: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => {
    if (editing) updateEntry.mutate({ entryId: editing.id, data: { description: input.description, amount: input.amount, dueDate: input.dueDate, category: input.category } }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(false); setEditing(undefined); } });
    else createEntry.mutate({ data: input }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(false); } });
  };
  const toggleSettled = (entry: FinanceEntry) => updateEntry.mutate({ entryId: entry.id, data: { status: entry.status === 'pending' ? 'settled' : 'pending' } }, { onSuccess: () => refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()) });
  const remove = (entry: FinanceEntry) => { if (window.confirm(`Excluir a conta “${entry.description}”?`)) deleteEntry.mutate({ entryId: entry.id }, { onSuccess: () => refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()) }); };
  return <div className="page-content">
    <PageHeading eyebrow="CADERNO DE CONTAS" title="O que entra e o que sai" subtitle="Anote uma conta rapidinho. Você cuida do resto, a gente ajuda a lembrar." action={<button className="button primary" onClick={() => { setEditing(undefined); setModal(true); }}><Plus size={17} />Anotar conta</button>} />
    <div className="finance-overview">
      <div className="finance-total payable-total"><span className="finance-overview-icon"><ArrowUpRight size={19} /></span><div><small>AINDA PRECISA PAGAR</small><strong>{isLoading ? '—' : money(payables)}</strong><span>contas em aberto</span></div><div className="amount-decoration">−</div></div>
      <div className="finance-total receivable-total"><span className="finance-overview-icon"><ArrowDownLeft size={19} /></span><div><small>AINDA VAI RECEBER</small><strong>{isLoading ? '—' : money(receivables)}</strong><span>contas em aberto</span></div><div className="amount-decoration">+</div></div>
      <div className="finance-note"><span className="note-doodle"><Coins size={21} /></span><b>Dinheiro bem anotado<br />não pega de surpresa.</b><small>Marque como pago assim que resolver.</small></div>
    </div>
    <section className="surface-card finance-list-card">
      <div className="finance-list-head"><div><div className="eyebrow">SUAS ANOTAÇÕES</div><h2>Contas da granja</h2></div><div className="filter-tabs finance-tabs"><button className={`filter-tab ${tab === 'all' ? 'selected' : ''}`} onClick={() => setTab('all')}>Todas</button><button className={`filter-tab ${tab === 'payable' ? 'selected' : ''}`} onClick={() => setTab('payable')}>A pagar</button><button className={`filter-tab ${tab === 'receivable' ? 'selected' : ''}`} onClick={() => setTab('receivable')}>A receber</button></div></div>
      {isLoading ? <LoadingPanel /> : isError ? <ErrorPanel retry={() => { void refetch(); }} /> : filtered.length ? <div className="finance-list">
        {filtered.map(entry => <article className={`finance-entry ${entry.status === 'settled' ? 'settled-entry' : ''}`} key={entry.id} data-testid={`row-finance-${entry.id}`}>
          <span className={`finance-entry-icon ${entry.kind}`}><CreditCard size={19} /></span>
          <div className="finance-entry-main"><b>{entry.description}</b><span>{entry.category || 'Sem categoria'} <i>·</i> Vence {dateBR(entry.dueDate)}</span></div>
          <div className="finance-entry-amount"><b className={entry.kind}>{entry.kind === 'payable' ? '−' : '+'}{money(entry.amount)}</b><span className={`entry-status ${entry.status}`}>{entry.status === 'pending' ? 'Em aberto' : 'Resolvida'}</span></div>
          <div className="entry-actions"><button className="button settle-button" onClick={() => toggleSettled(entry)} disabled={updateEntry.isPending} data-testid={`button-settle-${entry.id}`}><Check size={15} />{entry.status === 'pending' ? 'Marcar resolvida' : 'Reabrir'}</button><button className="icon-button small-icon" aria-label={`Editar ${entry.description}`} onClick={() => { setEditing(entry); setModal(true); }}><Pencil size={15} /></button><button className="icon-button small-icon danger-icon" aria-label={`Excluir ${entry.description}`} onClick={() => remove(entry)} disabled={deleteEntry.isPending}><Trash2 size={15} /></button></div>
        </article>)}
      </div> : <EmptyState title={tab === 'all' ? 'Nenhuma conta anotada ainda' : 'Nada por aqui'} text={tab === 'all' ? 'Anote o que precisa pagar e o que tem para receber.' : 'Não encontramos contas nessa categoria.'} action={tab === 'all' ? <button className="button primary" onClick={() => setModal(true)}><Plus size={17} />Anotar primeira conta</button> : undefined} />}
    </section>
    <div className="finance-footnote"><span className="footnote-mark"><Wallet size={16} /></span><span>As contas resolvidas continuam anotadas para você consultar quando quiser.</span><span className="foot-count">{rows.filter(e => e.status === 'settled').length} resolvida(s)</span></div>
    {modal && <Modal title={editing ? 'Editar anotação' : 'Anotar uma conta'} eyebrow="CONTAS · REGISTRO" onClose={() => { setModal(false); setEditing(undefined); }}><FinanceForm key={editing?.id ?? 'new'} initial={editing} onSave={save} busy={createEntry.isPending || updateEntry.isPending} onClose={() => { setModal(false); setEditing(undefined); }} /></Modal>}
  </div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Shell><Switch>
    <Route path="/" component={DashboardPage} />
    <Route path="/estoque" component={StockPage} />
    <Route path="/contas" component={FinancePage} />
    <Route path="/aves" component={PoultryPage} />
    <Route path="/alimentacao" component={FeedingPage} />
    <Route component={NotFound} />
  </Switch></Shell></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;