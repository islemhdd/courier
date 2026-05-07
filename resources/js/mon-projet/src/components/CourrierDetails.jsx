import { lazy, Suspense, useEffect, useState } from 'react'
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
import SkeletonLoader, { ModalSkeleton } from './SkeletonLoader'

const CourrierTransmitForm = lazy(() => import('./CourrierTransmitForm'))
const AllDetails = lazy(() => import('./AllDetails'))

export default function CourrierDetails({
  courrier,
  actionLoading = false,
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
    if (!isAllDetailsOpen) return undefined

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
      <div className="glass-panel-strong rounded-[2rem] p-5">
        <SkeletonLoader variant="detail" />
      </div>
    )
  }

  const contenuRestreint =
    courrier.contenu_restreint === true || courrier.peut_voir_details === false

  const peutValider = courrier.peut_etre_valide === true
  const peutModifier = courrier.peut_etre_modifie === true
  const peutSupprimer = courrier.peut_etre_supprime === true
  const peutArchiver = !contenuRestreint && courrier.peut_etre_archive === true
  const peutTransmettre = !contenuRestreint && courrier.peut_etre_transmis === true
  const canReply =
    !contenuRestreint &&
    courrier?.peut_repondre === true &&
    typeof onReply === 'function'

  const actionDisabled = actionLoading === true

  const handleDelete = () => {
    if (!onDelete) return

    const confirmed = window.confirm('Voulez-vous vraiment supprimer ce courrier ?')

    if (confirmed) {
      onDelete(courrier.id)
    }
  }

  return (
    <aside className="glass-panel-strong sticky top-28 rounded-[2rem] p-5">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-950 text-white shadow-lg shadow-slate-900/12">
            <FileText size={22} />
          </div>

          <h2 className="break-words text-xl font-semibold tracking-tight text-slate-900">
            {courrier.numero || '-'}
          </h2>

          <p className="mt-1 max-w-[18rem] break-words text-sm leading-relaxed text-slate-500">
            {courrier.objet || '-'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAllDetailsOpen(true)}
            className="glass-panel flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 hover:text-slate-900"
            aria-label="Afficher tous les details"
            title="Afficher tous les details"
          >
            <Plus size={18} />
          </button>

          <button
            type="button"
            className="glass-panel flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 hover:text-amber-500"
            aria-label="Favori"
            title="Favori"
          >
            <Star size={18} />
          </button>
        </div>
      </div>

      <div
        className={`soft-divider space-y-3 border-y py-5 text-sm ${
          contenuRestreint ? 'relative overflow-hidden rounded-[1.5rem] bg-slate-50 px-4' : ''
        }`}
      >
        <div className={contenuRestreint ? 'pointer-events-none select-none blur-sm' : ''}>
          <Detail label="Type" value={courrier.type || '-'} />
          <Detail label="Source" value={courrier.source?.libelle || courrier.expediteur} />
          <Detail label="Date de reception" value={formatDate(courrier.date_reception)} />
          <Detail label="Confidentialite" value={courrier.niveau_confidentialite?.libelle} />
          <Detail label="Statut" value={getStatusLabel(courrier.statut)} />
          <Detail label="Reponse attendue" value={courrier.requiert_reponse ? 'Oui' : 'Non'} />
        </div>

        {contenuRestreint && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[1.5rem] bg-white/70 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm">
              Contenu non accessible
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        {peutValider && (
          <ActionButton
            label={actionLoading ? 'Traitement...' : 'Valider'}
            icon={<Check size={16} />}
            disabled={actionDisabled}
            variant="primary"
            onClick={() => onValidate?.(courrier.id)}
          />
        )}

        {peutModifier && (
          <ActionButton
            label="Modifier"
            icon={<Pencil size={16} />}
            disabled={actionDisabled}
            variant="warning"
            onClick={() => onEdit?.(courrier)}
          />
        )}

        {peutTransmettre && (
          <ActionButton
            label="Transmettre"
            icon={<Send size={16} />}
            disabled={actionDisabled}
            variant="outline"
            onClick={() => setIsTransmitOpen(true)}
          />
        )}

        {canReply && (
          <ActionButton
            label="Repondre"
            icon={<MessageCircle size={16} />}
            disabled={actionDisabled}
            variant="neutral"
            onClick={() => onReply(courrier)}
          />
        )}
      </div>

      {peutArchiver && (
        <ActionButton
          label="Archiver"
          icon={<Archive size={16} />}
          disabled={actionDisabled}
          variant="neutral"
          className="mt-3 w-full"
          onClick={() => onArchive?.(courrier.id)}
        />
      )}

      {peutSupprimer && (
        <ActionButton
          label="Supprimer"
          icon={<Trash2 size={16} />}
          disabled={actionDisabled}
          variant="danger"
          className="mt-3 w-full"
          onClick={handleDelete}
        />
      )}

      {isTransmitOpen && (
        <Suspense fallback={<ModalSkeleton title="Chargement du module de transmission..." />}>
          <CourrierTransmitForm
            courrier={courrier}
            onClose={() => setIsTransmitOpen(false)}
            onSubmit={(data) => onTransmit?.(courrier.id, data)}
          />
        </Suspense>
      )}

      {isAllDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsAllDetailsOpen(false)}
            aria-label="Fermer la fenetre"
          />

          <div className="glass-panel-strong relative z-10 w-full max-w-4xl overflow-hidden rounded-[2rem] shadow-2xl">
            <div className="soft-divider flex items-center justify-between border-b px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Details du courrier
                </p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {courrier.numero || '-'} • {courrier.objet || '-'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAllDetailsOpen(false)}
                className="glass-panel flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 hover:text-slate-700"
                aria-label="Fermer"
                title="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[80vh] overflow-auto px-6 py-5">
              <Suspense fallback={<SkeletonLoader variant="detail" />}>
                <AllDetails courrier={courrier} contenuRestreint={contenuRestreint} />
              </Suspense>
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
      <span className="min-w-0 break-words text-right font-medium text-slate-700">
        {value || '-'}
      </span>
    </div>
  )
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled = false,
  className = '',
  variant = 'primary',
}) {
  const tones = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    warning: 'bg-amber-500 text-white hover:bg-amber-600',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    outline: 'border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100',
    neutral: 'border border-slate-200 bg-white/70 text-slate-700 hover:bg-slate-50',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-[1.25rem] px-4 py-3 text-sm font-medium shadow-sm ${
        tones[variant]
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${className}`}
    >
      {icon}
      {label}
    </button>
  )
}
