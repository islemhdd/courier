import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, ExternalLink, FileText, Lock, Loader2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { courrierApi } from '../api/courrierApi'
import AllDetails from '../components/AllDetails'
import SkeletonLoader, { ModalSkeleton } from '../components/SkeletonLoader'

const CourrierTransmitForm = lazy(() => import('../components/CourrierTransmitForm'))
const CourrierForm = lazy(() => import('../components/CourrierForm'))

export default function CourrierPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mainRef = useRef(null)
  const [courrier, setCourrier] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [transmitOpen, setTransmitOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  useEffect(() => {
    let active = true

    courrierApi.show(id)
      .then((res) => {
        if (!active) return
        setCourrier(res.data?.courrier || null)
        if (!res.data?.courrier) setError('Courrier introuvable.')
      })
      .catch((err) => {
        if (!active) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [id])

  const contenuRestreint = courrier?.contenu_restreint === true || courrier?.peut_voir_details === false
  const canReply = !contenuRestreint && courrier?.peut_repondre === true
  const canTransmit = !contenuRestreint && courrier?.peut_etre_transmis === true
  const canArchive = !contenuRestreint && courrier?.peut_etre_archive === true

  const refreshCourrier = async () => {
    const res = await courrierApi.show(id)
    setCourrier(res.data?.courrier || null)
  }

  const handleArchive = async () => {
    if (!courrier || !window.confirm('Archiver ce courrier ?')) return

    setActionLoading(true)
    try {
      await courrierApi.archive(courrier.id)
      navigate('/recus')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setActionLoading(false)
    }
  }

  const handleTransmit = async (data) => {
    if (!courrier) return

    setActionLoading(true)
    try {
      await courrierApi.transmit(courrier.id, data)
      setTransmitOpen(false)
      await refreshCourrier()
    } catch (err) {
      setError(getErrorMessage(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  const handleReply = async () => {
    setReplyOpen(true)
  }

  return (
    <div ref={mainRef} className="flex min-h-[calc(100vh-9rem)] flex-col gap-5 sm:gap-6">
      <nav className="glass-panel-strong flex items-center gap-3 rounded-[2rem] px-5 py-3 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          aria-label="Retour"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex h-7 w-px bg-slate-200" />

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Apercu complet du courrier
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {loading ? 'Chargement...' : (courrier?.numero || 'Courrier introuvable')}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!loading && courrier && (
            <>
              <Link
                to="/recus"
                className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex"
              >
                <ExternalLink size={14} />
                Courriers recus
              </Link>
              <Link
                to="/archives"
                className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 sm:inline-flex"
              >
                <ExternalLink size={14} />
                Archives
              </Link>
            </>
          )}
        </div>
      </nav>

      {loading ? (
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 sm:p-8">
          <div className="mb-8 flex animate-pulse items-start gap-5">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-slate-200" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="h-3 w-32 rounded-full bg-slate-200" />
              <div className="h-6 w-72 rounded-full bg-slate-200" />
              <div className="h-3 w-48 rounded-full bg-slate-200" />
            </div>
          </div>
          <SkeletonLoader variant="detail" />
        </div>
      ) : error ? (
        <PageError message={error} onBack={() => navigate(-1)} />
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <AllDetails
            courrier={courrier}
            contenuRestreint={contenuRestreint}
            actionDisabled={actionLoading}
            actions={{
              canReply,
              canTransmit,
              canArchive,
              onReply: canReply ? handleReply : undefined,
              onTransmit: canTransmit ? () => setTransmitOpen(true) : undefined,
              onArchive: canArchive ? handleArchive : undefined,
              onClose: () => navigate(-1),
              onViewCourrier: (id) => navigate(`/courriers/${id}`),
            }}
          />
        </div>
      )}

      {transmitOpen && courrier && (
        <Suspense fallback={<ModalSkeleton title="Initialisation de la transmission..." />}>
          <CourrierTransmitForm
            courrier={courrier}
            onClose={() => setTransmitOpen(false)}
            onSubmit={handleTransmit}
          />
        </Suspense>
      )}

      {replyOpen && courrier && (
        <Suspense fallback={<ModalSkeleton title="Chargement du formulaire..." />}>
          <CourrierForm
            type="sortant"
            onClose={() => setReplyOpen(false)}
            initialData={{ parent_courrier_id: courrier.id, objet: `Reponse: ${courrier.objet || ''}` }}
            onSuccess={async () => {
              setReplyOpen(false)
              await refreshCourrier()
            }}
          />
        </Suspense>
      )}
    </div>
  )
}

function PageError({ message, onBack }) {
  const restricted = message.includes("autorisation") || message.includes("droit")

  return (
    <div className="flex flex-1 items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          {restricted ? <Lock size={28} /> : <AlertCircle size={28} />}
        </div>
        <h2 className="mt-6 text-lg font-semibold text-slate-950">{message}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
          {restricted
            ? "Vous n'avez pas l'autorisation de consulter ce courrier."
            : "Le courrier demande n'a pas pu etre charge. Verifiez l'identifiant ou reassayez."}
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <ArrowLeft size={16} />
            Retour
          </button>
        </div>
      </div>
    </div>
  )
}

function getErrorMessage(err) {
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
