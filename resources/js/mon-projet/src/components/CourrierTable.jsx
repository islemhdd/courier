import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Paperclip,
  Shield,
  ShieldAlert,
  FileText,
  ChevronRight,
} from 'lucide-react'

import { formatDate, getStatusBadgeClass, getStatusLabel } from '../lib/courrier'
import SkeletonLoader from './SkeletonLoader'

function ConfidentialityBadge({ level }) {
  if (!level) return null
  const colors = {
    normal: 'bg-slate-100 text-slate-600',
    confidentiel: 'bg-amber-50 text-amber-700 border-amber-200',
    secret: 'bg-rose-50 text-rose-700 border-rose-200',
    'top-secret': 'bg-red-50 text-red-700 border-red-300',
  }
  const color = colors[level.libelle?.toLowerCase()] || 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${color}`}>
      <Shield size={9} />
      {level.libelle || level}
    </span>
  )
}

export default function CourrierTable({
  courriers,
  loading,
  selectedCourrier,
  onSelect,
}) {
  if (loading) {
    return <SkeletonLoader count={5} variant="table" />
  }

  if (!courriers || courriers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300">
          <ShieldAlert size={24} />
        </div>
        <h4 className="text-sm font-semibold text-slate-500">Aucun courrier</h4>
        <p className="mt-1 text-xs text-slate-400">Aucun courrier trouvé pour cette vue.</p>
      </div>
    )
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">N°</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Objet</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Expéditeur</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Statut</th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Conf.</th>
              <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
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
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-indigo-50/60'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'
                      }`}>
                        <FileText size={13} />
                      </div>
                      <span className={`text-xs font-semibold ${
                        isSelected ? 'text-indigo-700' : 'text-slate-700'
                      }`}>
                        {courrier.numero}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-800 truncate max-w-[300px]">
                        {courrier.objet || '-'}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasAttachments && <Paperclip size={11} className="text-slate-300" />}
                        {hasComments && <MessageSquare size={11} className="text-slate-300" />}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-500 truncate max-w-[180px] inline-block">
                      {courrier.expediteur || courrier.source?.libelle || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(courrier.date_reception)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {needsResponse && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isAnswered
                            ? 'bg-emerald-50 text-emerald-600'
                            : isOverdue
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-amber-50 text-amber-600'
                        }`}>
                          {isAnswered ? <CheckCircle2 size={9} /> : isOverdue ? <AlertCircle size={9} /> : <Clock size={9} />}
                        </span>
                      )}
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(courrier.statut)}`}>
                        {getStatusLabel(courrier.statut)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-center hidden lg:table-cell">
                    <ConfidentialityBadge level={courrier.niveau_confidentialite} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ChevronRight size={14} className={`inline-block transition-opacity ${
                      isSelected ? 'text-indigo-400' : 'text-slate-200'
                    }`} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-slate-100">
        {courriers.map((courrier) => {
          const isSelected = selectedCourrier?.id === courrier.id
          const hasAttachments = courrier.attachments?.length > 0
          const hasComments = courrier.comments?.length > 0

          return (
            <button
              key={courrier.id}
              onClick={() => onSelect(courrier)}
              className={`w-full text-left px-4 py-3.5 transition-colors ${
                isSelected ? 'bg-indigo-50/60 border-l-2 border-indigo-500' : 'border-l-2 border-transparent hover:bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isSelected ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'
                }`}>
                  <FileText size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-700">{courrier.numero}</span>
                    <div className="flex items-center gap-1">
                      {hasAttachments && <Paperclip size={10} className="text-slate-300" />}
                      {hasComments && <MessageSquare size={10} className="text-slate-300" />}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-800 truncate mb-1">{courrier.objet}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 truncate">{courrier.expediteur || courrier.source?.libelle || '-'}</span>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getStatusBadgeClass(courrier.statut)}`}>
                      {getStatusLabel(courrier.statut)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
