import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileStack,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
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
    <main className="min-h-screen overflow-hidden bg-[#f6f2e9] text-slate-950">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.14),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(217,119,6,0.16),_transparent_34%),linear-gradient(135deg,_#f6f2e9,_#fffdf8_42%,_#eef6f4)]" />
        <div className="absolute left-[-8rem] top-16 h-64 w-64 rounded-full bg-[#0f766e]/10 blur-3xl" />
        <div className="absolute bottom-10 right-[-6rem] h-72 w-72 rounded-full bg-[#d97706]/10 blur-3xl" />

        <div className="relative grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
          <section className="hidden px-10 py-10 lg:flex lg:flex-col lg:justify-between xl:px-16">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-slate-950 text-white shadow-lg shadow-slate-300/50">
                <FileStack size={26} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#0f766e]">
                  Gestion Courrier
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Plateforme documentaire securisee
                </p>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-2 text-sm font-medium text-slate-700 backdrop-blur">
                <Sparkles size={16} className="text-[#d97706]" />
                Suivi moderne des courriers, validations et archives
              </div>

              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight text-slate-950 xl:text-6xl">
                Une entrée plus nette pour un circuit documentaire plus rigoureux.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">
                Connectez-vous à votre espace pour traiter les courriers, suivre les validations,
                protéger les contenus sensibles et garder une traçabilité claire.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                <FeatureCard
                  icon={<ShieldCheck size={18} />}
                  title="Acces securise"
                  text="Confidentialite, roles et controles backend."
                  tone="teal"
                />
                <FeatureCard
                  icon={<CheckCircle2 size={18} />}
                  title="Circuit maitrise"
                  text="Validation, transmission, reception et archivage."
                  tone="amber"
                />
                <FeatureCard
                  icon={<Mail size={18} />}
                  title="Suivi centralise"
                  text="Courriers, messages et services sur une meme interface."
                  tone="slate"
                />
              </div>
            </div>

            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <Metric label="Protection" value="Par role" accent="bg-[#0f766e]" />
              <Metric label="Validation" value="Chef / Admin" accent="bg-[#d97706]" />
              <Metric label="Archivage" value="Trace complete" accent="bg-slate-950" />
            </div>
          </section>

          <section className="flex items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
            <div className="w-full max-w-lg">
              <div className="mb-8 flex items-center gap-4 lg:hidden">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-slate-950 text-white shadow-lg shadow-slate-300/40">
                  <FileStack size={24} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0f766e]">
                    Gestion Courrier
                  </p>
                  <p className="mt-1 text-sm text-slate-500">Connexion securisee</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/85 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
                <div className="border-b border-slate-100 bg-[linear-gradient(135deg,_rgba(15,118,110,0.08),_rgba(217,119,6,0.08),_rgba(255,255,255,0.9))] px-7 py-7 sm:px-8">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">
                    <ShieldCheck size={14} className="text-[#0f766e]" />
                    Authentification
                  </div>

                  <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                    Connexion
                  </h2>

                  <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
                    Entrez vos identifiants pour accéder à votre tableau de bord documentaire.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="px-7 py-7 sm:px-8">
                  {error && (
                    <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="space-y-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Email
                      </span>
                      <span className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-[#0f766e] focus-within:ring-4 focus-within:ring-[#0f766e]/10">
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
                      <span className="flex h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 transition focus-within:border-[#0f766e] focus-within:ring-4 focus-within:ring-[#0f766e]/10">
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
                          className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
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

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <label className="flex items-center gap-3 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={form.remember}
                        onChange={(event) => updateField('remember', event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0f766e]"
                      />
                      Se souvenir de moi
                    </label>

                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                      Laravel Sanctum
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-[#0f172a] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                    Se connecter
                  </button>

                  <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">Inscription</p>
                    <p className="mt-1 leading-6">
                      La creation de compte est geree par l’administrateur dans l’espace
                      utilisateurs. L’inscription publique n’est donc pas ouverte.
                    </p>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function FeatureCard({ icon, title, text, tone }) {
  const tones = {
    teal: 'border-[#0f766e]/15 bg-white/65 text-[#0f766e]',
    amber: 'border-[#d97706]/15 bg-white/65 text-[#d97706]',
    slate: 'border-slate-300/60 bg-white/65 text-slate-700',
  }

  return (
    <div className={`rounded-[1.6rem] border p-5 backdrop-blur ${tones[tone] || tones.slate}`}>
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm">
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  )
}

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur">
      <div className={`mb-3 h-1.5 w-12 rounded-full ${accent}`} />
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  )
}
