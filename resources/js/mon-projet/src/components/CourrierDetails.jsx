import {
  Archive,
  Check,
  MessageCircle,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react'

export default function CourrierDetails({
  courrier,
  onValidate,
  onArchive,
  onEdit,
  onDelete,
}) {
  if (!courrier) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-sm">
        Sélectionne un courrier.
      </div>
    )
  }

  const contenuRestreint =
    courrier.contenu_restreint === true ||
    courrier.peut_voir_details === false

  const peutValider = courrier.peut_etre_valide === true
  const peutModifier = courrier.peut_etre_modifie === true
  const peutSupprimer = courrier.peut_etre_supprime === true
  const peutArchiver = !contenuRestreint && courrier.statut !== 'ARCHIVE'

  const handleDelete = () => {
    if (!onDelete) return

    const ok = window.confirm(
      'Voulez-vous vraiment supprimer ce courrier ?'
    )

    if (ok) {
      onDelete(courrier.id)
    }
  }

  return (
    <aside className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            📄
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            {courrier.numero || '-'}
          </h2>

          <p className="text-sm text-slate-500">
            {courrier.objet || '-'}
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl p-2 text-slate-400 hover:bg-slate-50"
        >
          <Star size={18} />
        </button>
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
            contenuRestreint
              ? 'pointer-events-none select-none blur-sm'
              : ''
          }
        >
          <Detail label="Expéditeur" value={courrier.expediteur} />
          <Detail label="Destinataire" value={courrier.destinataire} />
          <Detail label="Date de réception" value={courrier.date_reception} />
          <Detail
            label="Confidentialité"
            value={courrier.niveau_confidentialite?.nom}
          />
          <Detail label="Priorité" value={courrier.priorite} />
          <Detail label="Statut" value={courrier.statut} />
        </div>

        {contenuRestreint && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm">
              Contenu non accessible
            </div>
          </div>
        )}
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Historique de traitement
        </h3>

        <div className="space-y-4">
          <TimelineItem title="Création" text="Courrier créé dans le système" />

          {courrier.statut === 'NON_VALIDE' && (
            <TimelineItem
              title="Non validé"
              text="En attente de validation par le chef"
            />
          )}

          {courrier.statut === 'VALIDE' && (
            <TimelineItem
              title="Validé"
              text="Courrier validé par le chef"
            />
          )}

          {courrier.statut === 'ARCHIVE' && (
            <TimelineItem
              title="Archivé"
              text="Courrier archivé"
            />
          )}
        </div>
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

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white hover:bg-violet-700"
        >
          Transmettre
        </button>

        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
        >
          <MessageCircle size={16} />
          Commenter
        </button>
      </div>

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

      {!peutModifier && !peutSupprimer && courrier.statut === 'VALIDE' && (
        <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm text-blue-700">
          Ce courrier est validé. Il ne peut être modifié que par le chef.
        </div>
      )}

      {courrier.statut === 'ARCHIVE' && (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          Ce courrier est archivé. Il ne peut plus être modifié ni supprimé.
        </div>
      )}
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