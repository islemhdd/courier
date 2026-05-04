import {
  Archive,
  Check,
  Clock3,
  FileText,
  MessageCircle,
  Pencil,
  Send,
  Star,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { formatDate, getStatusLabel } from '../lib/courrier'

export default function CourrierDetails({
  courrier,
  onValidate,
  onArchive,
  onEdit,
  onDelete,
  onTransmit,
}) {
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

  const handleDelete = () => {
    if (!onDelete) return

    const ok = window.confirm('Voulez-vous vraiment supprimer ce courrier ?')

    if (ok) {
      onDelete(courrier.id)
    }
  }

  return (
    <aside className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <FileText size={20} />
          </div>

          <h2 className="text-xl font-bold text-slate-800">
            {courrier.numero || '-'}
          </h2>

          <p className="text-sm text-slate-500">{courrier.objet || '-'}</p>
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
            contenuRestreint ? 'pointer-events-none select-none blur-sm' : ''
          }
        >
          <Detail label="Type" value={courrier.type || '-'} />
          <Detail label="Catégorie" value={courrier.courrier_type?.libelle || '-'} />
          <Detail label="Mode" value={courrier.mode_diffusion || '-'} />
          <Detail label="Source" value={courrier.source?.libelle || courrier.expediteur} />
          <Detail label="Expediteur" value={courrier.expediteur} />
          <Detail label="Destinataire" value={courrier.destinataire} />
          <Detail label="Date de reception" value={formatDate(courrier.date_reception)} />
          <Detail
            label="Confidentialite"
            value={courrier.niveau_confidentialite?.libelle}
          />
          <Detail label="Statut" value={getStatusLabel(courrier.statut)} />
          <Detail label="Reponse attendue" value={courrier.requiert_reponse ? 'Oui' : 'Non'} />
          {courrier.requiert_reponse && (
            <>
              <Detail label="Delai" value={courrier.delai_reponse_jours ? `${courrier.delai_reponse_jours} jour(s)` : '-'} />
              <Detail label="Date limite" value={formatDate(courrier.date_limite_reponse)} />
              <Detail label="Repondu" value={courrier.a_ete_repondu ? 'Oui' : 'Non'} />
            </>
          )}
        </div>

        {contenuRestreint && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-medium text-slate-600 shadow-sm">
              Contenu non accessible
            </div>
          </div>
        )}
      </div>

      {!contenuRestreint && courrier.resume && (
        <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Résumé</h3>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {courrier.resume}
          </p>
        </section>
      )}

      {!contenuRestreint && courrier.recipients?.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UsersRound size={16} /> Destinataires
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            {courrier.recipients.map((recipient) => (
              <div key={recipient.id} className="rounded-xl bg-slate-50 px-3 py-2">
                {recipient.recipient_type === 'all' && 'Tout le monde'}
                {recipient.recipient_type === 'structure' && `Structure : ${recipient.structure?.libelle || '-'}`}
                {recipient.recipient_type === 'service' && `Service : ${recipient.service?.libelle || '-'}`}
                {recipient.recipient_type === 'user' && `Personne : ${recipient.user?.prenom || ''} ${recipient.user?.nom || ''}`}
              </div>
            ))}
          </div>
        </section>
      )}

      {!contenuRestreint && courrier.comments?.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MessageCircle size={16} /> Instructions / commentaires
          </h3>
          <div className="space-y-3">
            {courrier.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-700">
                  {comment.instruction?.libelle || 'Commentaire'}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-slate-600">
                  {comment.commentaire || '-'}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {comment.user ? `${comment.user.prenom || ''} ${comment.user.nom || ''}` : 'Utilisateur'}
                  {comment.validation_requise && !comment.valide_le ? ' - validation requise' : ''}
                  {comment.valide_le ? ' - valide' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!contenuRestreint && courrier.chaine_reponses?.length > 0 && (
        <section className="mt-5 rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Chaîne des réponses</h3>
          <div className="space-y-2 text-sm text-slate-600">
            {courrier.chaine_reponses.map((reponse) => (
              <div key={reponse.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">{reponse.numero}</span>
                <span className="mx-2">-</span>
                <span>{reponse.objet}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Historique de traitement
        </h3>

        <div className="space-y-4">
          <TimelineItem title="Creation" text="Courrier cree dans le systeme" />
          {courrier.transmission_demandee && (
            <TimelineItem title="Validation requise" text="Action effectuee par un secretaire et en attente du chef" />
          )}
          {courrier.requiert_reponse && !courrier.a_ete_repondu && (
            <TimelineItem title="En attente de reponse" text="Ce courrier doit recevoir une reponse" icon={<Clock3 size={14} />} />
          )}
          {courrier.statut === 'CREE' && <TimelineItem title="Cree" text="En attente de validation par le chef" />}
          {courrier.statut === 'VALIDE' && <TimelineItem title="Valide" text="Courrier valide par le chef" />}
          {courrier.statut === 'TRANSMIS' && <TimelineItem title="Transmis" text="Courrier transmis" />}
          {courrier.statut === 'RECU' && <TimelineItem title="Recu" text="Courrier recu par le service" />}
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

        {peutTransmettre && (
          <button
            type="button"
            onClick={() => onTransmit?.(courrier.id)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-blue-200 px-4 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
          >
            <Send size={16} />
            Transmettre
          </button>
        )}
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

      {courrier.attachments && courrier.attachments.length > 0 && !contenuRestreint && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pieces jointes</h4>
          <div className="space-y-2">
            {courrier.attachments.map((att) => (
              <a
                key={att.id}
                href={`/storage/${att.chemin}`}
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center justify-start gap-3 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="text-blue-500">📎</span>
                <span className="truncate">{att.nom_original || 'Fichier joint'}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {courrier.url_fichier && (!courrier.attachments || courrier.attachments.length === 0) && !contenuRestreint && (
        <a
          href={courrier.url_fichier}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <span>📎</span>
          Ouvrir le fichier
        </a>
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
    </aside>
  )
}

function Detail({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{value || '-'}</span>
    </div>
  )
}

function TimelineItem({ title, text, icon }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-white">
        {icon || null}
      </div>
      <div>
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <p className="text-xs text-slate-400">{text}</p>
      </div>
    </div>
  )
}
