-- Additive Stripe Connect and Checkout schema for Piecebook.
-- Apply this script in the Supabase SQL Editor. It keeps existing marketplace
-- listing and order records, and stores Stripe identifiers in private tables.

alter table public.marketplace_orders
  add column if not exists payment_status text not null default 'legacy';

alter table public.marketplace_orders enable row level security;
revoke all on table public.marketplace_orders from public, anon, authenticated;
grant all on table public.marketplace_orders to service_role;
drop policy if exists "Marketplace orders are readable by the app" on public.marketplace_orders;

-- Associate existing listings with the seller email already stored on the
-- seller profile when the listing has no explicit contact email.
update public.marketplace_listing as listing
set seller_email = lower(btrim(seller.email))
from public.users as seller
where seller.id = listing.seller_id
  and nullif(btrim(listing.seller_email), '') is null
  and nullif(btrim(seller.email), '') is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.marketplace_orders'::regclass
      and conname = 'marketplace_orders_payment_status_check'
  ) then
    alter table public.marketplace_orders
      add constraint marketplace_orders_payment_status_check
      check (payment_status in ('legacy', 'pending', 'paid', 'failed', 'canceled', 'refunded'));
  end if;
end
$$;

create table if not exists public.marketplace_seller_stripe_accounts (
  seller_email text primary key,
  seller_id uuid not null references public.users(id) on delete restrict,
  stripe_account_id text not null unique,
  onboarding_status text not null default 'incomplete'
    check (onboarding_status in ('incomplete', 'pending', 'connected')),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_seller_stripe_email_normalized
    check (seller_email = lower(btrim(seller_email)))
);
create index if not exists marketplace_seller_stripe_accounts_seller_idx
  on public.marketplace_seller_stripe_accounts (seller_id);
alter table public.marketplace_seller_stripe_accounts enable row level security;
revoke all on table public.marketplace_seller_stripe_accounts from public, anon, authenticated;
grant all on table public.marketplace_seller_stripe_accounts to service_role;

create table if not exists public.marketplace_order_payments (
  marketplace_order_id uuid primary key
    references public.marketplace_orders(id) on delete cascade,
  listing_id uuid not null,
  buyer_email text,
  seller_email text not null,
  stripe_account_id text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  item_price numeric(12, 2) not null check (item_price > 0),
  platform_fee_amount numeric(12, 2) not null check (platform_fee_amount >= 0),
  seller_net_amount numeric(12, 2) not null check (seller_net_amount >= 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  checkout_cancel_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_order_payment_amounts_check
    check (platform_fee_amount <= item_price and seller_net_amount = item_price - platform_fee_amount)
);
create unique index if not exists marketplace_order_payments_one_pending_listing_idx
  on public.marketplace_order_payments (listing_id)
  where payment_status = 'pending';
create index if not exists marketplace_order_payments_status_idx
  on public.marketplace_order_payments (payment_status, created_at);
alter table public.marketplace_order_payments enable row level security;
revoke all on table public.marketplace_order_payments from public, anon, authenticated;
grant all on table public.marketplace_order_payments to service_role;

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  account_id text,
  processed_at timestamptz not null default now()
);
alter table public.stripe_webhook_events enable row level security;
revoke all on table public.stripe_webhook_events from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;

-- The legacy one-step checkout RPC would bypass Stripe, so only the old API
-- used it. Keep the function for data compatibility but remove public access.
revoke all on function public.checkout_marketplace_listing(uuid, uuid, integer)
  from public, anon, authenticated;

create or replace function public.create_marketplace_payment_order(
  requested_listing_id uuid,
  requested_buyer_id uuid,
  requested_quantity integer,
  requested_stripe_account_id text,
  requested_cancel_token_hash text
)
returns public.marketplace_orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_listing public.marketplace_listing%rowtype;
  selected_buyer public.users%rowtype;
  selected_seller public.users%rowtype;
  selected_stripe_account public.marketplace_seller_stripe_accounts%rowtype;
  created_order public.marketplace_orders%rowtype;
  total_amount numeric(12, 2);
  platform_fee numeric(12, 2);
  seller_net numeric(12, 2);
