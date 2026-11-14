from pydantic import BaseModel, ConfigDict, Field


class Learner(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    target_career: str
    education: str = ""
    academic_level: str = ""
    institution: str = ""
    experience: str = ""
    certifications: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=10, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    learner: Learner


class CareerUpdate(BaseModel):
    target_career: str


class LearnerProfileUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    education: str = Field(default="", max_length=500)
    academic_level: str = Field(default="", max_length=120)
    institution: str = Field(default="", max_length=200)
    experience: str = Field(default="", max_length=5000)
    certifications: list[str] = Field(default_factory=list, max_length=30)
    projects: list[str] = Field(default_factory=list, max_length=30)


class Skill(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    level: str
    progress: int
    is_gap: bool
    priority: str


class SkillProgressUpdate(BaseModel):
    progress: int = Field(ge=0, le=100)


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    category: str = Field(min_length=1, max_length=100)
    progress: int = Field(default=0, ge=0, le=100)


class AssessmentAttempt(BaseModel):
    id: int
    target_career: str
    score: int
    total_questions: int
    correct_count: int
    weak_topics: list[str]
    created_at: str


class RoadmapStep(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    duration: str
    lessons: int
    description: str
    status: str
    position: int
    exercises: list[str] = Field(default_factory=list)
    resources: list[str] = Field(default_factory=list)


class AnalysisRequest(BaseModel):
    target_career: str | None = None


class AssessmentAnswer(BaseModel):
    question_id: str
    answer: str


class AssessmentSubmission(BaseModel):
    answers: list[AssessmentAnswer] = Field(min_length=1, max_length=20)
    target_career: str | None = None


class MentorMessage(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    target_career: str | None = None
