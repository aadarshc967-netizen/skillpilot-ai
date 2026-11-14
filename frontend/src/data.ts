export type RoadmapStep = {
  id: number
  title: string
  duration: string
  lessons: number
  description: string
  status: 'complete' | 'in-progress' | 'up-next' | 'locked'
  exercises?: string[]
  resources?: string[]
}

export const learner = {
  id: 'sample-learner',
  name: 'Jordan Miller',
  firstName: 'Jordan',
  email: 'jordan.miller@example.com',
  targetCareer: 'Full Stack Developer',
}

export const careerOptions = [
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Data Analyst',
]

export const navigation = [
  { label: 'Overview', icon: 'dashboard' },
  { label: 'My roadmap', icon: 'roadmap' },
  { label: 'My skills', icon: 'skills' },
  { label: 'Assessments', icon: 'assessment' },
  { label: 'AI Mentor', icon: 'mentor' },
]

export const skillGroups = {
  current: [
    { name: 'Python', mark: 'Py', color: 'logo-python', level: 'Intermediate', progress: 72 },
    { name: 'SQL', mark: 'SQ', color: 'logo-sql', level: 'Intermediate', progress: 58 },
    { name: 'HTML & CSS', mark: '</>', color: 'logo-html', level: 'Beginner', progress: 35 },
  ],
  gaps: [
    { name: 'JavaScript', mark: 'JS', category: 'Programming', priority: 'High' },
    { name: 'React', mark: '⚛', category: 'Frontend framework', priority: 'High' },
    { name: 'Node.js', mark: 'N', category: 'Backend runtime', priority: 'High' },
    { name: 'Git & GitHub', mark: '⌘', category: 'Developer tools', priority: 'Medium' },
    { name: 'REST APIs', mark: '↔', category: 'Backend concepts', priority: 'Medium' },
  ],
  gapsByCareer: {
    'Frontend Developer': [
      { name: 'JavaScript', mark: 'JS', category: 'Programming', priority: 'High' },
      { name: 'React', mark: '⚛', category: 'Frontend framework', priority: 'High' },
      { name: 'TypeScript', mark: 'TS', category: 'Programming', priority: 'High' },
      { name: 'Git & GitHub', mark: '⌘', category: 'Developer tools', priority: 'Medium' },
      { name: 'Accessibility', mark: 'A11y', category: 'Web fundamentals', priority: 'Medium' },
    ],
    'Backend Developer': [
      { name: 'JavaScript', mark: 'JS', category: 'Programming', priority: 'High' },
      { name: 'Node.js', mark: 'N', category: 'Backend runtime', priority: 'High' },
      { name: 'REST APIs', mark: '↔', category: 'Backend concepts', priority: 'High' },
      { name: 'SQL', mark: 'SQ', category: 'Databases', priority: 'Medium' },
      { name: 'Docker', mark: 'D', category: 'Developer tools', priority: 'Medium' },
    ],
    'Data Analyst': [
      { name: 'Advanced SQL', mark: 'SQ', category: 'Databases', priority: 'High' },
      { name: 'Data visualization', mark: '▥', category: 'Analytics', priority: 'High' },
      { name: 'Statistics', mark: '∑', category: 'Analytics', priority: 'High' },
      { name: 'Excel', mark: 'X', category: 'Analytics tools', priority: 'Medium' },
      { name: 'Tableau', mark: 'T', category: 'Analytics tools', priority: 'Medium' },
    ],
  } satisfies Record<string, Array<{ name: string; mark: string; category: string; priority: string }>>,
}

type MappedCareer = keyof typeof skillGroups.gapsByCareer

export function getSkillGapsForCareer(career: string) {
  if (Object.prototype.hasOwnProperty.call(skillGroups.gapsByCareer, career)) {
    return skillGroups.gapsByCareer[career as MappedCareer]
  }
  return skillGroups.gaps
}

export const initialRoadmap: RoadmapStep[] = [
  {
    id: 1,
    title: 'HTML & CSS essentials',
    duration: '2 weeks',
    lessons: 8,
    description: 'Build accessible, responsive pages and get comfortable with the building blocks of the web.',
    status: 'complete',
  },
  {
    id: 2,
    title: 'JavaScript foundations',
    duration: '3 weeks',
    lessons: 12,
    description: 'Learn modern JavaScript, from variables and functions through async code and browser APIs.',
    status: 'in-progress',
  },
  {
    id: 3,
    title: 'Build with React',
    duration: '4 weeks',
    lessons: 16,
    description: 'Turn your JavaScript into interactive interfaces with components, hooks, and state.',
    status: 'up-next',
  },
  {
    id: 4,
    title: 'Backend with Node.js',
    duration: '3 weeks',
    lessons: 11,
    description: 'Create a server, design REST APIs, and connect your app to a database.',
    status: 'locked',
  },
]
