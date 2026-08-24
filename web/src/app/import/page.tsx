import { listPeople } from '@/lib/db/people'
import { ImportScreen } from './ImportScreen'

export default async function ImportPage() {
  const people = await listPeople()
  return <ImportScreen people={people} />
}
