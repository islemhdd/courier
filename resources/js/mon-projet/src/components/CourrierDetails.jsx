import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Archive,
  Calendar,
  CheckCircle2,
  FileText,
  Globe,
  Info,
  Lock,
  MessageCircle,
  Paperclip,
  Pencil,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import clsx from 'clsx'

import { courrierApi } from '../api/courrierApi'
import { formatDate, getStatusLabel, getStatusTone } from '../lib/courrier'
import Badge from './Badge'
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
  onClose,
  showCloseButton = false,
}) {
  const navigate = useNavigate()
  const [isTransmitOpen, setIsTransmitOpen] = useState(false)
  const [isAllDetailsOpen, setIsAllDetailsOpen] = useState(false)
  const [detailsState, setDetailsState] = useState({
    loading: false,
    courrier: null,
    error: '',
  })
  const detailsRequestRef = useRef(0)

  const isArchiveRecord = Boolean(courrier?.archive_le || courrier?.statut_original || courrier?.courrier_original_id)

  useEffect(() => {
    if (!isAllDetailsOpen) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsAllDetailsOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isAllDetailsOpen])

  useEffect(() => {
    if (!isAllDetailsOpen || !courrier) return undefined

    if (isArchiveRecord || !courrier.id) return undefined

    const requestId = detailsRequestRef.current + 1
    detailsRequestRef.current = requestId

    let active = true

    courrierApi.show(courrier.id)
      .then((res) => {
        if (!active || detailsRequestRef.current !== requestId) return
        const nextCourrier = res.data?.courrier || null
        setDetailsState({
          loading: false,
          courrier: nextCourrier,
          error: nextCourrier ? '' : 'Courrier introuvable.',
        })
      })
      .catch((err) => {
        if (!active || detailsRequestRef.current !== requestId) return
        setDetailsState({
          loading: false,
          courrier: null,
          error: getDetailsErrorMessage(err),
        })
      })

    return () => {
      active = false
    }
  }, [isAllDetailsOpen, courrier, isArchiveRecord])

  if (!courrier) {
    return (
      <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100/60 min-h-[500px] flex flex-col items-center justify-center text-slate-300">
        <FileText size={48} className="mb-4 opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest">Selectionnez un document</p>
      </div>
    )
  }

  const contenuRestreint = courrier.contenu_restreint === true || courrier.peut_voir_details === false
  const peutValider = courrier.peut_etre_valide === true
  const peutModifier = courrier.peut_etre_modifie === true
  const peutSupprimer = courrier.peut_etre_supprime === true
  const peutArchiver = !contenuRestreint && courrier.peut_etre_archive === true
  const peutTransmettre = !contenuRestreint && courrier.peut_etre_transmis === true
  const canReply = !contenuRestreint && courrier?.peut_repondre === true && typeof onReply === 'function'
  const actionDisabled = actionLoading === true
  const modalCourrier = detailsState.courrier
  const modalContenuRestreint = modalCourrier
    ? modalCourrier.contenu_restreint === true || modalCourrier.peut_voir_details === false
    : contenuRestreint
  const currentDetailsLoading = detailsState.loading || (
    isAllDetailsOpen &&
    !isArchiveRecord &&
    !detailsState.error &&
    (!modalCourrier || modalCourrier.id !== courrier.id)
  )

  const handleDelete = () => {
    if (!onDelete || !window.confirm('Voulez-vous vraiment supprimer ce courrier ?')) return
    onDelete(courrier.id)
  }

  const handleOpenDetails = () => {
    if (!isArchiveRecord && courrier.id) {
      navigate(`/courriers/${courrier.id}`)
      return
    }

    setDetailsState(
      isArchiveRecord || !courrier.id
        ? { loading: false, courrier, error: '' }
        : { loading: true, courrier: null, error: '' },
    )
    setIsAllDetailsOpen(true)
  }

  const handleReplyFromDetails = () => {
    setIsAllDetailsOpen(false)
    onReply?.(modalCourrier || courrier)
  }

  const handleTransmitFromDetails = () => {
    setIsAllDetailsOpen(false)
    setIsTransmitOpen(true)
  }

  const handleArchiveFromDetails = () => {
    setIsAllDetailsOpen(false)
    onArchive?.(courrier.id)
  }

  return (
    <aside className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-900/5 border border-slate-100/60 flex max-h-full flex-col gap-8 overflow-y-auto animate-in slide-in-from-right-4 duration-300">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="h-16 w-16 rounded-[1.5rem] bg-slate-950 text-white flex items-center justify-center shadow-2xl shadow-slate-900/20 shrink-0">
            <FileText size={28} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenDetails}
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all group shadow-sm"
              title="Apercu complet"
            >
              <Info size={18} className="group-hover:scale-110 transition-transform" />
            </button>
            <button
              className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-300 hover:text-amber-500 transition-all shadow-sm"
              title="Favoris"
            >
              <Star size={18} />
            </button>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm"
                title="Fermer"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none mb-3 truncate" title={courrier.numero}>
            {courrier.numero || '-'}
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant={getStatusTone(courrier.statut || courrier.statut_original)} dot size="xs">
              {courrier.archive_le ? 'Archive' : getStatusLabel(courrier.statut || courrier.statut_original)}
            </Badge>
            <Badge variant="indigo" size="xs">{courrier.type || '-'}</Badge>
          </div>
          <p className="text-sm font-bold text-slate-500 leading-relaxed uppercase tracking-tight line-clamp-2">
            {contenuRestreint ? 'Contenu restreint' : courrier.objet || '-'}
          </p>
        </div>
      </div>

      <div className={clsx(
        'relative rounded-3xl p-6 transition-all border',
        contenuRestreint ? 'bg-slate-100 border-slate-200' : 'bg-slate-50 border-slate-100',
      )}>
        {contenuRestreint ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Lock size={28} className="text-slate-400 mb-2" />
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Contenu restreint</p>
            <p className="mt-2 text-xs font-medium leading-5 text-slate-500">
              Vous n'avez pas l'autorisation de consulter ce courrier.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <CompactInfo icon={<Globe size={14} />} label="Source" value={courrier.source?.libelle || courrier.expediteur} />
            <CompactInfo icon={<Calendar size={14} />} label="Reception" value={formatDate(courrier.date_reception)} />
            <CompactInfo icon={<ShieldCheck size={14} />} label="Confidentialité" value={courrier.niveau_confidentialite?.libelle} />
            <CompactInfo icon={<Paperclip size={14} />} label="Annexes" value={`${courrier.attachments?.length || 0} fichier(s)`} />
          </div>
        )}
      </div>

      <div className="space-y-3 pt-2">
        {peutValider && (
          <MainAction
            label={actionLoading ? 'Traitement...' : 'Approuver le document'}
            icon={<CheckCircle2 size={18} />}
            variant="emerald"
            onClick={() => onValidate?.(courrier.id)}
            disabled={actionDisabled}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          {peutTransmettre && (
            <SideAction icon={<Send size={16} />} label="Transmettre" onClick={() => setIsTransmitOpen(true)} disabled={actionDisabled} />
          )}
          {canReply && (
            <SideAction icon={<MessageCircle size={16} />} label="Repondre" onClick={() => onReply(courrier)} disabled={actionDisabled} />
          )}
        </div>

        <div className="pt-2">
          <button
            onClick={() => navigate(`/courriers/${courrier.id}`)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <FileText size={15} />
            Page complete
          </button>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          {peutModifier && (
            <GhostAction icon={<Pencil size={14} />} label="Modifier les métadonnées" onClick={() => onEdit?.(courrier)} disabled={actionDisabled} />
          )}
          {peutArchiver && (
            <GhostAction icon={<Archive size={14} />} label="Envoyer aux archives" onClick={() => onArchive?.(courrier.id)} disabled={actionDisabled} />
          )}
          {peutSupprimer && (
            <GhostAction icon={<Trash2 size={14} />} label="Supprimer du registre" variant="rose" onClick={handleDelete} disabled={actionDisabled} />
          )}
        </div>
      </div>

      {isTransmitOpen && (
        <Suspense fallback={<ModalSkeleton title="Initialisation de la transmission..." />}>
          <CourrierTransmitForm
            courrier={courrier}
            onClose={() => setIsTransmitOpen(false)}
            onSubmit={(data) => onTransmit?.(courrier.id, data)}
          />
        </Suspense>
      )}

      {isAllDetailsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 p-2 animate-in fade-in duration-200 sm:p-4">
          <div className="absolute inset-0" onClick={() => setIsAllDetailsOpen(false)} />
          <div className="bg-white relative z-10 flex h-[calc(100dvh-1rem)] min-h-0 w-full max-w-7xl flex-col overflow-hidden rounded-[1.75rem] border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-300 sm:h-[calc(100dvh-2rem)] sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 bg-white sticky top-0 z-20 sm:px-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 mb-1">
                  {modalContenuRestreint ? 'Acces restreint' : 'Apercu complet du courrier'}
                </p>
                <h3 className="truncate text-base font-black text-slate-900 uppercase tracking-tight sm:text-lg">
                  {modalContenuRestreint
                    ? 'Consultation non autorisée'
                    : currentDetailsLoading
                      ? 'Chargement du dossier'
                      : 'Dossier administratif'}
                </h3>
              </div>
              <button
                onClick={() => setIsAllDetailsOpen(false)}
                className="h-12 w-12 flex items-center justify-center rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-950 hover:text-white transition-all shadow-sm"
              >
                <X size={24} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-scroll overscroll-contain bg-slate-100 px-3 py-4 custom-scrollbar sm:px-6 sm:py-6 lg:px-8">
              <Suspense fallback={<SkeletonLoader variant="detail" />}>
                {currentDetailsLoading ? (
                  <SkeletonLoader variant="detail" />
                ) : detailsState.error ? (
                  <DetailsError message={detailsState.error} onClose={() => setIsAllDetailsOpen(false)} />
                ) : (
                  <AllDetails
                    courrier={modalCourrier}
                    contenuRestreint={modalContenuRestreint}
                    actionDisabled={actionDisabled}
                    actions={{
                      canReply,
                      canTransmit: peutTransmettre,
                      canArchive: peutArchiver,
                      onReply: canReply ? handleReplyFromDetails : undefined,
                      onTransmit: peutTransmettre ? handleTransmitFromDetails : undefined,
                      onArchive: peutArchiver ? handleArchiveFromDetails : undefined,
                      onClose: () => setIsAllDetailsOpen(false),
                      onViewCourrier: (id) => {
                        setIsAllDetailsOpen(false)
                        navigate(`/courriers/${id}`)
                      },
                    }}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}

function getDetailsErrorMessage(err) {
  if (err.response?.status === 403) {
    return "Vous n'avez pas l'autorisation de consulter ce courrier."
  }

  return (
    err.response?.data?.message ||
    err.response?.data?.detail ||
    err.response?.data?.error ||
    "Erreur lors du chargement de l'aperçu complet."
  )
}

function DetailsError({ message, onClose }) {
  return (
    <div className="rounded-[1.75rem] border border-rose-100 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <Lock size={26} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-950">{message}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Aucune donnée détaillée n'est affichée tant que l'API ne confirme pas l'autorisation.
      </p>
      <button
        onClick={onClose}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Fermer
      </button>
    </div>
  )
}

function CompactInfo({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5 text-slate-400">
        <div className="opacity-60">{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xs font-black text-slate-800 truncate max-w-[150px] uppercase tracking-tight">
        {value || '-'}
      </span>
    </div>
  )
}

function MainAction({ label, icon, onClick, disabled, variant = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20',
    slate: 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full h-14 rounded-2xl text-white text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-95',
        tones[variant],
      )}
    >
      {icon} {label}
    </button>
  )
}

function SideAction({ label, icon, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-12 rounded-2xl border-2 border-slate-100 bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:border-slate-900 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
    >
      {icon} {label}
    </button>
  )
}

function GhostAction({ label, icon, onClick, disabled, variant = 'slate' }) {
  const tones = {
    slate: 'text-slate-400 hover:text-slate-900 hover:bg-slate-50',
    rose: 'text-slate-400 hover:text-rose-600 hover:bg-rose-50',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'w-full px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed',
        tones[variant],
      )}
    >
      {icon} {label}
    </button>
  )
}
