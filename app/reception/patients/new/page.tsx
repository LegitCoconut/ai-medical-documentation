import { getSession } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { PageHeader } from '@/components/ui'
import { NewPatientForm } from './NewPatientForm'

export default async function NewPatientPage() {
  const session = await getSession()
  if (!session) return null

  return (
    <Shell role="reception" user={session} title="Register patient">
      <PageHeader title="Register patient" />
      <NewPatientForm />
    </Shell>
  )
}
