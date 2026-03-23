"use client";

import { useState, useEffect, useRef } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { questions as baseQuestions } from "@/lib/questions";

/* ============================
   TYPES
   ============================ */
interface Question {
  id: string;
  text: string;
  answer: boolean;
  explanation: string;
  qFontSize: number;
  eFontSize: number;
  noAnswer?: boolean; // skip mode — just show "Далi" instead of Правда/Міф
}
const DEFAULT_Q_FONT_SIZE = 2.5;
const DEFAULT_E_FONT_SIZE = 1.5;
const QUESTION_FONT_SCALE = 2;
const ANSWER_FONT_SCALE = 2;

const stripQuestionPrefix = (text: string) => {
  const trimmed = text.trim();
  return trimmed
    .replace(/^(Міф\s+чи\s+правда)[:\s]*/i, "")
    .replace(/^(Правда\s+чи\s+міф)([:,]?\s*(що\s*)?)?/i, "")
    .trim();
};

const defaultSeedQuestions: Question[] = baseQuestions.map((q, i) => ({
  id: `seed-${i + 1}`,
  text: stripQuestionPrefix(q.text),
  answer: q.answer,
  explanation: q.explanation,
  qFontSize: DEFAULT_Q_FONT_SIZE,
  eFontSize: DEFAULT_E_FONT_SIZE,
  noAnswer: q.noAnswer ?? false,
}));

const normalizeQuestion = (id: string, data: Record<string, unknown>): Question => ({
  id,
  text: typeof data.text === "string" ? data.text : "",
  answer: Boolean(data.answer),
  explanation: typeof data.explanation === "string" ? data.explanation : "",
  qFontSize: typeof data.qFontSize === "number" ? data.qFontSize : DEFAULT_Q_FONT_SIZE,
  eFontSize: typeof data.eFontSize === "number" ? data.eFontSize : DEFAULT_E_FONT_SIZE,
  noAnswer: Boolean(data.noAnswer),
});

/* ============================
   CONFETTI HELPER
   ============================ */
function spawnConfetti(
  container: HTMLDivElement | null,
  originEl: HTMLButtonElement,
  colorScheme: "green" | "red"
) {
  if (!container) return;
  const rect = originEl.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top;

  const greens = ["#22c55e", "#16a34a", "#4ade80", "#a3e635", "#34d399"];
  const reds = ["#ef4444", "#dc2626", "#f87171", "#fb923c", "#f43f5e"];
  const colors = colorScheme === "green" ? greens : reds;

  for (let i = 0; i < 30; i++) {
    const piece = document.createElement("span");
    const size = Math.random() * 8 + 4;
    const vx = (Math.random() - 0.5) * 200;
    const vy = -(Math.random() * 180 + 60);
    const color = colors[Math.floor(Math.random() * colors.length)];

    Object.assign(piece.style, {
      position: "absolute",
      left: ox + "px",
      top: oy + "px",
      width: size + "px",
      height: size + "px",
      backgroundColor: color,
      borderRadius: Math.random() > 0.5 ? "50%" : "2px",
      pointerEvents: "none",
      animationDelay: Math.random() * 0.15 + "s",
    });
    piece.style.setProperty("--vx", vx + "px");
    piece.style.setProperty("--vy", vy + "px");
    piece.style.animation = "confetti-fly 1s ease-out forwards";

    container.appendChild(piece);
    setTimeout(() => piece.remove(), 1200);
  }
}

/* ============================
   INLINE CSS
   ============================ */
const gameCSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;600;700;900&display=swap');

*, *::before, *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background: #050510;
  color: #f0f0f0;
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

body::before {
  content: '';
  position: fixed; inset: 0; z-index: 0;
  background:
    radial-gradient(ellipse at 20% 50%, #001129 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, #0F0025 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, #14080A 0%, transparent 50%),
    #010101;
  pointer-events: none;
}

.question-marks {
  position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none;
}

.qm {
  position: absolute; font-weight: 900;
  font-family: 'Playfair Display', serif;
  user-select: none; opacity: 0.7;
  animation: float 4s ease-in-out infinite;
}

.qm-green {
  color: #2d8a4e;
  text-shadow: 0 0 10px rgba(45,138,78,0.25), 0 2px 4px rgba(0,0,0,0.5);
}

.qm-red {
  color: #b92d3a;
  text-shadow: 0 0 10px rgba(185,45,58,0.25), 0 2px 4px rgba(0,0,0,0.5);
}

#confetti-box {
  position: fixed; inset: 0; z-index: 100; pointer-events: none;
}

/* ===== SCREENS ===== */
.screen {
  position: fixed; inset: 0; z-index: 10;
  display: none; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 1.5rem;
}
.screen.active { display: flex; }

/* ===== ADMIN TOGGLE ===== */
.admin-toggle {
  position: fixed; top: 0; left: 0; width: 50px; height: 50px;
  z-index: 200; background: transparent; border: none; cursor: pointer; opacity: 0;
}
.admin-toggle:hover { opacity: 0.08; background: white; }

/* ===== REFRESH BUTTON ===== */
.refresh-btn {
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.06);
  color: #fff;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.2s, border-color 0.2s;
}
.refresh-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.35); }

/* ===== ADMIN PANEL ===== */
.admin-panel {
  position: fixed; top: 0; left: 0; width: 100%; max-width: 440px; height: 100%;
  z-index: 300; background: #0a0a18; border-right: 1px solid rgba(255,255,255,0.1);
  transform: translateX(-100%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
  overflow-y: auto;
}
.admin-panel.open { transform: translateX(0); }

.admin-inner { padding: 1.5rem; }

.admin-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;
}
.admin-header h2 {
  font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 700; color: #fff;
}

