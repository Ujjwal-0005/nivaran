import { Link } from 'react-router-dom'

const STATS = [
  { value: '12,400+', label: 'Issues Reported', hi: 'शिकायतें दर्ज' },
  { value: '91%',     label: 'Resolution Rate', hi: 'समाधान दर' },
  { value: '38 hrs',  label: 'Avg. Resolution', hi: 'औसत समाधान समय' },
  { value: '240+',    label: 'Wards Covered',   hi: 'वार्ड कवर' },
]

const FEATURES = [
  {
    icon: '📍',
    title: 'Geo-Tagged Reports',
    titleHi: 'भू-टैग रिपोर्ट',
    desc: 'Pin the exact issue location on a map so field staff can reach it without confusion.',
  },
  {
    icon: '🔔',
    title: 'Real-Time Updates',
    titleHi: 'रियल-टाइम अपडेट',
    desc: 'Get notified the moment your complaint moves from filed to resolved.',
  },
  {
    icon: '📊',
    title: 'Public Transparency',
    titleHi: 'सार्वजनिक पारदर्शिता',
    desc: 'Live department scorecards — every citizen can see how their ward is performing.',
  },
  {
    icon: '🤝',
    title: 'Community Voice',
    titleHi: 'सामुदायिक आवाज़',
    desc: 'Upvote existing issues to raise priority. One problem, one ticket, faster resolution.',
  },
]

function Landing() {
  return (
    <div className="min-h-screen bg-sandstone font-body">

      {/* ── Top bar ────────────────────────────────────── */}
      <header className="bg-sovereign-indigo text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-kesariya flex items-center justify-center text-sm">🏛</div>
            <span className="font-display font-bold text-lg tracking-tight">Nivaran</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/transparency"
              className="text-white/70 hover:text-white text-sm font-medium transition hidden sm:block"
            >
              📊 Public Data
            </Link>
            <Link
              to="/login"
              className="text-sm font-semibold text-white/80 hover:text-white border border-white/25 px-3 py-1.5 rounded transition"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-kesariya hover:bg-civic-flame text-white px-4 py-1.5 rounded transition shadow"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="bg-sovereign-indigo text-white pt-16 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Chakra motif */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full border-4 border-kesariya/60 flex items-center justify-center text-4xl shadow-lg shadow-kesariya/20 bg-white/5">
              🏛️
            </div>
          </div>

          <p className="text-kesariya text-xs font-bold uppercase tracking-[0.25em] mb-3">
            Jan Seva · जन सेवा
          </p>

          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-3">
            Nivaran
          </h1>
          <p className="text-2xl sm:text-3xl font-display font-semibold text-white/70 mb-5">
            निवारण — Resolved.
          </p>
          <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto mb-8 leading-relaxed">
            A civic grievance platform where citizens report local issues, track resolution in real-time, and hold municipal departments accountable.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="bg-kesariya hover:bg-civic-flame text-white font-bold px-7 py-3 rounded shadow-lg shadow-kesariya/30 transition-all active:scale-95 text-sm"
            >
              शिकायत दर्ज करें — File a Report
            </Link>
            <Link
              to="/login"
              className="border border-white/25 hover:border-white/50 text-white font-semibold px-7 py-3 rounded transition-all text-sm"
            >
              Login
            </Link>
            <Link
              to="/transparency"
              className="border border-kesariya/50 hover:border-kesariya text-kesariya hover:text-civic-flame font-semibold px-7 py-3 rounded transition-all text-sm flex items-center gap-1.5"
            >
              📊 Public Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────── */}
      <section className="bg-parchment border-y border-earthen-slate">
        <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-bold text-sovereign-indigo">{s.value}</p>
              <p className="text-xs font-semibold text-gray-700 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-gray-400">{s.hi}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-kesariya mb-2">How it works</p>
            <h2 className="font-display text-3xl font-bold text-sovereign-indigo">
              Built for Citizens, Accountable to Citizens
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-nivaran p-5 hover:shadow-md hover:border-earthen-slate-dark transition-all group"
              >
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">{f.icon}</div>
                <h3 className="font-display font-bold text-sovereign-indigo text-sm mb-0.5">{f.title}</h3>
                <p className="text-[10px] text-kesariya font-semibold mb-2">{f.titleHi}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────── */}
      <section className="bg-sovereign-indigo text-white py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
            अपनी शिकायत दर्ज करें
          </h2>
          <p className="text-white/60 mb-6 text-sm">
            Register in 30 seconds. No paperwork. No offices. Just report it and track it.
          </p>
          <Link
            to="/register"
            className="inline-block bg-kesariya hover:bg-civic-flame text-white font-bold px-8 py-3 rounded shadow-lg shadow-kesariya/30 transition-all active:scale-95"
          >
            Get Started →
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="bg-parchment border-t border-earthen-slate py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© 2025 Nivaran · Open Governance Platform</span>
          <div className="flex gap-4">
            <Link to="/transparency" className="hover:text-kesariya transition">Public Data</Link>
            <Link to="/login" className="hover:text-kesariya transition">Login</Link>
            <Link to="/register" className="hover:text-kesariya transition">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
