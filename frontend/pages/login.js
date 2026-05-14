import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Enter your email and password to continue.')
      return
    }

    setLoading(true)
    setError('')

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <>
      <Head>
        <title>Sign in · Party Player</title>
      </Head>

      <div className="page bg-dotted flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="flex items-center justify-center mb-8">
            <div className="w-11 h-11 rounded-2xl bg-accent grid place-items-center text-white text-xl font-bold shadow-glow">P</div>
          </div>

          <div className="surface-card p-7 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-ink-2 text-sm mt-1">Sign in to your Party Player account.</p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 h-9 text-xs text-ink-2 hover:text-ink-0 rounded-lg hover:bg-surface-4 transition"
                    tabIndex={-1}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : 'Sign in'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center text-sm text-ink-2">
              New here?{' '}
              <Link href="/signup" className="text-accent hover:text-accent-hover font-medium">
                Create an account
              </Link>
            </div>
          </div>

          <p className="text-center text-xs text-ink-3 mt-6">
            Watch YouTube together · Synced playback · Real-time chat
          </p>
        </div>
      </div>
    </>
  )
}
