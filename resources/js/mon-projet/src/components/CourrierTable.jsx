import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageSquare,
  Paperclip,
  ShieldAlert,
} from 'lucide-react'

import { formatDate, getStatusLabel, getStatusTone } from '../lib/courrier'
import SkeletonLoader from './SkeletonLoader'

export default function CourrierTable({
  courriers,
  loading,
  selectedCourrier,
  onSelect,
}) {
  if (loading) {
    return <SkeletonLoader count={5} variant="table" />
  }

  if (courriers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
          <ShieldAlert size={24} />
        </div>
        <h4 className="text-sm font-semibold text-slate-900">Aucun resultat</h4>
        <p className="mt-1 text-sm text-slate-400">Aucun courrier trouve pour cette vue.</p>
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-slate-50/85 backdrop-blur">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              Reference
            </th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              Objet
            </th>
            <th className="hidden px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500 md:table-cell">
              Expediteur
            </th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              Statut
            </th>
            <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
              Date
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {courriers.map((courrier) => {
            const isSelected = selectedCourrier?.id === courrier.id
            const hasAttachments = courrier.attachments?.length > 0
            const hasComments = courrier.comments?.length > 0
            const needsResponse = courrier.requiert_reponse
            const isAnswered = courrier.a_ete_repondu
            const isOverdue = courrier.est_en_retard

            return (
              <tr
                key={courrier.id}
                onClick={() => onSelect(courrier)}
                className={`table-row-hover cursor-pointer align-top ${
                  isSelected
                    ? 'bg-blue-50/70'
                    : 'bg-white/70 hover:bg-white'
                }`}
              >
                <td className="px-4 py-4">
                  <div className="flex flex-col">
                    <span
                      className={`text-xs font-semibold ${
                        isSelected ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      {courrier.numero}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 text-slate-400">
                      {hasAttachments && <Paperclip size={12} />}
                      {hasComments && <MessageSquare size={12} />}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="max-w-[160px] sm:max-w-xs">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {courrier.objet}
                    </p>
                    <p className="mt-1 truncate text-xs leading-relaxed text-slate-500">
                      {courrier.resume || 'Aucun resume'}
                    </p>
                  </div>
                </td>

                <td className="hidden px-4 py-4 md:table-cell">
                  <p className="max-w-[160px] truncate text-xs font-medium text-slate-600">
                    {courrier.expediteur || courrier.source?.libelle || '-'}
                  </p>
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1.5">
                    <span
                      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusTone(
                        courrier.statut,
                        'badge',
                      )}`}
                    >
                      {getStatusLabel(courrier.statut)}
                    </span>

                    {needsResponse && (
                      <div
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold ${
                          isAnswered
                            ? 'text-emerald-600'
                            : isOverdue
                              ? 'text-rose-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {isAnswered ? (
                          <CheckCircle2 size={11} />
                        ) : isOverdue ? (
                          <AlertCircle size={11} />
                        ) : (
                          <Clock size={11} />
                        )}
                        {isAnswered ? 'Repondu' : isOverdue ? 'Retard' : 'Attente'}
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-xs font-medium text-slate-500">
                      {formatDate(courrier.date_reception)}
                    </p>
                    <ChevronRight
                      size={14}
                      className={isSelected ? 'text-blue-500' : 'text-slate-300'}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
