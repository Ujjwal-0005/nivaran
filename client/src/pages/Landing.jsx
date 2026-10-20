import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Landing() {
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

  // Interactive Live Feed Simulator
  const [activeTab, setActiveTab] = useState('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [activeIncident, setActiveIncident] = useState(0)

  // Real-time counter animation
  const [activeCitizens, setActiveCitizens] = useState(84290)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCitizens((prev) => prev + Math.floor(Math.random() * 3))
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Ward Radar HUD Ward selector
  const [selectedWard, setSelectedWard] = useState('Central Zone (Ward 14)')
  const wards = [
    { name: 'Central Zone (Ward 14)', active: 14, latency: '1.2m', status: 'Optimal', crews: 5 },
    { name: 'North Metro (Ward 22)', active: 28, latency: '2.4m', status: 'High Traffic', crews: 8 },
    { name: 'South Ring (Ward 07)', active: 9, latency: '0.8m', status: 'Fast Response', crews: 4 },
  ]

  // Interactive Sandbox Simulator State
  const [simCategory, setSimCategory] = useState('pothole')
  const [simState, setSimState] = useState('idle') // 'idle', 'generating', 'generated'
  const [simVotes, setSimVotes] = useState(24)
  const [simUpvoted, setSimUpvoted] = useState(false)

  const handleSimulate = () => {
    setSimState('generating')
    setTimeout(() => {
      setSimState('generated')
    }, 900)
  }

  const handleSimVote = () => {
    if (!simUpvoted) {
      setSimVotes((v) => v + 1)
      setSimUpvoted(true)
    } else {
      setSimVotes((v) => v - 1)
      setSimUpvoted(false)
    }
  }

  // Audio simulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [audioProgress, setAudioProgress] = useState(0)

  useEffect(() => {
    let timer
    if (isPlayingAudio) {
      timer = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false)
            return 0
          }
          return prev + 5
        })
      }, 200)
    } else {
      clearInterval(timer)
    }
    return () => clearInterval(timer)
  }, [isPlayingAudio])

  // Live Incident Feed
  const liveIncidents = [
    {
      id: 'NIV-9824',
      category: 'Pothole & Surface Breakdown',
      icon: '🛣️',
      location: 'Ring Road, Sector 18 Outer Crossing',
      zone: 'Zone 03 • Central',
      reportedTime: '4 mins ago',
      slaRemaining: '43h 56m',
      status: 'Crew En Route',
      statusColor: 'emerald',
      upvotes: 42,
      progress: 65,
      dept: 'Roads & Surface Works (B&R)',
      officer: 'Er. Sandeep Rawat (JE)',
    },
    {
      id: 'NIV-9821',
      category: 'Pipeline Burst & Sewage Backflow',
      icon: '💧',
      location: 'Gandhi Chowk, Near Post Office Market',
      zone: 'Zone 01 • North',
      reportedTime: '18 mins ago',
      slaRemaining: '23h 42m',
      status: 'Excavation Active',
      statusColor: 'sky',
      upvotes: 89,
      progress: 80,
      dept: 'Water Supply & Sewerage Board',
      officer: 'Er. Meenakshi Sundaram (AE)',
    },
    {
      id: 'NIV-9818',
      category: 'High-Tension Sparking Transformer',
      icon: '⚡',
      location: 'Adarsh Nagar Lane 4, Behind School',
      zone: 'Zone 02 • South',
      reportedTime: '32 mins ago',
      slaRemaining: '03h 28m',
      status: 'Power Isolated',
      statusColor: 'amber',
      upvotes: 114,
      progress: 90,
      dept: 'State Power Distribution Grid',
      officer: 'Er. Rajesh K. Varma (SDO)',
    },
    {
      id: 'NIV-9812',
      category: 'Overflowing Community Garbage Dump',
      icon: '🗑️',
      location: 'Railway Colony Road, Gate 3',
      zone: 'Zone 04 • West',
      reportedTime: '1 hr ago',
      slaRemaining: '11h 00m',
      status: 'Compactor Deployed',
      statusColor: 'emerald',
      upvotes: 31,
      progress: 75,
      dept: 'Municipal Solid Waste & Sanitation',
      officer: 'Inspector Harish Chandra',
    },
  ]

  // Filtered incidents
  const filteredIncidents = liveIncidents.filter((inc) => {
    if (activeTab === 'pothole' && !inc.category.includes('Surface')) return false
    if (activeTab === 'water' && !inc.category.includes('Pipeline')) return false
    if (activeTab === 'electricity' && !inc.category.includes('Transformer')) return false
    if (activeTab === 'sanitation' && !inc.category.includes('Garbage')) return false
    if (ticketSearch) {
      const q = ticketSearch.toLowerCase()
      return (
        inc.id.toLowerCase().includes(q) ||
        inc.location.toLowerCase().includes(q) ||
        inc.category.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Compare slider for audit photo
  const [sliderPos, setSliderPos] = useState(50)

  return (
    <div
      className={`min-h-screen transition-colors duration-300 font-body relative overflow-x-hidden ${isDark
          ? 'bg-[#050811] text-slate-100 selection:bg-orange-600 selection:text-white'
          : 'bg-[#F8F9FA] text-slate-900 selection:bg-orange-500 selection:text-white'
        }`}
    >
      {/* ── Background Glow & Grid Canvas ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[640px] rounded-full blur-3xl opacity-20 ${isDark ? 'bg-gradient-to-b from-orange-600 via-amber-500 to-transparent' : 'bg-gradient-to-b from-orange-400/40 via-amber-200/30 to-transparent'
            }`}
        />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ── Official Sovereign Top Ribbon ─────────────────────────── */}
      <div
        className={`w-full py-1.5 px-4 sm:px-8 border-b text-[11px] font-mono transition-colors relative z-50 flex items-center justify-between ${isDark
            ? 'bg-[#080D18]/90 border-slate-800/80 text-slate-400'
            : 'bg-[#0F172A] border-slate-900 text-slate-300 shadow-xs'
          }`}
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-white flex items-center gap-1.5">
              <span>🏛️</span>
              <span>भारत सरकार | Government of India</span>
            </span>
            <span className="opacity-30 hidden sm:inline">•</span>
            <span className="hidden sm:inline font-sans text-slate-300">
              National Smart Municipal Governance Framework (Right to Service Act)
            </span>
          </div>

          <div className="flex items-center gap-4 text-[10px]">
            <span className="hidden md:inline font-mono text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              7,800+ ULBs Synchronized
            </span>
            <span className="hidden md:inline opacity-30">•</span>
            <span className="text-slate-300 font-semibold font-sans">
              PRAGATI & MyGov Aligned
            </span>
          </div>
        </div>
      </div>

      {/* ── Floating Modern Glass Header ───────────────────────────── */}
      <header className="sticky top-3 z-40 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-2">
        <div
          className={`w-full h-18 px-5 rounded-2xl border backdrop-blur-xl transition-all flex items-center justify-between shadow-2xl ${isDark
              ? 'bg-[#0B111E]/80 border-slate-800/80 shadow-black/60'
              : 'bg-white/85 border-slate-200/90 shadow-slate-200/50'
            }`}
        >
          {/* Logo Brand Emblem */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-600 to-orange-400 p-[1px] shadow-lg shadow-orange-600/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0B111E] rounded-[11px] flex items-center justify-center text-xl">
                🏛️
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-display font-black text-2xl tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Nivaran
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  National OS
                </span>
              </div>
              <p className={`text-[10px] leading-tight font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Zero-Delay Civic Redressal & Field Telemetry
              </p>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            <a
              href="#sandbox"
              className={`px-3.5 py-2 rounded-xl transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              Interactive Simulator
            </a>
            <a
              href="#live-grid"
              className={`px-3.5 py-2 rounded-xl transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              Live Telemetry Grid
            </a>
            <a
              href="#smart-engine"
              className={`px-3.5 py-2 rounded-xl transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              Spatial Clustering
            </a>
            <a
              href="#audit-proof"
              className={`px-3.5 py-2 rounded-xl transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              Photo Proof
            </a>
            <Link
              to="/transparency"
              className={`px-3.5 py-2 rounded-xl transition ${isDark ? 'text-slate-300 hover:text-white hover:bg-slate-800/50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              Public Scorecard
            </Link>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${isDark
                  ? 'bg-slate-900/90 border-slate-700 text-slate-200 hover:border-slate-500'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-slate-400'
                }`}
            >
              {isDark ? (
                <>
                  <span className="text-amber-400">🌙</span>
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <span className="text-amber-500">☀️</span>
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            <Link
              to="/login"
              className={`hidden sm:inline-flex px-4 py-2 rounded-xl text-xs font-bold border transition ${isDark
                  ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:opacity-95 shadow-lg shadow-orange-600/30 active:scale-95 transition"
            >
              <span>🚨</span>
              <span>Report Grievance</span>
              <span className="text-[10px] font-mono bg-black/25 px-1.5 py-0.2 rounded font-bold">&lt;60s</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO SECTION: REAL-TIME RADAR HUD + HIGH-TECH HERO ─────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-14 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Bold Typography & National Mandate */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Counter Badge */}
            <div
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-semibold shadow-xs"
              style={{
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                borderColor: isDark ? 'rgba(234, 88, 12, 0.3)' : 'rgba(234, 88, 12, 0.25)',
              }}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                {activeCitizens.toLocaleString()} Citizens Protected
              </span>
              <span className="opacity-40">•</span>
              <span className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Section 7 RTS Guarantee Enacted
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1
                className={`font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] ${isDark ? 'text-white' : 'text-slate-900'
                  }`}
              >
                Your city is listening. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600">
                  Together, we resolve.
                </span>
              </h1>
              <p
                className={`text-base sm:text-lg leading-relaxed max-w-2xl ${isDark ? 'text-slate-300' : 'text-slate-600'
                  }`}
              >
                India's first real-time civic grid. Snap a photo, drop an auto-pinned ward geotag, or speak naturally in your mother tongue. No paper files, zero bureaucracy, guaranteed time-bound resolution under statutory state mandate.
              </p>
            </div>

            {/* Quick Action CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                to="/register"
                className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-600/30 active:scale-95 transition"
              >
                <span>📷 Report an Issue in 60s</span>
                <span>→</span>
              </Link>
              <a
                href="#live-grid"
                className={`inline-flex items-center gap-2.5 px-6 py-4 rounded-2xl font-bold text-sm border transition ${isDark
                    ? 'border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                  }`}
              >
                <span>⚡ Explore Live Radar Grid</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </a>
            </div>

            {/* Multilingual Voice AI Card */}
            <div
              className={`p-4 rounded-2xl border transition-all ${isDark ? 'bg-[#0A101D] border-slate-800/80 shadow-md' : 'bg-white border-slate-200 shadow-xs'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className={isDark ? 'text-slate-200' : 'text-slate-800'}>MULTILINGUAL SPEECH-TO-TEXT ENGINE</span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                    AI Auto-Triage Active
                  </span>
                  <span className="text-slate-400">40m Spatial Dedupe</span>
                </div>
              </div>

              {/* Simulated Audio Player Waveform */}
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center flex-shrink-0 transition shadow-sm"
                >
                  {isPlayingAudio ? '⏸' : '▶'}
                </button>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Citizen Voice Dispatch Sample</span>
                    <span>{isPlayingAudio ? `${Math.round((audioProgress / 100) * 4)}s / 4s` : '00:04'}</span>
                  </div>
                  {/* Waveform bars */}
                  <div className="flex items-center gap-1 h-4">
                    {[30, 60, 90, 45, 80, 100, 70, 40, 85, 60, 40, 75, 95, 50, 30, 65, 80, 50, 20].map((h, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-300 ${(i / 19) * 100 <= audioProgress ? 'bg-orange-500' : 'bg-slate-700'
                          }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                <p className="italic text-slate-300">
                  "गली नंबर 4 के ट्रांसफॉर्मर में स्पार्क हो रहा है, तुरंत टीम भेजिए..."
                </p>
                <span className="font-mono text-emerald-400 font-bold text-[10px]">Confidence: 99.4%</span>
              </div>
            </div>
          </div>

          {/* Right Column: Ward Radar HUD Command Screen */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-[#070A12] group">
              {/* Radar HUD Banner Header */}
              <div className="p-4 bg-[#0A101D] border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="font-mono text-xs font-bold text-white tracking-wider">WARD RADAR HUD</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live Mesh: 80 Wards
                  </span>
                </div>
              </div>

              {/* Ward Selector Pills */}
              <div className="px-4 py-2 bg-[#080D18] border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-[11px]">
                {wards.map((w) => (
                  <button
                    key={w.name}
                    onClick={() => setSelectedWard(w.name)}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold whitespace-nowrap transition ${selectedWard === w.name
                        ? 'bg-orange-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>

              {/* Radar Graphic View */}
              <div className="relative h-[310px] overflow-hidden">
                <img
                  src="/ward_radar_hud.jpg"
                  alt="Municipal Ward Radar HUD"
                  className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070A12] via-transparent to-transparent pointer-events-none" />

                {/* Live Marker HUD overlay */}
                <div className="absolute top-3 left-3 p-2 rounded-xl bg-black/80 backdrop-blur-md border border-slate-700 text-[10px] font-mono text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                  <span>Centroid: 28.6139° N, 77.2090° E</span>
                </div>

                <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-[#0A101D]/90 backdrop-blur-md border border-slate-700/80 text-white flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold block">
                      FIELD SQUAD DISPATCH ACTIVE
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200">
                      14 crews in circulation across ward zones
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-emerald-400">88.4%</span>
                    <span className="text-[9px] block text-slate-400 font-mono">Response Rate</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: INTERACTIVE CIVIC SANDBOX EXPERIMENT ────────── */}
      <section id="sandbox" className={`py-16 border-y transition-colors relative z-10 ${isDark ? 'bg-[#080D18]' : 'bg-white'
        } border-slate-200 dark:border-slate-800`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase bg-orange-500/10 text-orange-600 border border-orange-500/20 mb-2">
                <span>⚡ INTERACTIVE EXPERIENCE SIMULATOR</span>
              </div>
              <h2 className={`font-display text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Test Nivaran in 30 Seconds
              </h2>
              <p className={`text-xs sm:text-sm mt-1 max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Experience how frictionless civic reporting works before submitting your actual complaint. No account required in sandbox mode.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-500 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Simulated Sandbox Node (Zero permanent record created)</span>
            </div>
          </div>

          {/* Interactive Form & Live Ticket Preview Card */}
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-2xl ${isDark ? 'bg-[#0B111E] border-slate-800 text-white' : 'bg-[#FAFAFA] border-slate-200 text-slate-900'
            }`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Interactive Controls */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Step 1: Choose Civic Issue Category
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'pothole', label: 'Pothole / Road', icon: '🛣️' },
                      { id: 'light', label: 'Streetlight', icon: '💡' },
                      { id: 'water', label: 'Water Leakage', icon: '💧' },
                      { id: 'garbage', label: 'Garbage Dump', icon: '🗑️' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSimCategory(c.id)}
                        className={`p-3 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${simCategory === c.id
                            ? 'bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/30'
                            : isDark
                              ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 shadow-xs'
                          }`}
                      >
                        <span className="text-xl">{c.icon}</span>
                        <span className="text-xs font-bold leading-tight">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                    Step 2: Sub-Meter Municipal Geotag Auto-Locked
                  </label>
                  <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-mono ${isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800 shadow-xs'
                    }`}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">📍</span>
                      <div>
                        <p className="font-bold">Ward 14, Model Town Main Market</p>
                        <p className="text-[11px] text-slate-400">28.6139° N, 77.2090° E • Accuracy ±1.1m</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px]">
                      ZONE 02
                    </span>
                  </div>
                </div>

                {/* Spatial Deduplication Node Banner */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-500 flex items-center gap-1.5">
                      <span>⚡</span>
                      <span>SPATIAL DEDUPLICATION NODE</span>
                    </span>
                    <span className="text-[10px] font-mono text-amber-500 font-bold">38m Distance Match</span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Similar issue already logged by a resident 14 minutes ago. Nivaran bundles votes rather than filing duplicate tickets.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSimVote}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${simUpvoted
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                        }`}
                    >
                      <span>👍</span>
                      <span>{simUpvoted ? 'Upvoted! Priority Boosted' : `Upvote Civic Priority (+${simVotes} neighbors)`}</span>
                    </button>
                    <span className="text-[10px] text-slate-400 font-mono">SLA drops to 24h</span>
                  </div>
                </div>

                {/* Simulation Button */}
                <button
                  type="button"
                  onClick={handleSimulate}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-600/30 transition flex items-center justify-center gap-2"
                >
                  {simState === 'generating' ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Simulating Sub-Meter Routing…</span>
                    </>
                  ) : (
                    <>
                      <span>⚡</span>
                      <span>Simulate Live Ticket Generation</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right Column: Live Ticket Preview */}
              <div className="lg:col-span-5">
                <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white border-slate-200 shadow-md'
                  }`}>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-3">
                    <span className="text-xs font-mono uppercase text-slate-400">Live Ticket Preview</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      Ready to Dispatch
                    </span>
                  </div>

                  <div className="relative h-44 rounded-xl overflow-hidden border border-slate-700 mb-3">
                    <img
                      src="/pothole_before.jpg"
                      alt="Preview Incident"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/80 font-mono text-[9px] text-white">
                      GPS: 28.6139° N, 77.2090° E
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-bold font-display text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {simCategory === 'pothole' && 'Road Cavity / Asphalt Loss'}
                        {simCategory === 'light' && 'Blacked-out Street Luminaire'}
                        {simCategory === 'water' && 'Main Distribution Line Rupture'}
                        {simCategory === 'garbage' && 'Overflowing Solid Waste Bin'}
                      </h4>
                      <span className="text-[10px] font-mono text-orange-500 font-bold">
                        SLA: 48h Legal Max
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Auto-routed to Municipal Corporation Engineering Wing. Assigned automatically to Ward Junior Engineer.
                    </p>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] font-mono flex items-center justify-between text-slate-400">
                      <span>Escalation: Level 1 (JE)</span>
                      <span className="text-emerald-500 font-bold">RTS Statutory Form Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: THREE PILLARS (CIVIC SPEED & DEDUPLICATION) ──── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-2xl mb-4">
              ⏱️
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-orange-500">PRAGATI & NATIONAL ALIGNMENT</span>
            </div>
            <h3 className={`font-display text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Real-Time Direct Oversight
            </h3>
            <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Critical municipal escalations above 72 hours automatically flagged to central governance dashboards for transparent executive review.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>Direct District Sync</span>
              <span className="text-orange-500 font-bold">Statutory Act § 7</span>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center text-2xl mb-4">
              🎯
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-sky-500">SMART CITIES 2.0</span>
            </div>
            <h3 className={`font-display text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              AI Spatial Deduplication
            </h3>
            <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Sub-meter GPS locks municipal ward coordinates. Our 40-meter spatial clustering engine aggregates neighborhood grievances into one prioritized ticket.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>40m Precision Grid</span>
              <span className="text-sky-500 font-bold">Zero Duplicate Work</span>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-2xl mb-4">
              🛡️
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-500">SEVA PARAMO DHARMA</span>
            </div>
            <h3 className={`font-display text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Mandatory Citizen Sign-Off
            </h3>
            <p className={`text-xs mt-2 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Good governance hallmark: No government officer can close a civic ticket without photo-proof and citizen OTP/SMS verification.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>100% Verified Sign-Off</span>
              <span className="text-emerald-500 font-bold">Zero Discretion</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4: CIVIC SPEED & ACCOUNTABILITY METRICS ────────── */}
      <section className={`py-14 border-y transition-colors relative z-10 ${isDark ? 'bg-[#070B14] border-slate-800/80' : 'bg-white border-slate-200'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-orange-500">LIVE MUNICIPAL LEDGER</span>
              <h2 className={`font-display text-2xl sm:text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Civic Speed & Accountability Metrics
              </h2>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Immutable resolution performance updated every 15 minutes from civic telemetry.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                All 80 Wards Unified
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0A101D] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>TOTAL REDRESSED</span>
                <span>📋</span>
              </div>
              <p className="font-display text-3xl font-black text-orange-600 dark:text-orange-500">
                18,940
              </p>
              <p className="text-[10px] font-mono text-emerald-500 mt-1">⚡ 12m triage WhatsApp & Voice</p>
            </div>

            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0A101D] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>RESOLVED (30 DAYS)</span>
                <span>✅</span>
              </div>
              <p className="font-display text-3xl font-black text-emerald-600 dark:text-emerald-400">
                2,104
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">94.2% rate across 80 wards</p>
            </div>

            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0A101D] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>AVERAGE RESOLUTION</span>
                <span>⏱️</span>
              </div>
              <p className="font-display text-3xl font-black text-sky-600 dark:text-sky-400">
                38.4 hrs
              </p>
              <p className="text-[10px] font-mono text-emerald-500 mt-1">↓ -33.6h vs historical 72h SLA</p>
            </div>

            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-[#0A101D] border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}>
              <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
                <span>CITIZEN SIGN-OFF</span>
                <span>⭐</span>
              </div>
              <p className="font-display text-3xl font-black text-amber-500">
                4.8 / 5.0
              </p>
              <p className="text-[10px] font-mono text-slate-400 mt-1">8,240 mandatory closure audits</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: HOW CIVIC PROBLEMS GET RESOLVED IN HOURS ────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-[10px] font-mono font-bold uppercase text-orange-500">ZERO RED TAPE WORKFLOW</span>
          <h2 className={`font-display text-3xl sm:text-4xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            How Civic Problems Get Resolved In Hours
          </h2>
          <p className={`text-xs sm:text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Built ground-up so no resident needs a computer degree or political contact to demand statutory public service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className={`p-8 rounded-3xl border relative transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-lg'
            }`}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-5xl font-black text-slate-300 dark:text-slate-700">01</span>
              <span className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center text-xl">
                🎙️
              </span>
            </div>
            <h3 className={`font-display text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Snap & Speak
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Citizens simply capture a quick photo or talk naturally in Hindi, English, or regional languages. AI instantly detects category, severity, and urgent priority.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-orange-500 font-bold flex items-center gap-2">
              <span>⚡</span>
              <span>Regional Dialect Certified AI</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className={`p-8 rounded-3xl border relative transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-lg'
            }`}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-5xl font-black text-slate-300 dark:text-slate-700">02</span>
              <span className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center text-xl">
                📍
              </span>
            </div>
            <h3 className={`font-display text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Auto-Cluster & Ward Pin
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Sub-meter GPS locks municipal ward boundary. Our 40-meter spatial deduplication algorithm merges duplicate complaints into an escalated civic priority.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-sky-500 font-bold flex items-center gap-2">
              <span>🎯</span>
              <span>Eliminates 38% duplicate paperwork</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className={`p-8 rounded-3xl border relative transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-lg'
            }`}>
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-5xl font-black text-slate-300 dark:text-slate-700">03</span>
              <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xl">
                🛡️
              </span>
            </div>
            <h3 className={`font-display text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Proof & Citizen Sign-Off
            </h3>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Field engineers upload geotagged After-Photos. Crucially, the ticket CANNOT close until the reporting citizen approves via a 1-tap SMS or OTP confirmation.
            </p>
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono text-emerald-500 font-bold flex items-center gap-2">
              <span>🔑</span>
              <span>Citizen holds the final closure key</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 6: LIVE TELEMETRY INCIDENT DISPATCH GRID ───────── */}
      <section id="live-grid" className={`py-20 border-y transition-colors relative z-10 ${isDark ? 'bg-[#080D18] border-slate-800' : 'bg-white border-slate-200'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase bg-orange-500/10 text-orange-600 border border-orange-500/20 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Live Municipal Telemetry Stream</span>
              </div>
              <h2 className={`font-display text-3xl sm:text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Active Citizen Redressals
              </h2>
              <p className={`text-xs sm:text-sm mt-1 max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Real grievances currently moving through statutory SLA stages. Filter by category or search your ward.
              </p>
            </div>

            {/* Search Input & Category Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search ticket, road, ward…"
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                className={`px-3.5 py-2 rounded-xl text-xs border transition focus:outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
              />

              <div className="flex items-center gap-1">
                {['all', 'pothole', 'electricity', 'water', 'sanitation'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${activeTab === cat
                        ? 'bg-orange-600 text-white shadow-sm'
                        : isDark
                          ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                          : 'bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {filteredIncidents.map((ticket, index) => (
              <div
                key={ticket.id}
                onClick={() => setActiveIncident(index)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${activeIncident === index
                    ? isDark
                      ? 'bg-slate-900/90 border-orange-500 shadow-xl shadow-orange-950/40 ring-1 ring-orange-500/40'
                      : 'bg-white border-orange-500 shadow-lg ring-1 ring-orange-500/20'
                    : isDark
                      ? 'bg-[#0E1524] border-slate-800 hover:border-slate-700'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                  }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono font-bold text-xs text-orange-600 dark:text-orange-400">
                    {ticket.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${ticket.statusColor === 'emerald'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : ticket.statusColor === 'sky'
                        ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}>
                    {ticket.status}
                  </span>
                </div>

                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl p-2 rounded-xl bg-orange-500/10 border border-orange-500/20 flex-shrink-0">
                    {ticket.icon}
                  </span>
                  <div>
                    <h3 className={`font-display font-bold text-sm leading-tight line-clamp-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {ticket.category}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{ticket.location}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-slate-400">
                    <span>Officer Assigned:</span>
                    <span className={`font-medium truncate max-w-[130px] ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {ticket.officer}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SLA Clock:</span>
                    <span className="font-bold text-orange-500">{ticket.slaRemaining}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 pt-2">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                    <span>Field Resolution</span>
                    <span>{ticket.progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-500 to-emerald-500 rounded-full"
                      style={{ width: `${ticket.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/transparency"
              className="inline-flex items-center gap-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
            >
              <span>Explore All Verified Municipal Wards in Public Scorecard</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 7: INTERACTIVE BEFORE/AFTER AUDIT PROOF SLIDER ── */}
      <section id="audit-proof" className={`py-20 border-b transition-colors relative z-10 ${isDark ? 'bg-[#060A14]' : 'bg-slate-50'
        } border-slate-200 dark:border-slate-800`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="px-3.5 py-1 rounded-full text-xs font-bold font-mono uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Photographic Proof of Governance
            </span>
            <h2 className={`font-display text-3xl sm:text-4xl lg:text-5xl font-black mt-2 ${isDark ? 'text-white' : 'text-slate-900'
              }`}>
              Audit Case Study: 120 Feet Road
            </h2>
            <p className={`text-sm mt-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Full photographic audit, materials stamp, and citizen closure verification. Compare genuine before-and-after photographic evidence.
            </p>
          </div>

          {/* Interactive Split Photo Box */}
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-2xl ${isDark ? 'bg-[#0E1524] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Photo Comparison with Interactive Slider */}
              <div className="lg:col-span-7">
                <div className="relative h-80 sm:h-96 rounded-2xl overflow-hidden border border-slate-700 select-none">
                  {/* After Image (Background) */}
                  <img
                    src="/pothole_after.jpg"
                    alt="Pothole After Repair"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-mono font-bold shadow-md z-10">
                    AFTER: Resolved 01:20 PM
                  </div>

                  {/* Before Image (Clipped with Slider Pos) */}
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-white shadow-2xl"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <img
                      src="/pothole_before.jpg"
                      alt="Pothole Before Repair"
                      className="absolute inset-0 w-full h-full object-cover max-w-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-red-600 text-white text-xs font-mono font-bold shadow-md">
                      BEFORE: Reported 09:14 AM
                    </div>
                  </div>

                  {/* Custom Slider Handle */}
                  <div
                    className="absolute inset-y-0 -ml-3 w-6 flex items-center justify-center pointer-events-none z-20"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="w-7 h-7 rounded-full bg-white text-slate-900 shadow-xl border-2 border-orange-500 flex items-center justify-center text-xs font-bold">
                      ↔
                    </div>
                  </div>

                  {/* Input range for dragging */}
                  <input
                    type="range"
                    min="5"
                    max="95"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-ew-resize z-30 w-full h-full"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mt-2 font-mono">
                  <span>← Drag slider to inspect repair quality →</span>
                  <span className="text-emerald-500 font-bold">4.2MT Hot Emulsion Compacted</span>
                </div>
              </div>

              {/* Case Inspection Summary */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-xs font-mono font-bold text-orange-500">CASE #NAT-7821</span>
                    <h3 className="font-display font-bold text-lg">Main 120 Feet Road Cavity</h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-mono font-bold">
                    Fixed in 28h (SLA 48h)
                  </span>
                </div>

                <div className={`p-4 rounded-xl border text-xs leading-relaxed ${isDark ? 'bg-slate-950/70 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                  <p className="font-bold text-orange-500 mb-1 font-mono uppercase text-[10px]">
                    Field Inspection Log • Junior Engineer:
                  </p>
                  "18cm cavity across bituminous surface repaired using 4.2MT hot bituminous emulsion binder with mechanical roller vibration. Road drainage channel cleared to prevent recurring water accumulation."
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Citizen Sign-Off: ★★★★★</span>
                    <span className="text-[10px] font-mono text-slate-400">Verified via OTP</span>
                  </div>
                  <p className={`italic ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    "Normally this pothole stayed broken for four months until winter. Nivaran had workers filling it the next afternoon."
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 mt-1">— Citizen Harpreet Singh (Ward 14)</p>
                </div>

                <Link
                  to="/register"
                  className="block text-center w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-md shadow-orange-600/30 transition"
                >
                  Report a Road Pothole in Your Area →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 8: PUBLIC AGENCY PERFORMANCE MATRIX ─────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-orange-500">DEPARTMENTAL COMPLIANCE</span>
            <h2 className={`font-display text-3xl sm:text-4xl font-black mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Public Agency Performance Matrix
            </h2>
            <p className={`text-xs sm:text-sm mt-1 max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Live SLAs tracked by the statutory Right to Service Commission oversight dashboard.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Updated Hourly • Real-Time Redressal</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Municipal Corporation */}
          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold uppercase text-slate-400">MUNICIPAL CORPORATION</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                ● Exemplary
              </span>
            </div>
            <h3 className={`font-display font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Civil Works & Sanitation
            </h3>
            <p className="text-xs text-slate-400 mb-6">Roads, Parks, Streetlights, Solid Waste</p>

            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">AVG TRIAGE</span>
                <p className="font-display font-black text-2xl text-orange-500">31.2 hrs</p>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">RESOLUTION</span>
                <p className="font-display font-black text-2xl text-emerald-500">93.8%</p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">On-time SLA Compliance:</span>
              <span className="font-bold text-emerald-500">96.4%</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '96.4%' }} />
            </div>
          </div>

          {/* Card 2: Power Grid */}
          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold uppercase text-slate-400">POWER DISTRIBUTION GRID</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                ● Leader
              </span>
            </div>
            <h3 className={`font-display font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              State Power Distribution
            </h3>
            <p className="text-xs text-slate-400 mb-6">Transformers, Loose High-Tension Wires, Outages</p>

            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">AVG TRIAGE</span>
                <p className="font-display font-black text-2xl text-orange-500">14.6 hrs</p>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">RESOLUTION</span>
                <p className="font-display font-black text-2xl text-emerald-500">97.1%</p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">On-time SLA Compliance:</span>
              <span className="font-bold text-emerald-500">98.2%</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '98.2%' }} />
            </div>
          </div>

          {/* Card 3: Water & Sewerage Board */}
          <div className={`p-6 rounded-3xl border transition-all ${isDark ? 'bg-[#0B111E] border-slate-800' : 'bg-white border-slate-200 shadow-md'
            }`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold uppercase text-slate-400">WATER SUPPLY & SEWERAGE</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                ● Monitored
              </span>
            </div>
            <h3 className={`font-display font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Water & Sewerage Board
            </h3>
            <p className="text-xs text-slate-400 mb-6">Pipe Bursts, Stagnant Sewage, Drain Desilting</p>

            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">AVG TRIAGE</span>
                <p className="font-display font-black text-2xl text-orange-500">46.8 hrs</p>
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase">RESOLUTION</span>
                <p className="font-display font-black text-2xl text-amber-500">86.2%</p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">On-time SLA Compliance:</span>
              <span className="font-bold text-amber-500">89.0%</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '89.0%' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 9: STATUTORY ESCALATION GUARANTEE BANNER ──────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#0B1528] via-[#0E203E] to-[#0A101D] text-white border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-mono font-bold">
                <span>⚖️</span>
                <span>STATE STATUTORY MANDATE</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-tight leading-tight">
                Every reported issue is legally time-bound. <br />
                No discretion, no excuses.
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Under Section 7 of the Right to Service (RTS) Act, if an unaddressed issue is not redressed within the statutory window without audited justification, the Nivaran Mesh triggers an automatic escalation report directly to the Municipal Commissioner's office.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="px-6 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-lg shadow-orange-600/30 transition"
                >
                  File Grievance Now →
                </Link>
                <Link
                  to="/transparency"
                  className="px-5 py-3 rounded-xl font-bold text-xs border border-slate-700 hover:bg-slate-800 transition text-slate-200"
                >
                  View RTS Escalation Rules
                </Link>
              </div>
            </div>

            {/* Escalation Matrix Steps */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 text-xs">
                <span className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
                  01
                </span>
                <div>
                  <p className="font-bold">Hour 0 – 24: Ward Junior Engineer</p>
                  <p className="text-[10px] text-slate-400">Direct dispatch of field repair team</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 text-xs">
                <span className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
                  02
                </span>
                <div>
                  <p className="font-bold">Hour 48: Sub-Divisional Officer</p>
                  <p className="text-[10px] text-slate-400">Second alert with contractor penalty trigger</p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-3 text-xs">
                <span className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-mono font-bold flex items-center justify-center text-xs flex-shrink-0">
                  03
                </span>
                <div>
                  <p className="font-bold">Hour 72: Municipal Commissioner</p>
                  <p className="text-[10px] text-slate-400">Formal show-cause inquiry as per statutory act</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 10: NATIONAL CIVIC FOOTER ───────────────────────── */}
      <footer className={`border-t py-14 transition-colors relative z-10 ${isDark ? 'bg-[#06090F] border-slate-900 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center text-white text-base shadow-sm">
                  🏛️
                </div>
                <span className={`font-display font-black text-xl ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Nivaran
                </span>
                <span className="text-xs text-slate-400 font-mono">/ Digital Bharat</span>
              </div>
              <p className="text-xs leading-relaxed">
                An independent civic platform connecting citizens and municipal administrations across India for transparent, SLA-enforced governance.
              </p>
              <div className="space-y-1 text-[11px] font-mono">
                <p className="text-emerald-500 font-bold">● 80 Wards in Active Telemetry Sync</p>
                <p className="text-slate-400">● Right to Service (RTS) Act Compliant</p>
              </div>
            </div>

            <div>
              <p className={`font-bold text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Citizen Services
              </p>
              <ul className="space-y-2 text-xs">
                <li><Link to="/register" className="hover:text-orange-500 transition">Track Ward Status</Link></li>
                <li><Link to="/register" className="hover:text-orange-500 transition">Roads & Potholes</Link></li>
                <li><Link to="/register" className="hover:text-orange-500 transition">Sanitation & Solid Waste</Link></li>
                <li><Link to="/register" className="hover:text-orange-500 transition">Water & Sewage Redressal</Link></li>
                <li><Link to="/transparency" className="hover:text-orange-500 transition">Public Budget Ledger</Link></li>
              </ul>
            </div>

            <div>
              <p className={`font-bold text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                Administration
              </p>
              <ul className="space-y-2 text-xs">
                <li><Link to="/login" className="hover:text-orange-500 transition">Zone Commissioner Portal</Link></li>
                <li><Link to="/login" className="hover:text-orange-500 transition">Ward Councillor Roster</Link></li>
                <li><Link to="/transparency" className="hover:text-orange-500 transition">SLA Escalation Matrix</Link></li>
                <li><Link to="/transparency" className="hover:text-orange-500 transition">Open Data API & SDK</Link></li>
                <li><Link to="/login" className="hover:text-orange-500 transition">Field Worker Dispatch</Link></li>
              </ul>
            </div>

            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
              }`}>
              <p className="text-[10px] font-mono uppercase font-bold text-orange-600 mb-1">
                Emergency Helplines
              </p>
              <p className="text-[10px] uppercase font-bold text-slate-400">
                Municipal Control Room
              </p>
              <p className={`text-xl font-black font-display mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                1800-180-2626
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Toll Free • 24x7 National Redressal Desk</p>
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 space-y-0.5 font-mono">
                <p>Police Emergency: 100 / 112</p>
                <p>Fire: 101 • Ambulance: 108</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
            <span>© {new Date().getFullYear()} Nivaran Civic OS • Engineered under National Smart City Open Standards.</span>
            <div className="flex items-center gap-4 text-slate-500">
              <Link to="/transparency" className="hover:text-orange-500 transition">Privacy Framework</Link>
              <span>•</span>
              <Link to="/transparency" className="hover:text-orange-500 transition">Terms of Service</Link>
              <span>•</span>
              <Link to="/transparency" className="hover:text-orange-500 transition">Public Audit Node</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
