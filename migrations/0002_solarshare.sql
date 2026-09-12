-- SolarShare app schema: profiles, wallets, order book, trade ledger + chain.
--
-- Runs AFTER 0001_auth.sql (better-auth "user" table). PGLite preview applies
-- it at startup; Neon (deploy) applies it during `npm run build`.
--
-- Money columns are INR (numeric), energy is kWh. `user_id TEXT` scopes every
-- per-user row (matches scaffold convention — the preview dev user id is the
-- string 'dev-user').

create table if not exists profiles (
  user_id    text primary key references "user" ("id") on delete cascade,
  full_name  text not null,
  area       text not null default 'Mumbai',
  panel_kwp  numeric(6,2) not null default 3.0,
  joined_at  timestamptz not null default now()
);

create table if not exists wallets (
  user_id          text primary key references "user" ("id") on delete cascade,
  inr_balance      numeric(12,2) not null default 0,
  kwh_credits      numeric(12,2) not null default 0,
  surplus_kwh      numeric(12,2) not null default 0,
  generated_since  timestamptz not null default now(),
  total_earned_inr numeric(14,2) not null default 0,
  total_spent_inr  numeric(14,2) not null default 0,
  total_sold_kwh   numeric(12,2) not null default 0,
  total_bought_kwh numeric(12,2) not null default 0,
  updated_at       timestamptz not null default now()
);

-- Order book rows. Ambient neighbour orders live client-side (simulation);
-- user-placed orders are persisted here so the book is real for members.
create table if not exists orders (
  id         text primary key,
  user_id    text references "user" ("id") on delete set null,
  peer_name  text not null,
  side       text not null check (side in ('ask', 'bid')),
  kwh        numeric(10,2) not null check (kwh > 0),
  price_inr  numeric(10,3) not null check (price_inr > 0),
  distance_km numeric(5,1),
  source     text,
  status     text not null default 'open' check (status in ('open', 'filled', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_open_idx on orders (user_id) where status = 'open';

-- One row per settlement inside a block (trades, top-ups, withdrawals, listings).
create table if not exists trades (
  id          text primary key,
  block_no    bigint not null,
  tx_hash     text not null,
  kind        text not null check (kind in ('trade', 'topup', 'withdraw', 'listing')),
  buyer_id    text references "user" ("id") on delete set null,
  seller_id   text references "user" ("id") on delete set null,
  buyer_name  text not null,
  seller_name text not null,
  kwh         numeric(10,2) not null default 0,
  price_inr   numeric(10,3) not null default 0,
  amount_inr  numeric(14,2) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists trades_block_idx on trades (block_no);

-- The embedded blockchain: one row per block, hash-chained (prev_hash -> block_hash).
-- Genesis is block 0 with prev_hash = 64 zeros. See src/lib/solar/ledger.server.ts.
create table if not exists blocks (
  block_no   bigint primary key,
  prev_hash  text not null,
  block_hash text not null,
  tx_count   integer not null default 0,
  total_kwh  numeric(12,2) not null default 0,
  total_inr  numeric(14,2) not null default 0,
  timestamp  timestamptz not null
);
