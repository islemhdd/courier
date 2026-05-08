import clsx from 'clsx'

/**
 * Modern Badge component for administrative UI.
 * Supports dots, subtle borders, and predefined professional tones.
 */
export default function Badge({ 
  children, 
  variant = 'gray', 
  dot = false, 
  className = '',
  size = 'md'
}) {
  const variants = {
    // Administrative Statuses
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/60',
    sky: 'bg-sky-50 text-sky-700 border-sky-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/60',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    slate: 'bg-slate-50 text-slate-700 border-slate-200/60',
    
    // Legacy colors mapping
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    red: 'bg-rose-50 text-rose-700 border-rose-200/60',
    orange: 'bg-amber-50 text-amber-700 border-amber-200/60',
    gray: 'bg-slate-50 text-slate-600 border-slate-200/60',
    violet: 'bg-violet-50 text-violet-700 border-violet-200/60',
  }

  const sizes = {
    xs: 'px-1.5 py-0.5 text-[9px]',
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }

  const dotColors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    indigo: 'bg-indigo-500',
    slate: 'bg-slate-400',
    green: 'bg-emerald-500',
    red: 'bg-rose-500',
    orange: 'bg-amber-500',
    gray: 'bg-slate-400',
    violet: 'bg-violet-500',
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider transition-all',
        variants[variant] || variants.slate,
        sizes[size],
        className
      )}
    >
      {dot && (
        <span className={clsx('h-1.5 w-1.5 rounded-full ring-1 ring-white/50', dotColors[variant] || dotColors.slate)} />
      )}
      {children}
    </span>
  )
}
