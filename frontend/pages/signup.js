import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    displayName: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { signUp } = useAuth()
  const router = useRouter()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const validate = () => {
    if (!formData.email || !formData.password || !formData.username || !formData.displayName) {
      setError('Please fill in all fields.')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters.')
      return false
    }
    if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      setError('Username can only contain letters, numbers, and underscores.')
      return false
    }
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await signUp(
      formData.email,
      formData.password,
      formData.username,
      formData.displayName,
    )

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess('Account created. Check your email to verify, then sign in.')
      setLoading(false)
      setTimeout(() => router.push('/login'), 2500)
    }
  }

  return (
    <>
      <Head>
        <title>Create account · Party Player</title>
      </Head>

      <div className="page bg-dotted flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="flex items-center justify-center mb-8">
            <div className="w-11 h-11 rounded-2xl bg-accent grid place-items-center text-white text-xl font-bold shadow-glow">P</div>
          </div>

          <div className="surface-card p-7 sm:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
              <p className="text-ink-2 text-sm mt-1">Join Party Player and watch together with friends.</p>
            </div>

            {error && (
              <div className="mb-5 p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-5 p-3 rounded-xl bg-success-soft border border-success/30 text-success text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="username" className="label">Username</label>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    className="input"
                    placeholder="yashpatil"
                    autoComplete="username"
                    required
                  />
                  <p className="helper">Friends use this to find you.</p>
                </div>
                <div>
                  <label htmlFor="displayName" className="label">Display name</label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="input"
                    placeholder="Yash"
                    required
                  />
                  <p className="helper">Shown to others in rooms.</p>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="input pr-12"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
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

              <div>
                <label htmlFor="confirmPassword" className="label">Confirm password</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full mt-1"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : 'Create account'}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center text-sm text-ink-2">
              Already have an account?{' '}
              <Link href="/login" className="text-accent hover:text-accent-hover font-medium">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
