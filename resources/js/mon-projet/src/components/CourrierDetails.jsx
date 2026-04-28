import { Archive, Check, MessageCircle, Star } from 'lucide-react'

export default function CourrierDetails({ courrier, onValidate, onArchive }) {
  if (!courrier) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        Sélectionne un courrier.
      </div>
    )
  }

  return (
    <aside className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            📄
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            {courrier.numero}
          </h2>

          <p className="text-sm text-slate-500">
            {courrier.objet}
          </p>
        </div>

        <button className="rounded-xl p-2 text-slate-400 hover:bg-slate-50">
          <Star size={18} />
        </button>
      </div>

      <div className="space-y-3 border-y border-slate-100 py-5 text-sm">
        <Detail label="Expéditeur" value={courrier.expediteur} />
        <Detail label="Date de réception" value={courrier.date_reception} />
        <Detail label="Confidentialité" value={courrier.niveau_confidentialite?.nom} />
        <Detail label="Priorité" value={courrier.priorite} />
        <Detail label="Statut" value={courrier.statut} />
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Historique de traitement
        </h3>

        <div className="space-y-4">
          <TimelineItem title="Reçu" text="Courrier créé dans le système" />
          <TimelineItem title="En validation" text="En attente de décision" />
          <TimelineItem title="Transmission" text="Circuit en cours" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <button
          onClick={() => onValidate(courrier.id)}
          className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Check size={16} />
          Valider
        </button>

        <button className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-700">
          Transmettre
        </button>

        <button className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50">
          <MessageCircle size={16} />
          Commenter
        </button>
      </div>

      <button
        onClick={() => onArchive(courrier.id)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <Archive size={16} />
        Archiver
      </button>
    </aside>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700">
        {value || '-'}
      </span>
    </div>
  )
}

function TimelineItem({ title, text }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-3 w-3 rounded-full bg-blue-600" />
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{text}</p>
      </div>
    </div>
  )
}
