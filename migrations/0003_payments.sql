-- UPI payment methods + wallet funding records.
--
-- This is intentionally provider-neutral: it stores the member's UPI VPA,
-- generated UPI references/intents, and the block that credited/debited the
-- SolarShare wallet. A real payment gateway can later reconcile these rows by
-- updating `status`, without changing wallet/ledger semantics.

create table if not exists payment_methods (
  id            text primary key,
  user_id       text not null references "user" ("id") on delete cascade,
  type          text not null default 'upi' check (type in ('upi')),
  label         text not null,
  upi_id        text not null,
  holder_name   text,
  is_default    boolean not null default false,
  status        text not null default 'active' check (status in ('active', 'disabled')),
  last_used_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, upi_id)
);

create unique index if not exists payment_methods_default_user_idx
  on payment_methods (user_id)
  where is_default and status = 'active';

create index if not exists payment_methods_user_idx
  on payment_methods (user_id, status, created_at desc);

create table if not exists payments (
  id            text primary key,
  user_id       text not null references "user" ("id") on delete cascade,
  method_id     text references payment_methods (id) on delete set null,
  direction     text not null check (direction in ('topup', 'withdraw')),
  status        text not null default 'confirmed' check (status in ('pending', 'confirmed', 'failed')),
  amount_inr    numeric(14,2) not null check (amount_inr > 0),
  provider      text not null default 'UPI',
  provider_ref  text not null,
  upi_id        text,
  upi_intent    text,
  block_no      bigint references blocks (block_no) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists payments_user_created_idx
  on payments (user_id, created_at desc);

create index if not exists payments_block_idx
  on payments (block_no);
