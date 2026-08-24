-- Writes a verified receipt and all its items atomically. Called only after
-- the user confirms verification; nothing reaches the database before that.
create or replace function save_verified_receipt(
  p_merchant text,
  p_store text,
  p_purchased_on date,
  p_payer_person_id uuid,
  p_source_filename text,
  p_source_csv text,
  p_stated_gross numeric,
  p_stated_discount numeric,
  p_stated_net numeric,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
as $$
declare
  v_receipt_id uuid;
begin
  insert into receipts (
    owner_user_id, merchant, store, purchased_on, payer_person_id,
    source_filename, source_csv, stated_gross, stated_discount, stated_net
  ) values (
    auth.uid(), p_merchant, p_store, p_purchased_on, p_payer_person_id,
    p_source_filename, p_source_csv, p_stated_gross, p_stated_discount, p_stated_net
  ) returning id into v_receipt_id;

  insert into items (
    receipt_id, position, category, description,
    quantity, quantity_kind, unit_price, gross_amount, discount, net_amount
  )
  select
    v_receipt_id,
    (item ->> 'position')::integer,
    item ->> 'category',
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    item ->> 'quantityKind',
    (item ->> 'unitPrice')::numeric,
    (item ->> 'grossAmount')::numeric,
    (item ->> 'discount')::numeric,
    (item ->> 'netAmount')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_receipt_id;
end;
$$;
