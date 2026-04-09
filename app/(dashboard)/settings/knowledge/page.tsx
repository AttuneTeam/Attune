import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { KnowledgeManager } from '@/components/settings/KnowledgeManager'

export default async function KnowledgePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: documents } = await supabase
    .from('knowledge_documents')
    .select('id, title, source, created_at')
    .eq('manager_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Knowledge base</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload reference documents — career ladders, performance frameworks, engineering principles, company strategy — so the AI assistant can reason from them directly.
        </p>
      </div>
      <KnowledgeManager initialDocuments={documents ?? []} />
    </div>
  )
}
