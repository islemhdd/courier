import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  pagination,
  onPageChange,
  loading = false,
}) {
  if (!pagination || pagination.last_page <= 1) {
    return null
  }

  const current = pagination.current_page
  const last = pagination.last_page
  const total = pagination.total

  const getPages = () => {
    const pages = []
    const delta = 1
    const rangeStart = Math.max(2, current - delta)
    const rangeEnd = Math.min(last - 1, current + delta)

    pages.push(1)
    if (rangeStart > 2) pages.push('...')
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i)
    if (rangeEnd < last - 1) pages.push('...')
    if (last > 1) pages.push(last)

    return pages
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
      <p className="text-xs text-slate-400">
        {total} résultat{total > 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(current - 1)}
          disabled={loading || current <= 1}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={15} />
        </button>

        {getPages().map((page, i) =>
          page === '...' ? (
            <span key={`ellipsis-${i}`} className="h-8 w-8 flex items-center justify-center text-xs text-slate-300">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={loading}
              className={`h-8 min-w-[32px] px-1.5 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                page === current
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              } ${loading ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(current + 1)}
          disabled={loading || current >= last}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
