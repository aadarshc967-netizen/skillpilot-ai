const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export type LearnerRecord = {
  id: number
  name: string
  email: string
  target_career: string
  education: string
  academic_level: string
  institution: string
  experience: string
  certifications: string[]
  projects: string[]
}

export type AuthResult = {
  access_token: string
  token_type: 'bearer'
  learner: LearnerRecord
}

export type AssessmentAttempt = {
  id: number
  target_career: string
  score: number
  total_questions: number
  correct_count: number
  weak_topics: string[]
  created_at: string
}

export type SkillRecord = {
  id: number
  name: string
  category: string
  level: string
  progress: number
  is_gap: boolean
  priority: string
}

export type RoadmapStep = {
  id: number
  title: string
  duration: string
  lessons: number
  description: string
  status: 'complete' | 'in-progress' | 'up-next' | 'locked'
  position: number
  exercises: string[]
  resources: string[]
}

export type RoadmapRecord = {
  id: number
  title: string
  duration: string
  lessons: number
  description: string
  status: 'complete' | 'in-progress' | 'up-next' | 'locked'
  position: number
  exercises: string[]
  resources: string[]
}

export type AgentActivity = {
  agent: string
  task: string
  status: 'running' | 'completed' | 'failed'
  output: Record<string, unknown> | null
}

export type AgentRunResult = {
  mode: 'demo' | 'live'
  mode_reason: string | null
  career: string
  skill_analysis: {
    strengths: Array<{ name: string; category: string; reason: string; priority: string }>
    weaknesses: Array<{ name: string; category: string; reason: string; priority: string }>
    skill_gaps: Array<{ name: string; category: string; reason: string; priority: string }>
    summary: string
  }
  career_match: {
    score: number
    formula: string
    missing_requirements: string[]
    explanation: string
  }
  learning_path: { summary: string; steps: RoadmapRecord[] }
}

export type AssessmentQuestion = {
  id: string
  topic: string
  question: string
  options: string[]
}

export type AssessmentRunResult = {
  mode: 'demo' | 'live'
  mode_reason: string | null
  assessment: {
    score: number
    total_questions: number
    correct_count: number
    weak_topics: string[]
    results: Array<{
      question_id: string
      topic: string
      question: string
      answer: string
      is_correct: boolean
      correct_answer: string
    }>
    summary: string
  }
  previous_roadmap: RoadmapRecord[]
  updated_roadmap: { summary: string; steps: RoadmapRecord[] }
  roadmap_changed: boolean
}

export type MentorReply = {
  mode: 'demo' | 'live'
  agent: string
  reply: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const token = getAuthToken()
  if (token && !path.startsWith('/api/auth/')) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  if (!response.ok) {
    if (response.status === 401 && token) {
      setAuthToken(null)
      window.dispatchEvent(new Event('skillpilot:unauthorized'))
    }
    const body = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(body?.detail ?? `SkillPilot API request failed (${response.status} ${response.statusText})`)
  }
  return response.json() as Promise<T>
}

async function streamRequest<T>(
  path: string,
  body: unknown,
  onActivity: (activity: AgentActivity) => void,
): Promise<T> {
  const token = getAuthToken()
  const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    if (response.status === 401 && token) {
      setAuthToken(null)
      window.dispatchEvent(new Event('skillpilot:unauthorized'))
    }
    const error = await response.json().catch(() => null) as { detail?: string } | null
    throw new Error(error?.detail ?? `SkillPilot API request failed (${response.status} ${response.statusText})`)
  }
  if (!response.body) throw new Error('The SkillPilot API did not return an event stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: T | undefined

  function processEvent(block: string) {
    const data = block.split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
    if (!data) return
    const event = JSON.parse(data) as
      | { type: 'activity'; activity: AgentActivity }
      | { type: 'result'; data: T }
      | { type: 'error'; message: string }
    if (event.type === 'activity') onActivity(event.activity)
    if (event.type === 'result') result = event.data
    if (event.type === 'error') throw new Error(event.message)
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ''
      for (const block of blocks) processEvent(block)
      if (done) break
    }
    if (buffer.trim()) processEvent(buffer)
  } finally {
    reader.releaseLock()
  }
  if (result === undefined) throw new Error('The SkillPilot agent run ended without a result.')
  return result
}

const TOKEN_STORAGE_KEY = 'skillpilot_access_token'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}

export const authApi = {
  signup: (name: string, email: string, password: string) =>
    request<AuthResult>('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<AuthResult>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
}

export const learnerApi = {
  addSkill: (skill: { name: string; category: string; progress: number }) =>
    request<SkillRecord>('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skill),
    }),
  getProfile: () => request<LearnerRecord>('/api/learner'),
  updateProfile: (profile: Pick<LearnerRecord, 'name' | 'email' | 'education' | 'academic_level' | 'institution' | 'experience' | 'certifications' | 'projects'>) =>
    request<LearnerRecord>('/api/learner/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    }),
  updateCareer: (targetCareer: string) =>
    request<LearnerRecord>('/api/learner/career', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_career: targetCareer }),
    }),
  getSkills: () => request<SkillRecord[]>('/api/skills'),
  updateSkillProgress: (skillId: number, progress: number) =>
    request<SkillRecord>(`/api/skills/${skillId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    }),
  getRoadmap: () => request<RoadmapRecord[]>('/api/roadmap'),
  updateRoadmapStatus: (stepId: number, status: RoadmapRecord['status']) =>
    request<RoadmapRecord>(`/api/roadmap/${stepId}?status=${encodeURIComponent(status)}`, { method: 'PUT' }),
  getAssessmentHistory: () => request<AssessmentAttempt[]>('/api/assessments'),
  getAssessmentQuestions: () => request<AssessmentQuestion[]>('/api/assessment/questions'),
  analyze: (targetCareer: string, onActivity: (activity: AgentActivity) => void) =>
    streamRequest<AgentRunResult>('/api/agents/analyze', { target_career: targetCareer }, onActivity),
  submitAssessment: (
    answers: Array<{ question_id: string; answer: string }>,
    targetCareer: string,
    onActivity: (activity: AgentActivity) => void,
  ) => streamRequest<AssessmentRunResult>('/api/agents/assessment', { answers, target_career: targetCareer }, onActivity),
  askMentor: (question: string, targetCareer: string) =>
    request<MentorReply>('/api/mentor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, target_career: targetCareer }),
    }),
}
