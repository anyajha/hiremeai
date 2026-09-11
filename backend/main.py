from __future__ import annotations

import json
import os
import random
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from groq import Groq
from pydantic import BaseModel
from pypdf import PdfReader

# Get the project root directory (parent of backend)
PROJECT_ROOT = Path(__file__).parent.parent

# Load environment variables from .env file
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE)

# Initialize Groq client lazily to allow startup without API key
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set. Please add it to .env file.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

model = "openai/gpt-oss-120b"

# Define resume path using PROJECT_ROOT (already defined above)
RESUME_PATH = PROJECT_ROOT / "A_Ress.pdf"

# Global cache for parsed resume
_cached_resume = None

def get_or_cache_resume():
    """Parse resume once and cache it globally."""
    global _cached_resume
    if _cached_resume is None:
        resume_text = read_pdf(RESUME_PATH)
        _cached_resume = parse_resume(resume_text)
    return _cached_resume

app=FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

#parse resume


#parse resume
class Experience(BaseModel):
    company: str | None = None
    role: str | None = None
    duration: str | None = None
    description: str | None = None
    skills_used: list[str] = []

class Resume(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None

    total_experience_years: float | None = None

    skills: list[str] = []
    experiences: list[Experience] = []
    education: list[str] = []
    projects: list[str] = []
    certifications: list[str] = []
resume_schema = Resume.model_json_schema()

class ChatRequest(BaseModel):
    question: str
    history: list[dict] = []  # Conversation history

# Soft, personal details about the candidate that don't appear in the resume.
# Used to make the chatbot feel more human when asked non-technical questions.
NOT_IN_RESUME_FACTS = [
    "That Anya once travelled to Shimla from Dehradun on a bike, just for tea.",
    "That Anya is a great singer.",
    "That Anya is very hardworking, trustworthy, and knows how to be a friend.",
    "That she has been hitting the gym since 2021.",
    "That she might not be too social.",
]

PERSONAL_PROFILE = """
Hobbies: Journaling, fitness, watching psychological thrillers (favorite: Shutter Island), athletics (track and field).
Favorite subject: Mathematics.
Highest qualification timeline: 2026-2028.
Something she'd love to learn properly: modeling — she has tried teaching herself the basics but wants professional training.

Strengths:
- Consistency: sticks with a task and keeps working on it even without motivation.
- Communication: people say she is easy to talk to and explains her thoughts clearly.
- Handles pressure by breaking work into smaller tasks, prioritizing, and focusing on one thing at a time.
- Comfortable listening to others' ideas, taking responsibility for her part, helping teammates, and adapting to better approaches.
- Proud of staying disciplined and consistently improving herself across academics, fitness, and new skills.

Weaknesses / growth areas:
- Sometimes overthinks and tries to make things perfect.
- Has learned that mistakes are part of learning and can't be avoided completely.
- Finds feedback about her effort (rather than results) the hardest to hear.
- Wishes she had started exploring her interests and skills earlier.

Work style & personality:
- An ambivert: works well independently but also enjoys being around people.
- Prefers a mix of independent work and teamwork.
- Stays motivated on repetitive tasks by remembering the bigger goal and focusing on one task at a time.
- Thrives in a positive environment with supportive people and room to learn.
- Weekends: cooking favorite meals, journaling, catching up with friends.

Values & motivation:
- Chose this career path because she enjoys learning, solving problems, and growing with technology.
- Most motivated by seeing herself improve and achieve things she's worked hard for.
- Thrives in a supportive, collaborative, growth-oriented culture.
- Cares deeply about personal growth and becoming a better version of herself.

Fun / light:
- If not in tech, she'd probably explore modeling or something related to fitness and fashion.
- Loves to serve her home-made tea.

About HireMeAI:
- HireMeAI is a conversational AI chatbot made by Anya to showcase her skills and personality.
- It's designed to answer questions about her background, skills, experience, personality, and fun facts.
- The project demonstrates her abilities in AI integration, full-stack development, and creative problem-solving.
"""

def ask_candidate(question: str, resume: Resume, conversation_history: list[dict] = None):

    if conversation_history is None:
        conversation_history = []

    not_in_resume_fact = random.choice(NOT_IN_RESUME_FACTS)
    question_lower = question.lower()
    salary_terms = ["salary", "pay", "compensation", "package", "ctc", "expected income"]
    meeting_terms = ["schedule a meeting", "schedule meeting", "book a meeting", "google meeting", "google calendar", "calendar invite"]

    if any(term in question_lower for term in salary_terms + meeting_terms):
        yield "I do not have enough information about that, guessing from your prompt, are you moving ahead with her profile?"
        return

    system_prompt = f"""
You are Anya's AI assistant representing her during job interviews or recruitment conversations.

Below is everything you know about Anya professionally (from her resume):

{resume.model_dump_json(indent=2)}

Below are some soft, personal details about Anya that are NOT on the resume.
Use these when asked about hobbies, strengths, weaknesses, personality, or anything personal:

{PERSONAL_PROFILE}

If the user asks something like "what is not in your resume" or "tell me something about yourself that isn't on your resume" or any similar phrasing, answer using this specific fact, phrased naturally in your own words (do not quote it verbatim):

{not_in_resume_fact}

Rules:

1. Answer only using the information provided above. Never hallucinate or make up information.

2. If information is unavailable, say "I don't have enough information to answer that."

3. Be professional, warm, and personable. Use conversational language.

4. Remember previous context from the conversation and refer back to earlier points naturally.

5. IMPORTANT: Keep answers SHORT and CONCISE - maximum 2-3 sentences per paragraph, 1-2 paragraphs total.

6. Use **bold** for key points and *italics* for emphasis to make answers scannable.

7. Avoid unnecessary elaboration, filler text, or repetition.

8. When Anya introduces herself or if asked about HireMeAI, mention that she built this chatbot to showcase her skills and personality.

9. If asked about Anya's highest qualification or expected graduation timeline, state it as **2026-2028**.
"""

    # Build messages including conversation history
    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]
    
    # Add conversation history
    for msg in conversation_history:
        messages.append(msg)
    
    # Add current question
    messages.append({
        "role": "user",
        "content": question
    })

    stream = get_groq_client().chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta

