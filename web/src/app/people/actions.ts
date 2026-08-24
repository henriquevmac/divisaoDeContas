'use server'

import { revalidatePath } from 'next/cache'
import { createPerson, renamePerson, deletePerson } from '@/lib/db/people'

function fail(error: unknown) {
  return { error: error instanceof Error ? error.message : 'Something went wrong.' }
}

export async function createPersonAction(name: string) {
  if (name.trim() === '') return { error: 'A name is required.' }
  try {
    await createPerson(name)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}

export async function renamePersonAction(id: string, name: string) {
  if (name.trim() === '') return { error: 'A name is required.' }
  try {
    await renamePerson(id, name)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}

export async function deletePersonAction(id: string) {
  try {
    await deletePerson(id)
  } catch (error) {
    return fail(error)
  }
  revalidatePath('/people')
}
