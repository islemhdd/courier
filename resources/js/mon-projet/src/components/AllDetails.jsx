import { useState } from 'react'
import {
  AlertCircle,
  Archive,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileText,
  Hash,
  History,
  Info,
  Layers,
  Lock,
  Mail,
  MessageCircle,
  Paperclip,
  Printer,
  Send,
  ShieldCheck,
  User,
  X,
} from 'lucide-react'
import clsx from 'clsx'

import { API_ORIGIN } from '../api/api'
import {
  formatDate,
  getConfidentialityLabel,
  getStatusLabel,
  getStatusTone,
} from '../lib/courrier'
import Badge from './Badge'

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key)

export default function AllDetails({
  courrier,
  contenuRestreint,
  actions = {},
  actionDisabled = false,
}) {
  const [copied, setCopied] = useState(false)

  if (!courrier) {
    return (
      <EmptyDocument
        icon={<AlertCircle size={34} />}
        title="Informations non disponibles"
        description="Le courrier selectionne est introuvable ou n'a pas ete retourne par l'API."
      />
    )
  }

  if (contenuRestreint) {
    return (
      <div className="courrier-print-root rounded-[1.75rem] border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Lock size={30} />
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
          Acces restreint
        </p>
        <h2 className="mt-3 text-xl font-semibold text-slate-950">
          Vous n'avez pas l'autorisation de consulter ce courrier.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">
          Les details, le resume, l'OCR, les pieces jointes et les commentaires ne sont pas affiches.
        </p>
        {actions.onClose && (
          <button
            onClick={actions.onClose}
            className="print:hidden mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <X size={16} />
            Fermer
          </button>
        )}
      </div>
    )
  }

  const statut = courrier.statut || courrier.statut_original
  const statusLabel = courrier.archive_le ? 'Archive' : getStatusLabel(statut)
  const confidentiality = getConfidentialityLabel(courrier)
  const dateReference = courrier.date_reception || courrier.date_creation || courrier.created_at
  const attachments = Array.isArray(courrier.attachments) ? courrier.attachments : null
  const comments = Array.isArray(courrier.comments) ? courrier.comments : null
  const recipients = Array.isArray(courrier.recipients) ? courrier.recipients : null
  const concernedPeople = Array.isArray(courrier.concerned_people) ? courrier.concerned_people : null
  const replies = Array.isArray(courrier.chaine_reponses)
    ? courrier.chaine_reponses
    : Array.isArray(courrier.reponses)
      ? courrier.reponses
      : null
  const downloadUrl = getPrimaryDownloadUrl(courrier)
  const showSummary = hasOwn(courrier, 'resume') || hasOwn(courrier, 'summary_source') || hasOwn(courrier, 'resume_auto_genere')
  const showOcr = hasOwn(courrier, 'extracted_text') || hasOwn(courrier, 'ocr_status')
  const summaryIsAutomatic = courrier.summary_source === 'auto_generated' || Boolean(courrier.resume_auto_genere)

  const handlePrint = () => {
    if (actions.onPrint) {
      actions.onPrint()
      return
    }
    window.print()
  }

  const handleCopyOcr = async () => {
    if (!courrier.extracted_text) return

    await navigator.clipboard.writeText(String(courrier.extracted_text))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="courrier-print-root space-y-6 pb-8 text-slate-900">
      <DocumentHeader
        courrier={courrier}
        statusLabel={statusLabel}
        statusTone={courrier.archive_le ? 'slate' : getStatusTone(statut)}
        confidentiality={confidentiality}
        dateReference={dateReference}
        downloadUrl={downloadUrl}
        actions={actions}
        actionDisabled={actionDisabled}
        onPrint={handlePrint}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Identification du courrier"
            subtitle="Reference, statut et qualification administrative."
            icon={<Hash size={18} />}
          >
            <InfoGrid>
              <InfoField label="Numero" value={courrier.numero} important />
              <InfoField label="Objet" value={courrier.objet} important wide />
              <InfoField label="Type" value={courrier.type} badgeVariant="blue" />
              <InfoField label="Type administratif" value={entityLabel(courrier.courrier_type)} />
              <InfoField label="Source" value={entityLabel(courrier.source) || courrier.expediteur} />
              <InfoField label="Statut" value={statusLabel} badgeVariant={courrier.archive_le ? 'slate' : getStatusTone(statut)} />
              <InfoField label="Confidentialite" value={confidentiality} badgeVariant={confidentialityTone(confidentiality)} />
            </InfoGrid>
          </SectionCard>

          <SectionCard
            title="Expediteur et destinataire"
            subtitle="Origine, destination et personnes concernees."
            icon={<Mail size={18} />}
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PartyCard
                title="Expediteur"
                icon={<Building2 size={18} />}
                name={courrier.expediteur || entityLabel(courrier.source)}
                service={entityLabel(courrier.service_source)}
                structure={entityLabel(courrier.structure_origine) || entityLabel(courrier.service_source?.structure)}
                tone="blue"
              />
              <PartyCard
                title="Destinataire"
                icon={<Send size={18} />}
                name={courrier.destinataire || entityLabel(courrier.service_destinataire)}
                service={entityLabel(courrier.service_destinataire)}
                structure={entityLabel(courrier.structure_destinataire) || entityLabel(courrier.service_destinataire?.structure)}
                tone="emerald"
              />
            </div>

            {concernedPeople && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Personnes concernees
                  </p>
                  <Badge variant="slate" size="xs">{concernedPeople.length}</Badge>
                </div>
                {concernedPeople.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {concernedPeople.map((person) => (
                      <span
                        key={person.id || entityLabel(person)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {entityLabel(person)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <EmptyInline message="Aucune personne concernee n'a ete associee." />
                )}
              </div>
            )}

            {recipients && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    Diffusion
                  </p>
                  <Badge variant="slate" size="xs">{recipients.length}</Badge>
                </div>
                {recipients.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {recipients.map((recipient) => (
                      <RecipientCard key={recipient.id || JSON.stringify(recipient)} recipient={recipient} />
                    ))}
                  </div>
                ) : (
                  <EmptyInline message="Aucun destinataire de diffusion retourne." />
                )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Dates et delais"
            subtitle="Creation, reception et suivi de reponse."
            icon={<Calendar size={18} />}
          >
            <InfoGrid>
              <InfoField label="Date de creation" value={formatDate(courrier.date_creation || courrier.created_at)} />
              <InfoField label="Date de reception" value={formatDate(courrier.date_reception)} />
              <InfoField label="Date limite de reponse" value={formatDate(courrier.date_limite_reponse)} />
              <InfoField label="Reponse requise" value={courrier.requiert_reponse} badgeVariant={courrier.requiert_reponse ? 'amber' : 'slate'} />
              <InfoField label="Repondu le" value={formatDate(courrier.repondu_le)} />
              <InfoField label="Retard" value={courrier.est_en_retard} badgeVariant={courrier.est_en_retard ? 'rose' : 'slate'} />
            </InfoGrid>
          </SectionCard>

          <SectionCard
            title="Workflow"
            subtitle="Validation, transmission et archivage."
            icon={<History size={18} />}
          >
            <WorkflowOverview courrier={courrier} statusLabel={statusLabel} />
          </SectionCard>

          {showSummary && (
            <SectionCard
              title="Resume"
              subtitle="Synthese lisible du contenu administratif."
              icon={<FileText size={18} />}
              action={summaryIsAutomatic ? <Badge variant="blue" size="sm">Resume automatique</Badge> : null}
            >
              {courrier.resume ? (
                <ExpandableText text={courrier.resume} maxHeightClass="max-h-44" threshold={420} size="lg" />
              ) : (
                <EmptyBlock
                  icon={<Info size={22} />}
                  title="Aucun resume disponible"
                  description="Aucune synthese n'a ete retournee pour ce courrier."
                />
              )}
            </SectionCard>
          )}

          {showOcr && (
            <SectionCard
              title="Contenu extrait / OCR"
              subtitle="Texte numerise, limite en hauteur pour rester lisible."
              icon={<FileText size={18} />}
              action={<OcrStatusBadge status={courrier.ocr_status} hasText={Boolean(courrier.extracted_text)} />}
            >
              {courrier.extracted_text ? (
                <div className="space-y-4">
                  <div className="flex justify-end print:hidden">
                    <button
                      onClick={handleCopyOcr}
                      className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copied ? 'Copie' : 'Copier le texte'}
                    </button>
                  </div>
                  <ExpandableText text={courrier.extracted_text} maxHeightClass="max-h-80" threshold={900} monospace />
                </div>
              ) : (
                <EmptyBlock
                  icon={<FileText size={22} />}
                  title="Aucun texte OCR disponible"
                  description={ocrEmptyMessage(courrier.ocr_status)}
                />
              )}
            </SectionCard>
          )}
        </div>

        <aside className="space-y-6">
          {attachments && (
            <SectionCard
              title="Pieces jointes"
              subtitle="Fichiers associes au courrier."
              icon={<Paperclip size={18} />}
              action={<Badge variant="slate" size="sm">{attachments.length} fichier(s)</Badge>}
            >
              {attachments.length > 0 ? (
                <div className="space-y-3">
                  {attachments.map((attachment) => (
                    <AttachmentCard key={attachment.id || attachment.chemin || attachment.nom_original} attachment={attachment} />
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon={<Paperclip size={22} />}
                  title="Aucune piece jointe"
                  description="Aucun fichier n'a ete associe a ce courrier."
                />
              )}
            </SectionCard>
          )}

          {comments && (
            <SectionCard
              title="Commentaires et instructions"
              subtitle="Annotations, consignes et validations."
              icon={<MessageCircle size={18} />}
              action={<Badge variant="slate" size="sm">{comments.length}</Badge>}
            >
              {comments.length > 0 ? (
                <div className="relative space-y-4">
                  <div className="absolute left-5 top-2 bottom-2 hidden w-px bg-slate-200 sm:block" />
                  {comments.map((comment) => (
                    <CommentCard key={comment.id || `${comment.created_at}-${comment.commentaire}`} comment={comment} />
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  icon={<MessageCircle size={22} />}
                  title="Aucun commentaire"
                  description="Aucune instruction ou annotation n'a ete retournee."
                />
              )}
            </SectionCard>
          )}

          {(courrier.parent_courrier_id || courrier.parent || replies) && (
            <SectionCard
              title="Fil du courrier"
              subtitle="Relation entre courrier original et reponses."
              icon={<Layers size={18} />}
            >
              <ThreadSection courrier={courrier} replies={replies} onViewCourrier={actions.onViewCourrier} />
            </SectionCard>
          )}
        </aside>
      </div>
    </article>
  )
}

function DocumentHeader({
  courrier,
  statusLabel,
  statusTone,
  confidentiality,
  dateReference,
  downloadUrl,
  actions,
  actionDisabled,
  onPrint,
}) {
  return (
    <header className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
      <div className="relative bg-slate-950 px-5 py-6 text-white sm:px-8 sm:py-8">
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant={statusTone} dot size="sm">{statusLabel}</Badge>
              <Badge variant={confidentialityTone(confidentiality)} size="sm">
                <Lock size={12} />
                {confidentiality}
              </Badge>
              <Badge variant="blue" size="sm">{courrier.type || 'Type non precise'}</Badge>
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-blue-200">
              Dossier courrier
            </p>
            <h1 className="mt-3 break-words text-2xl font-semibold tracking-tight sm:text-4xl">
              {courrier.objet || 'Objet non renseigne'}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 font-semibold text-white ring-1 ring-slate-700">
                <Hash size={14} />
                {courrier.numero || 'Sans numero'}
              </span>
              <span className="inline-flex items-center gap-2">
                <Calendar size={14} />
                {formatDate(dateReference)}
              </span>
            </div>
          </div>

          <div className="print:hidden flex flex-wrap gap-2 lg:justify-end">
            <HeaderAction icon={<Printer size={15} />} label="Imprimer" onClick={onPrint} />
            {downloadUrl ? (
              <a
                href={downloadUrl}
                download
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-950 shadow-sm hover:bg-blue-50 sm:px-4"
              >
                <Download size={15} />
                Telecharger
              </a>
            ) : (
              <HeaderAction icon={<Download size={15} />} label="Telecharger" disabled />
            )}
            {actions.canReply && (
              <HeaderAction icon={<MessageCircle size={15} />} label="Repondre" onClick={actions.onReply} disabled={actionDisabled} />
            )}
            {actions.canTransmit && (
              <HeaderAction icon={<Send size={15} />} label="Transmettre" onClick={actions.onTransmit} disabled={actionDisabled} />
            )}
            {actions.canArchive && (
              <HeaderAction icon={<Archive size={15} />} label="Archiver" onClick={actions.onArchive} disabled={actionDisabled} />
            )}
            {actions.onClose && (
              <HeaderAction icon={<X size={15} />} label="Fermer" onClick={actions.onClose} />
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-slate-100 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <HeaderFact icon={<User size={16} />} label="Expediteur" value={courrier.expediteur || entityLabel(courrier.source)} />
        <HeaderFact icon={<Send size={16} />} label="Destinataire" value={courrier.destinataire || entityLabel(courrier.service_destinataire)} />
        <HeaderFact icon={<FileText size={16} />} label="Resume" value={courrier.resume ? truncate(courrier.resume, 82) : 'Non disponible'} />
      </div>
    </header>
  )
}

function HeaderAction({ icon, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-800 px-3 text-xs font-bold text-white ring-1 ring-slate-700 hover:bg-white hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function HeaderFact({ icon, label, value }) {
  return (
    <div className="flex min-w-0 gap-3 px-5 py-4 sm:px-6">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-800">{safeText(value)}</p>
      </div>
    </div>
  )
}

function SectionCard({ title, subtitle, icon, action, children }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            {icon}
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-800">{title}</h2>
            {subtitle && <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

function InfoGrid({ children }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {children}
    </dl>
  )
}

function InfoField({ label, value, important = false, wide = false, badgeVariant }) {
  const rendered = normalizeValue(value)

  return (
    <div
      className={clsx(
        'min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4',
        important && 'border-slate-300 bg-white shadow-sm',
        wide && 'sm:col-span-2',
      )}
    >
      <dt className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</dt>
      <dd className="mt-2 min-w-0">
        {badgeVariant && rendered !== '-' ? (
          <Badge variant={badgeVariant} size="sm">{rendered}</Badge>
        ) : (
          <span className={clsx('block break-words text-sm text-slate-800', important ? 'font-semibold' : 'font-medium')}>
            {rendered}
          </span>
        )}
      </dd>
    </div>
  )
}

function PartyCard({ title, icon, name, service, structure, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', tones[tone] || tones.blue)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{title}</p>
          <p className="mt-1 break-words text-base font-semibold text-slate-900">{safeText(name)}</p>
          <div className="mt-3 space-y-1.5 text-xs text-slate-500">
            <p><span className="font-semibold text-slate-600">Service:</span> {safeText(service)}</p>
            <p><span className="font-semibold text-slate-600">Structure:</span> {safeText(structure)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkflowOverview({ courrier, statusLabel }) {
  const items = [
    {
      label: 'Creation',
      value: entityLabel(courrier.createur) || 'Non renseigne',
      detail: formatDate(courrier.date_creation || courrier.created_at),
      state: 'completed',
      icon: <User size={16} />,
    },
    {
      label: 'Validation',
      value: entityLabel(courrier.valideur) || (courrier.statut === 'NON_VALIDE' ? 'Non valide' : 'En attente ou non requise'),
      detail: statusLabel,
      state: courrier.valideur ? 'completed' : courrier.statut === 'CREE' ? 'active' : 'muted',
      icon: <ShieldCheck size={16} />,
    },
    {
      label: 'Transmission',
      value: entityLabel(courrier.transmis_par) || 'Non transmise',
      detail: formatDate(courrier.transmis_le),
      state: courrier.transmis_le ? 'completed' : courrier.transmission_demandee ? 'active' : 'muted',
      icon: <Send size={16} />,
    },
    {
      label: 'Archivage',
      value: courrier.archive_le ? entityLabel(courrier.archive_par) || 'Archive' : 'Non archive',
      detail: formatDate(courrier.archive_le),
      state: courrier.archive_le ? 'completed' : 'muted',
      icon: <Archive size={16} />,
    },
  ]

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <WorkflowItem key={item.label} item={item} />
      ))}
      <InfoGrid>
        <InfoField label="Etat de validation" value={courrier.valideur ? 'Valide' : courrier.statut === 'NON_VALIDE' ? 'Non valide' : 'Non finalise'} badgeVariant={courrier.valideur ? 'emerald' : courrier.statut === 'NON_VALIDE' ? 'rose' : 'amber'} />
        <InfoField label="Etat de transmission" value={courrier.transmis_le ? 'Transmis' : courrier.transmission_demandee ? 'Validation requise' : 'Non transmis'} badgeVariant={courrier.transmis_le ? 'emerald' : courrier.transmission_demandee ? 'amber' : 'slate'} />
      </InfoGrid>
    </div>
  )
}

function WorkflowItem({ item }) {
  const stateClass = {
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    active: 'border-blue-200 bg-blue-50 text-blue-700',
    muted: 'border-slate-200 bg-slate-50 text-slate-500',
  }[item.state]

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', stateClass)}>
        {item.state === 'completed' ? <CheckCircle2 size={16} /> : item.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-900">{safeText(item.value)}</p>
        <p className="mt-1 text-xs text-slate-500">{safeText(item.detail)}</p>
      </div>
    </div>
  )
}

function ExpandableText({
  text,
  maxHeightClass = 'max-h-48',
  threshold = 500,
  monospace = false,
  size = 'md',
}) {
  const [expanded, setExpanded] = useState(false)
  const value = String(text || '')
  const isLong = value.length > threshold

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div
        className={clsx(
          'whitespace-pre-wrap break-words leading-7 text-slate-700',
          !expanded && isLong && ['overflow-hidden', maxHeightClass],
          monospace && 'font-mono text-xs leading-6',
          size === 'lg' && !monospace && 'text-base sm:text-lg',
        )}
      >
        {value}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="print:hidden mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-950"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Reduire' : 'Voir plus'}
        </button>
      )}
    </div>
  )
}

function AttachmentCard({ attachment }) {
  const url = attachment.chemin ? `${API_ORIGIN}/storage/${attachment.chemin}` : attachment.url || attachment.url_fichier
  const filename = attachment.nom_original || attachment.name || 'Fichier sans nom'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          <FileText size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-900">{filename}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="slate" size="xs">{fileType(filename, attachment)}</Badge>
            {formatBytes(attachment.taille || attachment.size || attachment.file_size) && (
              <Badge variant="slate" size="xs">{formatBytes(attachment.taille || attachment.size || attachment.file_size)}</Badge>
            )}
            <OcrStatusBadge status={attachment.ocr_status} compact />
          </div>
          {attachment.ocr_error && (
            <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
              {safeText(attachment.ocr_error)}
            </p>
          )}
        </div>
      </div>
      <div className="print:hidden mt-4 flex flex-wrap gap-2">
        {url ? (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <Eye size={14} />
              Voir
            </a>
            <a
              href={url}
              download={filename}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Download size={14} />
              Telecharger
            </a>
          </>
        ) : (
          <span className="text-xs font-medium text-slate-400">Lien fichier indisponible</span>
        )}
      </div>
    </div>
  )
}

function CommentCard({ comment }) {
  const validationRequired = comment.validation_requise === true
  const validated = Boolean(comment.valide_le)

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:ml-10">
      <div className="absolute -left-[2.75rem] top-4 hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm sm:flex">
        <MessageCircle size={16} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{entityLabel(comment.user) || 'Auteur non renseigne'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(comment.created_at)} {comment.user?.service ? `- ${entityLabel(comment.user.service)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={validationRequired ? 'amber' : 'slate'} size="xs">
            {validationRequired ? 'Validation requise' : 'Note'}
          </Badge>
          <Badge variant={validated ? 'emerald' : 'slate'} size="xs">
            {validated ? 'Valide' : 'Non valide'}
          </Badge>
        </div>
      </div>
      {comment.instruction?.libelle && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Instruction: {comment.instruction.libelle}
        </div>
      )}
      {comment.commentaire ? (
        <div className="mt-4">
          <ExpandableText text={comment.commentaire} maxHeightClass="max-h-32" threshold={260} />
        </div>
      ) : (
        <EmptyInline message="Commentaire vide." />
      )}
      {validated && (
        <p className="mt-3 text-xs text-emerald-700">
          Valide le {formatDate(comment.valide_le)}
          {comment.valide_par ? ` par ${entityLabel(comment.valide_par)}` : ''}
        </p>
      )}
    </div>
  )
}

function RecipientCard({ recipient }) {
  const type = recipient.recipient_type
  const labels = {
    all: 'Tous',
    structure: 'Structure',
    service: 'Service',
    user: 'Utilisateur',
  }
  const value = type === 'structure'
    ? entityLabel(recipient.structure)
    : type === 'service'
      ? entityLabel(recipient.service)
      : type === 'user'
        ? entityLabel(recipient.user)
        : 'Toutes les entites autorisees'

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
        {labels[type] || 'Destinataire'}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{safeText(value)}</p>
    </div>
  )
}

function ThreadSection({ courrier, replies, onViewCourrier }) {
  const hasParent = courrier.parent_courrier_id || courrier.parent
  const parentData = courrier.parent
  const visibleReplies = Array.isArray(replies) ? replies : []

  return (
    <div className="space-y-3">
      {hasParent && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-blue-900">
            <Mail size={16} />
            Courrier d'origine (parent)
          </p>
          {parentData ? (
            <div
              className="mt-3 cursor-pointer rounded-xl border border-blue-200 bg-white p-3 transition hover:border-blue-400 hover:shadow-sm"
              onClick={() => onViewCourrier?.(parentData.id)}
            >
              <p className="text-sm font-bold text-blue-950">{parentData.numero || 'Sans numero'}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-600">{parentData.objet || 'Sans objet'}</p>
              <p className="mt-1 text-[11px] text-slate-400">{parentData.date_reception ? new Date(parentData.date_reception).toLocaleDateString('fr-FR') : ''}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onViewCourrier?.(courrier.parent_courrier_id)}
              className="mt-3 w-full rounded-xl border border-blue-200 bg-white p-3 text-left transition hover:border-blue-400 hover:shadow-sm"
            >
              <p className="text-sm font-semibold text-blue-950">Voir le courrier parent</p>
              <p className="mt-1 text-[11px] text-slate-500">ID : {courrier.parent_courrier_id}</p>
            </button>
          )}
        </div>
      )}

      {Array.isArray(replies) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Reponses liees</p>
            <Badge variant="slate" size="xs">{visibleReplies.length}</Badge>
          </div>
          {visibleReplies.length > 0 ? (
            <div className="space-y-2">
              {visibleReplies.map((reply) => {
                const canShowReply = reply.peut_voir_details === true || reply.est_accessible === true
                return (
                  <button
                    type="button"
                    key={reply.id || reply.numero}
                    onClick={canShowReply ? () => onViewCourrier?.(reply.id) : undefined}
                    className={`w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition ${canShowReply ? 'hover:border-slate-300 hover:bg-slate-100' : ''}`}
                    disabled={!canShowReply}
                  >
                    {canShowReply ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">{reply.numero || 'Reponse'}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{reply.objet || 'Objet non renseigne'}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-slate-700">Reponse referencee</p>
                    )}
                  </button>
                )
              })}
            </div>
          ) : (
            <EmptyInline message="Aucune reponse liee." />
          )}
        </div>
      )}
    </div>
  )
}

function OcrStatusBadge({ status, hasText = false, compact = false }) {
  const normalized = String(status || (hasText ? 'completed' : 'pending')).toLowerCase()
  const meta = {
    completed: { label: 'OCR termine', variant: 'emerald' },
    processing: { label: 'OCR en cours', variant: 'blue' },
    pending: { label: 'OCR en attente', variant: 'amber' },
    failed: { label: 'OCR echoue', variant: 'rose' },
  }[normalized] || { label: `OCR ${normalized}`, variant: 'slate' }

  return (
    <Badge variant={meta.variant} size={compact ? 'xs' : 'sm'} dot>
      {meta.label}
    </Badge>
  )
}

function EmptyDocument({ icon, title, description }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h2 className="mt-5 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6">{description}</p>
    </div>
  )
}

function EmptyBlock({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
        {icon}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  )
}

function EmptyInline({ message }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
      {message}
    </p>
  )
}

function getPrimaryDownloadUrl(courrier) {
  if (courrier.url_fichier) return courrier.url_fichier
  if (courrier.chemin_fichier) return `${API_ORIGIN}/storage/${courrier.chemin_fichier}`
  if (Array.isArray(courrier.attachments) && courrier.attachments[0]?.chemin) {
    return `${API_ORIGIN}/storage/${courrier.attachments[0].chemin}`
  }
  return null
}

function confidentialityTone(label) {
  const value = String(label || '').toLowerCase()
  if (value.includes('secret')) return 'rose'
  if (value.includes('confidentiel')) return 'amber'
  return 'slate'
}

function entityLabel(entity) {
  if (entity === null || entity === undefined) return ''
  if (typeof entity === 'string' || typeof entity === 'number') return String(entity)
  if (typeof entity === 'boolean') return entity ? 'Oui' : 'Non'
  if (Array.isArray(entity)) return entity.map(entityLabel).filter(Boolean).join(', ')
  if (typeof entity !== 'object') return ''

  const fullName = [entity.prenom, entity.nom].filter(Boolean).join(' ').trim()
  return (
    entity.nom_complet ||
    entity.name ||
    fullName ||
    entity.libelle ||
    entity.titre ||
    entity.numero ||
    entity.email ||
    ''
  )
}

function normalizeValue(value) {
  if (value === true) return 'Oui'
  if (value === false) return 'Non'
  return safeText(value)
}

function safeText(value) {
  const label = entityLabel(value)
  if (!label) return '-'
  return label
}

function truncate(value, maxLength) {
  const text = safeText(value)
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function formatBytes(value) {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  const units = ['o', 'Ko', 'Mo', 'Go']
  let size = bytes
  let unit = 0

  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }

  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

function fileType(filename, attachment) {
  if (attachment.mime_type) return attachment.mime_type
  const extension = String(filename || '').split('.').pop()
  return extension && extension !== filename ? extension.toUpperCase() : 'Fichier'
}

function ocrEmptyMessage(status) {
  const normalized = String(status || 'pending').toLowerCase()
  if (normalized === 'processing') return "L'analyse OCR est en cours. Le texte sera disponible apres traitement."
  if (normalized === 'failed') return "L'analyse OCR a echoue ou le document n'a pas pu etre lu."
  if (normalized === 'completed') return "L'OCR est marque comme termine mais aucun texte n'a ete retourne."
  return "L'OCR n'a pas encore produit de contenu exploitable."
}
