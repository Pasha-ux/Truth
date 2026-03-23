/* ===========================
   GAME STATE
   =========================== */
const STORAGE_KEY = "pravda-mif-questions";

// Робимо змінну глобальною для доступу з index.html (Firebase)
window.questions = loadQuestions();
let currentIndex = 0;
let score = 0;
let answered = false;

/* ===========================
   DOM ELEMENTS
   =========================== */
const screenStart = document.getElementById("screen-start");
const screenPlay = document.getElementById("screen-play");
const screenResult = document.getElementById("screen-result");

const btnStart = document.getElementById("btn-start");
const btnTruth = document.getElementById("btn-truth");
const btnMyth = document.getElementById("btn-myth");
const btnNext = document.getElementById("btn-next");
const btnRestart = document.getElementById("btn-restart");
const noQuestionsMsg = document.getElementById("no-questions-msg");

const progressLabel = document.getElementById("progress-label");
const scoreLabel = document.getElementById("score-label");
const progressBar = document.getElementById("progress-bar");
const questionText = document.getElementById("question-text");
const explanationBox = document.getElementById("explanation-box");
const explanationText = document.getElementById("explanation-text");
const questionCard = document.getElementById("question-card");

const resultScoreNum = document.getElementById("result-score-num");
const resultScoreTotal = document.getElementById("result-score-total");
const resultMessage = document.getElementById("result-message");

const confettiContainer = document.getElementById("confetti-container");

// Admin elements
const adminToggle = document.getElementById("admin-toggle");
const adminPanel = document.getElementById("admin-panel");
const adminClose = document.getElementById("admin-close");
const addQuestionBtn = document.getElementById("add-question-btn");
const newQuestionTextEl = document.getElementById("new-question-text");
const newQuestionExplanationEl = document.getElementById("new-question-explanation");
const questionsList = document.getElementById("questions-list");
const questionCount = document.getElementById("question-count");
const clearAllBtn = document.getElementById("clear-all-btn");

/* ===========================
   STORAGE
   =========================== */
function loadQuestions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) { /* ignore */ }
  return [];
}

function saveQuestions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(window.questions));
}

/* ===========================
   SCREEN MANAGEMENT
   =========================== */
function showScreen(screen) {
  screenStart.classList.remove("active");
  screenPlay.classList.remove("active");
  screenResult.classList.remove("active");
  screen.classList.add("active");
}

window.updateStartScreen = function() {
  if (window.questions.length === 0) {
    noQuestionsMsg.style.display = "block";
    btnStart.style.display = "none";
  } else {
    noQuestionsMsg.style.display = "none";
    btnStart.style.display = "";
  }
}

/* ===========================
   GAME LOGIC
   =========================== */
window.startGame = function() {
  if (window.questions.length === 0) return;
  currentIndex = 0;
  score = 0;
  answered = false;
  showScreen(screenPlay);
  loadQuestion();
}

function loadQuestion() {
  const q = window.questions[currentIndex];
  const total = window.questions.length;

  questionText.textContent = q.text;
  progressLabel.textContent = "Питання " + (currentIndex + 1) + " / " + total;
  scoreLabel.textContent = "Рахунок: " + score;
  progressBar.style.width = ((currentIndex + 1) / total * 100) + "%";

  explanationBox.style.display = "none";
  btnTruth.disabled = false;
  btnMyth.disabled = false;
  btnTruth.className = "answer-btn answer-truth";
  btnMyth.className = "answer-btn answer-myth";
  answered = false;
}

function handleAnswer(userAnswer) {
  if (answered) return;
  answered = true;

  const q = window.questions[currentIndex];
  
  // Обробка відповіді (працює і з boolean, і з рядком "true"/"false")
  const correctAnswer = (q.answer === true || q.answer === "true");
  const isCorrect = userAnswer === correctAnswer;
  
  const clickedBtn = userAnswer ? btnTruth : btnMyth;

  btnTruth.disabled = true;
  btnMyth.disabled = true;

  if (isCorrect) {
    score++;
    scoreLabel.textContent = "Рахунок: " + score;
    clickedBtn.classList.add("correct");
    spawnConfetti(clickedBtn, userAnswer ? "green" : "red");
  } else {
    clickedBtn.classList.add("wrong");
  }

  setTimeout(function () {
    explanationText.textContent = q.explanation || "";
    explanationBox.style.display = "block";
    btnNext.textContent = currentIndex < window.questions.length - 1 ? "Далi" : "Результат";
  }, 600);
}

