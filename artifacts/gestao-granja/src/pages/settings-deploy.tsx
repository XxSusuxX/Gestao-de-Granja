import { useState, useEffect } from 'react';
import {
  Settings, Rocket, Globe, Server, Cpu, Database, Copy, ExternalLink,
  RefreshCw, CheckCircle2, AlertCircle, Key, Sparkles, Trash2, Check,
  ShieldCheck, HardDrive, Clock, ArrowRight, Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SettingsAndDeployScreenProps {
  user: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  };
  onUpdateUser?: (updated: { id: number; username: string; displayName: string; role: string }) => void;
  onGoToSlide?: (slideIndex: number) => void;
}

interface EndpointTest {
  name: string;
  url: string;
  status: 'idle' | 'testing' | 'ok' | 'error';
  statusCode?: number;
  latency?: number;
}

export function SettingsAndDeployScreen({ user, onUpdateUser, onGoToSlide }: SettingsAndDeployScreenProps) {
  const { toast } = useToast();
  const [subView, setSubView] = useState<'config' | 'deploy'>('config');

  // Configurações da Granja
  const [farmName, setFarmName] = useState(user.displayName || 'Granja Gabriel Suenaga');
  const [producerName, setProducerName] = useState(() => localStorage.getItem('granja_producer_name') || 'Gabriel Suenaga');
  const [farmLocation, setFarmLocation] = useState(() => localStorage.getItem('granja_location') || 'Granja Suenaga - Setor Avícola');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('granja_gemini_api_key') || '');
  const [savingConfig, setSavingConfig] = useState(false);
  const [cleaningData, setCleaningData] = useState(false);

  // Health check dos endpoints
  const [endpoints, setEndpoints] = useState<EndpointTest[]>([
    { name: 'Frontend SPA (Rota Raiz)', url: '/', status: 'idle' },
    { name: 'Navegação Estoque (Deep Link)', url: '/estoque', status: 'idle' },
    { name: 'API Health & Banco', url: '/api/health', status: 'idle' },
    { name: 'API Sessão / Auth', url: '/api/auth/me', status: 'idle' },
  ]);
  const [testingEndpoints, setTestingEndpoints] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const prodUrl = 'https://gestao-de-granja-suenaga.vercel.app';

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(prodUrl);
      setCopiedUrl(true);
      toast({ title: 'URL copiada com sucesso!', description: prodUrl });
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      toast({ title: 'Erro ao copiar', description: 'Copie manualmente: ' + prodUrl, variant: 'destructive' });
    }
  };

  const handleSaveFarmConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      localStorage.setItem('granja_producer_name', producerName.trim());
      localStorage.setItem('granja_location', farmLocation.trim());
      localStorage.setItem('granja_gemini_api_key', geminiKey.trim());

      const token = localStorage.getItem('granja_suenaga_token');
      if (token && farmName.trim() !== user.displayName) {
        const res = await fetch('/api/auth/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ displayName: farmName.trim() }),
        });
        if (res.ok) {
          const data = (await res.json()) as { user: any; token: string };
          if (data.user && onUpdateUser) {
            onUpdateUser(data.user);
          }
        }
      }

      toast({
        title: 'Configurações salvas!',
        description: 'Os dados da Granja e chaves foram atualizados com sucesso.',
      });
    } catch {
      toast({
        title: 'Aviso',
        description: 'Configurações salvas localmente no navegador.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCleanTestData = async () => {
    if (!window.confirm('Deseja remover produtos de teste temporários criados no banco?')) return;
    setCleaningData(true);
    try {
      const res = await fetch('/api/admin/clean-test-data', { method: 'POST' });
      const data = await res.json();
      toast({
        title: 'Limpeza concluída!',
        description: data.message || 'Dados de teste limpos com sucesso.',
      });
    } catch {
      toast({
        title: 'Aviso',
        description: 'Não foi possível limpar os dados no momento.',
        variant: 'destructive',
      });
    } finally {
      setCleaningData(false);
    }
  };

  const handleRunHealthCheck = async () => {
    setTestingEndpoints(true);
    const updated = [...endpoints];

    for (let i = 0; i < updated.length; i++) {
      updated[i].status = 'testing';
      setEndpoints([...updated]);
      const start = performance.now();
      try {
        const token = localStorage.getItem('granja_suenaga_token');
        const headers: Record<string, string> = {};
        if (token && updated[i].url.includes('/api/')) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(updated[i].url, { headers });
        const latency = Math.round(performance.now() - start);
        updated[i].status = res.ok ? 'ok' : 'error';
        updated[i].statusCode = res.status;
        updated[i].latency = latency;
      } catch {
        updated[i].status = 'error';
        updated[i].statusCode = 0;
        updated[i].latency = Math.round(performance.now() - start);
      }
      setEndpoints([...updated]);
    }
    setTestingEndpoints(false);
  };

  useEffect(() => {
    if (subView === 'deploy') {
      void handleRunHealthCheck();
    }
  }, [subView]);

  return (
    <div className="screen-content" data-testid="screen-settings-deploy">
      <div className="screen-header">
        <div>
          <span className="screen-kicker">
            <Settings size={22} /> TELA 6 · AJUSTES & DEPLOY
          </span>
          <h1>Configurações e Deploy</h1>
        </div>
      </div>

      <div className="segmented-giant" style={{ marginBottom: '24px' }}>
        <button
          type="button"
          className={subView === 'config' ? 'selected' : ''}
          onClick={() => setSubView('config')}
        >
          <Settings size={24} /> Configurações da Granja
        </button>
        <button
          type="button"
          className={subView === 'deploy' ? 'selected' : ''}
          onClick={() => setSubView('deploy')}
        >
          <Rocket size={24} /> Deploy & Produção Vercel
        </button>
      </div>

      {subView === 'config' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Identificação da Granja */}
          <form className="card" onSubmit={handleSaveFarmConfig} style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#203b30', color: '#fff', padding: '10px', borderRadius: '12px' }}>
                <Server size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Identificação da Granja</h3>
                <small style={{ color: '#4b6354' }}>Nome exibido no topo e nos relatórios de estoque e financeiro</small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <label className="field-label">
                Nome da Granja
                <input
                  required
                  value={farmName}
                  onChange={e => setFarmName(e.target.value)}
                  placeholder="Ex.: Granja Gabriel Suenaga"
                />
              </label>

              <label className="field-label">
                Produtor / Responsável
                <input
                  required
                  value={producerName}
                  onChange={e => setProducerName(e.target.value)}
                  placeholder="Ex.: Gabriel Suenaga"
                />
              </label>

              <label className="field-label" style={{ gridColumn: '1 / -1' }}>
                Localização / Setor
                <input
                  value={farmLocation}
                  onChange={e => setFarmLocation(e.target.value)}
                  placeholder="Ex.: Granja Suenaga - Setor Avícola"
                />
              </label>
            </div>

            <button type="submit" className="button primary giant-btn" disabled={savingConfig}>
              <Save size={24} /> {savingConfig ? 'Salvando…' : 'Salvar Dados da Granja'}
            </button>
          </form>

          {/* Card 2: Inteligência Artificial (Visão Computacional) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#1c4a30', color: '#eed788', padding: '10px', borderRadius: '12px' }}>
                <Sparkles size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Inteligência Artificial (Visão Computacional)</h3>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>Ativa</span>
                </div>
                <small style={{ color: '#4b6354' }}>Reconhecimento por foto no Estoque: conta garrafas, identifica milho, ração e insumos</small>
              </div>
            </div>

            <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '14px', padding: '16px', marginBottom: '16px', fontSize: '15px', color: '#274332', lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                ✨ <b>Reconhecimento Visual Nativo:</b> O sistema analisa a densidade de objetos e rótulos da câmera/galeria para preencher automaticamente: nome, unidade (kg, L, un), categoria e quantidade exata detectada.
              </p>
            </div>

            <label className="field-label">
              Chave Google Gemini API (Opcional - Para modelos Vision avançados)
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={e => setGeminiKey(e.target.value)}
                  placeholder="Cole sua chave AIzaSy... (Opcional)"
                  style={{ flex: 1, fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    localStorage.setItem('granja_gemini_api_key', geminiKey.trim());
                    toast({ title: 'Chave de IA salva no navegador!' });
                  }}
                >
                  <Key size={20} /> Salvar Chave
                </button>
              </div>
            </label>
          </div>

          {/* Card 3: Banco de Dados Supabase PostgreSQL */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#203b30', color: '#3ecf8e', padding: '10px', borderRadius: '12px' }}>
                <Database size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Banco de Dados Supabase (PostgreSQL)</h3>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>Conectado</span>
                </div>
                <small style={{ color: '#4b6354' }}>Persistência em nuvem PostgreSQL em tempo real</small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px', textTransform: 'uppercase' }}>Host Supabase</small>
                <strong style={{ fontSize: '14px', wordBreak: 'break-all' }}>nkvcfyqttjrlovsxvnkv.supabase.co</strong>
              </div>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px', textTransform: 'uppercase' }}>Modo de Acesso</small>
                <strong style={{ fontSize: '14px', color: '#166534' }}>Conta & Senha Obrigatória</strong>
              </div>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px', textTransform: 'uppercase' }}>Protocolo</small>
                <strong style={{ fontSize: '14px' }}>REST API v1 + SSL Seguro</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary"
                onClick={handleCleanTestData}
                disabled={cleaningData}
                style={{ color: '#b91c1c' }}
              >
                <Trash2 size={20} /> {cleaningData ? 'Limpando…' : 'Limpar Registros de Teste'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card 1: Status da Produção Vercel */}
          <div className="card" style={{ padding: '24px', border: '2px solid #38a169', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ background: '#166534', color: '#fff', padding: '12px', borderRadius: '14px' }}>
                  <Globe size={28} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#14532d' }}>Produção Vercel Online</h2>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#22c55e', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }}></span> Ready Latest
                    </span>
                  </div>
                  <small style={{ color: '#274332', fontSize: '14px' }}>Aplicação SPA e Serverless API rodando sincronizados</small>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={handleCopyUrl}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {copiedUrl ? <Check size={20} color="#16a34a" /> : <Copy size={20} />}
                  <span>{copiedUrl ? 'Copiado!' : 'Copiar URL'}</span>
                </button>
                <a
                  href={prodUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                >
                  <ExternalLink size={20} />
                  <span>Abrir Site</span>
                </a>
              </div>
            </div>

            <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', fontFamily: 'monospace', fontSize: '16px', color: '#166534', fontWeight: 600 }}>
              <Globe size={20} />
              <span style={{ wordBreak: 'break-all' }}>{prodUrl}</span>
            </div>
          </div>

          {/* Card 2: Diagnóstico em Tempo Real (Health Check) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#203b30', color: '#eed788', padding: '10px', borderRadius: '12px' }}>
                  <Cpu size={24} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Diagnóstico de Endpoints ao Vivo</h3>
                  <small style={{ color: '#4b6354' }}>Verificação de integridade dos roteamentos e chamadas de API</small>
                </div>
              </div>

              <button
                type="button"
                className="button secondary"
                onClick={handleRunHealthCheck}
                disabled={testingEndpoints}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <RefreshCw size={20} className={testingEndpoints ? 'spin' : ''} />
                <span>{testingEndpoints ? 'Testando…' : 'Testar Conexões'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {endpoints.map((ep, idx) => {
                const isOk = ep.status === 'ok';
                const isError = ep.status === 'error';
                const isTesting = ep.status === 'testing';

                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: '12px',
                      background: isOk ? '#f0fdf4' : isError ? '#fef2f2' : '#f9faf7',
                      border: `1px solid ${isOk ? '#86efac' : isError ? '#fca5a5' : '#e2e8f0'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isOk && <CheckCircle2 size={24} color="#16a34a" />}
                      {isError && <AlertCircle size={24} color="#dc2626" />}
                      {isTesting && <RefreshCw size={24} className="spin" color="#64748b" />}
                      {ep.status === 'idle' && <Clock size={24} color="#94a3b8" />}
                      <div>
                        <strong style={{ fontSize: '16px', display: 'block', color: '#1f2937' }}>{ep.name}</strong>
                        <code style={{ fontSize: '13px', color: '#4b5563' }}>{ep.url}</code>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      {ep.statusCode ? (
                        <span
                          style={{
                            background: isOk ? '#dcfce7' : '#fee2e2',
                            color: isOk ? '#166534' : '#991b1b',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '13px',
                          }}
                        >
                          {ep.statusCode} {isOk ? 'OK' : 'FAIL'}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Aguardando</span>
                      )}
                      {ep.latency !== undefined && (
                        <small style={{ display: 'block', color: '#6b7280', marginTop: '2px', fontSize: '11px' }}>
                          {ep.latency} ms
                        </small>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Repositório & Comandos Git CI/CD */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ background: '#203b30', color: '#fff', padding: '10px', borderRadius: '12px' }}>
                <Rocket size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>CI/CD & Como Fazer Novos Deploys</h3>
                <small style={{ color: '#4b6354' }}>Repositório integrado via GitHub com automação Vercel</small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px' }}>REPOSITÓRIO GITHUB</small>
                <strong style={{ fontSize: '15px' }}>XxSusuxX/Gestao-de-Granja</strong>
              </div>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px' }}>BRANCH DE PRODUÇÃO</small>
                <strong style={{ fontSize: '15px', color: '#166534' }}>main</strong>
              </div>
              <div style={{ background: '#f5f7f2', border: '1px solid #d1dbc8', borderRadius: '12px', padding: '12px' }}>
                <small style={{ color: '#5b7063', display: 'block', fontSize: '12px' }}>TEMPO DE COMPILAÇÃO</small>
                <strong style={{ fontSize: '15px' }}>~20 segundos</strong>
              </div>
            </div>

            <div style={{ background: '#1e293b', color: '#f8fafc', padding: '16px', borderRadius: '12px', fontFamily: 'monospace', fontSize: '14px', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 8px 0', color: '#94a3b8' }}># Para subir qualquer alteração diretamente para a nuvem:</p>
              <div>git add .</div>
              <div>git commit -m &quot;Melhoria na Granja Suenaga&quot;</div>
              <div style={{ color: '#38bdf8' }}>git push origin main</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
