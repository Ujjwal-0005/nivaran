import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function AuthLayout({
  children,
  badgeText = 'PUNJAB RIGHT TO SERVICE ACT • CITIZEN PORTAL',
  badgeSub = 'RTS SEC-7',
  step = null,
  steps = null,
  showTicker = true,
  customHero = null,
}) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('nivaran_auth_theme') || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('nivaran_auth_theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const isDark = theme === 'dark'

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 font-body ${
        isDark
          ? 'bg-[#06090F] text-slate-100 selection:bg-orange-600 selection:text-white'
          : 'bg-[#FAF8F5] text-slate-900 selection:bg-orange-500 selection:text-white'
      }`}
      style={{
        backgroundImage: isDark
          ? 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234, 88, 12, 0.08), transparent 70%), radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)'
          : 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(234, 88, 12, 0.05), transparent 70%), radial-gradient(circle at 1px 1px, rgba(0,0,0,0.03) 1px, transparent 0)',
        backgroundSize: '100% 100%, 24px 24px',
      }}
    >
      {/* ── Top Sovereign Government Header ───────────────────────────── */}
      <header
        className={`w-full border-b transition-colors duration-200 z-30 sticky top-0 backdrop-blur-md ${
          isDark
            ? 'bg-[#0B0F17]/90 border-slate-800/80'
            : 'bg-white/95 border-amber-100/80 shadow-xs'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand + Localized Emblem */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
                <span className="font-display font-black text-xl">🏛</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-display font-bold text-xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Nivaran
                  </span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded font-mono ${
                    isDark
                      ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                      : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}>
                    ਨਿਵਾਰਣ • निवारण
                  </span>
                </div>
                <p className={`text-[11px] leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Punjab Public Redressal Infrastructure
                </p>
              </div>
            </Link>

            {/* Jurisdiction Badge */}
            <div
              className={`hidden md:flex items-center gap-2 pl-4 ml-3 border-l py-1 text-xs ${
                isDark ? 'border-slate-800 text-slate-300' : 'border-slate-200 text-slate-600'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium">Punjab Municipal Grid</span>
              <span className={`px-1.5 py-0.5 text-[10px] rounded font-mono ${
                isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
              }`}>
                80 Wards Active
              </span>
            </div>
          </div>

          {/* Quick Nav & Mode Switcher */}
          <div className="flex items-center gap-2 sm:gap-4">
            <nav className="hidden lg:flex items-center gap-5 text-xs font-medium">
              <Link to="/" className={`transition hover:text-orange-500 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Public Home
              </Link>
              <Link to="/transparency" className={`transition hover:text-orange-500 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                Transparency Log
              </Link>
              <Link to="/register" className={`transition hover:text-orange-500 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                File Issue
              </Link>
            </nav>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                isDark
                  ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600'
                  : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400 shadow-xs'
              }`}
            >
              {isDark ? (
                <>
                  <span className="text-amber-400">🌙</span>
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <span className="text-amber-500">☀️</span>
                  <span>Light</span>
                </>
              )}
            </button>

            {/* Emergency / Report CTA */}
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-md shadow-orange-600/20 active:scale-95 transition"
            >
              <span>🚨</span>
              <span>Report Issue</span>
              <span className="text-[10px] opacity-75 font-mono bg-black/20 px-1 py-0.2 rounded">&lt;60s</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Responsive Content Area ──────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 flex flex-col justify-center">
        {/* Multi-step Top Tracker (e.g. For Registration or Verification) */}
        {steps && (
          <div className="mb-8 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {steps.map((st, idx) => {
                const stepNum = idx + 1
                const isActive = step?.current === stepNum
                const isPassed = step?.current > stepNum
                return (
                  <div
                    key={st.title}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isActive
                        ? isDark
                          ? 'bg-slate-900/90 border-orange-500/50 shadow-lg shadow-orange-950/30'
                          : 'bg-white border-orange-500 shadow-sm ring-1 ring-orange-500/20'
                        : isPassed
                        ? isDark
                          ? 'bg-slate-900/40 border-slate-800 text-slate-400'
                          : 'bg-emerald-50/60 border-emerald-200 text-slate-700'
                        : isDark
                        ? 'bg-slate-950/40 border-slate-900 text-slate-500'
                        : 'bg-white/70 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                        isActive
                          ? 'bg-orange-500 text-white shadow-xs'
                          : isPassed
                          ? 'bg-emerald-500 text-white'
                          : isDark
                          ? 'bg-slate-800 text-slate-400'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPassed ? '✓' : `0${stepNum}`}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${
                          isActive ? 'text-orange-600' : isPassed ? 'text-emerald-600' : 'text-slate-400'
                        }`}>
                          Step 0{stepNum}
                        </span>
                        {isActive && (
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                            isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700'
                          }`}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className={`text-xs font-semibold truncate ${
                        isActive
                          ? isDark ? 'text-white' : 'text-slate-900'
                          : isDark ? 'text-slate-400' : 'text-slate-600'
                      }`}>
                        {st.title}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Civic Hero Guarantee & Telemetry Cards */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-6">
            {customHero || (
              <>
                {/* Government Statutory Badge */}
                <div
                  className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border text-xs font-medium shadow-xs ${
                    isDark
                      ? 'bg-slate-900/80 border-orange-500/30'
                      : 'bg-orange-50/80 border-orange-200/90 text-orange-950'
                  }`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold text-orange-600 tracking-wide">{badgeText}</span>
                  <span className="px-1.5 py-0.2 text-[10px] rounded bg-orange-600 text-white font-mono font-bold">
                    {badgeSub}
                  </span>
                </div>

                {/* Primary Headline & Gurmukhi/Hindi Subtitle */}
                <div className="space-y-2">
                  <h1 className={`font-display text-3xl sm:text-4xl xl:text-5xl font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    Your voice connects directly to governance.
                  </h1>
                  <p className="text-base sm:text-lg font-bold text-orange-600">
                    ਤੁਹਾਡੀ ਆਵਾਜ਼, ਸਿੱਧਾ ਨਿਵਾਰਣ • त्वरित नागरिक समाधान
                  </p>
                  <p className={`text-sm sm:text-base leading-relaxed max-w-xl ${
                    isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}>
                    A frictionless, single-window municipal command gateway for Punjab residents.
                    Track ground crews, enforce statutory SLAs under RTS Sec-7, and verify public works in real time.
                  </p>
                </div>

                {/* Statutory Feature Pillars */}
                <div className="space-y-3 pt-2">
                  {/* Pillar 1 */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-amber-100/90 shadow-sm hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                        isDark
                          ? 'bg-orange-500/10 border border-orange-500/20 text-orange-400'
                          : 'bg-orange-50 border border-orange-200 text-orange-600'
                      }`}>
                        ⚡
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Zero-Delay Civic Dispatch
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isDark
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            AUTOMATED
                          </span>
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Instant encrypted ticketing routed directly to ward sanitary inspectors and road engineers without bureaucratic bottlenecks.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 2 */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-amber-100/90 shadow-sm hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                        isDark
                          ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                      }`}>
                        📍
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            GPS Geo-Tagged Accountability
                          </h4>
                          <span className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Live Telemetry Active
                          </span>
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          All before-and-after work evidence requires verified geo-coordinates and photo audit to prevent ghost completions.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3 */}
                  <div
                    className={`p-4 rounded-xl border transition-all ${
                      isDark
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        : 'bg-white border-amber-100/90 shadow-sm hover:border-amber-200'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                        isDark
                          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                          : 'bg-amber-50 border border-amber-200 text-amber-600'
                      }`}>
                        ⏱️
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Statutory Resolution SLA (48–72 Hrs)
                          </h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                            isDark
                              ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                              : 'bg-orange-50 text-orange-700 border-orange-200'
                          }`}>
                            LEGALLY BINDING
                          </span>
                        </div>
                        <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          Time-bound automatic escalation to the Zonal Commissioner if citizen grievances remain unaddressed past statutory window.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 24x7 Helpline Bar */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                    isDark
                      ? 'bg-slate-950/80 border-slate-800/80 text-slate-300'
                      : 'bg-gradient-to-r from-amber-50/90 to-orange-50/70 border-amber-200/90 text-amber-950 shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🎧</span>
                    <div>
                      <p className="font-bold">Toll-Free Civic Helpline</p>
                      <p className={isDark ? 'text-slate-400' : 'text-amber-800'}>
                        Dial 1800-180-2121 (JMC Civic Redressal Desk)
                      </p>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-md font-mono font-bold text-[11px] bg-orange-600 text-white shadow-xs">
                    24x7 Ready
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column: High-contrast Form Card Container */}
          <div className="lg:col-span-6 xl:col-span-5">
            <div
              className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-xl transition-all shadow-xl relative overflow-hidden ${
                isDark
                  ? 'bg-[#0E1420]/95 border-slate-800 text-white shadow-black/40'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-xl shadow-slate-200/80 ring-1 ring-slate-950/5'
              }`}
            >
              {/* Subtle Ambient Glow */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 rounded-full pointer-events-none blur-3xl ${
                  isDark ? 'opacity-20 bg-orange-600' : 'opacity-15 bg-orange-300'
                }`}
              />
              <div
                className={`absolute -bottom-24 -left-24 w-48 h-48 rounded-full pointer-events-none blur-3xl ${
                  isDark ? 'opacity-15 bg-emerald-500' : 'opacity-10 bg-emerald-300'
                }`}
              />

              {/* Pass theme to children if needed via data-theme attribute */}
              <div className="relative z-10" data-theme={theme}>{children}</div>
            </div>
          </div>
        </div>

        {/* ── Bottom Live Redressals Strip ────────────────────────────── */}
        {showTicker && (
          <div
            className={`mt-12 rounded-2xl border p-5 transition-all ${
              isDark
                ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                : 'bg-white border-amber-100/90 text-slate-700 shadow-sm'
            }`}
          >
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-6 text-center sm:text-left divide-y sm:divide-y-0 sm:divide-x ${
              isDark ? 'divide-slate-800/40' : 'divide-slate-200'
            }`}>
              <div className="pt-2 sm:pt-0 sm:pr-4">
                <p className={`text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Live Active Redressals
                </p>
                <div className="flex items-baseline gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-2xl font-black font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    1,842
                  </span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">↓ 8.4%</span>
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Across Punjab Wards
                </p>
              </div>

              <div className="pt-4 sm:pt-0 sm:px-4">
                <p className={`text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Mean Resolution Speed
                </p>
                <div className="flex items-baseline gap-2 mt-1 justify-center sm:justify-start">
                  <span className="text-2xl font-black font-display text-orange-600">
                    4.2 hrs
                  </span>
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Roads & Sanitation
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Within Section 7 RTS Rules
                </p>
              </div>

              <div className="pt-4 sm:pt-0 sm:px-4">
                <p className={`text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Verified Resolution Rate
                </p>
                <div className="flex items-baseline gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-2xl font-black font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    96.8%
                  </span>
                  <span className="text-xs font-bold text-emerald-600 font-mono">Geo-Tagged</span>
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Photo-validated by residents
                </p>
              </div>

              <div className="pt-4 sm:pt-0 sm:pl-4">
                <p className={`text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Active Municipal Squads
                </p>
                <div className="flex items-baseline gap-2 mt-1 justify-center sm:justify-start">
                  <span className={`text-2xl font-black font-display ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    42 teams
                  </span>
                </div>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Sanitation, Lighting & Water
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Official Footer Strip ────────────────────────────────────── */}
      <footer
        className={`w-full border-t py-4 text-xs transition-colors ${
          isDark
            ? 'bg-[#0B0F17]/90 border-slate-900 text-slate-400'
            : 'bg-white border-slate-200 text-slate-600'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              An independent civic platform • Connecting citizens & municipal administration across Punjab
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link to="/transparency" className="hover:text-orange-500 transition">
              Statutory Citizen Charter
            </Link>
            <span>•</span>
            <span>Right to Service Act Enforced</span>
            <span>•</span>
            <span className="font-mono">© {new Date().getFullYear()} Nivaran OS</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
