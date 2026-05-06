import { useEffect, useState } from 'react'
import {
  Archive,
  Check,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Send,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { formatDate, getStatusLabel } from '../lib/courrier'
import CourrierTransmitForm from './CourrierTransmitForm'
import AllDetails from './AllDetails'

export default function CourrierDetails({
  courrier,
  onValidate,
  onArchive,
  onEdit,
  onDelete,
  onTransmit,
  onReply,
}) {
  const [isTransmitOpen, setIsTransmitOpen] = useState(false)
  const [isAllDetailsOpen, setIsAllDetailsOpen] = useState(false)

  useEffect(() => {
    if (!isAllDetailsOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAllDetailsOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAllDetailsOpen])

  if (!courrier) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        Selectionne un courrier.
      </div>
    )
  }

  const contenuRestreint =
    courrier.contenu_restreint === true ||
    courrier.peut_voir_details === false

  const peutValider = courrier.peut_etre_valide === true
  const peutModifier = courrier.peut_etre_modifie === true
  const peutSupprimer = courrier.peut_etre_supprime === true
  const peutArchiver = !contenuRestreint && courrier.peut_etre_archive === true
  const peutTransmettre = !contenuRestreint && courrier.peut_etre_transmis === true
  const canReply =
    !contenuRestreint &&
    courrier?.peut_repondre === true &&
    typeof onReply === 'function'

  const handleDelete = () => {
    if (!onDelete) return

    const ok = window.confirm('Voulez-vous vraiment supprimer ce courrier ?')

    if (ok) {
      onDelete(courrier.id)
    }
  }

  return (
    <aside className="relative rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <FileText size={20} />
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            {courrier.numero || '-'}
          </h2>

          <p className="mt-1 max-w-[18rem] text-sm text-slate-500 break-words">
            {courrier.objet || '-'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsAllDetailsOpen(true)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Afficher tous les détails"
            title="Afficher tous les détails"
          >
            <Plus size={18} />
          </button>

          <button
            type="button"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"
            aria-label="Favori"
            title="Favori"
          >
            <Star size={18} />
          </button>
        </div>
      </div>

      <div
        className={`space-y-3 border-y border-slate-100 py-5 text-sm ${
          contenuRestreint
            ? 'relative overflow-hidden rounded-2xl bg-slate-50 p-4'
            : ''
        }`}
      >
        <div
          className={
            contenuRestreint ? 'pointer-events-none select-none blur-sm' : ''
          }
        >
          <Detail label="Type" value={courrier.type || '-'} />
          <Detail label="Source" value={courrier.source?.libelle || courrier.expediteur} />
          <Detail label="Date de reception" value={formatDate(courrier.date_reception)} />
          <Detail
            label="Confidentialite"
            value={courrier.niveau_confidentialite?.libelle}
          />
          <Detail label="Statut" value={getStatusLabel(courrier.statut)} />
          <Detail label="Reponse attendue" value={courrier.requiert_reponse ? 'Oui' : 'Non'} />
        </div>

        {contenuRestreint && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm">
              Contenu non accessible
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {peutValider && (
          <button
            type="button"
            onClick={() => onValidate?.(courrier.id)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Check size={16} />
            Valider
          </button>
        )}

        {peutModifier && (
          <button
            type="button"
            onClick={() => onEdit?.(courrier)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-medium text-white hover:bg-amber-600"
          >
            <Pencil size={16} />
            Modifier
          </button>
        )}

        {peutTransmettre && (
          <button
            type="button"
            onClick={() => setIsTransmitOpen(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <Send size={16} />
            Transmettre
          </button>
        )}

        {canReply && (
          <button
            type="button"
            onClick={() => onReply(courrier)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <MessageCircle size={16} />
            Répondre
          </button>
        )}
      </div>

      {isTransmitOpen && (
        <CourrierTransmitForm
          courrier={courrier}
          onClose={() => setIsTransmitOpen(false)}
          onSubmit={(data) => onTransmit?.(courrier.id, data)}
        />
      )}

      {peutArchiver && (
        <button
          type="button"
          onClick={() => onArchive?.(courrier.id)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Archive size={16} />
          Archiver
        </button>
      )}

      {peutSupprimer && (
        <button
          type="button"
          onClick={handleDelete}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700"
        >
          <Trash2 size={16} />
          Supprimer
        </button>
      )}

      {isAllDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsAllDetailsOpen(false)}
            aria-label="Fermer la fenêtre"
          />

          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Détails du courrier
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {courrier.numero || '-'} • {courrier.objet || '-'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAllDetailsOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-auto px-6 py-5">
              <AllDetails courrier={courrier} contenuRestreint={contenuRestreint} />
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-700 break-words">
        {value || '-'}
      </span>
    </div>
  )
}
