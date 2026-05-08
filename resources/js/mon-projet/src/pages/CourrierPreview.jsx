import { lazy, Suspense, useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft, FileText, Lock } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'

import { courrierApi } from '../api/courrierApi'
import AllDetails from '../components/AllDetails'
import SkeletonLoader, { ModalSkeleton } from '../components/SkeletonLoader'

const CourrierTransmitForm = lazy(() => import('../components/CourrierTransmitForm'))
const CourrierForm = lazy(() => import('../components/CourrierForm'))

export default function CourrierPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
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

  return (
    <div className="min-h-[calc(100vh-9rem)] rounded-[2rem] border border-slate-200 bg-slate-100 p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FileText size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
              Page d'aperçu complet
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">
              {courrier?.numero || 'Chargement du courrier'}
            </h2>
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} />
          Retour
        </button>
      </div>

      {loading ? (
        <SkeletonLoader variant="detail" />
      ) : error ? (
        <PageError message={error} onBack={() => navigate(-1)} />
      ) : (
        <AllDetails
          courrier={courrier}
          contenuRestreint={contenuRestreint}
          actionDisabled={actionLoading}
          actions={{
            canReply,
            canTransmit,
            canArchive,
            onReply: canReply ? () => setReplyOpen(true) : undefined,
            onTransmit: canTransmit ? () => setTransmitOpen(true) : undefined,
            onArchive: canArchive ? handleArchive : undefined,
            onClose: () => navigate(-1),
            onViewCourrier: (id) => navigate(`/courriers/${id}`),
          }}
        />
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
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        {restricted ? <Lock size={26} /> : <AlertCircle size={26} />}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-950">{message}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        Aucune donnée détaillée n'est affichée tant que l'API ne confirme pas l'autorisation.
      </p>
      <button
        onClick={onBack}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Retour
      </button>
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