begin
  if requested_quantity is null or requested_quantity < 1 then
    raise exception using errcode = 'P0001', message = 'Choose a quantity of at least one.';
  end if;
  if requested_cancel_token_hash is null or length(requested_cancel_token_hash) <> 64 then
    raise exception using errcode = 'P0001', message = 'The checkout request is invalid.';
  end if;

  select * into selected_listing
    from public.marketplace_listing
    where id = requested_listing_id
    for update;
  if not found or selected_listing.status <> 'available' then
    raise exception using errcode = 'P0001', message = 'This listing is no longer available.';
  end if;
  if selected_listing.quantity < requested_quantity then
    raise exception using errcode = 'P0001', message = 'There is not enough stock for that quantity.';
  end if;
  if selected_listing.price <= 0 then
    raise exception using errcode = 'P0001', message = 'This listing cannot be purchased online.';
  end if;
  if nullif(btrim(selected_listing.seller_email), '') is null then
    raise exception using errcode = 'P0001', message = 'The seller has not added a payout email to this listing.';
  end if;

  select * into selected_buyer
    from public.users
    where id = requested_buyer_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'The selected buyer profile could not be found.';
  end if;
  if selected_listing.seller_id = requested_buyer_id then
    raise exception using errcode = 'P0001', message = 'You cannot buy your own listing.';
  end if;
  select * into selected_seller
    from public.users
    where id = selected_listing.seller_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'The seller profile for this listing could not be found.';
  end if;

  select * into selected_stripe_account
    from public.marketplace_seller_stripe_accounts
    where seller_id = selected_listing.seller_id
      and stripe_account_id = requested_stripe_account_id
      and charges_enabled = true
      and payouts_enabled = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'The seller is not ready to accept payments.';
  end if;

  total_amount := round(selected_listing.price * requested_quantity, 2);
  platform_fee := round(total_amount * 0.10, 2);
  seller_net := total_amount - platform_fee;

  update public.marketplace_listing
    set status = 'pending'
    where id = selected_listing.id;

  insert into public.marketplace_orders (
    source_listing_id, listing_id, buyer_id, seller_id,
    buyer_name, buyer_role, buyer_location, buyer_image,
    seller_name, seller_role, seller_location, seller_image,
    listing_title, listing_previous_price, listing_category, listing_condition,
    listing_description, listing_location, listing_photos, listing_category_details,
    listing_color, listing_material, unit_price, quantity, total_price, payment_status
  ) values (
    selected_listing.id, selected_listing.id, selected_buyer.id, selected_listing.seller_id,
    coalesce(nullif(btrim(selected_buyer.full_name), ''), 'Buyer'), selected_buyer.role,
    selected_buyer.location, selected_buyer.image,
    coalesce(nullif(btrim(selected_seller.full_name), ''), selected_listing.seller_name),
    selected_seller.role, selected_seller.location, selected_seller.image,
    selected_listing.title, selected_listing.previous_price, selected_listing.category,
    selected_listing.condition, selected_listing.description, selected_listing.location,
    selected_listing.photos, selected_listing.category_details, selected_listing.color,
    selected_listing.material, selected_listing.price, requested_quantity,
    total_amount, 'pending'
  ) returning * into created_order;

  insert into public.marketplace_order_payments (
    marketplace_order_id, listing_id, seller_email, stripe_account_id,
    item_price, platform_fee_amount, seller_net_amount, currency,
    payment_status, checkout_cancel_token_hash
  ) values (
    created_order.id, selected_listing.id, lower(btrim(selected_listing.seller_email)),
    selected_stripe_account.stripe_account_id, total_amount, platform_fee,
    seller_net, 'usd', 'pending', requested_cancel_token_hash
  );

  return created_order;
