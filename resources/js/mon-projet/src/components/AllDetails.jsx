import { Clock3, MessageCircle, UsersRound } from 'lucide-react'
import { formatDate, getStatusLabel } from '../lib/courrier'

export default function AllDetails({ courrier, contenuRestreint }) {
  if (!courrier) return null

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Informations</h3>
        <div
          className={`space-y-3 rounded-2xl border border-slate-100 p-4 text-sm ${
            contenuRestreint ? 'relative overflow-hidden bg-slate-50' : 'bg-white'
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
            {courrier.destinataire && <Detail label="Destinataire" value={courrier.destinataire} />}
            <Detail label="Date de reception" value={formatDate(courrier.date_reception)} />
            <Detail label="Confidentialite" value={courrier.niveau_confidentialite?.libelle} />
            <Detail label="Statut" value={getStatusLabel(courrier.statut)} />
            <Detail label="Reponse attendue" value={courrier.requiert_reponse ? 'Oui' : 'Non'} />
            {courrier.requiert_reponse && (
              <>
                <Detail
                  label="Delai"
                  value={
                    courrier.delai_reponse_jours
                      ? `${courrier.delai_reponse_jours} jour(s)`
                      : '-'
                  }
                />
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
      </section>

      {!contenuRestreint && (courrier.objet || courrier.resume) && (
        <section className="grid gap-4 md:grid-cols-2">
          {courrier.objet && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Objet</h3>
              <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {courrier.objet}
              </div>
            </div>
          )}

          {courrier.resume && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Résumé</h3>
              <div className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                {courrier.resume}
              </div>
            </div>
          )}
        </section>
      )}

      {!contenuRestreint && courrier.recipients?.length > 0 && (
        <section className="rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UsersRound size={16} /> Destinataires
          </h3>
          <div className="space-y-2 text-sm text-slate-600">
            {courrier.recipients.map((recipient) => (
              <div
                key={recipient.id}
                className="rounded-xl bg-slate-50 px-3 py-2 break-words"
              >
                {recipient.recipient_type === 'all' && 'Tout le monde'}
                {recipient.recipient_type === 'structure' &&
                  `Structure : ${recipient.structure?.libelle || '-'}`}
                {recipient.recipient_type === 'service' &&
                  `Service : ${recipient.service?.libelle || '-'}`}
                {recipient.recipient_type === 'user' &&
                  `Personne : ${recipient.user?.prenom || ''} ${recipient.user?.nom || ''}`}
              </div>
            ))}
          </div>
        </section>
      )}

      {!contenuRestreint && courrier.comments?.length > 0 && (
        <section className="rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MessageCircle size={16} /> Instructions / commentaires
          </h3>
          <div className="space-y-3">
            {courrier.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-medium text-slate-700 break-words">
                  {comment.instruction?.libelle || 'Commentaire'}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-slate-600">
                  {comment.commentaire || '-'}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {comment.user
                    ? `${comment.user.prenom || ''} ${comment.user.nom || ''}`
                    : 'Utilisateur'}
                  {comment.validation_requise && !comment.valide_le
                    ? ' - validation requise'
                    : ''}
                  {comment.valide_le ? ' - valide' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!contenuRestreint && courrier.chaine_reponses?.length > 0 && (
        <section className="rounded-2xl border border-slate-100 p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Chaîne des réponses</h3>
          <div className="space-y-2 text-sm text-slate-600">
            {courrier.chaine_reponses.map((reponse) => (
              <div key={reponse.id} className="rounded-xl bg-slate-50 px-3 py-2">
                <span className="font-medium text-slate-800">{reponse.numero}</span>
                <span className="mx-2">-</span>
                <span className="break-words">{reponse.objet}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Historique de traitement
        </h3>
        <div className="space-y-4">
          <TimelineItem title="Creation" text="Courrier cree dans le systeme" />
          {courrier.transmission_demandee && (
            <TimelineItem
              title="Validation requise"
              text="Action effectuee par un secretaire et en attente du chef"
            />
          )}
          {courrier.requiert_reponse && !courrier.a_ete_repondu && (
            <TimelineItem
              title="En attente de reponse"
              text="Ce courrier doit recevoir une reponse"
              icon={<Clock3 size={14} />}
            />
          )}
          {courrier.statut === 'CREE' && (
            <TimelineItem title="Cree" text="En attente de validation par le chef" />
          )}
          {courrier.statut === 'VALIDE' && (
            <TimelineItem title="Valide" text="Courrier valide par le chef" />
          )}
          {courrier.statut === 'TRANSMIS' && (
            <TimelineItem title="Transmis" text="Courrier transmis" />
          )}
          {courrier.statut === 'RECU' && (
            <TimelineItem title="Recu" text="Courrier recu par le service" />
          )}
        </div>
      </section>

      {!contenuRestreint &&
        courrier.attachments &&
        courrier.attachments.length > 0 && (
          <section className="rounded-2xl border border-slate-100 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pieces jointes
            </h4>
            <div className="space-y-2">
              {courrier.attachments.map((att) => (
                <a
                  key={att.id}
                  href={`/storage/${att.chemin}`}
                  download={att.nom_original || 'Fichier joint'}
                  className="flex h-10 items-center justify-start gap-3 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >

                  <span className="min-w-0 flex-1 truncate">
                    {att.nom_original || 'Fichier joint'}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

      {!contenuRestreint &&
        courrier.url_fichier &&
        (!courrier.attachments || courrier.attachments.length === 0) && (
          <a
            href={courrier.url_fichier}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <span>ðŸ“Ž</span>
            Ouvrir le fichier
          </a>
        )}
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-4">
      <span className="text-slate-400">{label}</span>
      <span className="min-w-0 text-right font-medium text-slate-700 break-words">
        {value || '-'}
      </span>
    </div>
  )
}

function TimelineItem({ title, text, icon }) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex h-3 w-3 items-center justify-center rounded-full bg-blue-600 text-white">
        {icon || null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-700 break-words">{title}</p>
        <p className="text-xs text-slate-400 break-words">{text}</p>
      </div>
    </div>
  )
}
