import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Camera, Check, ChevronLeft, ChevronRight,
  CircleDollarSign, CreditCard, Database, Egg, ImagePlus, Leaf, Lock, LogOut, Package,
  Plus, Sparkles, Sprout, Trash2, TrendingDown, TrendingUp, UserCheck, UserPlus, Wallet, X, Pencil, AlertTriangle,
  RotateCcw, Bird, Wheat, Hand,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  setAuthTokenGetter,
  useGetDashboard, getGetDashboardQueryKey, useGetProducts, getGetProductsQueryKey,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useGetMovements,
  getGetMovementsQueryKey, useCreateMovement, useDeleteMovement, useGetFinanceEntries,
  getGetFinanceEntriesQueryKey, useCreateFinanceEntry, useUpdateFinanceEntry,
  useDeleteFinanceEntry, useGetPoultrySummary,
  useGetFeedingSummary, getGetFeedRecipesQueryKey,
} from '@workspace/api-client-react';
import type { Product, Movement, FinanceEntry } from '@workspace/api-client-react';
import { Router as WouterRouter, useLocation } from 'wouter';
import { PoultryPage, FeedingPage } from '@/pages/poultry-feeding';

const AUTH_STORAGE_KEY = 'granja_suenaga_token';
const AUTH_USER_KEY = 'granja_suenaga_user';

setAuthTokenGetter(() => localStorage.getItem(AUTH_STORAGE_KEY));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

interface AuthUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

type SystemStatus = {
  mode: 'supabase' | 'demo';
  connected: boolean;
  provider: string;
  hasDatabaseUrl: boolean;
  error: string | null;
};

interface ImageAnalysisResult {
  matchedInDb: boolean;
  similarity: number;
  matchedProduct: Product | null;
  suggestion: {
    name: string;
    category: Product['category'];
    unit: string;
    quantity: number;
    minimumQuantity: number | null;
    unitCost: number | null;
    reason: string;
  };
}

interface PreparedImageData {
  imageData: string;
  imageSignature: string;
  fileName: string;
}

async function extractImageFeatures(file: File): Promise<PreparedImageData> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });

  return new Promise<PreparedImageData>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        // 1. Create compact 140x140 thumbnail for fast database storage & display
        const thumbCanvas = document.createElement('canvas');
        const thumbSize = 140;
        thumbCanvas.width = thumbSize;
        thumbCanvas.height = thumbSize;
        const tCtx = thumbCanvas.getContext('2d');
        let compactDataUrl = dataUrl;
        if (tCtx) {
          tCtx.fillStyle = '#ffffff';
          tCtx.fillRect(0, 0, thumbSize, thumbSize);
          const scale = Math.max(thumbSize / img.width, thumbSize / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          tCtx.drawImage(img, (thumbSize - w) / 2, (thumbSize - h) / 2, w, h);
          compactDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.78);
        }

        // 2. Compute 4x4 spatial RGB signature (48 values) + global RGB + contrast stdDev
        const sigCanvas = document.createElement('canvas');
        const gridSize = 32;
        sigCanvas.width = gridSize;
        sigCanvas.height = gridSize;
        const sCtx = sigCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(img, 0, 0, gridSize, gridSize);
          const pixels = sCtx.getImageData(0, 0, gridSize, gridSize).data;
          const block = 8; // 4x4 blocks of 8x8 pixels
          const vector: number[] = [];
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          const lums: number[] = [];

          for (let by = 0; by < 4; by++) {
            for (let bx = 0; bx < 4; bx++) {
              let br = 0;
              let bg = 0;
              let bb = 0;
              let count = 0;
              for (let y = by * block; y < (by + 1) * block; y++) {
                for (let x = bx * block; x < (bx + 1) * block; x++) {
                  const idx = (y * gridSize + x) * 4;
                  const r = pixels[idx];
                  const g = pixels[idx + 1];
                  const b = pixels[idx + 2];
                  br += r;
                  bg += g;
                  bb += b;
                  totalR += r;
                  totalG += g;
                  totalB += b;
                  lums.push(0.299 * r + 0.587 * g + 0.114 * b);
                  count++;
                }
              }
              vector.push(
                Math.round(br / count),
                Math.round(bg / count),
                Math.round(bb / count),
              );
            }
          }

          const totalPixels = gridSize * gridSize;
          const avgR = Math.round(totalR / totalPixels);
          const avgG = Math.round(totalG / totalPixels);
          const avgB = Math.round(totalB / totalPixels);
          const meanLum = lums.reduce((a, b) => a + b, 0) / lums.length;
          const variance =
            lums.reduce((acc, l) => acc + (l - meanLum) ** 2, 0) / lums.length;
          const std = Math.round(Math.sqrt(variance));

          resolve({
            imageData: compactDataUrl,
            imageSignature: JSON.stringify({
              v: vector,
              rgb: [avgR, avgG, avgB],
              std,
              fn: file.name,
            }),
            fileName: file.name,
          });
          return;
        }
      } catch {
        // Fallback below
      }

      const fallbackVec = Array.from({ length: 48 }, (_, i) =>
        dataUrl.charCodeAt((i * 13) % dataUrl.length) % 255,
      );
      resolve({
        imageData: dataUrl,
        imageSignature: JSON.stringify({
          v: fallbackVec,
          rgb: [170, 145, 95],
          std: 42,
          fn: file.name,
        }),
        fileName: file.name,
      });
    };
    img.onerror = () => {
      const fallbackVec = Array.from({ length: 48 }, (_, i) =>
        dataUrl.charCodeAt((i * 13) % Math.max(1, dataUrl.length)) % 255,
      );
      resolve({
        imageData: dataUrl,
        imageSignature: JSON.stringify({
          v: fallbackVec,
          rgb: [170, 145, 95],
          std: 42,
          fn: file.name,
        }),
        fileName: file.name,
      });
    };
    img.src = dataUrl;
  });
}

async function analyzeProductImageOnServer(
  prepared: PreparedImageData,
): Promise<ImageAnalysisResult> {
  const token = localStorage.getItem(AUTH_STORAGE_KEY);
  const res = await fetch('/api/inventory/analyze-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      imageSignature: prepared.imageSignature,
      fileName: prepared.fileName,
    }),
  });
  if (!res.ok) {
    throw new Error('Falha ao analisar imagem');
  }
  return res.json() as Promise<ImageAnalysisResult>;
}

