-- =============================================================================
-- GESTÃO DA GRANJA — Schema Completo + Dados Iniciais (MVP) para Supabase
-- =============================================================================
-- Como usar no Supabase:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. Vá em "SQL Editor" -> "New query"
-- 3. Cole todo este arquivo e clique em "Run"
-- (Nota: O servidor da aplicação também cria estas tabelas automaticamente
--  ao conectar via DATABASE_URL se elas ainda não existirem!)
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('feed', 'medicine', 'supplies', 'equipment', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE movement_direction AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_kind AS ENUM ('payable', 'receivable');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE finance_status AS ENUM ('pending', 'settled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_lot_kind AS ENUM ('layers', 'broilers', 'chicks', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_movement_direction AS ENUM ('in', 'out');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE poultry_exit_reason AS ENUM ('sale', 'transfer', 'mortality', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 1. Produtos do Estoque
CREATE TABLE IF NOT EXISTS farm_products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category product_category NOT NULL,
  unit TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  minimum_quantity DOUBLE PRECISION,
  unit_cost_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Movimentações de Estoque
CREATE TABLE IF NOT EXISTS farm_stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES farm_products(id) ON DELETE RESTRICT,
  direction movement_direction NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  note TEXT,
  source_type TEXT,
  source_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Lançamentos Financeiros (Contas a Pagar e Receber)
CREATE TABLE IF NOT EXISTS farm_finance_entries (
  id SERIAL PRIMARY KEY,
  kind finance_kind NOT NULL,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status finance_status NOT NULL DEFAULT 'pending',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- 4. Lotes de Aves
CREATE TABLE IF NOT EXISTS farm_poultry_lots (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  kind poultry_lot_kind NOT NULL,
  received_at DATE NOT NULL,
  source TEXT,
  breed TEXT,
  age_weeks INTEGER,
  initial_count INTEGER NOT NULL,
  current_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Movimentações do Plantel (Entradas e Baixas de Aves)
CREATE TABLE IF NOT EXISTS farm_poultry_movements (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES farm_poultry_lots(id) ON DELETE RESTRICT,
  direction poultry_movement_direction NOT NULL,
  quantity INTEGER NOT NULL,
  movement_date DATE NOT NULL,
  counterparty TEXT,
  reason poultry_exit_reason,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Receitas de Ração
CREATE TABLE IF NOT EXISTS farm_feed_recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Ingredientes das Receitas de Ração
CREATE TABLE IF NOT EXISTS farm_feed_recipe_ingredients (
  id SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL REFERENCES farm_feed_recipes(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES farm_products(id) ON DELETE RESTRICT,
  quantity_kg DOUBLE PRECISION NOT NULL
);

-- 8. Histórico de Alimentação / Consumo Diário
CREATE TABLE IF NOT EXISTS farm_feeding_logs (
  id SERIAL PRIMARY KEY,
  lot_id INTEGER NOT NULL REFERENCES farm_poultry_lots(id) ON DELETE RESTRICT,
  recipe_id INTEGER NOT NULL REFERENCES farm_feed_recipes(id) ON DELETE RESTRICT,
  lot_label_snapshot TEXT NOT NULL,
  recipe_name_snapshot TEXT NOT NULL,
  quantity_kg DOUBLE PRECISION NOT NULL,
  total_cost_cents INTEGER,
  feeding_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON farm_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_status_due ON farm_finance_entries(status, due_date);
CREATE INDEX IF NOT EXISTS idx_poultry_movements_lot_id ON farm_poultry_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_date ON farm_feeding_logs(feeding_date);

-- =============================================================================
-- DADOS INICIAIS DO MVP (Executado apenas se o banco estiver vazio)
-- =============================================================================
DO $$
DECLARE
  v_milho_id INTEGER;
  v_soja_id INTEGER;
  v_calcario_id INTEGER;
  v_nucleo_id INTEGER;
  v_racao_pintinhos_id INTEGER;
  v_vacina_id INTEGER;
  v_cartela_id INTEGER;
  v_lote_poedeiras_id INTEGER;
  v_lote_frangos_id INTEGER;
  v_lote_pintinhos_id INTEGER;
  v_receita_postura_id INTEGER;
  v_receita_engorda_id INTEGER;
  v_log_id INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM farm_products LIMIT 1) THEN
    -- Produtos do estoque
    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Milho em Grão', 'feed', 'kg', 420, 150, 145)
    RETURNING id INTO v_milho_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Farelo de Soja', 'feed', 'kg', 160, 80, 290)
    RETURNING id INTO v_soja_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Calcário Calcítico', 'feed', 'kg', 45, 20, 85)
    RETURNING id INTO v_calcario_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Núcleo Postura 4%', 'feed', 'kg', 12, 20, 680)
    RETURNING id INTO v_nucleo_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Ração Inicial Pintinhos', 'feed', 'kg', 18, 25, 340)
    RETURNING id INTO v_racao_pintinhos_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Vacina Newcastle + Bronquite', 'medicine', 'un', 3, 2, 4500)
    RETURNING id INTO v_vacina_id;

    INSERT INTO farm_products (name, category, unit, quantity, minimum_quantity, unit_cost_cents)
    VALUES ('Cartelas para 30 Ovos', 'supplies', 'un', 85, 50, 95)
    RETURNING id INTO v_cartela_id;

    -- Movimentações iniciais de estoque
    INSERT INTO farm_stock_movements (product_id, direction, quantity, note)
    VALUES
      (v_milho_id, 'in', 450, 'Compra de 9 sacas na Cooperativa'),
      (v_soja_id, 'in', 180, 'Compra de farelo de soja'),
      (v_nucleo_id, 'in', 20, 'Compra na Casa do Criador'),
      (v_cartela_id, 'out', 15, 'Entrega de ovos na feira de sábado');

    -- Lotes de aves
    INSERT INTO farm_poultry_lots (label, kind, received_at, source, breed, age_weeks, initial_count, current_count)
    VALUES ('Galpão 1 — Poedeiras Caipiras', 'layers', CURRENT_DATE - INTERVAL '45 days', 'Aviário São Pedro', 'Isa Brown', 24, 250, 246)
    RETURNING id INTO v_lote_poedeiras_id;

    INSERT INTO farm_poultry_lots (label, kind, received_at, source, breed, age_weeks, initial_count, current_count)
    VALUES ('Galpão 2 — Frangos de Corte', 'broilers', CURRENT_DATE - INTERVAL '30 days', 'Incubatório Vale Verde', 'Caipirão Pesado', 8, 150, 135)
    RETURNING id INTO v_lote_frangos_id;

    INSERT INTO farm_poultry_lots (label, kind, received_at, source, breed, age_weeks, initial_count, current_count)
    VALUES ('Pinteiro — Reposição Postura', 'chicks', CURRENT_DATE - INTERVAL '10 days', 'Aviário São Pedro', 'Embrapa 051', 2, 80, 80)
    RETURNING id INTO v_lote_pintinhos_id;

    -- Movimentações de aves
    INSERT INTO farm_poultry_movements (lot_id, direction, quantity, movement_date, counterparty, reason)
    VALUES
      (v_lote_poedeiras_id, 'in', 250, CURRENT_DATE - INTERVAL '45 days', 'Aviário São Pedro', NULL),
      (v_lote_poedeiras_id, 'out', 4, CURRENT_DATE - INTERVAL '12 days', 'Adaptação inicial', 'mortality'),
      (v_lote_frangos_id, 'in', 150, CURRENT_DATE - INTERVAL '30 days', 'Incubatório Vale Verde', NULL),
      (v_lote_frangos_id, 'out', 15, CURRENT_DATE - INTERVAL '3 days', 'Restaurante Sabor da Roça', 'sale'),
      (v_lote_pintinhos_id, 'in', 80, CURRENT_DATE - INTERVAL '10 days', 'Aviário São Pedro', NULL);

    -- Receitas de ração
    INSERT INTO farm_feed_recipes (name)
    VALUES ('Mistura Postura Casa (100 kg)')
    RETURNING id INTO v_receita_postura_id;

    INSERT INTO farm_feed_recipe_ingredients (recipe_id, product_id, quantity_kg)
    VALUES
      (v_receita_postura_id, v_milho_id, 62),
      (v_receita_postura_id, v_soja_id, 24),
      (v_receita_postura_id, v_calcario_id, 10),
      (v_receita_postura_id, v_nucleo_id, 4);

    INSERT INTO farm_feed_recipes (name)
    VALUES ('Mistura Engorda Caipira (100 kg)')
    RETURNING id INTO v_receita_engorda_id;

    INSERT INTO farm_feed_recipe_ingredients (recipe_id, product_id, quantity_kg)
    VALUES
      (v_receita_engorda_id, v_milho_id, 70),
      (v_receita_engorda_id, v_soja_id, 26),
      (v_receita_engorda_id, v_nucleo_id, 4);

    -- Registro de alimentação de hoje
    INSERT INTO farm_feeding_logs (lot_id, recipe_id, lot_label_snapshot, recipe_name_snapshot, quantity_kg, total_cost_cents, feeding_date)
    VALUES (v_lote_poedeiras_id, v_receita_postura_id, 'Galpão 1 — Poedeiras Caipiras', 'Mistura Postura Casa (100 kg)', 28, 5466, CURRENT_DATE)
    RETURNING id INTO v_log_id;

    -- Contas a pagar e a receber
    INSERT INTO farm_finance_entries (kind, description, amount_cents, due_date, status, category)
    VALUES
      ('receivable', 'Venda de 45 dúzias de ovos — Mercearia São José', 54000, CURRENT_DATE + INTERVAL '2 days', 'pending', 'Venda de ovos'),
      ('receivable', 'Encomenda de 15 frangos caipiras — Restaurante Sabor da Roça', 67500, CURRENT_DATE + INTERVAL '5 days', 'pending', 'Outros'),
      ('payable', 'Reposição de Milho e Núcleo — Cooperativa Agrícola', 48500, CURRENT_DATE + INTERVAL '3 days', 'pending', 'Ração e alimentação'),
      ('payable', 'Conta de Energia Elétrica dos Galpões', 21890, CURRENT_DATE + INTERVAL '7 days', 'pending', 'Insumos'),
      ('receivable', 'Feira Livre de Sábado — Ovos Caipiras', 38000, CURRENT_DATE - INTERVAL '2 days', 'settled', 'Venda de ovos');
  END IF;
END $$;