.admin-close-btn {
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-size: 2rem; cursor: pointer; padding: 0 0.25rem; line-height: 1; transition: color 0.2s;
}
.admin-close-btn:hover { color: #fff; }

.admin-form {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
}

.admin-form h3 {
  font-size: 0.875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: rgba(255,255,255,0.5); margin-bottom: 0.75rem;
}

.admin-form textarea {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #fff; font-family: 'Inter', sans-serif; font-size: 0.9rem;
  padding: 0.75rem; resize: vertical; margin-bottom: 0.75rem; transition: border-color 0.2s;
}
.admin-form textarea:focus { outline: none; border-color: rgba(255,255,255,0.3); }
.admin-form textarea::placeholder { color: rgba(255,255,255,0.25); }

.admin-radio-group { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }

.admin-radio { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }
.admin-radio input[type="radio"] { accent-color: #22c55e; cursor: pointer; }

.radio-label { font-size: 0.9rem; font-weight: 700; }
.radio-true { color: #22c55e; }
.radio-false { color: #ef4444; }

.admin-add-btn {
  width: 100%; padding: 0.65rem 1rem; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff;
  font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 700;
  cursor: pointer; transition: opacity 0.2s;
}
.admin-add-btn:hover { opacity: 0.85; }

.admin-list-header {
  display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;
}
.admin-list-header h3 {
  font-size: 0.875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: rgba(255,255,255,0.5);
}

.question-count {
  background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);
  font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px;
}

.admin-questions-list {
  display: flex; flex-direction: column; gap: 0.5rem;
  margin-bottom: 1rem; max-height: 40vh; overflow-y: auto;
}

.admin-q-item {
  display: flex; align-items: flex-start; gap: 0.75rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 0.75rem;
}

.q-num {
  flex-shrink: 0; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.08); border-radius: 6px;
  font-size: 0.75rem; font-weight: 700; color: rgba(255,255,255,0.5);
}

.q-content { flex: 1; min-width: 0; }

.q-text-item {
  font-size: 0.85rem; color: rgba(255,255,255,0.85);
  line-height: 1.4; margin-bottom: 0.25rem; word-wrap: break-word;
}

.q-meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; }

.q-badge { padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: 700; font-size: 0.7rem; }
.q-badge-true { background: rgba(34,197,94,0.15); color: #22c55e; }
.q-badge-false { background: rgba(239,68,68,0.15); color: #ef4444; }

.q-delete {
  flex-shrink: 0; background: none; border: none;
  color: rgba(255,255,255,0.25); font-size: 1.25rem;
  cursor: pointer; padding: 0 0.25rem; line-height: 1; transition: color 0.2s;
}
.q-delete:hover { color: #ef4444; }

.q-edit {
  flex-shrink: 0; background: none; border: none;
  color: rgba(255,255,255,0.25); font-size: 0.9rem;
  cursor: pointer; padding: 0 0.25rem; line-height: 1; transition: color 0.2s;
}
.q-edit:hover { color: #3b82f6; }

.q-sizes {
  display: flex; gap: 0.5rem; margin-top: 0.25rem; font-size: 0.7rem; color: rgba(255,255,255,0.35);
}

/* ===== EDIT MODAL ===== */
.edit-overlay {
  position: fixed; inset: 0; z-index: 400;
  background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.edit-modal {
  background: #0f0f20; border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px; padding: 1.75rem; width: 100%; max-width: 500px;
  max-height: 90vh; overflow-y: auto;
}
.edit-modal h3 {
  font-family: 'Playfair Display', serif; font-size: 1.25rem; color: #fff; margin-bottom: 1rem;
}
.edit-modal textarea {
  width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px; color: #fff; font-family: 'Inter', sans-serif; font-size: 0.9rem;
  padding: 0.75rem; resize: vertical; margin-bottom: 0.75rem; transition: border-color 0.2s;
}
.edit-modal textarea:focus { outline: none; border-color: rgba(255,255,255,0.3); }
.edit-modal textarea::placeholder { color: rgba(255,255,255,0.25); }
.edit-modal .admin-radio-group { display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
.edit-size-section { margin-bottom: 1rem; }
.edit-size-section label {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.5rem;
}
.edit-size-section .size-label { font-size: 0.85rem; color: rgba(255,255,255,0.7); }
.edit-btns { display: flex; gap: 0.75rem; }
.edit-save-btn {
  flex: 1; padding: 0.65rem 1rem; border: none; border-radius: 8px;
  background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff;
  font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 700;
  cursor: pointer; transition: opacity 0.2s;
}
.edit-save-btn:hover { opacity: 0.85; }
.edit-cancel-btn {
  flex: 1; padding: 0.65rem 1rem; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
  background: transparent; color: rgba(255,255,255,0.7);
  font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: background 0.2s;
}
.edit-cancel-btn:hover { background: rgba(255,255,255,0.06); }

/* ===== HIGHLIGHTER TOOLBAR ===== */
.hl-toolbar {
  display: flex; align-items: center; gap: 0.4rem;
  margin-bottom: 0.4rem; flex-wrap: wrap;
}
.hl-toolbar span {
  font-size: 0.72rem; color: rgba(255,255,255,0.4); font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.05em; margin-right: 0.25rem;
}
.hl-btn {
  border: none; border-radius: 6px; font-family: 'Inter', sans-serif;
  font-size: 0.78rem; font-weight: 700; padding: 0.25rem 0.65rem;
  cursor: pointer; transition: opacity 0.2s;
}
.hl-btn:hover { opacity: 0.8; }
.hl-green { background: rgba(34,197,94,0.18); color: #22c55e; border: 1px solid rgba(34,197,94,0.35); }
.hl-red   { background: rgba(239,68,68,0.18);  color: #ef4444; border: 1px solid rgba(239,68,68,0.35); }
.hl-clear { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.12); }

/* skip-mode toggle */
.skip-toggle {
  display: flex; align-items: center; gap: 0.5rem;
  margin-bottom: 0.75rem; cursor: pointer; width: fit-content;
}
.skip-toggle input { accent-color: #f59e0b; cursor: pointer; width: 16px; height: 16px; }
.skip-toggle span { font-size: 0.85rem; color: rgba(255,255,255,0.65); }

/* big next-only button (skip mode) */
.next-only-btn {
  width: 100%; max-width: 520px; padding: 1.5rem 2rem;
  border: 3px solid rgba(255,255,255,0.25); border-radius: 20px;
  background: rgba(255,255,255,0.05); color: #fff;
  font-family: 'Inter', sans-serif; font-size: clamp(1.4rem, 4vw, 2rem);
  font-weight: 900; letter-spacing: 0.12em; cursor: pointer;
  transition: all 0.25s; animation: pulse-glow 2s ease-in-out infinite;
}
.next-only-btn:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }

/* answered state: hide truth/myth, show inline next */
.answer-area.answered { justify-content: center; }
.answer-btn.hidden-btn { display: none; }
.answer-divider.hidden-btn { display: none; }

.inline-next-btn {
  padding: 1.15rem 3rem; border: none; border-radius: 16px;
  background: rgba(255,255,255,0.1); color: #fff;
  font-family: 'Inter', sans-serif; font-size: clamp(1rem, 3vw, 1.35rem);
  font-weight: 900; letter-spacing: 0.1em; cursor: pointer; transition: background 0.2s;
}
.inline-next-btn:hover { background: rgba(255,255,255,0.18); }

.admin-actions { text-align: center; display: flex; flex-direction: column; gap: 0.5rem; }

.admin-clear-btn {
  background: none; border: 1px solid rgba(239,68,68,0.3); color: #ef4444;
  font-family: 'Inter', sans-serif; font-size: 0.8rem; font-weight: 600;
  padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer; transition: background 0.2s;
}
.admin-clear-btn:hover { background: rgba(239,68,68,0.1); }

/* ===== SIZE CONTROLS ===== */
.size-controls {
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;
}
.size-controls h3 {
  font-size: 0.875rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; color: rgba(255,255,255,0.5); margin-bottom: 0.75rem;
}
.size-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.65rem;
}
.size-row:last-child { margin-bottom: 0; }
.size-label { font-size: 0.85rem; color: rgba(255,255,255,0.7); }
.size-btns { display: flex; align-items: center; gap: 0.5rem; }
.size-value {
  font-size: 0.8rem; font-weight: 700; color: #fff;
  min-width: 40px; text-align: center;
}
.size-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06); color: #fff; font-size: 1.1rem; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.2s, border-color 0.2s;
}
.size-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); }

/* ===== START SCREEN ===== */
.screen-start { gap: 0.5rem; }

.subtitle {
  font-size: 1rem; color: rgba(255,255,255,0.45);
  letter-spacing: 0.15em; font-weight: 600; text-transform: lowercase;
}

.main-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(3rem, 10vw, 7rem);
  font-weight: 900; color: #fff; letter-spacing: 0.06em;
  text-align: center;
  text-shadow: 0 0 40px rgba(255,255,255,0.15), 0 4px 8px rgba(0,0,0,0.8);
  transform: rotate(-5deg);
  margin-bottom: 1.5rem;
}

.start-btn {
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 2px solid rgba(255,255,255,0.3);
  color: #fff; font-family: 'Playfair Display', serif;
  font-size: clamp(1.25rem, 3vw, 1.75rem); font-weight: 700;
  letter-spacing: 0.2em; padding: 0.9rem 3.5rem;
  border-radius: 999px; cursor: pointer; transition: all 0.3s;
  animation: pulse-glow 2s ease-in-out infinite;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}
.start-btn:hover {
  border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.08);
  box-shadow: 0 0 30px rgba(255,255,255,0.15);
}

.no-questions-msg {
  margin-top: 1.5rem; font-size: 0.9rem; color: rgba(255,255,255,0.35);
  text-align: center; max-width: 320px; line-height: 1.5;
}

/* ===== PLAYING SCREEN ===== */
.screen-play { justify-content: space-between; padding: 1.5rem 1rem; }

.question-area {
  display: flex; flex-direction: column; align-items: center;
  flex: 1; justify-content: center; width: 100%; padding: 1rem 0;
}

.question-card {
  max-width: 90%; width: 100%; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 20px;
  padding: 3.5rem 2.5rem; backdrop-filter: blur(4px); text-align: center;
  transition: transform 0.5s ease, opacity 0.5s ease;
}
.question-card.swipe-left {
  animation: swipe-left 0.55s ease forwards;
}
.question-card.swipe-right {
  animation: swipe-right 0.55s ease forwards;
}

.question-text {
  font-family: 'Playfair Display', serif; font-size: clamp(1.8rem, 5.5vw, 3rem);
  font-weight: 700; line-height: 1.4; color: #fff;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}

.explanation-box {
  max-width: 90%; width: 100%; margin-top: 1.5rem;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px; padding: 2rem 2.5rem; backdrop-filter: blur(4px);
  text-align: center; animation: fade-up 0.5s ease-out forwards;
}

.answer-inline {
  font-weight: 900;
  font-size: 1.05em;
}
.answer-inline.truth { color: #22c55e; text-shadow: 0 0 10px rgba(34,197,94,0.35); }
.answer-inline.myth { color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,0.35); }

.explanation-text {
  font-size: clamp(1.1rem, 3vw, 1.5rem); color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 1.25rem;
}

.next-btn {
  background: rgba(255,255,255,0.08); border: none; color: #fff;
  font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600;
  padding: 0.6rem 2rem; border-radius: 999px; cursor: pointer; transition: background 0.2s;
}
.next-btn:hover { background: rgba(255,255,255,0.15); }

.answer-area {
  display: flex; align-items: center; justify-content: center;
  gap: 1rem; width: 100%; max-width: 520px; padding-bottom: 0.5rem;
}

.answer-btn {
  flex: 1; padding: 1.15rem 1.5rem; border: 3px solid #000; border-radius: 16px;
  font-family: 'Inter', sans-serif; font-size: clamp(1rem, 3vw, 1.35rem);
  font-weight: 900; letter-spacing: 0.08em; color: #fff; cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.answer-truth { background: #15803d; }
.answer-truth:hover:not(:disabled) { background: #16a34a; box-shadow: 0 0 20px rgba(34,197,94,0.3); }

.answer-myth { background: #b91c1c; }
.answer-myth:hover:not(:disabled) { background: #dc2626; box-shadow: 0 0 20px rgba(239,68,68,0.3); }

.answer-btn:disabled { cursor: default; }
.answer-btn.correct { animation: shake-correct 0.6s ease-in-out; }
.answer-btn.wrong { opacity: 0.5; animation: bounce-wrong 0.6s ease-in-out; }

.answer-divider { color: rgba(255,255,255,0.2); font-size: 1.25rem; font-weight: 700; }

/* Overlay flash on full screen */
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
  transition: background-color 0.5s ease, box-shadow 0.5s ease;
}
.overlay-green {
  background-color: rgba(76, 175, 80, 0.25);
  box-shadow: inset 0 0 150px rgba(46, 125, 50, 0.4);
  backdrop-filter: brightness(1.05) saturate(1.1);
}
.overlay-red {
  background-color: rgba(244, 67, 54, 0.25);
  box-shadow: inset 0 0 150px rgba(198, 40, 40, 0.4);
  backdrop-filter: brightness(1.05) saturate(1.1);
}

/* ===== RESULT SCREEN ===== */
.result-card {
  max-width: 480px; width: 100%; background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
  padding: 3rem 2rem; backdrop-filter: blur(4px); text-align: center;
  animation: fade-up 0.5s ease-out forwards;
}

.result-title {
  font-family: 'Playfair Display', serif; font-size: 2.5rem; font-weight: 900;
  color: #fff; text-shadow: 0 0 30px rgba(255,255,255,0.1); margin-bottom: 0.5rem;
}

.result-score { margin: 2rem 0; }

.result-num { font-size: clamp(4rem, 10vw, 5rem); font-weight: 900; color: #fff; }
.result-total { font-size: clamp(1.75rem, 5vw, 2.25rem); color: rgba(255,255,255,0.35); }

.result-message {
  font-size: 1.1rem; color: rgba(255,255,255,0.5); margin-bottom: 2rem; line-height: 1.5;
}

.restart-btn {
  background: transparent; border: 2px solid rgba(255,255,255,0.3); color: #fff;
  font-family: 'Inter', sans-serif; font-size: 1.05rem; font-weight: 700;
  padding: 0.75rem 2.5rem; border-radius: 999px; cursor: pointer; transition: all 0.3s;
}
.restart-btn:hover { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.08); }

/* ===== ANIMATIONS ===== */
@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-15px) rotate(5deg); }
  75% { transform: translateY(10px) rotate(-5deg); }
}

@keyframes confetti-fly {
  0% { opacity: 1; transform: translate(0,0) rotate(0deg); }
  100% { opacity: 0; transform: translate(var(--vx), var(--vy)) rotate(720deg); }
}

@keyframes shake-correct {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-8px) rotate(-2deg); }
  20% { transform: translateX(8px) rotate(2deg); }
  30% { transform: translateX(-6px) rotate(-1deg); }
  40% { transform: translateX(6px) rotate(1deg); }
  50% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  70% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

@keyframes bounce-wrong {
  0%, 100% { transform: translateY(0); }
  20% { transform: translateY(-25px); }
  40% { transform: translateY(0); }
  60% { transform: translateY(-12px); }
  80% { transform: translateY(0); }
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes swipe-left {
  0% { transform: translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateX(-35%) rotate(-6deg); opacity: 0; }
}

@keyframes swipe-right {
  0% { transform: translateX(0) rotate(0deg); opacity: 1; }
  100% { transform: translateX(35%) rotate(6deg); opacity: 0; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(255,255,255,0.1); }
  50% { box-shadow: 0 0 20px rgba(255,255,255,0.2); }
}

@media (max-width: 640px) {
  .answer-divider { display: none; }
  .answer-area { gap: 0.75rem; }
  .question-card { padding: 2.5rem 1.25rem; }
  .explanation-box { padding: 1.5rem 1.25rem; }
  .result-card { padding: 2rem 1.5rem; }
  .admin-panel { max-width: 100%; }
}

.admin-questions-list::-webkit-scrollbar { width: 4px; }
.admin-questions-list::-webkit-scrollbar-track { background: transparent; }
.admin-questions-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
`;

/* ============================
   QUESTION MARKS DATA
   ============================ */
const questionMarks = [
  { left: "5%", top: "8%", size: 60, delay: "0s", dur: "4.2s", color: "green" },
  { left: "18%", top: "15%", size: 50, delay: "0.8s", dur: "3.8s", color: "red" },
  { left: "35%", top: "6%", size: 55, delay: "1.5s", dur: "4.5s", color: "green" },
  { left: "55%", top: "10%", size: 48, delay: "0.3s", dur: "3.6s", color: "red" },
  { left: "75%", top: "5%", size: 65, delay: "2s", dur: "4s", color: "green" },
  { left: "90%", top: "12%", size: 58, delay: "1.2s", dur: "4.3s", color: "red" },
  { left: "8%", top: "75%", size: 52, delay: "0.6s", dur: "3.9s", color: "green" },
  { left: "25%", top: "82%", size: 45, delay: "1.8s", dur: "4.1s", color: "red" },
  { left: "70%", top: "78%", size: 60, delay: "0.4s", dur: "3.7s", color: "green" },
  { left: "88%", top: "70%", size: 68, delay: "1s", dur: "4.4s", color: "red" },
  { left: "45%", top: "80%", size: 42, delay: "2.2s", dur: "3.5s", color: "green" },
  { left: "92%", top: "45%", size: 55, delay: "1.6s", dur: "4.2s", color: "red" },
];

/* ============================
   MAIN COMPONENT
   ============================ */
export default function GamePage() {
  const [screen, setScreen] = useState<"start" | "play" | "result">("start");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [btnState, setBtnState] = useState<{ truth: string; myth: string }>({ truth: "", myth: "" });
  const [adminOpen, setAdminOpen] = useState(false);
  const [overlayClass, setOverlayClass] = useState("");
  const [swipeDir, setSwipeDir] = useState<"" | "left" | "right">("");

  // Admin form state
  const [newText, setNewText] = useState("");
  const [newAnswer, setNewAnswer] = useState(true);
  const [newExplanation, setNewExplanation] = useState("");
  const [newQFontSize, setNewQFontSize] = useState(2.5);
  const [newEFontSize, setNewEFontSize] = useState(1.5);
  const [newNoAnswer, setNewNoAnswer] = useState(false);

  // Edit modal state
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editAnswer, setEditAnswer] = useState(true);
  const [editExplanation, setEditExplanation] = useState("");
  const [editQFontSize, setEditQFontSize] = useState(2.5);
  const [editEFontSize, setEditEFontSize] = useState(1.5);
  const [editNoAnswer, setEditNoAnswer] = useState(false);

  // Refs for explanation textareas (for highlighter)
  const newExplRef = useRef<HTMLTextAreaElement>(null);
  const editExplRef = useRef<HTMLTextAreaElement>(null);

  // Audio refs
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const wrongAudioRef = useRef<HTMLAudioElement | null>(null);

  const confettiRef = useRef<HTMLDivElement>(null);
  const truthBtnRef = useRef<HTMLButtonElement>(null);
  const mythBtnRef = useRef<HTMLButtonElement>(null);

  // Load questions from Firebase (shared) or fall back to defaults
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const init = async () => {
      const db = getFirebaseDb();
      if (!db) {
        setQuestions(defaultSeedQuestions);
        return;
      }

      const colRef = collection(db, "questions");

      try {
        const snap = await getDocs(colRef);
        if (snap.empty) {
          await Promise.all(
            defaultSeedQuestions.map((q) =>
              setDoc(
                doc(colRef, q.id),
                {
                  text: q.text,
                  answer: q.answer,
                  explanation: q.explanation,
                  qFontSize: q.qFontSize,
                  eFontSize: q.eFontSize,
                  noAnswer: q.noAnswer ?? false,
                  createdAt: serverTimestamp(),
                },
                { merge: true }
              )
            )
          );
        }
      } catch {
        if (!cancelled) setQuestions(defaultSeedQuestions);
      }

      const q = query(colRef, orderBy("createdAt", "asc"));
      unsub = onSnapshot(
        q,
        (snapshot) => {
          const items = snapshot.docs.map((d) => normalizeQuestion(d.id, d.data()));
          if (!cancelled) setQuestions(items);
        },
        () => {
          if (!cancelled) setQuestions(defaultSeedQuestions);
        }
      );
    };

    init();

    // Preload audio
    correctAudioRef.current = new Audio("/sounds/correct.mp3");
    wrongAudioRef.current = new Audio("/sounds/wrong.mp3");
    correctAudioRef.current.preload = "auto";
    wrongAudioRef.current.preload = "auto";

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  /* ---- HIGHLIGHT HELPER ---- */
  const wrapSelection = (
    ref: React.RefObject<HTMLTextAreaElement | null>,
    value: string,
    setValue: (v: string) => void,
    color: string | null
  ) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) return;
    const selected = value.slice(start, end);
    let replacement: string;
    if (color === null) {
      // strip all color spans
      replacement = selected.replace(/<span[^>]*color:[^>]*>([\s\S]*?)<\/span>/g, "$1");
    } else {
      replacement = `<span style="color:${color}">${selected}</span>`;
    }
    const updated = value.slice(0, start) + replacement + value.slice(end);
    setValue(updated);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start, start + replacement.length);
    }, 0);
  };

  const withAnswerHighlight = (html: string, answer: boolean, noAnswer?: boolean) => {
    if (noAnswer) return html;
    const trimmed = html.trim();
    const match = trimmed.match(/^(Міф|Мiф|Правда)([.!:])?\s*/i);
    if (!match) return html;
    const word = match[1];
    const rest = trimmed.slice(match[0].length);
    const cls = answer ? "truth" : "myth";
    return `<span class="answer-inline ${cls}">${word}:</span> ${rest}`.trim();
  };

  /* ---- GAME LOGIC ---- */
  const startGame = () => {
    if (questions.length === 0) return;
    setCurrentIndex(0);
    setScore(0);
    setAnswered(false);
    setShowExplanation(false);
    setSwipeDir("");
    setBtnState({ truth: "", myth: "" });
    setScreen("play");
  };

  const handleAnswer = (userAnswer: boolean) => {
    if (answered) return;
    setAnswered(true);

    const q = questions[currentIndex];
    const isCorrect = userAnswer === q.answer;

    if (isCorrect) {
      setScore((s) => s + 1);
      setBtnState({
        truth: userAnswer ? "correct" : "",
        myth: !userAnswer ? "correct" : "",
      });
      setOverlayClass("overlay-green");
      if (correctAudioRef.current) {
        correctAudioRef.current.currentTime = 0;
        correctAudioRef.current.play().catch(() => {});
      }
      const btnEl = userAnswer ? truthBtnRef.current : mythBtnRef.current;
      if (btnEl) spawnConfetti(confettiRef.current, btnEl, userAnswer ? "green" : "red");
    } else {
      setBtnState({
        truth: userAnswer ? "wrong" : "",
        myth: !userAnswer ? "wrong" : "",
      });
      setOverlayClass("overlay-red");
      if (wrongAudioRef.current) {
        wrongAudioRef.current.currentTime = 0;
        wrongAudioRef.current.play().catch(() => {});
      }
    }

    setTimeout(() => setOverlayClass(""), 800);
    // Swipe: truth = left, myth = right
    setSwipeDir(userAnswer ? "left" : "right");
    setTimeout(() => {
      setShowExplanation(true);
    }, 550);
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      // Reset visual state first (hide explanation + buttons instantly)
      setShowExplanation(false);
      setSwipeDir("");
      setBtnState({ truth: "", myth: "" });
      // Then advance to next question — delay answered reset so buttons
      // don't flash back before disappearing
      setTimeout(() => {
        setAnswered(false);
        setCurrentIndex((i) => i + 1);
      }, 20);
    } else {
      setScreen("result");
    }
  };

  const restart = () => {
    setScreen("start");
  };

  /* ---- ADMIN ---- */
  const addQuestion = async () => {
    if (!newText.trim()) return;
    const db = getFirebaseDb();
    const payload = {
      text: stripQuestionPrefix(newText.trim()),
      answer: newAnswer,
      explanation: newExplanation.trim(),
      qFontSize: newQFontSize,
      eFontSize: newEFontSize,
      noAnswer: newNoAnswer,
      createdAt: serverTimestamp(),
    };

    if (db) {
      await addDoc(collection(db, "questions"), payload);
    } else {
      const localQuestion: Question = {
        id: `local-${Date.now()}`,
        text: payload.text,
        answer: payload.answer,
        explanation: payload.explanation,
        qFontSize: payload.qFontSize,
        eFontSize: payload.eFontSize,
        noAnswer: payload.noAnswer,
      };
      setQuestions((prev) => [...prev, localQuestion]);
    }

    setNewText("");
    setNewExplanation("");
    setNewAnswer(true);
    setNewQFontSize(DEFAULT_Q_FONT_SIZE);
    setNewEFontSize(DEFAULT_E_FONT_SIZE);
    setNewNoAnswer(false);
  };

  const deleteQuestion = async (idx: number) => {
    const q = questions[idx];
    if (!q) return;
    const db = getFirebaseDb();
    if (db) {
      await deleteDoc(doc(db, "questions", q.id));
    } else {
      setQuestions((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const clearAll = async () => {
    const db = getFirebaseDb();
    if (db) {
      const snap = await getDocs(collection(db, "questions"));
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } else {
      setQuestions([]);
    }
  };

  const refreshQuestions = async () => {
    const ok = window.confirm("Оновити питання? Поточний список буде замінено базовим.");
    if (!ok) return;
    const db = getFirebaseDb();
    if (db) {
      const colRef = collection(db, "questions");
      const snap = await getDocs(colRef);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      await Promise.all(
        defaultSeedQuestions.map((q) =>
          setDoc(
            doc(colRef, q.id),
            {
              text: q.text,
              answer: q.answer,
              explanation: q.explanation,
              qFontSize: q.qFontSize,
              eFontSize: q.eFontSize,
              noAnswer: q.noAnswer ?? false,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );
    } else {
      setQuestions(defaultSeedQuestions);
    }
    setScreen("start");
    setCurrentIndex(0);
    setScore(0);
    setAnswered(false);
    setShowExplanation(false);
  };

  const openEdit = (idx: number) => {
    const q = questions[idx];
    setEditIndex(idx);
    setEditText(q.text);
    setEditAnswer(q.answer);
    setEditExplanation(q.explanation);
    setEditQFontSize(q.qFontSize ?? DEFAULT_Q_FONT_SIZE);
    setEditEFontSize(q.eFontSize ?? DEFAULT_E_FONT_SIZE);
    setEditNoAnswer(q.noAnswer ?? false);
  };

  const saveEdit = async () => {
    if (editIndex === null) return;
    const q = questions[editIndex];
    if (!q) return;
    const updatePayload = {
      text: stripQuestionPrefix(editText.trim()),
      answer: editAnswer,
      explanation: editExplanation.trim(),
      qFontSize: editQFontSize,
      eFontSize: editEFontSize,
      noAnswer: editNoAnswer,
    };

    const db = getFirebaseDb();
    if (db) {
      await updateDoc(doc(db, "questions", q.id), updatePayload);
    } else {
      setQuestions((prev) =>
        prev.map((item, i) => (i === editIndex ? { ...item, ...updatePayload } : item))
      );
    }
    setEditIndex(null);
  };

  /* ---- RESULT MESSAGE ---- */
  const getResultMessage = () => {
    const total = questions.length;
    if (score === total) return "Неймовiрно! Ти знаєш все!";
    if (score >= total * 0.7) return "Чудовий результат! Ти добре обiзнаний!";
    if (score >= total * 0.4) return "Непоганий результат! Є куди рости.";
    return "Не засмучуйся! Спробуй ще раз.";
  };

  const currentQ = questions[currentIndex];
  const total = questions.length;
  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: gameCSS }} />

      {/* Floating question marks */}
      <div className="question-marks" aria-hidden="true">
        {questionMarks.map((qm, i) => (
          <span
            key={i}
            className={`qm qm-${qm.color}`}
            style={{
              left: qm.left,
              top: qm.top,
              fontSize: qm.size + "px",
              animationDelay: qm.delay,
              animationDuration: qm.dur,
            }}
          >
            ?
          </span>
        ))}
      </div>

      {/* Overlay flash */}
      <div className={`overlay ${overlayClass}`} aria-hidden="true" />

      {/* Confetti container */}
      <div id="confetti-box" ref={confettiRef} aria-hidden="true" />

      {/* Admin toggle */}
      <button
        className="admin-toggle"
        aria-label="Редактор питань"
        onClick={() => setAdminOpen(true)}
      />

      {/* Admin panel */}
      <div className={`admin-panel ${adminOpen ? "open" : ""}`}>
        <div className="admin-inner">
          <div className="admin-header">
            <h2>Редактор питань</h2>
            <button className="admin-close-btn" onClick={() => setAdminOpen(false)}>
              &times;
            </button>
          </div>

          {/* Add form */}
          <div className="admin-form">
            <h3>Додати питання</h3>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Текст питання..."
              rows={3}
            />
            <div className="admin-radio-group">
              <label className="admin-radio">
                <input
                  type="radio"
                  name="new-answer"
                  checked={newAnswer === true}
                  onChange={() => setNewAnswer(true)}
                />
                <span className="radio-label radio-true">Правда</span>
              </label>
              <label className="admin-radio">
                <input
                  type="radio"
                  name="new-answer"
                  checked={newAnswer === false}
                  onChange={() => setNewAnswer(false)}
                />
                <span className="radio-label radio-false">Мiф</span>
              </label>
            </div>
            <label className="skip-toggle">
              <input
                type="checkbox"
                checked={newNoAnswer}
                onChange={(e) => setNewNoAnswer(e.target.checked)}
              />
              <span>Тiльки кнопка "Далi" (без Правда/Мiф)</span>
            </label>
            <div className="hl-toolbar">
              <span>Виділення:</span>
              <button type="button" className="hl-btn hl-green" onClick={() => wrapSelection(newExplRef, newExplanation, setNewExplanation, "#22c55e")}>Зелений</button>
              <button type="button" className="hl-btn hl-red"   onClick={() => wrapSelection(newExplRef, newExplanation, setNewExplanation, "#ef4444")}>Червоний</button>
              <button type="button" className="hl-btn hl-clear" onClick={() => wrapSelection(newExplRef, newExplanation, setNewExplanation, null)}>Зняти</button>
            </div>
            <textarea
              ref={newExplRef}
              value={newExplanation}
              onChange={(e) => setNewExplanation(e.target.value)}
              placeholder="Пояснення (чому це правда або мiф)..."
              rows={3}
            />
            <div className="edit-size-section">
              <label>
                <span className="size-label">Розмiр питання</span>
                <div className="size-btns">
                  <button type="button" className="size-btn" onClick={() => setNewQFontSize((s) => Math.max(1, +(s - 0.25).toFixed(2)))}>−</button>
                  <span className="size-value">{newQFontSize.toFixed(2)}</span>
                  <button type="button" className="size-btn" onClick={() => setNewQFontSize((s) => Math.min(5, +(s + 0.25).toFixed(2)))}>+</button>
                </div>
              </label>
              <label>
                <span className="size-label">Розмiр вiдповiдi</span>
                <div className="size-btns">
                  <button type="button" className="size-btn" onClick={() => setNewEFontSize((s) => Math.max(0.75, +(s - 0.25).toFixed(2)))}>−</button>
                  <span className="size-value">{newEFontSize.toFixed(2)}</span>
                  <button type="button" className="size-btn" onClick={() => setNewEFontSize((s) => Math.min(4, +(s + 0.25).toFixed(2)))}>+</button>
                </div>
              </label>
            </div>
            <button className="admin-add-btn" onClick={addQuestion}>
              Додати питання
            </button>
          </div>

          {/* Questions list */}
          <div className="admin-list-header">
            <h3>Мої питання</h3>
            <span className="question-count">{questions.length}</span>
          </div>
          <div className="admin-questions-list">
            {questions.length === 0 ? (
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.85rem", textAlign: "center", padding: "1rem 0" }}>
                Поки що пусто
              </p>
            ) : (
              questions.map((q, i) => (
                <div className="admin-q-item" key={q.id}>
                  <span className="q-num">{i + 1}</span>
                  <div className="q-content">
                    <p className="q-text-item">{stripQuestionPrefix(q.text)}</p>
                    <div className="q-meta">
                      <span className={`q-badge ${q.answer ? "q-badge-true" : "q-badge-false"}`}>
                        {q.answer ? "Правда" : "Мiф"}
                      </span>
                    </div>
                    <div className="q-sizes">
                      <span>{"Q: " + ((q.qFontSize ?? 2.5) * QUESTION_FONT_SCALE).toFixed(2) + "rem"}</span>
                      <span>{"A: " + ((q.eFontSize ?? 1.5) * ANSWER_FONT_SCALE).toFixed(2) + "rem"}</span>
                    </div>
                  </div>
                  <button className="q-edit" onClick={() => openEdit(i)} title="Редагувати">
                    &#9998;
                  </button>
                  <button className="q-delete" onClick={() => deleteQuestion(i)} title="Видалити">
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="admin-actions">
            <button className="refresh-btn" onClick={refreshQuestions}>
              Оновити питання
            </button>
            <button className="admin-clear-btn" onClick={clearAll}>
              Видалити всi
            </button>
          </div>
        </div>
      </div>

      {/* ===== START SCREEN ===== */}
      <div className={`screen screen-start ${screen === "start" ? "active" : ""}`}>
        <h1 className="main-title">{"ПРАВДА ЧИ МIФ"}</h1>
        {questions.length > 0 ? (
          <button className="start-btn" onClick={startGame}>
            START
          </button>
        ) : (
          <p className="no-questions-msg">
            {"Додайте питання через редактор (натиснiть на лiвий верхнiй кут)"}
          </p>
        )}
      </div>

      {/* ===== PLAY SCREEN ===== */}
      <div className={`screen screen-play ${screen === "play" ? "active" : ""}`}>
        <div className="question-area">
          {!showExplanation && (
            <div className={`question-card${swipeDir ? " swipe-" + swipeDir : ""}`}>
              <p className="question-text" style={{ fontSize: ((currentQ?.qFontSize ?? 2.5) * QUESTION_FONT_SCALE) + "rem" }}>
                {stripQuestionPrefix(currentQ?.text || "")}
              </p>
            </div>
          )}

          {showExplanation && (
            <div className="explanation-box">
              <p
                className="explanation-text"
                style={{ fontSize: ((currentQ?.eFontSize ?? 1.5) * ANSWER_FONT_SCALE) + "rem" }}
                dangerouslySetInnerHTML={{
                  __html: withAnswerHighlight(currentQ?.explanation || "", currentQ?.answer ?? false, currentQ?.noAnswer),
                }}
              />
            </div>
          )}
        </div>

        {/* Skip-mode: big single Далi button */}
        {currentQ?.noAnswer ? (
          <div className="answer-area">
            <button className="next-only-btn" onClick={nextQuestion}>
              ДАЛI
            </button>
          </div>
        ) : (
          <div className={`answer-area${answered ? " answered" : ""}`}>
            {answered ? (
              <button className="inline-next-btn" onClick={nextQuestion}>
                {currentIndex < questions.length - 1 ? "ДАЛI" : "РЕЗУЛЬТАТ"}
              </button>
            ) : (
              <>
                <button
                  ref={truthBtnRef}
                  className={`answer-btn answer-truth ${btnState.truth}`}
                  disabled={answered}
                  onClick={() => handleAnswer(true)}
                >
                  ПРАВДА
                </button>
                <span className="answer-divider">/</span>
                <button
                  ref={mythBtnRef}
                  className={`answer-btn answer-myth ${btnState.myth}`}
                  disabled={answered}
                  onClick={() => handleAnswer(false)}
                >
                  МIФ
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== RESULT SCREEN ===== */}
      <div className={`screen screen-result ${screen === "result" ? "active" : ""}`}>
        <div className="result-card">
          <h2 className="result-title">Результат</h2>
          <div className="result-score">
            <span className="result-num">{score}</span>
            <span className="result-total">{" / " + total}</span>
          </div>
          <p className="result-message">{getResultMessage()}</p>
          <button className="restart-btn" onClick={restart}>
            Грати знову
          </button>
        </div>
      </div>

      {/* ===== EDIT MODAL ===== */}
      {editIndex !== null && (
        <div className="edit-overlay" onClick={(e) => { if (e.target === e.currentTarget) setEditIndex(null); }}>
          <div className="edit-modal">
            <h3>Редагувати питання</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Текст питання..."
              rows={3}
            />
            <div className="admin-radio-group">
              <label className="admin-radio">
                <input
                  type="radio"
                  name="edit-answer"
                  checked={editAnswer === true}
                  onChange={() => setEditAnswer(true)}
                />
                <span className="radio-label radio-true">Правда</span>
              </label>
              <label className="admin-radio">
                <input
                  type="radio"
                  name="edit-answer"
                  checked={editAnswer === false}
                  onChange={() => setEditAnswer(false)}
                />
                <span className="radio-label radio-false">Мiф</span>
              </label>
            </div>
            <label className="skip-toggle">
              <input
                type="checkbox"
                checked={editNoAnswer}
                onChange={(e) => setEditNoAnswer(e.target.checked)}
              />
              <span>Тiльки кнопка "Далi" (без Правда/Мiф)</span>
            </label>
            <div className="hl-toolbar">
              <span>Виділення:</span>
              <button type="button" className="hl-btn hl-green" onClick={() => wrapSelection(editExplRef, editExplanation, setEditExplanation, "#22c55e")}>Зелений</button>
              <button type="button" className="hl-btn hl-red"   onClick={() => wrapSelection(editExplRef, editExplanation, setEditExplanation, "#ef4444")}>Червоний</button>
              <button type="button" className="hl-btn hl-clear" onClick={() => wrapSelection(editExplRef, editExplanation, setEditExplanation, null)}>Зняти</button>
            </div>
            <textarea
              ref={editExplRef}
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              placeholder="Пояснення..."
              rows={3}
            />
            <div className="edit-size-section">
              <label>
                <span className="size-label">Розмiр питання</span>
                <div className="size-btns">
                  <button type="button" className="size-btn" onClick={() => setEditQFontSize((s) => Math.max(1, +(s - 0.25).toFixed(2)))}>−</button>
                  <span className="size-value">{editQFontSize.toFixed(2)}</span>
                  <button type="button" className="size-btn" onClick={() => setEditQFontSize((s) => Math.min(5, +(s + 0.25).toFixed(2)))}>+</button>
                </div>
              </label>
              <label>
                <span className="size-label">Розмiр вiдповiдi</span>
                <div className="size-btns">
                  <button type="button" className="size-btn" onClick={() => setEditEFontSize((s) => Math.max(0.75, +(s - 0.25).toFixed(2)))}>−</button>
                  <span className="size-value">{editEFontSize.toFixed(2)}</span>
                  <button type="button" className="size-btn" onClick={() => setEditEFontSize((s) => Math.min(4, +(s + 0.25).toFixed(2)))}>+</button>
                </div>
              </label>
            </div>
            <div className="edit-btns">
              <button className="edit-cancel-btn" onClick={() => setEditIndex(null)}>Скасувати</button>
              <button className="edit-save-btn" onClick={saveEdit}>Зберегти</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
