import NewCourrierForm from './NewCourrierForm'
import ReplyCourrierForm from './ReplyCourrierForm'

export default function CourrierForm({
  type = 'entrant',
  onClose,
  onSuccess,
  initialData = null
}) {
  // Détecter si c'est une réponse
  const isReply = !!initialData?.parent_courrier_id

  if (isReply) {
    return (
      <ReplyCourrierForm
        type={type}
        onClose={onClose}
        onSuccess={onSuccess}
        initialData={initialData}
      />
    )
  }

  return (
    <NewCourrierForm
      type={type}
      onClose={onClose}
      onSuccess={onSuccess}
      initialData={initialData}
    />
  )
}
