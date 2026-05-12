import {
  Archive,
  Building2,
  Calendar,
  FileText,
  Hash,
  Info,
  Paperclip,
  Search,
  Shield,
  User,
} from 'lucide-react'

import { formatDate, getConfidentialityLabel, getStatusBadgeClass, getStatusLabel } from '../lib/courrier'

function entityLabel(entity) {
  return entity?.libelle || entity?.nom || entity?.name || ''
}

function personLabel(user) {
  if (!user) return ''
  return user.nom_complet || [user.prenom, user.nom].filter(Boolean).join(' ') || user.email || ''
}

function Field({ label, value, wide = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '-'}</p>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-slate-900">
        {icon}
        <h3 className="text-sm font-bold uppercase tracking-[0.18em]">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function TextBlock({ value, empty = 'Aucune information.' }) {
  if (!value) {
    return <p className="text-sm text-slate-400">{empty}</p>
  }

  return <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{value}</p>
}

export default function ArchiveDetails({ archive, loading, searchTerm }) {
  if (loading) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
        <div className="mt-4 space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    )
  }

  if (!archive) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center">
        <Archive className="mx-auto text-slate-300" size={34} />
        <h3 className="mt-4 text-sm font-bold text-slate-700">Aucune archive sélectionnée</h3>
        <p className="mt-2 text-sm text-slate-400">Sélectionnez une ligne pour afficher son détail.</p>
      </div>
    )
  }

  const attachments = Array.isArray(archive.attachments) ? archive.attachments : []
  const comments = Array.isArray(archive.comments) ? archive.comments : []
  const matchedFields = Array.isArray(archive.matched_fields) ? archive.matched_fields : []

  return (
    <article className="space-y-4">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="bg-slate-950 p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getStatusBadgeClass(archive.statut_original)}`}>
              {getStatusLabel(archive.statut_original)}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase">
              Archive
            </span>
          </div>
          <h2 className="mt-4 break-words text-2xl font-semibold">{archive.objet || 'Objet non renseigné'}</h2>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <Hash size={14} />
            {archive.numero || '-'}
          </p>
        </div>
      </section>

      {(searchTerm || archive.search_term || archive.match_score !== undefined) && (
        <Section title="Recherche" icon={<Search size={16} />}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Terme" value={archive.search_term || searchTerm} />
            <Field label="Score Levenshtein" value={archive.match_score ?? archive.search_score ?? '-'} />
            <Field label="Champs trouvés" value={matchedFields.length ? matchedFields.join(', ') : '-'} wide />
          </div>
        </Section>
      )}

      <Section title="Identification" icon={<Info size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numéro" value={archive.numero} />
          <Field label="Type" value={archive.type} />
          <Field label="Statut original" value={getStatusLabel(archive.statut_original)} />
          <Field label="Titre / Objet" value={archive.objet} wide />
          <Field label="Niveau confidentialité" value={getConfidentialityLabel(archive)} />
          <Field label="Type administratif" value={entityLabel(archive.courrier_type)} />
          <Field label="Source" value={entityLabel(archive.source)} />
        </div>
      </Section>

      <Section title="Acteurs" icon={<User size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Expéditeur" value={archive.expediteur} />
          <Field label="Destinataire" value={archive.destinataire} />
          <Field label="Archivé par" value={personLabel(archive.archive_par)} />
          <Field label="Créateur" value={personLabel(archive.createur)} />
        </div>
      </Section>

      <Section title="Dates" icon={<Calendar size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date création" value={formatDate(archive.date_creation)} />
          <Field label="Date réception" value={formatDate(archive.date_reception)} />
          <Field label="Date limite réponse" value={formatDate(archive.date_limite_reponse)} />
          <Field label="Répondu le" value={formatDate(archive.repondu_le)} />
          <Field label="Date archivage" value={formatDate(archive.archive_le)} />
          <Field label="Motif archivage" value={archive.motif} />
        </div>
      </Section>

      <Section title="Organisation" icon={<Building2 size={16} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service source" value={entityLabel(archive.service_source)} />
          <Field label="Service destinataire" value={entityLabel(archive.service_destinataire)} />
          <Field label="Structure origine" value={entityLabel(archive.structure_origine) || entityLabel(archive.service_source?.structure)} />
          <Field label="Structure destinataire" value={entityLabel(archive.structure_destinataire) || entityLabel(archive.service_destinataire?.structure)} />
        </div>
      </Section>

      <Section title="Résumé" icon={<FileText size={16} />}>
        <TextBlock value={archive.resume} empty="Aucun résumé archivé." />
      </Section>

      <Section title="Texte OCR" icon={<Shield size={16} />}>
        <TextBlock value={archive.extracted_text} empty="Aucun texte OCR archivé." />
      </Section>

      <Section title="Pièces jointes" icon={<Paperclip size={16} />}>
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune pièce jointe archivée.</p>
        ) : (
          <div className="space-y-3">
            {attachments.map((attachment, index) => (
              <div key={attachment.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-800">{attachment.nom_original || 'Pièce jointe'}</p>
                <p className="mt-1 text-xs text-slate-400">OCR: {attachment.ocr_status || '-'}</p>
                {attachment.ocr_text && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{attachment.ocr_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Commentaires et instructions" icon={<FileText size={16} />}>
        {comments.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun commentaire archivé.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment, index) => (
              <div key={comment.id || index} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  {personLabel(comment.user) || 'Auteur non renseigné'}
                </p>
                {comment.instruction?.libelle && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">Instruction: {comment.instruction.libelle}</p>
                )}
                <TextBlock value={comment.commentaire} empty="Commentaire vide." />
              </div>
            ))}
          </div>
        )}
      </Section>
    </article>
  )
}
