import { useState } from 'react'
import {
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../context/auth-context'

export default function Login() {
  const { login } = useAuth()
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError('')

      await login(form)
    } catch (err) {
      const validationMessage =
        err.response?.data?.errors?.email?.[0] ||
        err.response?.data?.message ||
        'Connexion impossible. Verifiez vos identifiants.'

      setError(validationMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f6f8] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden bg-[#171717] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-[#171717]">
              <FileText size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase text-amber-300">
                Gestion Courrier
              </p>
              <p className="text-sm text-slate-300">Acces securise</p>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">
              <ShieldCheck size={16} className="text-emerald-300" />
              Authentification Laravel Sanctum
            </div>

            <h1 className="text-5xl font-semibold leading-tight">
              Connectez-vous a votre espace de gestion.
            </h1>

            <div className="mt-10 grid gap-3">
              <Metric label="Sessions" value="Protegees" tone="emerald" />
              <Metric label="Acces" value="Par role" tone="amber" />
              <Metric label="API" value="CSRF actif" tone="sky" />
            </div>
          </div>

          <p className="max-w-md text-sm leading-6 text-slate-400">
            Les courriers, messages et archives sont accessibles uniquement
            apres une connexion valide.
          </p>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#171717] text-white">
                <FileText size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase text-slate-500">
                  Gestion Courrier
                </p>
                <p className="font-semibold text-slate-950">Acces securise</p>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-950">
                  Connexion
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Entrez vos identifiants pour continuer.
                </p>
              </div>

              {error && (
                <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </span>
                  <span className="flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-slate-900">
                    <Mail size={18} className="text-slate-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateField('email', event.target.value)}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      placeholder="admin@courrier.dz"
                      autoComplete="email"
                      required
                    />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Mot de passe
                  </span>
                  <span className="flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-slate-900">
                    <Lock size={18} className="text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) => updateField('password', event.target.value)}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
                      placeholder="Votre mot de passe"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showPassword
                          ? 'Masquer le mot de passe'
                          : 'Afficher le mot de passe'
                      }
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
              </div>

              <label className="mt-5 flex items-center gap-3 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(event) => updateField('remember', event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-950"
                />
                Se souvenir de moi
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#171717] px-4 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting && <Loader2 size={18} className="animate-spin" />}
                Se connecter
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, tone }) {
  const tones = {
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    sky: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
  }

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs uppercase opacity-70">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}
