const configuredApiBaseUrl = document.querySelector('meta[name="hiremeai-api-base-url"]')?.content.trim();
const API_URL = configuredApiBaseUrl
  ? `${configuredApiBaseUrl.replace(/\/$/, "")}/chat`
  : window.location.protocol === "file:"
    ? "http://127.0.0.1:8000/chat"
    : "/chat";

// Conversation history
let conversationHistory = [];

const chat = document.getElementById("chat");
const form = document.getElementById("chat-form");
const input = document.getElementById("question");
const sendBtn = document.getElementById("send-btn");
const stopBtn = document.getElementById("stop-btn");
const micBtn = document.getElementById("mic-btn");
const listeningStatus = document.getElementById("listening-status");
const themeToggle = document.getElementById("theme-toggle");
const moodOrb = document.getElementById("mood-orb");
const confettiLayer = document.getElementById("confetti-layer");
const offerCard = document.getElementById("offer-card");

// Abort controller for stopping message generation
let abortController = null;

/* ---------- dark / light theme toggle ---------- */
const savedTheme = localStorage.getItem("hiremeai-theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("hiremeai-theme", next);
});


/* ---------- tiny ASMR typing tick sound via Web Audio ---------- */
let audioCtx;
function playTick() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 720 + Math.random() * 180;
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (e) {
    /* audio not available, ignore */
  }
}

/* ---------- voice input via Web Speech API ---------- */
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let listening = false;
let finalizedTranscript = "";
let speechSilenceTimer = null;
const SPEECH_SILENCE_DELAY = 1800;

function setListeningState(isListening) {
  listening = isListening;
  if (!isListening && speechSilenceTimer) {
    clearTimeout(speechSilenceTimer);
    speechSilenceTimer = null;
  }
  micBtn.classList.toggle("listening", isListening);
  listeningStatus.textContent = isListening ? "Listening..." : "";
  micBtn.setAttribute("aria-label", isListening ? "Stop listening" : "Voice input");
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.lang = "en-IN";

  recognition.onstart = () => {
    finalizedTranscript = input.value.trim();
    setListeningState(true);
  };

  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) {
        finalizedTranscript += `${transcript} `;
      } else {
        interimTranscript += transcript;
      }
    }
    input.value = `${finalizedTranscript}${interimTranscript}`.trim();
    input.focus();
    if (speechSilenceTimer) clearTimeout(speechSilenceTimer);
    speechSilenceTimer = setTimeout(() => {
      if (listening) recognition.stop();
    }, SPEECH_SILENCE_DELAY);
  };

  recognition.onend = () => {
    setListeningState(false);
  };

  recognition.onerror = (event) => {
    setListeningState(false);
    const errorMessages = {
      "not-allowed": "Microphone permission is blocked.",
      "service-not-allowed": "Speech recognition is unavailable in this browser.",
      network: "Speech recognition needs an internet connection.",
      "no-speech": "I did not hear anything. Try speaking again.",
    };
    listeningStatus.textContent = errorMessages[event.error] || "Speech recognition stopped.";
    setTimeout(() => {
      if (!listening) listeningStatus.textContent = "";
    }, 3000);
  };
} else {
  micBtn.style.display = "none";
  listeningStatus.style.display = "none";
}

micBtn.addEventListener("click", () => {
  if (!recognition || listening) {
    recognition?.stop();
    return;
  }
  finalizedTranscript = input.value.trim();
  setListeningState(true);
  try {
    recognition.start();
  } catch (error) {
    setListeningState(false);
    listeningStatus.textContent = "Speech recognition is already starting.";
    setTimeout(() => {
      listeningStatus.textContent = "";
    }, 2500);
  }
});

/* ---------- mood-ring orb: reflects the vibe of the last answer ---------- */
const MOOD_CLASSES = ["mood-neutral", "mood-thinking", "mood-technical", "mood-personal", "mood-achievement"];

function setMood(mood) {
  if (!moodOrb) return;
  moodOrb.classList.remove(...MOOD_CLASSES);
  moodOrb.classList.add(mood);
}

function classifyMood(text) {
  const lower = text.toLowerCase();

  const achievementWords = ["achieve", "award", "certificat", "accomplish", "proud", "improved", "increased", "led ", "successfully", "won ", "ranked"];
  const personalWords = ["hobby", "hobbies", "journaling", "gym", "fitness", "sing", "travel", "weekend", "favorite", "movie", "thriller", "personality", "enjoy", "love", "tea", "friend"];
  const technicalWords = ["project", "experience", "skill", "python", "javascript", "developed", "engineer", "api", "database", "code", "built", "framework", "backend", "frontend"];

  if (achievementWords.some((w) => lower.includes(w))) return "mood-achievement";
  if (personalWords.some((w) => lower.includes(w))) return "mood-personal";
  if (technicalWords.some((w) => lower.includes(w))) return "mood-technical";
  return "mood-neutral";
}

/* ---------- confetti + offer-letter easter egg ---------- */
const HIRE_INTENT_PHRASES = [
  "should i hire",
  "should you be hired",
  "should we hire",
  "why hire",
  "why should i hire",
  "why should we hire",
  "worth hiring",
  "hire her",
  "hire you",
  "hire anya",
  "recommend her",
  "give her a chance",
];

let hireEasterEggShown = false;
const CONFETTI_COLORS = ["#ff9fd0", "#c9a4ff", "#ffc94f", "#4fb3ff", "#7be495"];

function isHireIntent(text) {
  const lower = text.toLowerCase();
  return HIRE_INTENT_PHRASES.some((p) => lower.includes(p));
}

