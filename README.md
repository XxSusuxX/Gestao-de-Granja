# 🐔 Gestão da Granja — MVP Completo (Vercel + Supabase)

Sistema mobile-first e desktop pensado para pequenos e médios criadores de aves controlarem **estoque de insumos**, **plantel de aves (poedeiras, corte e pintinhos)**, **receitas e consumo diário de ração** e **contas a pagar e receber** com o mínimo de digitação.

---

## ✅ O que este projeto inclui

1. **Zero Dependências da Replit**:
   - Removidos todos os pacotes `@replit/*` (`@replit/connectors-sdk`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`), arquivos `.replit`, `.replit-artifact` e travas de binários Linux.
2. **Pronto para Deploy na Vercel (`vercel.json` + `/api`)**:
   - Frontend React + Vite + Tailwind CSS compilado estaticamente.
   - Backend Express 5 + Drizzle ORM empacotado automaticamente em `/api/index.mjs` para rodar como Serverless Function na Vercel.
3. **Banco de Dados PostgreSQL / Supabase Completo (`lib/db` + `supabase/schema.sql`)**:
   - **Auto-migração inteligente**: Ao conectar a variável `DATABASE_URL` (ou `POSTGRES_URL`) da sua conta Supabase, o servidor cria automaticamente todas as 8 tabelas e 7 tipos enumerados (`CREATE TABLE IF NOT EXISTS`) no primeiro acesso e já popula os dados iniciais do MVP!
   - **Modo Demonstração Automático**: Caso o app seja aberto antes de configurar a `DATABASE_URL`, ele funciona 100% interativo em modo de demonstração com todos os dados da Granja Modelo carregados, sem nunca quebrar com tela de erro.

---

## 🗄️ Tabelas do Banco de Dados (Supabase PostgreSQL)

O banco de dados possui **8 tabelas** definidas em `lib/db/src/schema/` e em `supabase/schema.sql`:

| Tabela | Descrição |
| :--- | :--- |
| `farm_products` | Produtos do estoque (Milho, Soja, Núcleo, Calcário, Ração, Vacinas, Embalagens), unidade, estoque mínimo e custo unitário. |
| `farm_stock_movements` | Histórico de entradas (compras) e saídas (uso/consumo) do estoque. |
| `farm_poultry_lots` | Lotes de aves (Poedeiras, Frangos de Corte, Pintinhos), data de chegada, raça, origem e saldo atual de aves vivas. |
| `farm_poultry_movements` | Chegadas e baixas de aves por venda, transferência ou mortalidade. |
| `farm_feed_recipes` | Receitas/misturas de ração da granja com cálculo automático de custo por batida e por quilo. |
| `farm_feed_recipe_ingredients` | Ingredientes e proporções (em kg) de cada receita de ração. |
| `farm_feeding_logs` | Registro diário de trato/alimentação por lote com baixa automática proporcional no estoque. |
| `farm_finance_entries` | Contas a pagar e a receber (vendas de ovos/aves, compras de insumos, despesas), vencimento e quitação com 1 toque. |

---

## 🚀 Como publicar na Vercel conectado ao Supabase (Passo a Passo)

### Passo 1: Pegar a URL do Banco na Supabase
1. Crie ou acesse seu projeto gratuito em [supabase.com/dashboard](https://supabase.com/dashboard).
2. No topo da página do projeto, clique no botão **Connect**.
3. Copie a URL de conexão PostgreSQL (**Transaction Pooler** na porta `6543` ou **Session Pooler** na porta `5432`) e substitua `[YOUR-PASSWORD]` pela senha do banco:
   ```env
   DATABASE_URL="postgresql://postgres.[SEU-PROJETO]:[SUA-SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
   ```
   *(Opcional: se quiser ver ou rodar o SQL manualmente no painel do Supabase, basta colar o arquivo [`supabase/schema.sql`](./supabase/schema.sql) no **SQL Editor**, mas o próprio sistema já cria as tabelas e dados iniciais do MVP automaticamente ao conectar!)*

### Passo 2: Subir na Vercel
1. Suba este repositório no seu GitHub e clique em **Add New -> Project** na [Vercel](https://vercel.com).
2. Em **Environment Variables**, adicione:
   - Nome: `DATABASE_URL`
   - Valor: sua string de conexão do Supabase (ou use a integração nativa **Supabase** do Marketplace da Vercel, que preenche `POSTGRES_URL` automaticamente).
3. Clique em **Deploy**. O arquivo `vercel.json` já configura o comando de build (`pnpm run build`), o diretório estático e as rotas `/api/*` automaticamente!

---

## 💻 Como rodar no seu computador

```bash
# 1. Instalar dependências
pnpm install

# 2. (Opcional) Copie .env.example para .env e coloque sua DATABASE_URL da Supabase
cp .env.example .env

# 3. Rodar servidor API + interface web simultaneamente
pnpm run dev
```
- **Interface Web**: `http://localhost:5173`
- **API Local**: `http://localhost:3001/api`
