-- A Settlement used to record only who handed over money, which was
-- unambiguous while every debt was owed to the Owner. Now that any Person can
-- be the Payer of a Receipt, "Ana paid 10,00" no longer says who she paid.
alter table settlements
  add column paid_to_person_id uuid references people (id) on delete cascade;

-- Existing settlements were all implicitly paid to the Owner.
update settlements s
set paid_to_person_id = (
  select p.id
  from people p
  where p.owner_user_id = s.owner_user_id
    and p.is_owner
)
where paid_to_person_id is null;

-- Deliberately no DELETE for rows the backfill could not resolve: the NOT NULL
-- below will fail loudly instead, which is the right outcome. A settlement is a
-- record of money that changed hands and must never be discarded silently.
alter table settlements
  alter column paid_to_person_id set not null;

alter table settlements
  add constraint settlements_distinct_parties
  check (person_id <> paid_to_person_id);

create index settlements_by_counterparty on settlements (paid_to_person_id);

comment on column settlements.person_id is 'The Person who handed over the money.';
comment on column settlements.paid_to_person_id is 'The Person who received it.';