const categoryNames: Record<string, string> = {
  feed: 'Alimentação', medicine: 'Remédios', supplies: 'Insumos',
  equipment: 'Equipamentos', other: 'Outros',
};
const quickProducts = ['Ração Postura', 'Milho em Grão', 'Farelo de Soja', 'Núcleo Postura', 'Calcário', 'Vacina'];
const financeCategories = ['Venda de ovos', 'Ração e alimentação', 'Remédios', 'Insumos', 'Equipamentos', 'Outros'];
const quickFinancePayable = ['Compra de milho', 'Compra de soja', 'Compra de ração', 'Conta de luz'];
const quickFinanceReceivable = ['Venda de ovos', 'Venda na feira', 'Venda de frangos'];
const quickQuantities = [5, 10, 25, 50, 100];
const quickAmounts = [50, 100, 250, 500];

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateBR = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
const today = () => new Date().toISOString().slice(0, 10);
const addDaysToToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function useSystemStatus() {
  return useQuery<SystemStatus>({
    queryKey: ['/api/system/status'],
    queryFn: async () => {
      const res = await fetch('/api/system/status');
      if (!res.ok) throw new Error('Falha ao consultar status');
      return res.json() as Promise<SystemStatus>;
    },
    staleTime: 30000,
  });
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" aria-label="Fechar" onClick={onClose}><X size={30} /></button></div>
      {children}
    </section>
  </div>;
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser, token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('suenaga');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('1234');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: status } = useSystemStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || username.trim(),
          password: password.trim(),
        }),
      });
      const data = (await res.json()) as { token?: string; user?: AuthUser; error?: string };
      if (!res.ok || !data.token || !data.user) {
        setError(data.error || 'Não foi possível entrar. Confira usuário e senha.');
        setBusy(false);
        return;
      }
      localStorage.setItem(AUTH_STORAGE_KEY, data.token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
      onAuthenticated(data.user, data.token);
    } catch {
      setError('Erro de conexão com o servidor.');
      setBusy(false);
    }
  };

  return (
    <div className="login-viewport" data-testid="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-logo"><Egg size={40} /></span>
          <div>
            <span className="login-kicker">SISTEMA PROTEGIDO · SUPABASE</span>
            <h1>Granja Suenaga</h1>
          </div>
        </div>

        <div className="segmented-giant login-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'selected' : ''}
            onClick={() => { setMode('login'); setError(null); }}
            data-testid="tab-login"
          >
            <Lock size={24} /> Entrar
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'selected' : ''}
            onClick={() => { setMode('register'); setUsername(''); setPassword(''); setError(null); }}
            data-testid="tab-register"
          >
            <UserPlus size={24} /> Novo Usuário
          </button>
        </div>

        <form className="login-form" onSubmit={e => { void handleSubmit(e); }}>
          <label className="field-label">
            Usuário
            <input
              required
              autoFocus
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Ex.: suenaga"
              data-testid="input-login-username"
            />
          </label>

          {mode === 'register' && (
            <label className="field-label">
              Nome e Sobrenome (ex.: Gabriel Suenaga)
              <input
                required
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Ex.: Gabriel Suenaga"
                data-testid="input-register-displayname"
              />
            </label>
          )}

          <label className="field-label">
            Senha / PIN
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              data-testid="input-login-password"
            />
          </label>

          {error && <div className="login-error" role="alert" data-testid="text-login-error">{error}</div>}

          <button
            type="submit"
            className="button primary login-submit-btn"
            disabled={busy || !username.trim() || !password.trim()}
            data-testid="button-login-submit"
          >
            <UserCheck size={28} />
            {busy ? 'Entrando…' : mode === 'login' ? 'Entrar na Granja' : 'Cadastrar e Entrar'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              className="button secondary login-quick-btn"
              onClick={() => { setUsername('suenaga'); setPassword('1234'); }}
              data-testid="button-fill-default-login"
            >
              Preencher Acesso Padrão (suenaga / 1234)
            </button>
          )}
        </form>

        <div className="login-footer">
          <Database size={20} />
          <span>{status?.connected ? 'Banco Supabase Conectado e Ativo' : 'Conectando ao Supabase…'}</span>
        </div>
      </div>
    </div>
  );
}

