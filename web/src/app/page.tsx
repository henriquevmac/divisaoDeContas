import { requireUser } from '@/lib/supabase/server'

export default async function HomePage() {
  const user = await requireUser()

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Signed in as {user.email}</h1>
    </main>
  )
}