def parse_resume(resume_text):
    system_prompt = f"""
    You are an expert resume parser.

    Extract information from the resume based on its meaning,
    not only based on exact section headings.

    Different resumes may use different headings.

    For example:
    - Experience
    - Professional Experience
    - Work History
    - Employment
    - Internships

    These may all contain relevant experience.

    Skills may also appear in the skills section, work experience,
    internships or projects.

    Return ONLY valid JSON matching this schema:

    {resume_schema}

    Important rules:

    1. Do not invent information.
    2. If a value is not available, return null.
    3. If a list has no information, return an empty list.
    4. Include internships inside experiences.
    5. Extract skills mentioned across the entire resume.
    """
    user_prompt = f"""
    Parse the following resume:

    {resume_text}
    """
    message_system={
        "role" : "system",
        "content" : system_prompt
    }
    message_user={
        "role" : "user",
        "content" : user_prompt
    }
    messages=[message_system, message_user]
    response_format={
        "type": "json_object"
    }
    stream=get_groq_client().chat.completions.create(model=model, messages=messages, response_format=response_format, stream=True)

    raw_output=""
    for chunk in stream:
        delta=chunk.choices[0].delta.content
        if delta:
            raw_output+=delta
            print(delta, end="", flush=True)
    print()

    data = json.loads(raw_output)
    resume = Resume(**data)
    return resume

#pdf extraction

def read_pdf(file_path):
    if not file_path.exists():
        raise FileNotFoundError(f"Resume PDF not found at {file_path}. Please place your resume PDF in the project root directory.")
    
    pdf_reader=PdfReader(file_path)

    text=""

    for page in pdf_reader.pages:

        page_text=page.extract_text()

        if page_text:
            text+=page_text + "\n"
    return text
     


@app.get("/health")
def home():
    try:
        resume = get_or_cache_resume()
        print(resume.model_dump_json(indent=2))
        return{
            "message":"ye home page h.",
        }
    except FileNotFoundError as e:
        return{
            "error": str(e),
            "message": "Resume PDF not found. Please upload your resume."
        }

@app.post("/chat")
def chat(request: ChatRequest):
    try:
        resume = get_or_cache_resume()
        return StreamingResponse(ask_candidate(request.question, resume, request.history), media_type="text/plain")
    except FileNotFoundError as e:
        return {"error": str(e)}


# Serve the browser client from the same origin in production.
app.mount("/", StaticFiles(directory=PROJECT_ROOT / "frontend", html=True), name="frontend")

#youtube.com
#youtube.com/anya
#youtube.com/anya/videos