function launchConfetti() {
  const count = 40;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = `${5 + Math.random() * 2.5}s`;
    piece.style.animationDelay = `${Math.random() * 1.2}s`;
    piece.style.borderRadius = "50%";
    confettiLayer.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function triggerHireEasterEgg() {
  if (hireEasterEggShown) return;
  hireEasterEggShown = true;

  launchConfetti();
  offerCard.classList.add("show");

  setTimeout(() => {
    offerCard.classList.remove("show");
  }, 4200);
}

/* ---------- chat logic ---------- */
function addBubble(text, sender) {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${sender}`;
  bubble.textContent = text;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function addTypingBubble() {
  const bubble = document.createElement("div");
  bubble.className = "bubble bot typing";
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function addOptionsBubble(options) {
  const bubble = document.createElement("div");
  bubble.className = "bubble bot options";
  options.forEach(({ label, question }) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "option-chip";
    chip.textContent = label;
    chip.addEventListener("click", () => sendQuestion(question));
    bubble.appendChild(chip);
  });
  chat.appendChild(bubble);
  chat.scrollTop = chat.scrollHeight;
  return bubble;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Check if user is at the bottom of the chat
function isAtBottom() {
  return chat.scrollHeight - chat.clientHeight - chat.scrollTop < 100;
}

// Smart scroll: only auto-scroll if user is at bottom
function smartScroll() {
  if (isAtBottom()) {
    chat.scrollTop = chat.scrollHeight;
  }
}

async function playGreeting() {
  const typing0 = addTypingBubble();
  await wait(1200);
  typing0.remove();
  addBubble("Hi! I'm HireMeAI.", "bot");

  const typing1 = addTypingBubble();
  await wait(2400);
  typing1.remove();
  addBubble("Ask me anything about Anya.", "bot");

  const typing2 = addTypingBubble();
  await wait(2400);
  typing2.remove();
  const linksBubble = addBubble(
    "Or pick a quick topic to get started.\n\n• [LinkedIn](https://www.linkedin.com/in/anyajha/)\n• [GitHub](https://github.com/anyajha)\n• [Portfolio](https://anyajha.netlify.app/)",
    "bot",
  );
  linksBubble.innerHTML = formatMarkdown(linksBubble.textContent);
  addOptionsBubble([
    { label: "🎓 Education", question: "Tell me about Anya's education." },
    { label: "💼 Projects", question: "Tell me about Anya's projects." },
    { label: "🧑‍💻 Experience", question: "Tell me about Anya's experience." },
  ]);
}

playGreeting();

async function sendQuestion(question) {
  addBubble(question, "user");
  input.value = "";
  sendBtn.disabled = true;
  setMood("mood-thinking");

  // Add user message to history
  conversationHistory.push({
    role: "user",
    content: question
  });

  // Create abort controller for stopping
  abortController = new AbortController();
  
  // Show stop button, hide send button
  sendBtn.style.display = "none";
  stopBtn.style.display = "flex";

  const typingBubble = addTypingBubble();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        question: question,
        history: conversationHistory.slice(0, -1) // Exclude the question we just added
      }),
      signal: abortController.signal, // Pass abort signal
    });

    if (!res.ok || !res.body) {
      throw new Error(`Request failed: ${res.status}`);
    }

    typingBubble.remove();
    const answerBubble = addBubble("", "bot");
    answerBubble.innerHTML = ""; // Use innerHTML for formatted text
    
    // Scroll to new message once
    smartScroll();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let tickCounter = 0;
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunkText = decoder.decode(value, { stream: true });
      
      // Add text character by character with streaming effect
      for (const char of chunkText) {
        fullText += char;
        answerBubble.innerHTML = formatMarkdown(fullText, true);
        
        // Smart scroll: only scroll if user is at bottom
        smartScroll();
        
        // Faster streaming speed - similar to ChatGPT (18ms between characters)
        await wait(18);
      }

      tickCounter += chunkText.length;
      if (tickCounter >= 3) {
        tickCounter = 0;
        playTick();
      }
    }

    answerBubble.innerHTML = formatMarkdown(fullText);

    // Add bot response to history
    conversationHistory.push({
      role: "assistant",
      content: fullText
    });

    // Set mood based on full response
    const moodClass = classifyMood(fullText);
    setMood(moodClass);
    
    if (isHireIntent(question)) {
      triggerHireEasterEgg();
    }
  } catch (err) {
    if (err.name === "AbortError") {
      // User stopped the generation
      if (typingBubble.parentNode) {
        typingBubble.remove();
      }
    } else {
      typingBubble.remove();
      addBubble("Oops, something went wrong reaching the backend. Is it running?", "bot");
      setMood("mood-neutral");
      console.error(err);
    }
  } finally {
    // Hide stop button, show send button
    stopBtn.style.display = "none";
    sendBtn.style.display = "flex";
    sendBtn.disabled = false;
    input.focus();
    abortController = null;
  }
}

// Stop button click handler
stopBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (abortController) {
    abortController.abort();
  }
});

// Convert markdown to HTML formatting
function formatMarkdown(text, isStreaming = false) {
  let formatted = text
    // Convert markdown links to safe, clickable links.
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Convert **bold** to <strong>bold</strong>
    .replace(/\*\*([^\*\*]+?)\*\*/g, "<strong>$1</strong>")
    // Convert *italic* to <em>italic</em>
    .replace(/\*([^\*]+?)\*/g, "<em>$1</em>")
    // Ensure line breaks are preserved
    .replace(/\n/g, "<br>");

  if (isStreaming) {
    // Hide a link's raw URL while its Markdown is still arriving.
    formatted = formatted.replace(/\[([^\]]+)\]\([^)]*$/g, "$1");
  }

  return formatted;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  sendQuestion(question);
});
