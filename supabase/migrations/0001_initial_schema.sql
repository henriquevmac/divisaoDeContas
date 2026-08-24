-- People. Exactly one per owner is flagged as the Owner.
create table people (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_owner boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index people_one_owner_per_user
  on people (owner_user_id)
  where is_owner;

create unique index people_unique_name_per_user
  on people (owner_user_id, lower(name));

-- One shopping trip. stated_* come from the transcription's TOTAL row and are
-- kept so reconciliation can be re-checked later.
create table receipts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  merchant text not null default '',
  store text not null default '',
  purchased_on date not null,
  payer_person_id uuid not null references people (id) on delete restrict,
  source_filename text not null default '',
  source_csv text not null default '',
  stated_gross numeric(12, 4),
  stated_discount numeric(12, 4),
  stated_net numeric(12, 4),
  created_at timestamptz not null default now()
);

create index receipts_by_date on receipts (owner_user_id, purchased_on desc);

-- Money is numeric, never float. Amounts are stored exactly; rounding to cents
-- happens only at display (ADR-0002).
create table items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references receipts (id) on delete cascade,
  position integer not null,
  category text not null default '',
  description text not null,
  quantity numeric(12, 4) not null,
  quantity_kind text not null check (quantity_kind in ('count', 'weight')),
  unit_price numeric(12, 4) not null,
  gross_amount numeric(12, 4) not null,
  discount numeric(12, 4) not null default 0,
  net_amount numeric(12, 4) not null
);

create index items_by_receipt on items (receipt_id, position);

-- A person is responsible for an item. Cost divides equally among these rows.
create table assignments (
  item_id uuid not null references items (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  primary key (item_id, person_id)
);

create index assignments_by_person on assignments (person_id);

-- A recorded amount handed over, never a boolean flag (ADR-0003).
create table settlements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null references people (id) on delete cascade,
  amount numeric(12, 4) not null,
  settled_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index settlements_by_person on settlements (person_id, settled_on desc);

-- Row-level security: every row reachable only by the user who owns it.
alter table people enable row level security;
alter table receipts enable row level security;
alter table items enable row level security;
alter table assignments enable row level security;
alter table settlements enable row level security;

create policy people_owner on people
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy receipts_owner on receipts
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy items_owner on items
  for all using (
    exists (
      select 1 from receipts r
      where r.id = items.receipt_id and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from receipts r
      where r.id = items.receipt_id and r.owner_user_id = auth.uid()
    )
  );

create policy assignments_owner on assignments
  for all using (
    exists (
      select 1 from items i
      join receipts r on r.id = i.receipt_id
      where i.id = assignments.item_id and r.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from items i
      join receipts r on r.id = i.receipt_id
      where i.id = assignments.item_id and r.owner_user_id = auth.uid()
    )
  );

create policy settlements_owner on settlements
  for all using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());
