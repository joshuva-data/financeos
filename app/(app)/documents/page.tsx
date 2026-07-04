import { createClient }    from '@/lib/supabase/server'
import { DocumentsModule } from '@/components/documents/DocumentsModule'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: documents } = await supabase
    .from('documents').select('*').eq('user_id', user.id)
    .order('uploaded_at', { ascending: false })

  return <DocumentsModule documents={documents ?? []} userId={user.id} />
}
