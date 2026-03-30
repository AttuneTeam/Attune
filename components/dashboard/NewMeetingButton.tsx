'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Plus } from 'lucide-react'

interface Props {
  memberId: string
  memberName: string
}

export function NewMeetingButton({ memberId, memberName }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleCreate = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('meetings')
      .insert({
        participant_id: memberId,
        manager_id: user.id,
        scheduled_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!error && data) {
      router.push(`/meetings/${data.id}`)
    }
    setLoading(false)
  }

  return (
    <Button
      size="sm"
      className="flex-1 text-xs"
      onClick={handleCreate}
      disabled={loading}
      title={`New meeting with ${memberName}`}
    >
      <Plus className="h-3 w-3 mr-1" />
      {loading ? 'Creating...' : 'New meeting'}
    </Button>
  )
}
