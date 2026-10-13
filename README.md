# Team Dashboard

Internal task, attendance and delivery-tracking dashboard. See `docs/SPEC.md` for the product spec and `supabase/schema.sql` for the database.

## Run it locally
```bash
npm install
cp .env.example .env.local   # already points at the team-dashboard Supabase project
npm run dev                  # http://localhost:3000
```

## First-time setup
1. Open the app and **Create an account**. New accounts start inactive.
2. Make the first account an admin (Supabase dashboard -> SQL editor):
   ```sql
   update profiles set role = 'admin', active = true
   where id = (select id from auth.users where email = 'YOU@COMPANY.COM');
   ```
3. Sign in, then use **Team** to approve everyone else and set roles, **Clients** to add clients and projects, and **Tasks -> New task**.

If sign-up says "check your email", turn off *Confirm email* in Supabase -> Authentication -> Providers -> Email (fine for a small internal tool).

## Deploy (free)
Import the GitHub repo into Vercel and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.example`.
