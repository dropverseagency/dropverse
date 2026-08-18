'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  AtSign,
  Check,
  Lock,
  Mail,
  Phone,
  Save,
  User,
} from 'lucide-react'
import Brand from '../../../components/Brand'
import { createClient } from '../../../lib/supabase'

interface SessionUser {
  id: string
  email: string | null
}

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  phone: string | null
  telegram_username: string | null
  username_cooldown_at: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function Settings() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [telegram, setTelegram] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const [profileStatus, setProfileStatus] = useState<SaveStatus>('idle')
  const [profileError, setProfileError] = useState('')
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null)
  const [emailStatus, setEmailStatus] = useState<SaveStatus>('idle')
  const [emailError, setEmailError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      let session = null
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          session = data.session
          break
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, 800))
      }
      if (!session || cancelled) {
        window.location.assign('/login?redirect=%2Fdashboard%2Fsettings')
        return
      }
      setUser({ id: session.user.id, email: session.user.email ?? null })
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone, telegram_username, username_cooldown_at')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (data) {
        const p = data as Profile
        setProfile(p)
        setFullName(p.full_name ?? '')
        setUsername(p.username ?? '')
        setPhone(p.phone ?? '')
        setTelegram(p.telegram_username ?? '')
        if (p.username && p.username_cooldown_at) {
          setCooldownUntil(new Date(new Date(p.username_cooldown_at).getTime() + 90 * 24 * 60 * 60 * 1000))
        }
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveProfile() {
    if (!user || !profile) return
    const trimmedUsername = username.trim().toLowerCase()
    if (trimmedUsername.length < 3) {
      setProfileError('Username must be at least 3 characters.')
      return
    }
    const sameUsername = trimmedUsername === (username.trim().toLowerCase())
    if (!sameUsername && cooldownUntil && new Date() < cooldownUntil) {
      setProfileError(
        `Username can only be changed once every 90 days — next change available ${cooldownUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
      )
      return
    }
    const supabase = createClient()
    setProfileStatus('saving')
    setProfileError('')
    // Profiles row (mirrors Supabase user metadata)
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        full_name: fullName.trim() || null,
        username: trimmedUsername || null,
        phone: phone.trim() || null,
        telegram_username: telegram.trim() || null,
      },
      { onConflict: 'id' },
    )
    if (error) {
      const msg = error.message || ''
      const detail = error.details || ''
      const cooldownUntilStr = detail.includes('cooldown_until=')
        ? detail.split('cooldown_until=')[1]?.split('\n')[0]?.trim()
        : null
      if (cooldownUntilStr) {
        setProfileError(
          `Username can only be changed once every 90 days${cooldownUntilStr ? ` — next change available ${cooldownUntilStr}` : ''}.`,
        )
      } else if (error.code === '23505' || msg.includes('duplicate key')) {
        // Which unique column? The unique index names differ per column.
        const detailLower = detail.toLowerCase()
        if (detailLower.includes('username') || msg.toLowerCase().includes('username')) {
          setProfileError('This username is already taken — pick another one.')
        } else if (detailLower.includes('phone') || msg.toLowerCase().includes('phone')) {
          setProfileError('This mobile number is already registered to another account.')
        } else {
          setProfileError('This value is already used by another account.')
        }
      } else {
        setProfileError('Could not save. Please try again.')
      }
      setProfileStatus('error')
      return
    }
    // Also keep user_metadata in sync so the headers keep showing the right name.
    await supabase.auth.updateUser({
      data: {
        full_name: fullName.trim() || null,
        username: trimmedUsername || null,
        phone: phone.trim() || null,
        telegram_username: telegram.trim() || null,
      },
    })
    setProfileStatus('saved')
    setTimeout(() => setProfileStatus('idle'), 3000)
  }

  async function changeEmail() {
    if (!user) return
    const email = newEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.')
      return
    }
    if (email === user.email?.toLowerCase()) {
      setEmailError('This is your current email already.')
      return
    }
    const supabase = createClient()
    setEmailStatus('saving')
    setEmailError('')
    setEmailSent(false)
    // Sends a confirmation link to the NEW email. Once the user clicks it,
    // the email is updated on the SAME account (id stays the same) so all
    // data is preserved. No sign-out needed.
    const { error } = await supabase.auth.updateUser({ email })
    if (error) {
      if (error.code === '42501') {
        setEmailError('This email is already in use by another account.')
      } else {
        setEmailError(error.message || 'Could not request the change. Please try again.')
      }
      setEmailStatus('error')
      return
    }
    setEmailStatus('saved')
    setEmailSent(true)
  }

  return (
    <main className="min-h-screen grid-bg px-5 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-5xl">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Brand compact />
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-[#9aaca6] transition hover:border-[rgba(216,180,90,0.40)] hover:text-[#e4c979]"
          >
            <ArrowLeft size={15} /> Back to Dashboard
          </Link>
        </div>

        <p className="mt-6 text-sm text-[#d8b45a]">Account settings</p>
        <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">Settings</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#8fa29c]">
          Update your profile anytime. Your name, contact details and email are saved
          instantly. Changing your email sends a confirmation link to the new address. Username
          can be changed once every 90 days.
        </p>

        {loading ? (
          <div className="mt-24 text-center text-sm text-[#718781]">Loading your settings...</div>
        ) : (
          <div className="mt-10 space-y-6">
            {/* Profile details */}
            <section className="card rounded-3xl p-7">
              <h2 className="font-display text-xl font-bold">Profile details</h2>
              <p className="mt-1 text-sm text-[#81948e]">Changes are saved right away.</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field
                  icon={<User size={15} />}
                  label="Full name"
                  value={fullName}
                  onChange={setFullName}
                  placeholder="Your name"
                />
                <Field
                  icon={<AtSign size={15} />}
                  label="Username"
                  value={username}
                  onChange={setUsername}
                  placeholder="min 3 characters"
                />
                {cooldownUntil && !profileError && new Date() < cooldownUntil && (
                  <p className="text-xs text-[#c9a86a] sm:col-span-2">
                    Username changed recently — next change available{' '}
                    {cooldownUntil.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}.
                  </p>
                )}
                <Field
                  icon={<Phone size={15} />}
                  label="Mobile"
                  value={phone}
                  onChange={setPhone}
                  placeholder="+20 100 000 0000"
                />
                <Field
                  icon={<AtSign size={15} />}
                  label="Telegram username"
                  value={telegram}
                  onChange={setTelegram}
                  placeholder="@username (optional)"
                />
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={profileStatus === 'saving'}
                  className="flex items-center gap-2 rounded-full bg-[#d8b45a] px-6 py-3 text-sm font-bold text-[#10221f] transition hover:bg-[#f0d98b] disabled:opacity-60"
                >
                  {profileStatus === 'saving' ? 'Saving...' : 'Save changes'}
                  {profileStatus === 'saving' ? null : profileStatus === 'saved' ? (
                    <Check size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                </button>
                {profileStatus === 'saved' && (
                  <span className="text-sm font-semibold text-[#6fbf73]">Saved successfully.</span>
                )}
                {profileError && <span className="text-sm font-semibold text-[#e08282]">{profileError}</span>}
              </div>
            </section>

            {/* Email */}
            <section className="card rounded-3xl p-7">
              <h2 className="font-display text-xl font-bold">Email</h2>
              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[.025] px-4 py-3.5">
                <Mail size={15} className="text-[#d8b45a]" />
                <div className="min-w-0">
                  <div className="text-xs text-[#718781]">Current email</div>
                  <div className="truncate text-sm font-semibold text-[#d9e0dc]">{user?.email || '—'}</div>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs text-[#718781]">New email address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => {
                    setNewEmail(e.target.value)
                    setEmailSent(false)
                  }}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-[#d9e0dc] outline-none transition focus:border-[rgba(216,180,90,0.50)]"
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={changeEmail}
                  disabled={emailStatus === 'saving'}
                  className="flex items-center gap-2 rounded-full border border-[rgba(216,180,90,0.40)] bg-[rgba(216,180,90,0.08)] px-6 py-3 text-sm font-bold text-[#e4c979] transition hover:border-[rgba(216,180,90,0.60)] hover:bg-[rgba(216,180,90,0.14)] disabled:opacity-60"
                >
                  <Lock size={15} /> {emailStatus === 'saving' ? 'Sending...' : 'Change email'}
                </button>
                {emailError && <span className="text-sm font-semibold text-[#e08282]">{emailError}</span>}
              </div>
              {emailSent && (
                <div className="mt-4 rounded-2xl border border-[rgba(111,191,115,0.30)] bg-[rgba(111,191,115,0.08)] p-4 text-sm leading-6 text-[#9fd8a4]">
                  <span className="font-bold">Check your new inbox.</span> We sent a confirmation
                  link to <span className="font-semibold">{newEmail}</span>. Click it to finish
                  switching — your account, data and settings stay exactly the same.
                </div>
              )}
              <p className="mt-4 text-xs leading-5 text-[#687d76]">
                Supabase verifies the new address before switching it on your account, so you stay
                signed in and keep all your data.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
}: {
  icon: React.ReactNode
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-[#718781]">
        <span className="text-[#d8b45a]">{icon}</span>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-[#d9e0dc] outline-none transition focus:border-[rgba(216,180,90,0.50)]"
      />
    </div>
  )
}