function ProductForm({
  initial,
  initialPhotoData,
  initialAnalysis,
  onSave,
  busy,
  onClose,
}: {
  initial?: Product;
  initialPhotoData?: PreparedImageData | null;
  initialAnalysis?: ImageAnalysisResult | null;
  onSave: (data: {
    name: string;
    category: Product['category'];
    unit: string;
    quantity: number;
    minimumQuantity: number | null;
    unitCost: number | null;
    imageData?: string | null;
    imageSignature?: string | null;
  }) => void;
  busy: boolean;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(
    initial?.name ?? initialAnalysis?.suggestion.name ?? '',
  );
  const [category, setCategory] = useState<Product['category']>(
    initial?.category ?? initialAnalysis?.suggestion.category ?? 'feed',
  );
  const [unit, setUnit] = useState(
    initial?.unit ?? initialAnalysis?.suggestion.unit ?? 'kg',
  );
  const [quantity, setQuantity] = useState(
    initial?.quantity.toString() ??
      (initialAnalysis ? String(initialAnalysis.suggestion.quantity) : ''),
  );
  const [minimum, setMinimum] = useState(
    initial?.minimumQuantity?.toString() ??
      (initialAnalysis?.suggestion.minimumQuantity != null
        ? String(initialAnalysis.suggestion.minimumQuantity)
        : ''),
  );
  const [unitCost, setUnitCost] = useState(
    initial?.unitCost?.toString() ??
      (initialAnalysis?.suggestion.unitCost != null
        ? String(initialAnalysis.suggestion.unitCost)
        : ''),
  );
  const [imageData, setImageData] = useState<string | null>(
    initialPhotoData?.imageData ?? initial?.imageData ?? null,
  );
  const [imageSignature, setImageSignature] = useState<string | null>(
    initialPhotoData?.imageSignature ?? initial?.imageSignature ?? null,
  );
  const [analysisBanner, setAnalysisBanner] = useState<string | null>(
    initialAnalysis?.suggestion.reason ?? null,
  );
  const [matchedInDb, setMatchedInDb] = useState<boolean>(
    initialAnalysis?.matchedInDb ?? false,
  );
  const [analyzingImage, setAnalyzingImage] = useState(false);

  const categoryOptions: { key: Product['category']; label: string }[] = [
    { key: 'feed', label: 'Alimentação' },
    { key: 'medicine', label: 'Remédios' },
    { key: 'supplies', label: 'Insumos' },
    { key: 'equipment', label: 'Equipamentos' },
    { key: 'other', label: 'Outros' },
  ];

  const applySuggestion = (item: string) => {
    setName(item);
    if (item.includes('Vacina')) {
      setCategory('medicine');
      setUnit('un');
    } else {
      setCategory('feed');
      setUnit('kg');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzingImage(true);
    try {
      const prepared = await extractImageFeatures(file);
      setImageData(prepared.imageData);
      setImageSignature(prepared.imageSignature);

      const analysis = await analyzeProductImageOnServer(prepared);
      setName(analysis.suggestion.name);
      setCategory(analysis.suggestion.category);
      setUnit(analysis.suggestion.unit);
      if (!initial && !quantity) {
        setQuantity(String(analysis.suggestion.quantity));
      }
      if (analysis.suggestion.minimumQuantity != null) {
        setMinimum(String(analysis.suggestion.minimumQuantity));
      }
      if (analysis.suggestion.unitCost != null) {
        setUnitCost(String(analysis.suggestion.unitCost));
      }
      setMatchedInDb(analysis.matchedInDb);
      setAnalysisBanner(analysis.suggestion.reason);
    } catch {
      setAnalysisBanner('Imagem carregada. Preencha ou confirme os campos abaixo.');
    } finally {
      setAnalyzingImage(false);
      e.target.value = '';
    }
  };

  return (
    <form
      className="modal-form compact-modal-form"
      onSubmit={e => {
        e.preventDefault();
        onSave({
          name: name.trim(),
          category,
          unit,
          quantity: Number(quantity),
          minimumQuantity: minimum ? Number(minimum) : null,
          unitCost: unitCost ? Number(unitCost) : null,
          imageData,
          imageSignature,
        });
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only-input"
        onChange={e => { void handleFileChange(e); }}
        data-testid="input-product-image-file"
      />

      <div className="photo-picker-box">
        {imageData ? (
          <img
            src={imageData}
            alt="Prévia do produto"
            className="photo-preview-thumb"
            data-testid="img-product-preview"
          />
        ) : (
          <div className="photo-placeholder">
            <Camera size={32} />
          </div>
        )}
        <div className="photo-picker-info">
          <b>{imageData ? 'Imagem do produto pronta' : 'Identificador por Imagem'}</b>
          <span>Abra a galeria (celular ou PC) para preencher tudo automático</span>
        </div>
        <button
          type="button"
          className="button secondary photo-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={analyzingImage}
          data-testid="button-upload-product-image"
        >
          <ImagePlus size={24} />
          {analyzingImage ? 'Analisando…' : imageData ? 'Trocar Imagem' : 'Adicionar Imagem'}
        </button>
      </div>

      {analysisBanner && (
        <div
          className={`image-analysis-banner ${matchedInDb ? 'matched' : 'analyzed'}`}
          role="status"
          data-testid="banner-image-analysis"
        >
          <Sparkles size={24} />
          <span>{analysisBanner}</span>
        </div>
      )}

      <label className="field-label">
        Nome do produto
        <input
          autoFocus
          required
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ex.: Milho em Grão"
          data-testid="input-product-name"
        />
        {!initial && (
          <div className="suggestion-row">
            {quickProducts.map(item => (
              <button
                type="button"
                key={item}
                onClick={() => applySuggestion(item)}
                className="suggestion-chip"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </label>

      <div className="field-label">
        Tipo
        <div className="choice-grid">
          {categoryOptions.map(opt => (
            <button
              type="button"
              key={opt.key}
              className={`choice-pill ${category === opt.key ? 'selected' : ''}`}
              onClick={() => setCategory(opt.key)}
              data-testid={`choice-category-${opt.key}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <label className="field-label">
          {initial ? 'Saldo atual' : 'Quantidade'}
          <input
            required
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="0"
            disabled={!!initial}
            data-testid="input-product-quantity"
          />
          {!initial && (
            <div className="suggestion-row">
              {quickQuantities.map(q => (
                <button
                  type="button"
                  key={q}
                  onClick={() => setQuantity(String(q))}
                  className="suggestion-chip"
                >
                  +{q}
                </button>
              ))}
            </div>
          )}
        </label>
        <label className="field-label">
          Unidade
          <select value={unit} onChange={e => setUnit(e.target.value)} data-testid="select-product-unit">
            <option value="kg">Quilos (kg)</option>
            <option value="un">Unidades (un)</option>
            <option value="L">Litros (L)</option>
            <option value="saco">Sacos</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label className="field-label">
          Estoque mínimo
          <input
            type="number"
            min="0"
            step="any"
            value={minimum}
            onChange={e => setMinimum(e.target.value)}
            placeholder="Ex.: 20"
            data-testid="input-product-minimum"
          />
        </label>
        <label className="field-label">
          Preço por {unit} (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={e => setUnitCost(e.target.value)}
            placeholder="R$ 0,00"
            data-testid="input-product-cost"
          />
        </label>
      </div>

      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={busy || analyzingImage || !name.trim() || quantity === ''}
          data-testid="button-save-product"
        >
          {busy ? 'Salvando…' : 'Salvar Produto'}
        </button>
      </div>
    </form>
  );
}

function MovementForm({ products, onSave, busy, onClose, preferred, initialProductId }: { products: Product[]; onSave: (data: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => void; busy: boolean; onClose: () => void; preferred?: 'in' | 'out'; initialProductId?: number }) {
  const [productId, setProductId] = useState(initialProductId ?? products[0]?.id ?? 0);
  const [direction, setDirection] = useState<'in' | 'out'>(preferred ?? 'in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const selectedProduct = products.find(p => p.id === Number(productId));
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ productId: Number(productId), direction, quantity: Number(quantity), note: note.trim() }); }}>
    <div className="field-label">Tipo de movimento<div className="toggle-row">
      <button type="button" className={`toggle-choice ${direction === 'in' ? 'selected in' : ''}`} onClick={() => setDirection('in')}><ArrowDownLeft size={26} />Entrou</button>
      <button type="button" className={`toggle-choice ${direction === 'out' ? 'selected out' : ''}`} onClick={() => setDirection('out')}><ArrowUpRight size={26} />Saiu</button>
    </div></div>
    <div className="field-label">Produto{products.length ? <div className="product-choice-list">{products.map(p => <button type="button" key={p.id} className={`product-choice ${Number(productId) === p.id ? 'selected' : ''}`} onClick={() => setProductId(p.id)}><span className="product-choice-name">{p.name}</span><span>{p.quantity} {p.unit}</span></button>)}</div> : <p className="field-hint">Cadastre um produto primeiro.</p>}</div>
    <div className="form-row">
      <label className="field-label">Quantidade ({selectedProduct?.unit ?? 'un'})<input type="number" required min="0.01" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="Quanto?" data-testid="input-movement-quantity" />
        <div className="suggestion-row">{quickQuantities.map(q => <button type="button" key={q} onClick={() => setQuantity(String(q))} className="suggestion-chip">{direction === 'in' ? `+${q}` : `−${q}`}</button>)}</div>
      </label>
      <label className="field-label">Observação<input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex.: Cooperativa" /></label>
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !products.length || !quantity} data-testid="button-save-movement">{busy ? 'Salvando…' : 'Confirmar'}</button></div>
  </form>;
}

function FinanceForm({ onSave, busy, onClose, initial, preferredKind }: { onSave: (data: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => void; busy: boolean; onClose: () => void; initial?: FinanceEntry; preferredKind?: 'payable' | 'receivable' }) {
  const [kind, setKind] = useState<'payable' | 'receivable'>(initial?.kind ?? preferredKind ?? 'payable');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initial?.dueDate.slice(0, 10) ?? today());
  const [category, setCategory] = useState(initial?.category ?? (kind === 'receivable' ? 'Venda de ovos' : 'Ração e alimentação'));
  const suggestions = kind === 'payable' ? quickFinancePayable : quickFinanceReceivable;
  return <form className="modal-form" onSubmit={e => { e.preventDefault(); onSave({ kind, description: description.trim(), amount: Number(amount), dueDate, category }); }}>
    <div className="field-label">Tipo de conta<div className="toggle-row">
      <button type="button" className={`toggle-choice ${kind === 'payable' ? 'selected out' : ''}`} onClick={() => { setKind('payable'); if (!initial) setCategory('Ração e alimentação'); }}><ArrowUpRight size={26} />A Pagar</button>
      <button type="button" className={`toggle-choice ${kind === 'receivable' ? 'selected in' : ''}`} onClick={() => { setKind('receivable'); if (!initial) setCategory('Venda de ovos'); }}><ArrowDownLeft size={26} />A Receber</button>
    </div></div>
    <label className="field-label">Descrição<input autoFocus required value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: Venda de ovos" data-testid="input-finance-description" />
      {!initial && <div className="suggestion-row">{suggestions.map(s => <button type="button" key={s} onClick={() => setDescription(s)} className="suggestion-chip">{s}</button>)}</div>}
    </label>
    <div className="field-label">Categoria<div className="choice-grid">{financeCategories.map(item => <button type="button" key={item} className={`choice-pill ${category === item ? 'selected' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
    <div className="form-row">
      <label className="field-label">Valor (R$)<input type="number" required min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="R$ 0,00" data-testid="input-finance-amount" />
        <div className="suggestion-row">{quickAmounts.map(a => <button type="button" key={a} onClick={() => setAmount(String(a))} className="suggestion-chip">R$ {a}</button>)}</div>
      </label>
      <label className="field-label">Vencimento<input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <div className="suggestion-row">
          <button type="button" onClick={() => setDueDate(today())} className="suggestion-chip">Hoje</button>
          <button type="button" onClick={() => setDueDate(addDaysToToday(7))} className="suggestion-chip">+7d</button>
          <button type="button" onClick={() => setDueDate(addDaysToToday(30))} className="suggestion-chip">+30d</button>
        </div>
      </label>
    </div>
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy || !description.trim() || !amount} data-testid="button-save-finance">{busy ? 'Salvando…' : 'Salvar Conta'}</button></div>
  </form>;
}

function useRefresh() {
  const qc = useQueryClient();
  return (...keys: ReadonlyArray<readonly unknown[]>) => keys.forEach(queryKey => { void qc.invalidateQueries({ queryKey }); });
}

function DashboardScreen({ onGoToSlide }: { onGoToSlide: (idx: number) => void }) {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const { data: products = [] } = useGetProducts();
  const { data: poultrySummary } = useGetPoultrySummary();
  const { data: feedingSummary } = useGetFeedingSummary();
  const createMove = useCreateMovement();
  const createFinance = useCreateFinanceEntry();
  const createProduct = useCreateProduct();
  const refresh = useRefresh();
  const [modal, setModal] = useState<'movement' | 'finance' | 'product' | null>(null);
  const [preferred, setPreferred] = useState<'in' | 'out'>('in');
  const [preferredFinanceKind, setPreferredFinanceKind] = useState<'payable' | 'receivable'>('receivable');
  const [preselectedProductId, setPreselectedProductId] = useState<number | undefined>();

  const pendingBills = data?.pendingPayables ?? 0;
  const dueIn = data?.pendingReceivables ?? 0;
  const liveBirds = poultrySummary?.liveBirdCount ?? 0;
  const activeLots = poultrySummary?.activeLotCount ?? 0;
  const todayFeedKg = feedingSummary?.todayQuantityKg ?? 0;

  const onMovement = (input: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => createMove.mutate({ data: input }, { onSuccess: () => { refresh(getGetMovementsQueryKey(), getGetProductsQueryKey(), getGetDashboardQueryKey()); setModal(null); setPreselectedProductId(undefined); } });
  const onFinance = (input: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => createFinance.mutate({ data: input }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const onProduct = (input: { name: string; category: Product['category']; unit: string; quantity: number; minimumQuantity: number | null; unitCost: number | null; imageData?: string | null; imageSignature?: string | null }) => createProduct.mutate({ data: input }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <div>
          <span className="screen-kicker"><Sprout size={22} /> TELA 1 · VISÃO GERAL</span>
          <h1>Painel da Granja Suenaga</h1>
        </div>
        <div className="screen-header-actions">
          <button className="button primary giant-btn" onClick={() => setModal('product')}>
            <Plus size={26} /> Adicionar Produto
          </button>
        </div>
      </div>

      {isLoading ? <div className="giant-empty">Carregando painel…</div> : isError || !data ? <div className="giant-empty"><button className="button secondary" onClick={() => { void refetch(); }}><RotateCcw size={24} /> Tentar de novo</button></div> : (
        <div className="dashboard-one-screen">
          <section className="giant-quick-actions" aria-label="Ações rápidas">
            <button className="giant-quick-btn green" onClick={() => { setPreselectedProductId(undefined); setPreferred('in'); setModal('movement'); }} data-testid="button-entrada">
              <ArrowDownLeft size={34} />
              <div>
                <b>+ Entrada Estoque</b>
                <span>Chegou ração ou milho</span>
              </div>
            </button>
            <button className="giant-quick-btn amber" onClick={() => { setPreselectedProductId(undefined); setPreferred('out'); setModal('movement'); }} data-testid="button-saida">
              <ArrowUpRight size={34} />
              <div>
                <b>− Saída Estoque</b>
                <span>Usou produto hoje</span>
              </div>
            </button>
            <button className="giant-quick-btn blue" onClick={() => { setPreferredFinanceKind('receivable'); setModal('finance'); }} data-testid="button-conta">
              <CircleDollarSign size={34} />
              <div>
                <b>+ Anotar Conta</b>
                <span>Venda ou despesa</span>
              </div>
            </button>
          </section>

          <section className="giant-kpi-grid">
            <button type="button" className="giant-kpi-card" onClick={() => onGoToSlide(1)}>
              <div className="kpi-top"><Package size={28} /> <span>ESTOQUE</span></div>
              <strong>{data.productCount} itens</strong>
              <small className={data.lowStockCount ? 'warn-text' : ''}>
                {data.lowStockCount ? `⚠ ${data.lowStockCount} precisam repor` : '✓ Estoque em dia'}
              </small>
            </button>

            <button type="button" className="giant-kpi-card" onClick={() => onGoToSlide(2)}>
              <div className="kpi-top"><Bird size={28} /> <span>PLANTEL VIVO</span></div>
              <strong>{liveBirds} aves</strong>
              <small>{activeLots} lotes · {todayFeedKg} kg hoje</small>
            </button>

            <button type="button" className="giant-kpi-card coral" onClick={() => onGoToSlide(4)}>
              <div className="kpi-top"><TrendingDown size={28} /> <span>A PAGAR</span></div>
              <strong>{money(pendingBills)}</strong>
              <small>contas em aberto</small>
            </button>

            <button type="button" className="giant-kpi-card green" onClick={() => onGoToSlide(4)}>
              <div className="kpi-top"><TrendingUp size={28} /> <span>A RECEBER</span></div>
              <strong>{money(dueIn)}</strong>
              <small>saldo: {money(dueIn - pendingBills)}</small>
            </button>
          </section>

          {data.lowStockProducts.length > 0 && (
            <section className="giant-alert-banner">
              <div className="alert-banner-left">
                <AlertTriangle size={30} />
                <div>
                  <b>Atenção: Estoque Baixo</b>
                  <span>{data.lowStockProducts.slice(0, 2).map(p => `${p.name} (${p.quantity} ${p.unit})`).join(' · ')}</span>
                </div>
              </div>
              <button
                type="button"
                className="button primary giant-btn"
                onClick={() => {
                  setPreselectedProductId(data.lowStockProducts[0].id);
                  setPreferred('in');
                  setModal('movement');
                }}
              >
                + Repor Agora
              </button>
            </section>
          )}
        </div>
      )}

      {modal === 'movement' && <Modal title={preferred === 'in' ? 'Entrada no Estoque' : 'Saída do Estoque'} eyebrow="ESTOQUE · MOVIMENTO" onClose={() => { setModal(null); setPreselectedProductId(undefined); }}><MovementForm products={products} preferred={preferred} initialProductId={preselectedProductId} onClose={() => { setModal(null); setPreselectedProductId(undefined); }} busy={createMove.isPending} onSave={onMovement} /></Modal>}
      {modal === 'finance' && <Modal title="Anotar Conta ou Venda" eyebrow="FINANCEIRO · REGISTRO" onClose={() => setModal(null)}><FinanceForm preferredKind={preferredFinanceKind} onClose={() => setModal(null)} busy={createFinance.isPending} onSave={onFinance} /></Modal>}
      {modal === 'product' && <Modal title="Adicionar Produto" eyebrow="ESTOQUE · NOVO ITEM" onClose={() => setModal(null)}><ProductForm onClose={() => setModal(null)} busy={createProduct.isPending} onSave={onProduct} /></Modal>}
    </div>
  );
}

function StockScreen() {
  const { data: products, isLoading, isError, refetch } = useGetProducts();
  const { data: movements } = useGetMovements();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createMovement = useCreateMovement();
  const deleteMovement = useDeleteMovement();
  const refresh = useRefresh();
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [modal, setModal] = useState<'product' | 'movement' | null>(null);
  const [editing, setEditing] = useState<Product | undefined>();
  const [photoPrefill, setPhotoPrefill] = useState<{
    prepared: PreparedImageData;
    analysis: ImageAnalysisResult | null;
  } | null>(null);
  const [analyzingTopPhoto, setAnalyzingTopPhoto] = useState(false);
  const [movementPref, setMovementPref] = useState<{ direction: 'in' | 'out'; productId?: number }>({ direction: 'in' });
  const [filter, setFilter] = useState('todos');
  const [subView, setSubView] = useState<'products' | 'movements'>('products');
  const [page, setPage] = useState(0);

  const list = products ?? [];
  const filteredProducts = useMemo(() => list.filter(p => filter === 'todos' || p.category === filter), [list, filter]);

  const perPage = 3;
  const totalProdPages = Math.max(1, Math.ceil(filteredProducts.length / perPage));
  const safeProdPage = Math.min(page, totalProdPages - 1);
  const visibleProducts = filteredProducts.slice(safeProdPage * perPage, (safeProdPage + 1) * perPage);

  const allMovements = (movements ?? []).slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const totalMovePages = Math.max(1, Math.ceil(allMovements.length / perPage));
  const safeMovePage = Math.min(page, totalMovePages - 1);
  const visibleMovements = allMovements.slice(safeMovePage * perPage, (safeMovePage + 1) * perPage);

  const handleQuickPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzingTopPhoto(true);
    try {
      const prepared = await extractImageFeatures(file);
      let analysis: ImageAnalysisResult | null = null;
      try {
        analysis = await analyzeProductImageOnServer(prepared);
      } catch {
        analysis = null;
      }
      setEditing(undefined);
      setPhotoPrefill({ prepared, analysis });
      setModal('product');
    } finally {
      setAnalyzingTopPhoto(false);
      e.target.value = '';
    }
  };

  const saveProduct = (input: {
    name: string;
    category: Product['category'];
    unit: string;
    quantity: number;
    minimumQuantity: number | null;
    unitCost: number | null;
    imageData?: string | null;
    imageSignature?: string | null;
  }) => {
    if (editing) {
      updateProduct.mutate(
        {
          productId: editing.id,
          data: {
            name: input.name,
            category: input.category,
            unit: input.unit,
            minimumQuantity: input.minimumQuantity,
            unitCost: input.unitCost,
            imageData: input.imageData,
            imageSignature: input.imageSignature,
          },
        },
        {
          onSuccess: () => {
            refresh(getGetProductsQueryKey(), getGetDashboardQueryKey(), getGetFeedRecipesQueryKey());
            setEditing(undefined);
            setPhotoPrefill(null);
            setModal(null);
          },
        },
      );
    } else {
      createProduct.mutate(
        { data: input },
        {
          onSuccess: () => {
            refresh(getGetProductsQueryKey(), getGetDashboardQueryKey());
            setPhotoPrefill(null);
            setModal(null);
          },
        },
      );
    }
  };
  const onMovement = (input: { productId: number; direction: 'in' | 'out'; quantity: number; note: string }) => createMovement.mutate({ data: input }, { onSuccess: () => { refresh(getGetProductsQueryKey(), getGetMovementsQueryKey(), getGetDashboardQueryKey()); setModal(null); } });
  const removeProduct = (p: Product) => { if (window.confirm(`Remover ${p.name} do estoque?`)) deleteProduct.mutate({ productId: p.id }, { onSuccess: () => refresh(getGetProductsQueryKey(), getGetDashboardQueryKey()) }); };
  const removeMovement = (m: Movement) => { if (window.confirm('Excluir este movimento?')) deleteMovement.mutate({ movementId: m.id }, { onSuccess: () => refresh(getGetMovementsQueryKey(), getGetProductsQueryKey(), getGetDashboardQueryKey()) }); };

  const cats = [['todos', 'Tudo'], ['feed', 'Ração/Grãos'], ['medicine', 'Remédios'], ['supplies', 'Insumos']];

  return (
    <div className="screen-panel">
      <input
        ref={quickPhotoInputRef}
        type="file"
        accept="image/*"
        className="sr-only-input"
        onChange={e => { void handleQuickPhotoSelected(e); }}
        data-testid="input-quick-photo-product"
      />
      <div className="screen-header">
        <div>
          <span className="screen-kicker"><Package size={22} /> TELA 2 · ESTOQUE</span>
          <h1>Produtos e Insumos</h1>
        </div>
        <div className="screen-header-actions">
          <button className="button secondary giant-btn" onClick={() => { setMovementPref({ direction: 'in' }); setModal('movement'); }}>
            <ArrowLeftRight size={24} /> Movimento
          </button>
          <button
            className="button secondary giant-btn photo-cta-btn"
            onClick={() => quickPhotoInputRef.current?.click()}
            disabled={analyzingTopPhoto}
            data-testid="button-add-product-photo"
          >
            <Camera size={26} />
            {analyzingTopPhoto ? 'Analisando Foto…' : 'Adicionar Produto por Foto'}
          </button>
          <button
            className="button primary giant-btn"
            onClick={() => {
              setEditing(undefined);
              setPhotoPrefill(null);
              setModal('product');
            }}
            data-testid="button-new-product"
          >
            <Plus size={26} /> Adicionar Produto
          </button>
        </div>
      </div>

      <div className="subview-bar">
        <div className="segmented-giant">
          <button type="button" className={subView === 'products' ? 'selected' : ''} onClick={() => { setSubView('products'); setPage(0); }}>
            Estoque ({filteredProducts.length})
          </button>
          <button type="button" className={subView === 'movements' ? 'selected' : ''} onClick={() => { setSubView('movements'); setPage(0); }}>
            Histórico ({allMovements.length})
          </button>
        </div>

        {subView === 'products' && (
          <div className="filter-pills-giant">
            {cats.map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setFilter(key); setPage(0); }} className={`giant-filter-pill ${filter === key ? 'selected' : ''}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="pager-controls">
          {subView === 'products' && totalProdPages > 1 && (
            <>
              <button type="button" className="pager-btn" disabled={safeProdPage <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft size={26} /></button>
              <span>{safeProdPage + 1} / {totalProdPages}</span>
              <button type="button" className="pager-btn" disabled={safeProdPage >= totalProdPages - 1} onClick={() => setPage(p => Math.min(totalProdPages - 1, p + 1))}><ChevronRight size={26} /></button>
            </>
          )}
          {subView === 'movements' && totalMovePages > 1 && (
            <>
              <button type="button" className="pager-btn" disabled={safeMovePage <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft size={26} /></button>
              <span>{safeMovePage + 1} / {totalMovePages}</span>
              <button type="button" className="pager-btn" disabled={safeMovePage >= totalMovePages - 1} onClick={() => setPage(p => Math.min(totalMovePages - 1, p + 1))}><ChevronRight size={26} /></button>
            </>
          )}
        </div>
      </div>

      <div className="screen-body">
        {subView === 'products' ? (
          isLoading ? <div className="giant-empty">Carregando estoque…</div> :
          isError ? <div className="giant-empty"><button className="button secondary" onClick={() => { void refetch(); }}>Tentar de novo</button></div> :
          visibleProducts.length === 0 ? <div className="giant-empty"><p>Nenhum produto nesta categoria.</p><button className="button primary giant-btn" onClick={() => setModal('product')}><Plus size={26} /> Adicionar Produto</button></div> :
          <div className="giant-list">
            {visibleProducts.map(p => {
              const low = p.minimumQuantity !== null && p.quantity <= p.minimumQuantity;
              return (
                <article className={`giant-list-row ${low ? 'row-attention' : ''}`} key={p.id} data-testid={`row-product-${p.id}`}>
                  {p.imageData ? (
                    <img src={p.imageData} alt={p.name} className="product-row-thumb" />
                  ) : (
                    <span className={`giant-dir-badge ${low ? 'out' : 'in'}`}><Package size={28} /></span>
                  )}
                  <div className="giant-row-main">
                    <b>{p.name}</b>
                    <span>{categoryNames[p.category] ?? p.category}{p.unitCost !== null ? ` · ${money(p.unitCost)}/${p.unit}` : ''}{low ? ' · ⚠ REPOR' : ''}</span>
                  </div>
                  <div className="giant-row-right">
                    <strong>{p.quantity} {p.unit}</strong>
                    {p.minimumQuantity !== null && <small>Mín. {p.minimumQuantity} {p.unit}</small>}
                  </div>
                  <div className="giant-row-actions">
                    <button type="button" className="giant-quick-tag in" onClick={() => { setMovementPref({ direction: 'in', productId: p.id }); setModal('movement'); }}>+ Entrada</button>
                    <button type="button" className="giant-quick-tag out" onClick={() => { setMovementPref({ direction: 'out', productId: p.id }); setModal('movement'); }}>− Saída</button>
                    <button className="icon-button giant-icon-btn" aria-label={`Editar ${p.name}`} onClick={() => { setEditing(p); setPhotoPrefill(null); setModal('product'); }}><Pencil size={24} /></button>
                    <button className="icon-button giant-icon-btn danger-icon" aria-label={`Excluir ${p.name}`} onClick={() => removeProduct(p)} disabled={deleteProduct.isPending}><Trash2 size={24} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          visibleMovements.length === 0 ? <div className="giant-empty">Nenhum movimento registrado.</div> :
          <div className="giant-list">
            {visibleMovements.map(m => (
              <div className="giant-list-row" key={m.id}>
                <span className={`giant-dir-badge ${m.direction}`}><ArrowLeftRight size={26} /></span>
                <div className="giant-row-main">
                  <b>{m.productName}</b>
                  <span>{m.note || (m.direction === 'in' ? 'Entrada' : 'Saída')} · {dateBR(m.createdAt)}</span>
                </div>
                <strong className={`giant-row-val ${m.direction}`}>{m.direction === 'in' ? '+' : '−'}{m.quantity}</strong>
                <button className="icon-button giant-icon-btn danger-icon" aria-label="Excluir movimento" onClick={() => removeMovement(m)}><Trash2 size={24} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === 'product' && (
        <Modal
          title={editing ? 'Editar Produto' : photoPrefill ? 'Adicionar Produto por Foto' : 'Adicionar Produto'}
          eyebrow="ESTOQUE · PRODUTO"
          onClose={() => {
            setModal(null);
            setEditing(undefined);
            setPhotoPrefill(null);
          }}
        >
          <ProductForm
            key={editing?.id ?? (photoPrefill ? `photo-${photoPrefill.prepared.fileName}` : 'new')}
            initial={editing}
            initialPhotoData={photoPrefill?.prepared ?? null}
            initialAnalysis={photoPrefill?.analysis ?? null}
            onClose={() => {
              setModal(null);
              setEditing(undefined);
              setPhotoPrefill(null);
            }}
            busy={createProduct.isPending || updateProduct.isPending}
            onSave={saveProduct}
          />
        </Modal>
      )}
      {modal === 'movement' && <Modal title="Registrar Movimento" eyebrow="ESTOQUE · ENTRADA OU SAÍDA" onClose={() => setModal(null)}><MovementForm products={list} preferred={movementPref.direction} initialProductId={movementPref.productId} onClose={() => setModal(null)} busy={createMovement.isPending} onSave={onMovement} /></Modal>}
    </div>
  );
}

function FinanceScreen() {
  const { data: entries, isLoading, isError, refetch } = useGetFinanceEntries();
  const createEntry = useCreateFinanceEntry();
  const updateEntry = useUpdateFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();
  const refresh = useRefresh();
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | undefined>();
  const [tab, setTab] = useState<'all' | 'payable' | 'receivable'>('all');
  const [page, setPage] = useState(0);

  const rows = entries ?? [];
  const filtered = rows.filter(e => tab === 'all' || e.kind === tab).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  const payables = rows.filter(e => e.kind === 'payable' && e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const receivables = rows.filter(e => e.kind === 'receivable' && e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  const perPage = 3;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const visibleEntries = filtered.slice(safePage * perPage, (safePage + 1) * perPage);
  const currentDay = today();

  const save = (input: { kind: 'payable' | 'receivable'; description: string; amount: number; dueDate: string; category: string }) => {
    if (editing) updateEntry.mutate({ entryId: editing.id, data: { description: input.description, amount: input.amount, dueDate: input.dueDate, category: input.category } }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(false); setEditing(undefined); } });
    else createEntry.mutate({ data: input }, { onSuccess: () => { refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()); setModal(false); } });
  };
  const toggleSettled = (entry: FinanceEntry) => updateEntry.mutate({ entryId: entry.id, data: { status: entry.status === 'pending' ? 'settled' : 'pending' } }, { onSuccess: () => refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()) });
  const remove = (entry: FinanceEntry) => { if (window.confirm(`Excluir a conta “${entry.description}”?`)) deleteEntry.mutate({ entryId: entry.id }, { onSuccess: () => refresh(getGetFinanceEntriesQueryKey(), getGetDashboardQueryKey()) }); };

  return (
    <div className="screen-panel">
      <div className="screen-header">
        <div>
          <span className="screen-kicker"><Wallet size={22} /> TELA 5 · FINANCEIRO</span>
          <h1>Contas a Pagar e Receber</h1>
        </div>
        <div className="screen-header-actions">
          <div className="big-stat-badge coral">
            <span>A PAGAR</span>
            <b>{money(payables)}</b>
          </div>
          <div className="big-stat-badge highlight">
            <span>A RECEBER</span>
            <b>{money(receivables)}</b>
          </div>
          <button className="button primary giant-btn" onClick={() => { setEditing(undefined); setModal(true); }} data-testid="button-new-finance">
            <Plus size={26} /> Anotar Conta
          </button>
        </div>
      </div>

      <div className="subview-bar">
        <div className="segmented-giant">
          <button type="button" className={tab === 'all' ? 'selected' : ''} onClick={() => { setTab('all'); setPage(0); }}>Todas ({rows.length})</button>
          <button type="button" className={tab === 'payable' ? 'selected' : ''} onClick={() => { setTab('payable'); setPage(0); }}>A Pagar</button>
          <button type="button" className={tab === 'receivable' ? 'selected' : ''} onClick={() => { setTab('receivable'); setPage(0); }}>A Receber</button>
        </div>

        {totalPages > 1 && (
          <div className="pager-controls">
            <button type="button" className="pager-btn" disabled={safePage <= 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft size={26} /></button>
            <span>{safePage + 1} / {totalPages}</span>
            <button type="button" className="pager-btn" disabled={safePage >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}><ChevronRight size={26} /></button>
          </div>
        )}
      </div>

      <div className="screen-body">
        {isLoading ? <div className="giant-empty">Carregando contas…</div> :
        isError ? <div className="giant-empty"><button className="button secondary" onClick={() => { void refetch(); }}>Tentar de novo</button></div> :
        visibleEntries.length === 0 ? <div className="giant-empty"><p>Nenhuma conta nesta aba.</p><button className="button primary giant-btn" onClick={() => setModal(true)}><Plus size={26} /> Anotar 1ª Conta</button></div> :
        <div className="giant-list">
          {visibleEntries.map(entry => {
            const isOverdue = entry.status === 'pending' && entry.dueDate.slice(0, 10) < currentDay;
            return (
              <article className={`giant-list-row ${entry.status === 'settled' ? 'settled-row' : ''}`} key={entry.id} data-testid={`row-finance-${entry.id}`}>
                <span className={`giant-dir-badge ${entry.kind === 'receivable' ? 'in' : 'out'}`}><CreditCard size={28} /></span>
                <div className="giant-row-main">
                  <b>{entry.description}</b>
                  <span>{entry.category || 'Geral'} · Vence {dateBR(entry.dueDate)} {isOverdue ? '· ⚠ VENCIDA' : ''}</span>
                </div>
                <div className="giant-row-right">
                  <strong className={`giant-row-val ${entry.kind === 'receivable' ? 'in' : 'out'}`}>
                    {entry.kind === 'payable' ? '−' : '+'}{money(entry.amount)}
                  </strong>
                  <small>{entry.status === 'settled' ? '✓ Resolvida' : 'Em aberto'}</small>
                </div>
                <div className="giant-row-actions">
                  <button className="button secondary giant-settle-btn" onClick={() => toggleSettled(entry)} disabled={updateEntry.isPending} data-testid={`button-settle-${entry.id}`}>
                    <Check size={22} /> {entry.status === 'pending' ? 'Resolver' : 'Reabrir'}
                  </button>
                  <button className="icon-button giant-icon-btn" aria-label={`Editar ${entry.description}`} onClick={() => { setEditing(entry); setModal(true); }}><Pencil size={24} /></button>
                  <button className="icon-button giant-icon-btn danger-icon" aria-label={`Excluir ${entry.description}`} onClick={() => remove(entry)} disabled={deleteEntry.isPending}><Trash2 size={24} /></button>
                </div>
              </article>
            );
          })}
        </div>}
      </div>

      {modal && <Modal title={editing ? 'Editar Conta' : 'Anotar Conta'} eyebrow="FINANCEIRO · REGISTRO" onClose={() => { setModal(false); setEditing(undefined); }}><FinanceForm key={editing?.id ?? 'new'} initial={editing} onSave={save} busy={createEntry.isPending || updateEntry.isPending} onClose={() => { setModal(false); setEditing(undefined); }} /></Modal>}
    </div>
  );
}

const SLIDES = [
  { id: 'inicio', path: '/', label: 'Início', icon: Sprout },
  { id: 'estoque', path: '/estoque', label: 'Estoque', icon: Package },
  { id: 'aves', path: '/aves', label: 'Aves', icon: Egg },
  { id: 'alimentacao', path: '/alimentacao', label: 'Ração', icon: Leaf },
  { id: 'contas', path: '/contas', label: 'Contas', icon: Wallet },
] as const;

function SwipeWorkspace({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [location, setLocation] = useLocation();
  const deckRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const [showSwipePopup, setShowSwipePopup] = useState<boolean>(() => {
    return sessionStorage.getItem('granja_swipe_popup_seen') !== '1';
  });

  const dismissSwipePopup = () => {
    sessionStorage.setItem('granja_swipe_popup_seen', '1');
    setShowSwipePopup(false);
  };

  useEffect(() => {
    if (!showSwipePopup) return undefined;
    const timer = window.setTimeout(() => {
      sessionStorage.setItem('granja_swipe_popup_seen', '1');
      setShowSwipePopup(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [showSwipePopup]);

  const rawName = (user.displayName || user.username || 'Gabriel Suenaga').trim();
  const normalizedTitle =
    rawName.toLowerCase() === 'granja suenaga'
      ? 'Granja Gabriel Suenaga'
      : rawName.toLowerCase().startsWith('granja')
        ? rawName
        : `Granja ${rawName}`;

  const slideIndexFromLocation = useMemo(() => {
    const idx = SLIDES.findIndex(s => s.path === location);
    return idx >= 0 ? idx : 0;
  }, [location]);

  const [activeIndex, setActiveIndex] = useState(slideIndexFromLocation);

  const goToSlide = (targetIndex: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, targetIndex));
    setActiveIndex(clamped);
    if (showSwipePopup) dismissSwipePopup();
    const targetPath = SLIDES[clamped].path;
    if (location !== targetPath) {
      setLocation(targetPath);
    }
    const deck = deckRef.current;
    if (deck) {
      isProgrammaticScroll.current = true;
      deck.scrollTo({
        left: clamped * deck.clientWidth,
        behavior: 'smooth',
      });
      window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 450);
    }
  };

  useEffect(() => {
    setActiveIndex(slideIndexFromLocation);
    const deck = deckRef.current;
    if (deck) {
      isProgrammaticScroll.current = true;
      deck.scrollTo({
        left: slideIndexFromLocation * deck.clientWidth,
        behavior: 'smooth',
      });
      const timer = window.setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 450);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [slideIndexFromLocation]);

  const handleScroll = () => {
    if (isProgrammaticScroll.current) return;
    const deck = deckRef.current;
    if (!deck || deck.clientWidth <= 0) return;
    const idx = Math.round(deck.scrollLeft / deck.clientWidth);
    if (idx !== activeIndex && idx >= 0 && idx < SLIDES.length) {
      setActiveIndex(idx);
      if (showSwipePopup) dismissSwipePopup();
      const targetPath = SLIDES[idx].path;
      if (location !== targetPath) {
        setLocation(targetPath);
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0 && activeIndex < SLIDES.length - 1) {
        goToSlide(activeIndex + 1);
      } else if (dx > 0 && activeIndex > 0) {
        goToSlide(activeIndex - 1);
      }
    }
  };

  return (
    <div className="swipe-app-shell">
      <header className="giant-topbar">
        <div className="topbar-brand">
          <span className="topbar-logo"><Egg size={30} /></span>
          <strong className="topbar-client-name" data-testid="text-header-client-name">
            {normalizedTitle}
          </strong>
        </div>

        <div className="topbar-user">
          <button
            type="button"
            className="logout-btn"
            onClick={onLogout}
            data-testid="button-logout"
            title="Sair do sistema"
          >
            <LogOut size={24} /> <span>Sair</span>
          </button>
        </div>
      </header>

      {showSwipePopup && (
        <div className="swipe-toast-popup" role="status" data-testid="popup-swipe-hint">
          <div className="swipe-toast-icon">
            <ChevronLeft size={26} />
            <Hand size={28} />
            <ChevronRight size={26} />
          </div>
          <div className="swipe-toast-copy">
            <b>Deslize para os lados</b>
            <span>Arraste o dedo para a esquerda ou direita para mudar de tela</span>
          </div>
          <button
            type="button"
            className="swipe-toast-close"
            onClick={dismissSwipePopup}
            data-testid="button-dismiss-swipe-popup"
          >
            Entendi
          </button>
        </div>
      )}

      <main
        ref={deckRef}
        className="swipe-deck"
        onScroll={handleScroll}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        data-testid="swipe-deck"
      >
        <section className="swipe-slide" aria-label="Início">
          <DashboardScreen onGoToSlide={goToSlide} />
        </section>
        <section className="swipe-slide" aria-label="Estoque">
          <StockScreen />
        </section>
        <section className="swipe-slide" aria-label="Aves">
          <PoultryPage />
        </section>
        <section className="swipe-slide" aria-label="Ração">
          <FeedingPage />
        </section>
        <section className="swipe-slide" aria-label="Contas">
          <FinanceScreen />
        </section>
      </main>

      <nav className="giant-bottom-tabs" aria-label="Navegação por telas">
        {SLIDES.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = activeIndex === idx;
          return (
            <button
              key={s.id}
              type="button"
              className={`giant-tab-btn ${isCurrent ? 'active' : ''}`}
              onClick={() => goToSlide(idx)}
              data-testid={`link-${s.id}`}
            >
              <Icon size={28} strokeWidth={isCurrent ? 2.4 : 1.9} />
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function AuthenticatedApp() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_USER_KEY);
      const token = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved && token) return JSON.parse(saved) as AuthUser;
    } catch {
      // ignore
    }
    return null;
  });
  const [checking, setChecking] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!token) {
      setChecking(false);
      return;
    }
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (!res.ok) throw new Error('Unauthorized');
        const data = (await res.json()) as { authenticated: boolean; user: AuthUser };
        if (data.authenticated && data.user) {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
          setUser(data.user);
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
    qc.clear();
  };

  if (checking) {
    return <div className="login-viewport"><div className="giant-empty">Carregando Granja Suenaga…</div></div>;
  }

  if (!user) {
    return (
      <LoginScreen
        onAuthenticated={(loggedUser) => {
          setUser(loggedUser);
          void qc.invalidateQueries();
        }}
      />
    );
  }

  return (
    <ErrorBoundary resetKey={user.username}>
      <SwipeWorkspace user={user} onLogout={handleLogout} />
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthenticatedApp />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
