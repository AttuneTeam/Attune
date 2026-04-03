'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function DeleteInteractionButton({ interactionId }: { interactionId: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this interaction? This cannot be undone.')) return
    const supabase = createClient()
    startTransition(async () => {
      const { error } = await supabase.from('interactions').delete().eq('id', interactionId)
      if (error) { toast.error(error.message); return }
      toast.success('Interaction deleted')
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground disabled:pointer-events-none"
      title="Delete interaction"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
