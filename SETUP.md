# Setup

One-time steps to get the app running against a fresh Supabase project.
Do them in this order — step 4 depends on having signed in at least once.

## 1. Create the schema

In the Supabase dashboard → **SQL Editor** → New query, run these two files in
order. Paste the contents of each, run, confirm success, then move to the next.

1. `supabase/migrations/0001_initial_schema.sql` — five tables, indexes, and
   row-level security policies.
2. `supabase/migrations/0002_save_receipt.sql` — the `save_verified_receipt`
   function that writes a receipt and its items in one transaction.

Verify: **Table Editor** should now list `people`, `receipts`, `items`,
`assignments` and `settlements`, each showing "RLS enabled".

## 2. Point the app at the project

Dashboard → **Project Settings → API**. Copy the **Project URL** and the
**anon / publishable** key (not the service_role key — that one bypasses RLS and
must never reach the browser).

Create `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

This file is git-ignored and stays on your machine.

## 3. Allow the sign-in redirect

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000`
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

Without this the magic link will refuse to come back to the app. Add the
production URL here too once the app is deployed.

## 4. Sign in, then create yourself as the Owner

```bash
cd web && npm run dev
```

Open `http://localhost:3000`. You will be redirected to `/login`. Enter your
email, then open the link Supabase sends you. You should land on the app signed
in.

Signing in creates your row in `auth.users`. Now create the Owner Person — the
one Person that is you. Back in the SQL Editor, substituting the email you just
signed in with:

```sql
insert into people (owner_user_id, name, is_owner)
select id, 'Henrique', true
from auth.users
where email = 'you@example.com';
```

Verify: `/people` shows one person with a `you` badge and no Delete button.

## 5. Import the sample receipt

Go to `/import` and upload `super_bairro_centro_24-08-2026.csv` from the repository
root. You should see "Super Bairro · Centro · 2026-08-24" prefilled, a green
reconciliation banner reading 191,22 €, and 34 editable lines.

## Everyday use

1. Photograph the receipt and paste it into a Claude conversation, asking for a
   `;`-delimited CSV with the columns
   `Categoria;Artigo;Quantidade;Preço unitário;Valor;Desconto;Valor líquido`
   and a final `;TOTAL;;;<gross>;<discount>;<net>` row.
2. Save it as `<merchant>_<store>_<DD-MM-YYYY>.csv`.
3. Upload it at `/import`, check the reconciliation banner, save.
4. Assign items to people, then settle up from `/people`.