end
$$;
revoke all on function public.create_marketplace_payment_order(uuid, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.create_marketplace_payment_order(uuid, uuid, integer, text, text)
  to service_role;

create or replace function public.complete_marketplace_stripe_order(
  requested_event_id text,
  requested_event_type text,
  requested_order_id uuid,
  requested_session_id text,
  requested_account_id text,
  requested_payment_intent_id text,
  requested_buyer_email text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_payment public.marketplace_order_payments%rowtype;
  selected_order public.marketplace_orders%rowtype;
begin
  insert into public.stripe_webhook_events (stripe_event_id, event_type, account_id)
    values (requested_event_id, requested_event_type, requested_account_id)
    on conflict (stripe_event_id) do nothing;
  if not found then return false; end if;

  select * into selected_payment
    from public.marketplace_order_payments
    where marketplace_order_id = requested_order_id
    for update;
  if not found
    or selected_payment.stripe_checkout_session_id is distinct from requested_session_id
    or selected_payment.stripe_account_id is distinct from requested_account_id then
    raise exception using errcode = 'P0001', message = 'Stripe session does not match the marketplace order.';
  end if;
  if selected_payment.payment_status <> 'pending' then return false; end if;

  select * into selected_order
    from public.marketplace_orders
    where id = requested_order_id
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Marketplace order was not found.';
  end if;

  update public.marketplace_order_payments
    set payment_status = 'paid',
        stripe_payment_intent_id = requested_payment_intent_id,
        buyer_email = coalesce(nullif(lower(btrim(requested_buyer_email)), ''), buyer_email),
        updated_at = now()
    where marketplace_order_id = selected_payment.marketplace_order_id;
  update public.marketplace_orders
    set payment_status = 'paid'
    where id = selected_order.id;

  update public.marketplace_listing
    set quantity = greatest(quantity - selected_order.quantity, 0),
        status = case when quantity - selected_order.quantity <= 0 then 'sold' else 'available' end
    where id = selected_payment.listing_id
      and status in ('pending', 'available');

  insert into public.message (listing_id, marketplace_order_id, sender_id, recipient_id, body)
    values (
      selected_payment.listing_id, selected_order.id, selected_order.buyer_id,
      selected_order.seller_id,
      left(format('Payment confirmed: %s bought %s x %s. Order #%s.',
        selected_order.buyer_name, selected_order.quantity, selected_order.listing_title,
        upper(left(selected_order.id::text, 8))), 1000)
    );
  return true;
end
$$;
revoke all on function public.complete_marketplace_stripe_order(text, text, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.complete_marketplace_stripe_order(text, text, uuid, text, text, text, text)
  to service_role;

create or replace function public.expire_marketplace_stripe_order(
  requested_event_id text,
  requested_event_type text,
  requested_order_id uuid,
  requested_session_id text,
  requested_account_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_payment public.marketplace_order_payments%rowtype;
  selected_order public.marketplace_orders%rowtype;
  next_status text;
begin
  insert into public.stripe_webhook_events (stripe_event_id, event_type, account_id)
    values (requested_event_id, requested_event_type, requested_account_id)
    on conflict (stripe_event_id) do nothing;
  if not found then return false; end if;

  select * into selected_payment
    from public.marketplace_order_payments
    where marketplace_order_id = requested_order_id
    for update;
  if not found
    or selected_payment.stripe_checkout_session_id is distinct from requested_session_id
    or selected_payment.stripe_account_id is distinct from requested_account_id then
    raise exception using errcode = 'P0001', message = 'Stripe session does not match the marketplace order.';
  end if;
  if selected_payment.payment_status <> 'pending' then return true; end if;

  select * into selected_order
    from public.marketplace_orders
    where id = requested_order_id
    for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Marketplace order was not found.';
  end if;

  next_status := case
    when requested_event_type in ('checkout.session.async_payment_failed', 'payment_intent.payment_failed')
      then 'failed'
    else 'canceled'
  end;
  update public.marketplace_order_payments
    set payment_status = next_status, updated_at = now()
    where marketplace_order_id = selected_payment.marketplace_order_id;
  update public.marketplace_orders
    set payment_status = next_status
    where id = selected_order.id;
  update public.marketplace_listing
    set status = 'available'
    where id = selected_payment.listing_id
      and status = 'pending'
      and not exists (
        select 1 from public.marketplace_order_payments as other_payment
        where other_payment.listing_id = selected_payment.listing_id
          and other_payment.payment_status = 'pending'
      );
  return true;
end
$$;
revoke all on function public.expire_marketplace_stripe_order(text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.expire_marketplace_stripe_order(text, text, uuid, text, text)
  to service_role;

create or replace function public.abandon_marketplace_stripe_order(requested_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_payment public.marketplace_order_payments%rowtype;
begin
  select * into selected_payment
    from public.marketplace_order_payments
    where marketplace_order_id = requested_order_id
    for update;
  if not found or selected_payment.payment_status <> 'pending'
    or selected_payment.stripe_checkout_session_id is not null then
    return false;
  end if;
  update public.marketplace_order_payments
    set payment_status = 'failed', updated_at = now()
    where marketplace_order_id = requested_order_id;
  update public.marketplace_orders
    set payment_status = 'failed'
    where id = requested_order_id;
  update public.marketplace_listing
    set status = 'available'
    where id = selected_payment.listing_id
      and status = 'pending'
      and not exists (
        select 1 from public.marketplace_order_payments as other_payment
        where other_payment.listing_id = selected_payment.listing_id
          and other_payment.payment_status = 'pending'
      );
  return true;
end
$$;
revoke all on function public.abandon_marketplace_stripe_order(uuid)
  from public, anon, authenticated;
grant execute on function public.abandon_marketplace_stripe_order(uuid)
  to service_role;
