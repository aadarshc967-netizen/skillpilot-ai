import { useEffect, useMemo, useState, type ReactNode } from 'react'
import './App.css'
import {
  learnerApi,
  type AgentActivity,
  type AgentRunResult,
  type AssessmentQuestion,
  type AssessmentAttempt,
  type AssessmentRunResult,
  type LearnerRecord,
  type SkillRecord,
} from './services/api'
import {
  careerOptions,
  getSkillGapsForCareer,
  initialRoadmap,
  learner,
  navigation,
  type RoadmapStep,
} from './data'

type IconName =
  | 'dashboard'
  | 'roadmap'
  | 'skills'
  | 'assessment'
  | 'mentor'
  | 'settings'
  | 'search'
  | 'bell'
  | 'chevron'
  | 'arrow'
  | 'clock'
  | 'check'
  | 'play'
  | 'spark'
  | 'book'
  | 'target'
  | 'menu'
  | 'close'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    roadmap: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="7" cy="5" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="19" r="2" fill="currentColor" /></>,
    skills: <><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></>,
    assessment: <><path d="M9 11l2 2 4-4" /><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /></>,
    mentor: <><path d="M12 3a7 7 0 0 0-4 12.75V19h8v-3.25A7 7 0 0 0 12 3Z" /><path d="M9 22h6M9 17h6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8.2 8.2 0 0 1-1.8 1.1l-.3 1.8h-2.8l-.3-1.8a8.2 8.2 0 0 1-1.8-1.1l-1.7.7-1.4-2.4 1.4-1.1a7.7 7.7 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8.2 8.2 0 0 1 1.8-1.1l.3-1.8h2.8l.3 1.8a8.2 8.2 0 0 1 1.8 1.1l1.7-.7 1.4 2.4-1.4 1.1a7.7 7.7 0 0 1 0 2Z" transform="translate(-1 -1) scale(.96)" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 6 10 6-10 6V6Z" fill="currentColor" stroke="none" />,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1 1-2.5Z" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 16h16M8 7h8M8 11h6" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function Sidebar({
  profile,
  roadmapCount,
  activePage,
  onNavigate,
  open,
  onClose,
}: {
  profile: LearnerRecord
  roadmapCount: number
  activePage: string
  onNavigate: (page: string) => void
  open: boolean
  onClose: () => void
}) {
  const initials = profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); onNavigate('Overview') }}>
          <span className="brand-mark"><span /></span>
          <span>skillpilot<span className="brand-ai">.ai</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map((item) => (
            <button key={item.label} className={`nav-item ${activePage === item.label ? 'nav-active' : ''}`} onClick={() => { onNavigate(item.label); onClose() }}>
              <Icon name={item.icon as IconName} size={17} />
              <span>{item.label}</span>
              {item.label === 'My roadmap' && <span className="nav-count">{roadmapCount}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="weekly-card">
            <div className="weekly-icon"><Icon name="spark" size={16} /></div>
            <strong>Your learning portfolio</strong>
            <span>{profile.projects.length} projects and {profile.certifications.length} certifications recorded.</span>
            <span className="streak-label">Keep adding milestones as you learn.</span>
          </div>
          <button className={`nav-item settings-link ${activePage === 'Settings' ? 'nav-active' : ''}`} onClick={() => onNavigate('Settings')}>
            <Icon name="settings" size={17} /><span>Settings</span>
          </button>
          <div className="sidebar-profile">
            <div className="avatar avatar-small">{initials}</div>
            <div className="profile-copy"><strong>{profile.name}</strong><span>Free plan</span></div>
            <Icon name="chevron" size={15} />
          </div>
        </div>
      </aside>
    </>
  )
}

function ProgressRing({ value }: { value: number }) {
  const radius = 37
  const circumference = 2 * Math.PI * radius
  return (
    <div className="progress-ring">
      <svg viewBox="0 0 88 88" aria-label={`${value}% roadmap complete`}>
        <circle className="ring-track" cx="44" cy="44" r={radius} />
        <circle className="ring-value" cx="44" cy="44" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <div className="ring-copy"><strong>{value}%</strong><span>complete</span></div>
    </div>
  )
}

function SkillCard({ title, children, badge }: { title: string; children: ReactNode; badge?: string }) {
  return (
    <section className="card skill-card">
      <div className="section-heading">
        <div><h2>{title}</h2><p>{title === 'Your skills' ? 'A snapshot of what you already know.' : 'The skills to focus on for your next role.'}</p></div>
        {badge && <span className="small-badge">{badge}</span>}
      </div>
      <div className="skill-list">{children}</div>
    </section>
  )
}

function AgentActivityPanel({
  activities,
  loading,
  error,
  result,
  onAnalyze,
  modeReason,
  disabled = false,
}: {
  activities: AgentActivity[]
  loading: boolean
  error: string | null
  result: AgentRunResult | null
  onAnalyze: () => void
  modeReason?: string | null
  disabled?: boolean
}) {
  return (
    <section className="card agent-activity-card" aria-live="polite">
      <div className="section-heading agent-activity-heading">
        <div><h2>Agent activity</h2><p>Collaborating specialists, working in sequence.</p></div>
        <button className="agent-run-button" onClick={onAnalyze} disabled={loading || disabled}>
          {loading ? <><span className="loading-spinner" /> Agents working</> : <><Icon name="spark" size={14} /> Run skill analysis</>}
        </button>
      </div>
      {result && <div className={`mode-label mode-${result.mode}`}>{result.mode === 'demo' ? 'DEMO MODE · deterministic example' : 'LIVE GEMINI · AI generated'}</div>}
      {result?.mode === 'demo' && modeReason && <p className="fallback-note">{modeReason}</p>}
      {error && <div className="agent-error" role="alert">{error}</div>}
      {!activities.length && !loading && <p className="agent-empty">Run an analysis to see each agent's real task and output.</p>}
      <div className="agent-activity-list">
        {activities.map((activity, index) => (
          <article className="agent-activity-item" key={`${activity.agent}-${index}`}>
            <div className={`activity-status ${activity.status === 'running' ? 'activity-running' : activity.status === 'failed' ? 'activity-failed' : 'activity-done'}`}>
              {activity.status === 'running' ? <span className="loading-spinner" /> : <Icon name={activity.status === 'failed' ? 'close' : 'check'} size={13} />}
            </div>
            <div className="activity-content">
              <div className="activity-title-row"><strong>{activity.agent}</strong><span>{activity.status === 'running' ? 'RUNNING' : activity.status === 'failed' ? 'FAILED' : 'COMPLETED'}</span></div>
              <p>{activity.task}</p>
              {activity.output && <details className="activity-output"><summary>View actual agent output</summary><pre>{JSON.stringify(activity.output, null, 2)}</pre></details>}
            </div>
          </article>
        ))}
      </div>
      {result && <div className="analysis-result">
        <div className="match-score-bubble">{result.career_match.score}<small>%</small></div>
        <div><strong>{result.career} match</strong><p>{result.career_match.explanation}</p><span>Recommended roadmap: {result.learning_path.steps.length} ordered steps</span></div>
      </div>}
      {result && <div className="analysis-missing">
        <strong>Requirements to develop</strong>
        <div>{result.career_match.missing_requirements.map((requirement) => <span key={requirement}>{requirement}</span>)}</div>
      </div>}
      {result && <div className="analysis-roadmap">
        <strong>Personalized learning roadmap</strong>
        <ol>{result.learning_path.steps.map((step) => (
          <li key={`${step.position}-${step.title}`}>
            <div><span>{step.title}</span><small>{step.duration} · {step.lessons} lessons</small></div>
            {step.exercises[0] && <p>Try: {step.exercises[0]}</p>}
            {step.resources[0] && <a href={step.resources[0]} target="_blank" rel="noreferrer">Learning resource <Icon name="arrow" size={11} /></a>}
          </li>
        ))}</ol>
      </div>}
    </section>
  )
}

function App() {
  const [activePage, setActivePage] = useState('Overview')
  const [today] = useState(() => new Intl.DateTimeFormat(
    undefined,
    { weekday: 'long', month: 'short', day: 'numeric' },
  ).format(new Date()))
  const [career, setCareer] = useState(learner.targetCareer)
  const [profile, setProfile] = useState<LearnerRecord>({
    id: 1,
    name: learner.name,
    email: learner.email,
    target_career: learner.targetCareer,
    certifications: [],
    projects: [],
  })
  const [skills, setSkills] = useState<SkillRecord[]>([])
  const [roadmap, setRoadmap] = useState(initialRoadmap)
  const [expandedStep, setExpandedStep] = useState<number | null>(1)
  const [search, setSearch] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [agentActivities, setAgentActivities] = useState<AgentActivity[]>([])
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentError, setAgentError] = useState<string | null>(null)
  const [agentResult, setAgentResult] = useState<AgentRunResult | null>(null)
  const [assessmentResult, setAssessmentResult] = useState<AssessmentRunResult | null>(null)
  const [assessmentHistory, setAssessmentHistory] = useState<AssessmentAttempt[]>([])
  const [careerSaving, setCareerSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      learnerApi.getProfile(),
      learnerApi.getRoadmap(),
      learnerApi.getSkills(),
      learnerApi.getAssessmentHistory(),
    ])
      .then(([savedProfile, savedRoadmap, savedSkills, savedAssessments]) => {
        if (!active) return
        setProfile(savedProfile)
        setCareer(savedProfile.target_career)
        setRoadmap(savedRoadmap)
        setSkills(savedSkills)
        setAssessmentHistory(savedAssessments)
        setExpandedStep(savedRoadmap.find((step) => step.status === 'in-progress')?.id ?? null)
      })
      .catch((error: unknown) => {
        if (active) setAgentError(error instanceof Error ? error.message : 'Learner profile could not be loaded.')
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })
    return () => { active = false }
  }, [])

  const completedSteps = roadmap.filter((step) => step.status === 'complete').length
  const roadmapProgress = roadmap.length ? Math.round((completedSteps / roadmap.length) * 100) : 0
  const firstName = profile.name.split(/\s+/)[0] || learner.firstName
  const currentSkills = skills.filter((skill) => skill.progress > 0)
  const analysisGaps = agentResult?.skill_analysis.skill_gaps.map((finding) => ({
    name: finding.name,
    mark: finding.name.slice(0, 2).toUpperCase(),
    category: finding.category,
    priority: finding.priority,
  }))
  const gapsForCareer = agentResult
    ? analysisGaps ?? []
    : getSkillGapsForCareer(career)
  const filteredRoadmap = useMemo(
    () => roadmap.filter((step) => step.title.toLowerCase().includes(search.toLowerCase())),
    [roadmap, search],
  )

  async function toggleStep(stepId: number) {
    const previous = roadmap.find((step) => step.id === stepId)
    if (!previous) return
    const status = previous.status === 'complete' ? 'in-progress' : 'complete'
    setRoadmap((steps) => steps.map((step) => {
      if (step.id !== stepId) return step
      return { ...step, status } as RoadmapStep
    }))
    try {
      await learnerApi.updateRoadmapStatus(stepId, status)
    } catch (error) {
      setRoadmap((steps) => steps.map((step) => step.id === stepId ? previous : step))
      setAgentError(error instanceof Error ? error.message : 'Roadmap progress could not be saved.')
    }
  }

  function recordActivity(activity: AgentActivity) {
    setAgentActivities((current) => {
      const currentIndex = current.findIndex((entry) => entry.agent === activity.agent)
      if (currentIndex === -1) return [...current, activity]
      return current.map((entry, index) => index === currentIndex ? activity : entry)
    })
  }

  async function runAnalysis(targetCareer = career) {
    setAgentLoading(true)
    setAgentError(null)
    setAgentResult(null)
    setAssessmentResult(null)
    setAgentActivities([])
    try {
      const result = await learnerApi.analyze(targetCareer, recordActivity)
      setAgentResult(result)
      setRoadmap(result.learning_path.steps)
      setSkills(await learnerApi.getSkills())
      setExpandedStep(result.learning_path.steps.find((step) => step.status === 'in-progress')?.id ?? null)
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Agent analysis failed.')
    } finally {
      setAgentLoading(false)
    }
  }

  async function changeCareer(targetCareer: string) {
    if (targetCareer === career || careerSaving || profileLoading) return
    setCareer(targetCareer)
    setCareerSaving(true)
    setAgentError(null)
    setAgentResult(null)
    try {
      const savedProfile = await learnerApi.updateCareer(targetCareer)
      setProfile(savedProfile)
      await runAnalysis(targetCareer)
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Career goal could not be updated.')
    } finally {
      setCareerSaving(false)
    }
  }

  async function submitAssessment(answers: Array<{ question_id: string; answer: string }>) {
    setAgentLoading(true)
    setAgentError(null)
    setAgentResult(null)
    setAssessmentResult(null)
    setAgentActivities([])
    try {
      const result = await learnerApi.submitAssessment(answers, career, recordActivity)
      setAssessmentResult(result)
      setRoadmap(result.updated_roadmap.steps)
      setSkills(await learnerApi.getSkills())
      setAssessmentHistory(await learnerApi.getAssessmentHistory())
      setExpandedStep(result.updated_roadmap.steps.find((step) => step.status === 'in-progress')?.id ?? null)
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Assessment could not be submitted.')
    } finally {
      setAgentLoading(false)
    }
  }

  async function saveProfile(updated: Pick<LearnerRecord, 'name' | 'email' | 'certifications' | 'projects'>) {
    setProfileSaving(true)
    setAgentError(null)
    try {
      setProfile(await learnerApi.updateProfile(updated))
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Learner profile could not be saved.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function saveSkillProgress(skillId: number, progress: number) {
    try {
      const updated = await learnerApi.updateSkillProgress(skillId, progress)
      setSkills((current) => current.map((skill) => skill.id === skillId ? updated : skill))
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : 'Skill progress could not be saved.')
    }
  }

  const isOverview = activePage === 'Overview'
  const pageTitle = isOverview ? 'Your learning dashboard' : activePage
  const pageDescription = isOverview
    ? 'A little progress each day adds up to big results.'
    : `Your ${activePage.toLowerCase()} at a glance. Pick up where you left off.`

  return (
    <div className="app-shell">
      <Sidebar profile={profile} roadmapCount={roadmap.length} activePage={activePage} onNavigate={setActivePage} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-button" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
            <div className="breadcrumbs"><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{activePage}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input aria-label="Search roadmap" placeholder="Search anything..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <kbd>⌘ K</kbd>
            </label>
            <button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={18} /><i /></button>
            <div className="avatar avatar-top">JM</div>
          </div>
        </header>

        <div className="dashboard">
          <div className="welcome-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-dot" /> YOUR PERSONAL LEARNING SPACE</div>
              <h1>{isOverview ? <>Good morning, {firstName} <span className="wave">✦</span></> : pageTitle}</h1>
              <p className="page-subtitle">{isOverview ? 'Ready to take the next step toward your dream role?' : pageDescription}</p>
            </div>
            {profileLoading && <div className="inline-loading profile-loading"><span className="loading-spinner" /> Loading your saved learner profile…</div>}
            <div className="date-chip"><span className="date-dot" /> {today}</div>
          </div>

          {isOverview ? <>
          <section className="hero-card">
            <div className="hero-copy">
              <span className="hero-kicker"><Icon name="target" size={14} /> YOUR NORTH STAR</span>
              <h2>Become a <span>{career}</span></h2>
              <p>You're building the skills to turn great ideas into real-world products. Keep your momentum going.</p>
              <label className="career-select-wrap">
                <span>My target career</span>
                <select value={career} disabled={profileLoading || careerSaving || agentLoading} onChange={(event) => void changeCareer(event.target.value)} aria-label="Select target career">
                  {careerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <Icon name="chevron" size={15} />
              </label>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="orbit-core"><span className="core-spark">✦</span></div>
              <div className="orbit-node node-python"><span>Py</span></div>
              <div className="orbit-node node-react"><span>⚛</span></div>
              <div className="orbit-node node-code"><span>{'{ }'}</span></div>
              <div className="hero-visual-caption"><span className="caption-line" /> your next chapter</div>
            </div>
            <div className="hero-progress">
              <ProgressRing value={roadmapProgress} />
              <div><strong>Roadmap progress</strong><span>{completedSteps} of {roadmap.length} milestones complete.</span></div>
            </div>
          </section>

          <section className="stats-row" aria-label="Learning statistics">
            <article className="stat-card">
              <div className="stat-icon stat-violet"><Icon name="skills" size={18} /></div>
              <div className="stat-copy"><span>Skills tracked</span><strong>{currentSkills.length} <small>/ {skills.length}</small></strong></div>
              <span className="stat-trend">{currentSkills.length} skills with progress</span>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-peach"><Icon name="assessment" size={18} /></div>
              <div className="stat-copy"><span>Assessment average</span><strong>{assessmentHistory.length ? Math.round(assessmentHistory.reduce((total, attempt) => total + attempt.score, 0) / assessmentHistory.length) : '—'} <small>{assessmentHistory.length ? '%' : ''}</small></strong></div>
              <span className="stat-trend">{assessmentHistory.length} saved attempts</span>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-green"><Icon name="roadmap" size={18} /></div>
              <div className="stat-copy"><span>Roadmap progress</span><strong>{roadmapProgress}<small>%</small></strong></div>
              <span className="stat-trend">{completedSteps} of {roadmap.length} milestones</span>
            </article>
            <article className="stat-card stat-streak">
              <div className="stat-icon stat-yellow"><span>✦</span></div>
              <div className="stat-copy"><span>Portfolio</span><strong>{profile.projects.length} <small>projects</small></strong></div>
              <span className="stat-trend">{profile.certifications.length} certifications recorded</span>
            </article>
          </section>

          <div className="content-grid">
            <div className="left-column">
              <SkillCard title="Your skills" badge={`${currentSkills.length} skills`}>
                {currentSkills.map((skill) => (
                  <div className="skill-row" key={skill.name}>
                    <div className="skill-logo">{skill.name.slice(0, 2).toUpperCase()}</div>
                    <div className="skill-main"><strong>{skill.name}</strong><span>{skill.level}</span></div>
                    <div className="skill-meter"><i style={{ width: `${skill.progress}%` }} /></div>
                    <span className="skill-level">{skill.progress}%</span>
                  </div>
                ))}
                <button className="text-button" onClick={() => setActivePage('My skills')}>View all skills <Icon name="arrow" size={15} /></button>
              </SkillCard>

              <SkillCard title="Skills to unlock" badge={`${gapsForCareer.length} to go`}>
                <div className="gaps-grid">
                  {gapsForCareer.map((skill, index) => (
                    <div className="gap-row" key={skill.name}>
                      <span className={`gap-number ${index === 0 ? 'gap-number-hot' : ''}`}>0{index + 1}</span>
                      <div className="skill-logo gap-logo">{skill.mark}</div>
                      <div className="gap-copy"><strong>{skill.name}</strong><span>{skill.category}</span></div>
                      <span className={`gap-tag ${skill.priority.toLowerCase()}`}>{skill.priority}</span>
                    </div>
                  ))}
                </div>
                <div className="gap-footnote"><span className="info-dot">i</span> These skills are most in-demand for your target role.</div>
              </SkillCard>
            </div>

            <div className="right-column">
              <section className="card roadmap-card">
                <div className="section-heading roadmap-heading">
                  <div><h2>Your learning roadmap</h2><p>Small steps, big career moves.</p></div>
                  <button className="icon-button more-button" aria-label="Roadmap options">•••</button>
                </div>
                <div className="roadmap-summary"><div className="roadmap-progress"><i style={{ width: `${roadmapProgress}%` }} /></div><span>{completedSteps} of {roadmap.length} completed</span></div>
                <div className="roadmap-list">
                  {filteredRoadmap.length > 0 ? filteredRoadmap.map((step, index) => (
                    <RoadmapItem
                      key={step.id}
                      step={step}
                      isExpanded={expandedStep === step.id}
                      isLast={index === filteredRoadmap.length - 1}
                      onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      onComplete={() => toggleStep(step.id)}
                    />
                  )) : <p className="empty-search">No roadmap steps match “{search}”.</p>}
                </div>
                <button className="roadmap-footer" onClick={() => setActivePage('My roadmap')}>View full roadmap <Icon name="arrow" size={15} /></button>
              </section>
            </div>
          </div>

          <section className="mentor-card">
            <div className="mentor-orb"><Icon name="spark" size={21} /></div>
            <div className="mentor-copy"><span className="mentor-label">A NOTE FROM YOUR AI MENTOR</span><p>You're doing great, {firstName}. <strong>{roadmap.find((step) => step.status !== 'complete')?.title ?? 'Your next learning milestone'}</strong> is a good next step. A little practice every day will get you there.</p></div>
            <div className="mentor-action"><span>Personalized for your journey</span><button onClick={() => setActivePage('AI Mentor')}>Meet your mentor <Icon name="arrow" size={15} /></button></div>
          </section>

          <AgentActivityPanel activities={agentActivities} loading={agentLoading || careerSaving} disabled={profileLoading} error={agentError} result={agentResult} onAnalyze={() => void runAnalysis()} modeReason={agentResult?.mode_reason} />

          <footer className="page-footer"><span>Made for your next big thing.</span><span>Need a hand? <button onClick={() => setActivePage('AI Mentor')}>We're here to help</button></span></footer>
          </> : <PageView
            activePage={activePage}
            career={career}
            profile={profile}
            skills={skills}
            gaps={gapsForCareer}
            roadmap={filteredRoadmap}
            onToggleStep={toggleStep}
            activities={agentActivities}
            agentLoading={agentLoading}
            agentError={agentError}
            agentResult={agentResult}
            assessmentResult={assessmentResult}
            assessmentHistory={assessmentHistory}
            onAnalyze={() => void runAnalysis()}
            onSubmitAssessment={submitAssessment}
            onCareerChange={changeCareer}
            onProfileSave={saveProfile}
            profileSaving={profileSaving}
            onSkillProgress={saveSkillProgress}
            careerSaving={careerSaving}
            profileLoading={profileLoading}
          />}
        </div>
      </main>
    </div>
  )
}

function ProfileEditor({
  profile,
  saving,
  onSave,
}: {
  profile: LearnerRecord
  saving: boolean
  onSave: (profile: Pick<LearnerRecord, 'name' | 'email' | 'certifications' | 'projects'>) => void
}) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [certifications, setCertifications] = useState(profile.certifications.join('\n'))
  const [projects, setProjects] = useState(profile.projects.join('\n'))

  function lines(value: string) {
    return value.split('\n').map((item) => item.trim()).filter(Boolean)
  }

  return (
    <form className="profile-editor" onSubmit={(event) => {
      event.preventDefault()
      onSave({ name: name.trim(), email: email.trim(), certifications: lines(certifications), projects: lines(projects) })
    }}>
      <label><span>Name</span><input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label><span>Email</span><input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label><span>Certifications <small>one per line</small></span><textarea rows={3} value={certifications} onChange={(event) => setCertifications(event.target.value)} /></label>
      <label><span>Projects <small>one per line</small></span><textarea rows={3} value={projects} onChange={(event) => setProjects(event.target.value)} /></label>
      <button className="primary-action" type="submit" disabled={saving}>{saving ? <><span className="loading-spinner" /> Saving profile…</> : 'Save learner profile'}</button>
    </form>
  )
}

