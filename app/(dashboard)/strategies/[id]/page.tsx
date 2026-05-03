import { redirect } from 'next/navigation'

export default async function StrategyRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/initiatives/${id}`)
}