function nextQuestion() {
  if (currentIndex < window.questions.length - 1) {
    currentIndex++;
    loadQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const total = window.questions.length;
  resultScoreNum.textContent = score;
  resultScoreTotal.textContent = " / " + total;

  let msg;
  if (score === total) {
    msg = "Неймовiрно! Ти знаєш все!";
  } else if (score >= total * 0.7) {
    msg = "Чудовий результат! Ти добре обiзнаний!";
  } else if (score >= total * 0.4) {
    msg = "Непоганий результат! Є куди рости.";
  } else {
    msg = "Не засмучуйся! Спробуй ще раз.";
  }
  resultMessage.textContent = msg;

  showScreen(screenResult);
}

function restart() {
  // При рестарті намагаємося підтягнути свіжі дані
  showScreen(screenStart);
  window.updateStartScreen();
}

/* ===========================
   CONFETTI
   =========================== */
function spawnConfetti(originEl, colorScheme) {
  const rect = originEl.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top;

  const greens = ["#22c55e", "#16a34a", "#4ade80", "#a3e635", "#34d399"];
  const reds = ["#ef4444", "#dc2626", "#f87171", "#fb923c", "#f43f5e"];
  const colors = colorScheme === "green" ? greens : reds;

  for (let i = 0; i < 30; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";

    const size = Math.random() * 8 + 4;
    const vx = (Math.random() - 0.5) * 200;
    const vy = -(Math.random() * 180 + 60);
    const color = colors[Math.floor(Math.random() * colors.length)];

    piece.style.left = ox + "px";
    piece.style.top = oy + "px";
    piece.style.width = size + "px";
    piece.style.height = size + "px";
    piece.style.backgroundColor = color;
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    piece.style.setProperty("--vx", vx + "px");
    piece.style.setProperty("--vy", vy + "px");
    piece.style.animationDelay = (Math.random() * 0.15) + "s";

    confettiContainer.appendChild(piece);

    setTimeout(function () { piece.remove(); }, 1200);
  }
}

/* ===========================
   ADMIN PANEL
   =========================== */
function toggleAdmin() {
  adminPanel.classList.toggle("open");
  renderQuestionsList();
}

function closeAdmin() {
  adminPanel.classList.remove("open");
}

function renderQuestionsList() {
  questionsList.innerHTML = "";
  questionCount.textContent = window.questions.length;

  if (window.questions.length === 0) {
    questionsList.innerHTML = '<p style="color:rgba(255,255,255,0.25);font-size:0.85rem;text-align:center;padding:1rem 0">Поки що пусто</p>';
    return;
  }

  window.questions.forEach(function (q, i) {
    const item = document.createElement("div");
    item.className = "admin-q-item";

    const badgeClass = q.answer ? "q-badge q-badge-true" : "q-badge q-badge-false";
    const badgeText = q.answer ? "Правда" : "Мiф";

    item.innerHTML =
      '<span class="q-num">' + (i + 1) + '</span>' +
      '<div class="q-content">' +
        '<p class="q-text">' + escapeHtml(q.text) + '</p>' +
        '<div class="q-meta">' +
          '<span class="' + badgeClass + '">' + badgeText + '</span>' +
        '</div>' +
      '</div>' +
      '<button class="q-delete" data-index="' + i + '" title="Видалити">&times;</button>';

    questionsList.appendChild(item);
  });

  questionsList.querySelectorAll(".q-delete").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const idx = parseInt(this.getAttribute("data-index"));
      window.questions.splice(idx, 1);
      saveQuestions();
      renderQuestionsList();
      window.updateStartScreen();
    });
  });
}

async function addQuestion() {
  const text = newQuestionTextEl.value.trim();
  const explanation = newQuestionExplanationEl.value.trim();
  const answerRadio = document.querySelector('input[name="new-answer"]:checked');
  const answer = answerRadio.value === "true";

  if (!text || !explanation) return;

  const newQuestion = {
    id: Date.now(),
    text: text,
    answer: answer,
    explanation: explanation,
  };

  // --- ЦЕЙ БЛОК ВІДПРАВЛЯЄ ПИТАННЯ В ІНТЕРНЕТ (Firebase) ---
  if (typeof window.sendQuestionToFirebase === 'function') {
    const success = await window.sendQuestionToFirebase(newQuestion);
    if (!success) {
      alert("Помилка: питання не збереглося в хмарі!");
      return; 
    }
  }
  // ------------------------------------------------------

  window.questions.push(newQuestion);
  saveQuestions();
  renderQuestionsList();
  window.updateStartScreen();

  newQuestionTextEl.value = "";
  newQuestionExplanationEl.value = "";
  alert("Питання збережено в базу для всіх!");
}
 
function clearAllQuestions() {
  if (window.questions.length === 0) return;
  window.questions = [];
  saveQuestions();
  renderQuestionsList();
  window.updateStartScreen();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ===========================
   EVENT LISTENERS
   =========================== */
btnStart.addEventListener("click", window.startGame);
btnTruth.addEventListener("click", function () { handleAnswer(true); });
btnMyth.addEventListener("click", function () { handleAnswer(false); });
btnNext.addEventListener("click", nextQuestion);
btnRestart.addEventListener("click", restart);

adminToggle.addEventListener("click", toggleAdmin);
adminClose.addEventListener("click", closeAdmin);
addQuestionBtn.addEventListener("click", addQuestion);
clearAllBtn.addEventListener("click", clearAllQuestions);

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeAdmin();
});

/* ===========================
   INIT
   =========================== */
window.updateStartScreen();