function SkillProgressEditor({
  skill,
  onSave,
}: {
  skill: SkillRecord
  onSave: (skillId: number, progress: number) => void
}) {
  const [progress, setProgress] = useState(skill.progress)

  return (
    <div className="skill-progress-editor">
      <div className="skill-row">
        <div className="skill-logo">{skill.name.slice(0, 2).toUpperCase()}</div>
        <div className="skill-main"><strong>{skill.name}</strong><span>{skill.level}</span></div>
        <div className="skill-meter"><i style={{ width: `${progress}%` }} /></div>
        <span className="skill-level">{progress}%</span>
      </div>
      <label>
        <span>Update {skill.name} proficiency</span>
        <input type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
      </label>
      <button type="button" className="text-button" disabled={progress === skill.progress} onClick={() => onSave(skill.id, progress)}>Save skill progress</button>
    </div>
  )
}

function PageView({
  activePage,
  career,
  profile,
  skills,
  gaps,
  roadmap,
  onToggleStep,
  activities,
  agentLoading,
  agentError,
  agentResult,
  assessmentResult,
  assessmentHistory,
  onAnalyze,
  onSubmitAssessment,
  onCareerChange,
  onProfileSave,
  onSkillProgress,
  careerSaving,
  profileSaving,
  profileLoading,
}: {
  activePage: string
  career: string
  profile: LearnerRecord
  skills: SkillRecord[]
  gaps: Array<{ name: string; mark: string; category: string; priority: string }>
  roadmap: RoadmapStep[]
  onToggleStep: (stepId: number) => void
  activities: AgentActivity[]
  agentLoading: boolean
  agentError: string | null
  agentResult: AgentRunResult | null
  assessmentResult: AssessmentRunResult | null
  assessmentHistory: AssessmentAttempt[]
  onAnalyze: () => void
  onSubmitAssessment: (answers: Array<{ question_id: string; answer: string }>) => void
  onCareerChange: (career: string) => void
  onProfileSave: (profile: Pick<LearnerRecord, 'name' | 'email' | 'certifications' | 'projects'>) => void
  onSkillProgress: (skillId: number, progress: number) => void
  careerSaving: boolean
  profileSaving: boolean
  profileLoading: boolean
}) {
  const [expandedStep, setExpandedStep] = useState<number | null>(
    roadmap.find((step) => step.status === 'in-progress')?.id ?? null,
  )
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([])
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [mentorQuestion, setMentorQuestion] = useState('')
  const [mentorReply, setMentorReply] = useState<{ mode: 'demo' | 'live'; text: string } | null>(null)
  const [mentorLoading, setMentorLoading] = useState(false)
  const [mentorError, setMentorError] = useState<string | null>(null)

  useEffect(() => {
    if (activePage !== 'Assessments') return
    let active = true
    learnerApi.getAssessmentQuestions()
      .then((items) => {
        if (active) {
          setQuestions(items)
          setQuestionError(null)
        }
      })
      .catch((error: unknown) => {
        if (active) setQuestionError(error instanceof Error ? error.message : 'Assessment questions could not be loaded.')
      })
    return () => { active = false }
  }, [activePage])

  async function askMentor() {
    const question = mentorQuestion.trim()
    if (!question || mentorLoading) return
    setMentorLoading(true)
    setMentorError(null)
    setMentorReply(null)
    try {
      const response = await learnerApi.askMentor(question, career)
      setMentorReply({ mode: response.mode, text: response.reply })
      setMentorQuestion('')
    } catch (error) {
      setMentorError(error instanceof Error ? error.message : 'The AI Mentor could not respond.')
    } finally {
      setMentorLoading(false)
    }
  }

  if (activePage === 'My skills') {
    return (
      <div className="page-view">
        {agentError && <div className="agent-error" role="alert">{agentError}</div>}
        <SkillCard title="Your skills" badge={`${skills.length} tracked`}>
          {skills.map((skill) => (
            <SkillProgressEditor key={`${skill.id}-${skill.progress}`} skill={skill} onSave={onSkillProgress} />
          ))}
        </SkillCard>
        <SkillCard title="Skills to unlock" badge={`${gaps.length} to go`}>
          <div className="gaps-grid">
            {gaps.map((skill, index) => (
              <div className="gap-row" key={skill.name}>
                <span className={`gap-number ${index === 0 ? 'gap-number-hot' : ''}`}>0{index + 1}</span>
                <div className="skill-logo gap-logo">{skill.mark}</div>
                <div className="gap-copy"><strong>{skill.name}</strong><span>{skill.category}</span></div>
                <span className={`gap-tag ${skill.priority.toLowerCase()}`}>{skill.priority}</span>
              </div>
            ))}
          </div>
          <div className="gap-footnote"><span className="info-dot">i</span> Sample skill-gap analysis for {career}.</div>
        </SkillCard>
      </div>
    )
  }

  if (activePage === 'My roadmap') {
    return (
      <div className="page-view">
        {agentError && <div className="agent-error" role="alert">{agentError}</div>}
        <section className="card dedicated-roadmap">
          <div className="section-heading"><div><h2>Your learning roadmap</h2><p>{roadmap.length} milestones designed around your next career step.</p></div><span className="small-badge">{roadmap.filter((step) => step.status === 'complete').length} complete</span></div>
          <div className="roadmap-list dedicated-roadmap-list">
            {roadmap.map((step, index) => (
              <RoadmapItem
                key={step.id}
                step={step}
                isExpanded={expandedStep === step.id}
                onToggle={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                isLast={index === roadmap.length - 1}
                onComplete={() => onToggleStep(step.id)}
              />
            ))}
            {roadmap.length === 0 && <p className="empty-search">No roadmap steps match your search.</p>}
          </div>
        </section>
      </div>
    )
  }

  if (activePage === 'Assessments') {
    return (
      <div className="page-view">
        <section className="card assessment-panel">
          <div className="section-heading"><div><h2>JavaScript foundations check-in</h2><p>Answer a few questions to tune your learning roadmap.</p></div><span className="small-badge">3 questions</span></div>
          {activePage === 'Assessments' && !questions.length && !questionError && <div className="inline-loading"><span className="loading-spinner" /> Loading assessment…</div>}
          {questionError && <div className="agent-error" role="alert">{questionError}</div>}
          {!questions.length && questionError && <p className="agent-empty">Assessment questions could not be loaded.</p>}
          <div className="quiz-list">
            {questions.map((question, index) => (
              <fieldset className="quiz-question" key={question.id}>
                <legend><span>{String(index + 1).padStart(2, '0')}</span>{question.question}</legend>
                <div className="quiz-options">
                  {question.options.map((option) => (
                    <label className={`quiz-option ${selectedAnswers[question.id] === option ? 'quiz-option-selected' : ''}`} key={option}>
                      <input type="radio" name={question.id} value={option} checked={selectedAnswers[question.id] === option} onChange={() => setSelectedAnswers((current) => ({ ...current, [question.id]: option }))} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          {questions.length > 0 && <button
            className="primary-action"
            disabled={agentLoading || questions.some((question) => !selectedAnswers[question.id])}
            onClick={() => onSubmitAssessment(questions.map((question) => ({
              question_id: question.id,
              answer: selectedAnswers[question.id],
            })))}
          >
            {agentLoading ? <><span className="loading-spinner" /> Assessing and adapting roadmap…</> : 'Submit assessment'}
          </button>}
        </section>
        {(activities.length > 0 || agentLoading) && <AgentActivityPanel activities={activities} loading={agentLoading} disabled={profileLoading} error={agentError} result={agentResult} onAnalyze={onAnalyze} modeReason={agentResult?.mode_reason} />}
        {assessmentResult && <AssessmentFeedback result={assessmentResult} />}
        <section className="card assessment-history">
          <div className="section-heading"><div><h2>Assessment history</h2><p>Saved attempts stay available across sessions.</p></div><span className="small-badge">{assessmentHistory.length} attempts</span></div>
          {assessmentHistory.length
            ? <ul>{assessmentHistory.map((attempt) => (
              <li key={attempt.id}>
                <strong>{attempt.score}%</strong>
                <span>{attempt.correct_count}/{attempt.total_questions} correct · {attempt.target_career}</span>
                <time dateTime={attempt.created_at}>{new Date(`${attempt.created_at}Z`).toLocaleString()}</time>
                {attempt.weak_topics.length > 0 && <small>Review: {attempt.weak_topics.join(', ')}</small>}
              </li>
            ))}</ul>
            : <p className="agent-empty">No saved assessments yet.</p>}
        </section>
      </div>
    )
  }

  if (activePage === 'AI Mentor') {
    return (
      <div className="page-view">
        <section className="card feature-panel mentor-page">
          <div className="feature-icon mentor-feature"><Icon name="spark" size={22} /></div>
          <h2>Your learning companion</h2>
          <p>Ask a question about your {career} journey. Responses use your selected career and recorded skill profile.</p>
          {mentorReply && <div className="mentor-reply"><span className={`mode-label mode-${mentorReply.mode}`}>{mentorReply.mode === 'demo' ? 'DEMO MODE · deterministic example' : 'LIVE GEMINI · AI generated'}</span><p>{mentorReply.text}</p></div>}
          {mentorError && <div className="agent-error" role="alert">{mentorError}</div>}
          <form className="mentor-input" onSubmit={(event) => { event.preventDefault(); void askMentor() }}>
            <input value={mentorQuestion} onChange={(event) => setMentorQuestion(event.target.value)} maxLength={2000} placeholder="Ask your mentor about your next learning step…" aria-label="Message your AI Mentor" />
            <button type="submit" disabled={!mentorQuestion.trim() || mentorLoading} aria-label="Send message">{mentorLoading ? <span className="loading-spinner" /> : <Icon name="arrow" size={15} />}</button>
          </form>
          {mentorLoading && <div className="inline-loading"><span className="loading-spinner" /> Sending your question to the backend…</div>}
        </section>
        <AgentActivityPanel activities={activities} loading={agentLoading} disabled={profileLoading} error={agentError} result={agentResult} onAnalyze={onAnalyze} modeReason={agentResult?.mode_reason} />
      </div>
    )
  }

  return (
    <div className="page-view">
      <section className="card settings-panel">
        <div className="section-heading"><div><h2>Your learner profile</h2><p>Keep your learner details and portfolio up to date.</p></div></div>
        <div className="settings-person"><div className="avatar settings-avatar">{profile.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><strong>{profile.name}</strong><span>{profile.email}</span></div></div>
        <label className="settings-career"><span>Target career</span><select value={career} disabled={profileLoading || careerSaving} onChange={(event) => onCareerChange(event.target.value)}>{careerOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
        {profileLoading
          ? <div className="inline-loading"><span className="loading-spinner" /> Loading profile details…</div>
          : <ProfileEditor profile={profile} saving={profileSaving} onSave={onProfileSave} />}
        <p className="settings-note">Your current skill-gap analysis is based on the {career} role.</p>
      </section>
      <AgentActivityPanel activities={activities} loading={agentLoading || careerSaving} disabled={profileLoading} error={agentError} result={agentResult} onAnalyze={onAnalyze} modeReason={agentResult?.mode_reason} />
    </div>
  )
}

function AssessmentFeedback({ result }: { result: AssessmentRunResult }) {
  const oldTitles = new Set(result.previous_roadmap.map((step) => step.title))
  const addedSteps = result.updated_roadmap.steps.filter((step) => !oldTitles.has(step.title))
  return (
    <section className="card assessment-feedback">
      <div className="assessment-score-row">
        <div className="assessment-score">{result.assessment.score}<small>%</small></div>
        <div><span className={`mode-label mode-${result.mode}`}>{result.mode === 'demo' ? 'DEMO MODE · deterministic example' : 'LIVE GEMINI · AI generated'}</span><h2>Assessment results</h2><p>{result.assessment.summary}</p></div>
      </div>
      {result.mode === 'demo' && result.mode_reason && <p className="fallback-note">{result.mode_reason}</p>}
      {result.assessment.weak_topics.length > 0
        ? <p className="weak-topics"><strong>Topics to reinforce:</strong> {result.assessment.weak_topics.join(', ')}</p>
        : <p className="weak-topics"><strong>Strong work:</strong> No weak topics were identified.</p>}
      <div className="answer-review">
        {result.assessment.results.map((answer) => (
          <div className={`answer-review-row ${answer.is_correct ? 'answer-correct' : 'answer-incorrect'}`} key={answer.question_id}>
            <span>{answer.is_correct ? '✓' : '×'}</span><div><strong>{answer.topic}</strong><p>{answer.is_correct ? 'Correct' : `Your answer: ${answer.answer} · Review: ${answer.correct_answer}`}</p></div>
          </div>
        ))}
      </div>
      <div className="roadmap-diff">
        <div className="roadmap-diff-heading"><div><span className="diff-label">ROADMAP UPDATE</span><h3>{result.roadmap_changed ? 'Your learning path adapted' : 'Your learning path stays on track'}</h3></div><span className="diff-arrow">BEFORE <Icon name="arrow" size={14} /> AFTER</span></div>
        <p>{result.updated_roadmap.summary}</p>
        <div className="roadmap-diff-columns">
          <div><strong>Previous roadmap</strong><ol>{result.previous_roadmap.map((step) => <li key={`${step.id}-${step.title}`}>{step.title}</li>)}</ol></div>
          <div><strong>Updated roadmap</strong><ol>{result.updated_roadmap.steps.map((step, index) => <li className={addedSteps.some((added) => added.title === step.title) ? 'roadmap-step-added' : ''} key={`${index}-${step.title}`}>{step.title}{addedSteps.some((added) => added.title === step.title) && <span>NEW</span>}</li>)}</ol></div>
        </div>
      </div>
    </section>
  )
}

function RoadmapItem({
  step,
  isExpanded,
  isLast,
  onToggle,
  onComplete,
}: {
  step: RoadmapStep
  isExpanded: boolean
  isLast: boolean
  onToggle: () => void
  onComplete: () => void
}) {
  const isComplete = step.status === 'complete'
  const isActive = step.status === 'in-progress'
  return (
    <article className={`roadmap-item ${isComplete ? 'step-complete' : ''} ${isActive ? 'step-active' : ''}`}>
      <div className="timeline">
        <button className={`timeline-marker ${isComplete ? 'marker-complete' : ''} ${isActive ? 'marker-active' : ''}`} onClick={onComplete} aria-label={isComplete ? `Mark ${step.title} incomplete` : `Mark ${step.title} complete`}>
          {isComplete ? <Icon name="check" size={13} /> : isActive ? <Icon name="play" size={11} /> : <span>{step.id}</span>}
        </button>
        {!isLast && <span className={`timeline-line ${isComplete ? 'line-complete' : ''}`} />}
      </div>
      <div className="roadmap-item-content">
        <button className="roadmap-step-toggle" onClick={onToggle} aria-expanded={isExpanded}>
          <span className="roadmap-step-title">{step.title}</span>
          <span className="step-time"><Icon name="clock" size={12} /> {step.duration}</span>
        </button>
        {isActive && <span className="current-step-label">CURRENTLY LEARNING</span>}
        {isExpanded && (
          <div className="step-detail">
            <p>{step.description}</p>
            {step.exercises?.length ? <ul className="step-exercises">{step.exercises.map((exercise) => <li key={exercise}>{exercise}</li>)}</ul> : null}
            {step.resources?.length ? <div className="step-resources">{step.resources.map((resource) => <a href={resource} target="_blank" rel="noreferrer" key={resource}>Learning resource <Icon name="arrow" size={11} /></a>)}</div> : null}
            <div className="step-detail-bottom">
              <span><Icon name="book" size={13} /> {step.lessons} lessons</span>
              <button onClick={onComplete}>{isComplete ? 'Mark incomplete' : isActive ? 'Continue learning' : 'Mark complete'} <Icon name="arrow" size={13} /></button>
            </div>
          </div>
        )}
      </div>
    </article>
  )
}

export default App
