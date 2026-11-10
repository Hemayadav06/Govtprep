import {
  collection,
  db,
  deleteDoc,
  deleteObject,
  doc,
  firebaseConfigured,
  getDocs,
  getDownloadURL,
  limit,
  orderBy,
  query,
  ref,
  serverTimestamp,
  setDoc,
  storage,
  uploadBytes,
  where,
} from "./firebase.js?v=20261110-papers";

const EXAMS = [
  { id: "ssc-cgl", name: "SSC CGL", category: "SSC", sourceName: "Staff Selection Commission", sourceUrl: "https://ssc.gov.in/" },
  { id: "ssc-chsl", name: "SSC CHSL", category: "SSC", sourceName: "Staff Selection Commission", sourceUrl: "https://ssc.gov.in/" },
  { id: "ibps-po", name: "IBPS PO", category: "Banking", sourceName: "Institute of Banking Personnel Selection", sourceUrl: "https://www.ibps.in/" },
  { id: "ibps-clerk", name: "IBPS Clerk", category: "Banking", sourceName: "Institute of Banking Personnel Selection", sourceUrl: "https://www.ibps.in/" },
  { id: "sbi-po", name: "SBI PO", category: "Banking", sourceName: "State Bank of India Careers", sourceUrl: "https://sbi.bank.in/web/careers" },
  { id: "sbi-clerk", name: "SBI Clerk", category: "Banking", sourceName: "State Bank of India Careers", sourceUrl: "https://sbi.bank.in/web/careers" },
  { id: "rrb-ntpc", name: "Railway RRB NTPC", category: "Railway", sourceName: "Railway Recruitment Board", sourceUrl: "https://www.rrbcdg.gov.in/" },
  { id: "rrb-group-d", name: "Railway Group D", category: "Railway", sourceName: "Railway Recruitment Board", sourceUrl: "https://www.rrbcdg.gov.in/" },
  { id: "appsc-group-1", name: "APPSC Group 1", category: "State PSC", sourceName: "Andhra Pradesh Public Service Commission", sourceUrl: "https://psc.ap.gov.in/" },
  { id: "appsc-group-2", name: "APPSC Group 2", category: "State PSC", sourceName: "Andhra Pradesh Public Service Commission", sourceUrl: "https://psc.ap.gov.in/" },
  { id: "police-recruitment", name: "Police Recruitment", category: "Police", sourceName: "AP State Level Police Recruitment Board", sourceUrl: "https://slprb.ap.gov.in/UI/recruitments.aspx" },
];
const SUBJECTS = ["Quantitative Aptitude", "Logical Reasoning", "English", "General Awareness", "General Science", "Computer Knowledge", "General Studies", "Current Affairs", "Other"];
const CATEGORIES = [...new Set(EXAMS.map(exam => exam.category))];
const MAX_PDF_SIZE = 25 * 1024 * 1024;

let paperUser = null;
let isPaperAdmin = false;
let papers = [];
let paperAttempts = [];
let activePaperId = null;
let activePaperQuestions = [];
let paperAnswers = {};
let paperQuestionIndex = 0;
let paperTimer = null;
let paperDeadline = 0;
let paperSeconds = 0;
let paperStartedAt = 0;
let paperResult = null;
let paperSubmitting = false;
let paperMode = "list";
let filterExam = "all";
let filterCategory = "all";
let filterYear = "all";
let filterSubject = "all";
let filterSearch = "";
let editingPaperId = "";
let adminQuestionPaperId = "";
let adminQuestions = [];
let onUpdated = () => {};
let onActivity = () => {};
let initialized = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function showMessage(message, type = "success") {
  const region = document.querySelector(".toast-region");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), 3500);
}
function examById(examId) {
  return EXAMS.find(exam => exam.id === examId);
}
function getActivePaper() {
  return papers.find(paper => paper.id === activePaperId) || null;
}
function hasHttpsUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
function formatAttemptDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function appHeading(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">GOVERNMENT EXAM RESOURCES</div><h1>${title}</h1><p class="subheading">${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}
function sortPaperRecords(snapshot) {
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
    .sort((first, second) => second.year - first.year || first.title.localeCompare(second.title));
}

export function initializePreviousPapers(options = {}) {
  onUpdated = options.onUpdated || onUpdated;
  onActivity = options.onActivity || onActivity;
  if (initialized) return;
  initialized = true;
  document.addEventListener("click", event => {
    const target = event.target.closest("[data-paper-action], [data-paper-category]");
    if (!target) return;
    if (target.hasAttribute("data-paper-category")) {
      filterCategory = target.dataset.paperCategory;
      updatePage();
      return;
    }
    void handlePaperAction(target);
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-paper-exam]")) filterExam = event.target.value;
    else if (event.target.matches("[data-paper-year]")) filterYear = event.target.value;
    else if (event.target.matches("[data-paper-subject]")) filterSubject = event.target.value;
    else if (event.target.matches("[data-admin-paper-select]")) {
      adminQuestionPaperId = event.target.value;
      void loadAdminQuestions(adminQuestionPaperId);
      return;
    } else return;
    updatePage();
  });
  document.addEventListener("input", event => {
    if (!event.target.matches("[data-paper-search]")) return;
    filterSearch = event.target.value;
    const results = document.querySelector("[data-paper-results]");
    if (results) results.innerHTML = renderPaperRows();
    const count = document.querySelector("[data-paper-count]");
    if (count) count.textContent = `${filteredPapers().length} papers`;
  });
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-admin-paper-form]")) {
      event.preventDefault();
      void savePaper(event.target);
    } else if (event.target.matches("[data-admin-question-form]")) {
      event.preventDefault();
      void savePaperQuestion(event.target);
    }
  });
}

export async function setPreviousPaperUser(user) {
  if (paperUser?.uid !== user?.uid) {
    stopPaperTimer();
    activePaperId = null;
    activePaperQuestions = [];
    paperAnswers = {};
    paperResult = null;
    paperMode = "list";
    paperSubmitting = false;
  }
  paperUser = user;
  isPaperAdmin = false;
  papers = [];
  paperAttempts = [];
  stopPaperTimer();
  if (!user || !db) {
    onUpdated();
    return;
  }
  try {
    const token = await user.getIdTokenResult();
    if (paperUser?.uid !== user.uid) return;
    isPaperAdmin = token.claims.admin === true;
    await Promise.all([loadPaperCatalog(), loadPaperAttempts()]);
  } catch (error) {
    console.error("Could not load previous-paper data.", error);
    showMessage("Previous-paper data could not be loaded. Check Firestore rules and try again.", "error");
  }
  onUpdated();
}

export async function loadPreviousPaperCatalog() {
  if (!paperUser || !db) return;
  const uid = paperUser.uid;
  try {
    const paperCollection = collection(db, "previousYearPapers");
    const snapshot = isPaperAdmin
      ? await getDocs(paperCollection)
      : await getDocs(query(paperCollection, where("published", "==", true)));
    if (paperUser?.uid !== uid) return;
    papers = sortPaperRecords(snapshot);
    if (!papers.some(paper => paper.id === activePaperId)) activePaperId = null;
    if (isPaperAdmin && !adminQuestionPaperId) adminQuestionPaperId = papers[0]?.id || "";
  } catch (error) {
    console.error("Previous-paper catalog refresh failed.", error);
    showMessage("Could not refresh papers. Confirm that the updated Firestore rules are published.", "error");
  }
  onUpdated();
}

async function loadPaperAttempts() {
  if (!paperUser || !db) return;
  const uid = paperUser.uid;
  const snapshot = await getDocs(query(
    collection(db, "paperAttempts", uid, "attempts"),
    orderBy("attemptedAt", "desc"),
    limit(30),
  ));
  if (paperUser?.uid !== uid) return;
  paperAttempts = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function filteredPapers() {
  const term = filterSearch.trim().toLowerCase();
  return papers.filter(paper => {
    const exam = examById(paper.examId);
    const text = `${paper.title} ${paper.examName} ${exam?.name || ""} ${paper.subject} ${paper.sourceName} ${paper.year}`.toLowerCase();
    return (filterExam === "all" || paper.examId === filterExam) &&
      (filterCategory === "all" || paper.category === filterCategory) &&
      (filterYear === "all" || String(paper.year) === filterYear) &&
      (filterSubject === "all" || paper.subject === filterSubject) &&
      (!term || text.includes(term));
  });
}

function renderPaperRows() {
  const result = filteredPapers();
  if (!paperUser) return `<div class="card paper-empty"><strong>No papers have been published on GovtPrep yet.</strong><p>Check the official source portals above. Sign in to access any published papers and save your practice attempts.</p><a class="button small" href="#/login">Sign in with Google</a></div>`;
  if (result.length) return result.map(paper => {
    const exam = examById(paper.examId);
    return `<article class="card paper-card"><div class="paper-card-top"><span class="paper-category-tag">${escapeHtml(paper.category)}</span><span>${paper.year}</span></div><h3>${escapeHtml(paper.title)}</h3><p>${escapeHtml(exam?.name || paper.examName)} · ${escapeHtml(paper.subject)}</p><p class="paper-source">Source: <a href="${escapeHtml(paper.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.sourceName)} ↗</a></p><div class="paper-actions"><button class="button small" type="button" data-paper-action="view" data-paper-id="${paper.id}" ${paper.pdfUrl ? "" : "disabled"}>View PDF</button>${paper.pdfUrl ? `<a class="button secondary small" href="${escapeHtml(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer" download>Download PDF</a>` : `<span class="paper-unavailable-label">PDF unavailable</span>`}${paper.answerKeyUrl ? `<a class="text-link" href="${escapeHtml(paper.answerKeyUrl)}" target="_blank" rel="noopener noreferrer">Answer key ↗</a>` : `<span class="paper-muted">Answer key unavailable</span>`}<button class="button secondary small" type="button" data-paper-action="practice" data-paper-id="${paper.id}" ${Number(paper.questionCount) > 0 ? "" : "disabled"}>${Number(paper.questionCount) > 0 ? `Practice · ${paper.questionCount} questions` : "Online practice unavailable"}</button></div></article>`;
  }).join("");
  if (papers.length && (filterSearch || filterSubject !== "all" || filterYear !== "all")) {
    return `<div class="card paper-empty">No papers match those filters. Try another year, subject or search term.</div>`;
  }
  if (filterExam !== "all") {
    const exam = examById(filterExam);
    return `<div class="card paper-unavailable"><div class="eyebrow">${escapeHtml(exam?.category || "EXAM")}</div><h3>No verified paper available for ${escapeHtml(exam?.name || "this exam")} yet.</h3><p>GovtPrep will show a paper here only after an administrator publishes a real paper with its source and PDF.</p><a class="text-link" href="${escapeHtml(exam?.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer">Check the official ${escapeHtml(exam?.sourceName || "exam")} source ↗</a></div>`;
  }
  return `<div class="card paper-empty"><strong>No verified papers are published yet.</strong><p>Select an exam to see its official source. Papers appear here only after an authorized admin adds a sourced PDF.</p></div>`;
}

function renderSourceList() {
  return `<section class="paper-source-list"><div class="section-title"><div><h2>Official source portals</h2><p>Use official notices and answer keys as the source of truth.</p></div></div><div class="paper-source-grid">${EXAMS.map(exam => `<a class="paper-source-link" href="${exam.sourceUrl}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(exam.category)}</span><strong>${escapeHtml(exam.name)}</strong><small>${escapeHtml(exam.sourceName)} ↗</small></a>`).join("")}</div></section>`;
}

function renderPaperViewer(paper) {
  if (!paper) return "";
  return `<section class="card paper-viewer"><div class="paper-viewer-header"><div><span class="paper-category-tag">${escapeHtml(paper.category)} · ${paper.year}</span><h2>${escapeHtml(paper.title)}</h2><p>Source: <a href="${escapeHtml(paper.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(paper.sourceName)} ↗</a></p></div><button class="icon-button" type="button" data-paper-action="close-viewer" aria-label="Close paper viewer">×</button></div>${paper.pdfUrl ? `<div class="paper-pdf-frame"><iframe src="${escapeHtml(paper.pdfUrl)}#toolbar=1" title="${escapeHtml(paper.title)} PDF viewer"></iframe></div><div class="paper-actions"><a class="button small" href="${escapeHtml(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer" download>Download PDF</a>${paper.answerKeyUrl ? `<a class="button secondary small" href="${escapeHtml(paper.answerKeyUrl)}" target="_blank" rel="noopener noreferrer">Open answer key</a>` : `<span class="paper-muted">No answer key has been published.</span>`}<button class="button secondary small" type="button" data-paper-action="practice" data-paper-id="${paper.id}" ${Number(paper.questionCount) > 0 ? "" : "disabled"}>${Number(paper.questionCount) > 0 ? "Practice online" : "Online practice unavailable"}</button></div>` : `<div class="paper-empty">PDF unavailable. Check the source link above.</div>`}</section>`;
}

function renderAttempts() {
  if (!paperAttempts.length) return `<section class="card section-card paper-attempt-history"><div class="section-title"><div><h2>Previous attempts</h2><p>Your submitted paper practice will appear here.</p></div></div><div class="empty-state">No previous-paper attempts yet.</div></section>`;
  return `<section class="card section-card paper-attempt-history"><div class="section-title"><div><h2>Previous attempts</h2><p>Saved to your student account</p></div></div>${paperAttempts.slice(0, 10).map(attempt => `<div class="history-row"><span class="history-date">${formatAttemptDate(attempt.attemptedAt)}</span><span class="history-copy"><strong>${escapeHtml(attempt.paperTitle)}</strong><small>${escapeHtml(attempt.examName)} · ${attempt.year} · ${attempt.correct}/${attempt.total} correct · ${Math.floor(attempt.elapsedSeconds / 60)} min</small></span><span class="history-score">${attempt.accuracy}%<small>${attempt.score}</small></span></div>`).join("")}</section>`;
}

function renderPaperResult() {
  const result = paperResult;
  if (!result) return "";
  return `<section class="card section-card paper-result"><div class="result-header"><div><div class="eyebrow">PAPER PRACTICE COMPLETE</div><h1>${escapeHtml(result.paperTitle)}</h1><p class="subheading">${escapeHtml(result.examName)} · ${result.year} · ${formatAttemptDate(result.attemptedAt)}</p></div><span class="result-score">${result.accuracy}%<small>accuracy</small></span></div><div class="stats-grid result-stats">${paperStat(result.total, "Questions")}${paperStat(result.correct, "Correct")}${paperStat(result.incorrect, "Incorrect")}${paperStat(result.unanswered, "Unanswered")}${paperStat(result.score, "Score")}${paperStat(`${Math.floor(result.elapsedSeconds / 60)}m ${result.elapsedSeconds % 60}s`, "Time taken")}</div><div class="section-title"><div><h2>Answer review</h2><p>Explanations are shown in English and Telugu-English when supplied.</p></div></div><div class="review-list">${activePaperQuestions.map((question, index) => {
    const selected = result.answers[question.id];
    const isCorrect = selected === question.answerIndex;
    return `<article class="review-item"><div class="review-question-head"><span class="task-tag">QUESTION ${index + 1}</span><span class="${isCorrect ? "review-correct" : selected === undefined ? "review-unanswered" : "review-incorrect"}">${isCorrect ? "Correct" : selected === undefined ? "Unanswered" : "Incorrect"}</span></div><h3>${escapeHtml(question.prompt)}</h3><p class="review-answer"><strong>Your answer:</strong> ${selected === undefined ? "Not answered" : escapeHtml(question.options[selected])}</p><p class="review-answer correct-answer"><strong>Correct answer:</strong> ${escapeHtml(question.options[question.answerIndex])}</p>${question.explanationEnglish ? `<p class="explanation"><strong>Explanation · English:</strong> ${escapeHtml(question.explanationEnglish)}</p>` : ""}${question.explanationTelugu ? `<p class="explanation paper-telugu-explanation"><strong>Explanation · Telugu-English:</strong> ${escapeHtml(question.explanationTelugu)}</p>` : ""}</article>`;
  }).join("")}</div><div class="result-actions"><button class="button secondary" type="button" data-paper-action="back-to-papers">Back to papers</button></div></section>`;
}
function paperStat(value, label) {
  return `<div class="card stat-card"><div class="stat-icon blue">✓</div><div><div class="stat-value">${escapeHtml(value)}</div><div class="stat-label">${escapeHtml(label)}</div></div></div>`;
}

function renderPaperQuiz() {
  const paper = getActivePaper();
  const question = activePaperQuestions[paperQuestionIndex];
  if (!paper || !question) return `<div class="card paper-empty">The question set is not available. Return to the paper list.</div>`;
  return `${appHeading("Online paper practice", `${paper.examName} · ${paper.year} · ${activePaperQuestions.length} verified questions`, `<button class="button secondary" type="button" data-paper-action="submit-test">Submit paper</button>`)}<section class="card paper-quiz"><div class="mock-topline"><span class="question-number">QUESTION ${paperQuestionIndex + 1} OF ${activePaperQuestions.length} · ${escapeHtml(question.subject || paper.subject)}</span><div class="timer ${paperSeconds <= 60 ? "urgent" : ""}" data-paper-timer>${formatTimer(paperSeconds)}</div></div><div class="mock-progress"><div class="progress-fill" style="width:${((paperQuestionIndex + 1) / activePaperQuestions.length) * 100}%"></div></div><h2 class="question-prompt">${escapeHtml(question.prompt)}</h2><div class="answers">${question.options.map((option, index) => `<button type="button" class="answer-option ${paperAnswers[question.id] === index ? "selected" : ""}" data-paper-action="answer" data-answer-index="${index}"><span class="option-letter">${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join("")}</div><div class="mock-footer"><button type="button" class="button secondary small" data-paper-action="previous-question" ${paperQuestionIndex === 0 ? "disabled" : ""}>← Previous</button><span class="muted">${Object.keys(paperAnswers).length} of ${activePaperQuestions.length} answered</span><button type="button" class="button small" data-paper-action="next-question" ${paperQuestionIndex === activePaperQuestions.length - 1 ? "disabled" : ""}>Next →</button></div><div class="question-palette">${activePaperQuestions.map((item, index) => `<button type="button" class="palette-dot ${paperQuestionIndex === index ? "current" : ""} ${paperAnswers[item.id] !== undefined ? "answered" : ""}" data-paper-action="jump-question" data-question-index="${index}" aria-label="Go to question ${index + 1}">${index + 1}</button>`).join("")}</div><p class="paper-practice-note">Timer starts with the first question. Answers and review are saved when you submit.</p></section>`;
}
function formatTimer(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function examFilterOptions() {
  return EXAMS.map(exam => `<option value="${exam.id}" ${filterExam === exam.id ? "selected" : ""}>${escapeHtml(exam.name)}</option>`).join("");
}
function renderPaperFilters() {
  const years = [...new Set(papers.map(paper => String(paper.year)))].sort((a, b) => Number(b) - Number(a));
  return `<div class="paper-filter-bar"><input class="search-input" type="search" value="${escapeHtml(filterSearch)}" placeholder="Search papers, exam or source..." aria-label="Search question papers" data-paper-search><select class="form-input" aria-label="Select exam" data-paper-exam><option value="all">All exams</option>${examFilterOptions()}</select><select class="form-input" aria-label="Filter by year" data-paper-year><option value="all">All years</option>${years.map(year => `<option value="${year}" ${filterYear === year ? "selected" : ""}>${year}</option>`).join("")}</select><select class="form-input" aria-label="Filter by subject" data-paper-subject><option value="all">All subjects</option>${SUBJECTS.map(subject => `<option value="${subject}" ${filterSubject === subject ? "selected" : ""}>${subject}</option>`).join("")}</select></div><div class="filter-row paper-category-filters" role="group" aria-label="Filter by exam category">${["all", ...CATEGORIES].map(category => `<button class="filter-chip ${filterCategory === category ? "active" : ""}" type="button" data-paper-category="${category}" aria-pressed="${filterCategory === category}">${category === "all" ? "All categories" : category}</button>`).join("")}</div>`;
}

function renderAdminPaperPanel() {
  if (!isPaperAdmin) return "";
  const editing = papers.find(paper => paper.id === editingPaperId);
  const questionPaper = papers.find(paper => paper.id === adminQuestionPaperId);
  return `<details class="card paper-admin-panel" open><summary>Admin · Manage question papers</summary><p class="paper-admin-note">Only your Firebase admin claim can publish or change papers. Verify source rights and accuracy before publishing.</p><form class="paper-admin-form" data-admin-paper-form><input type="hidden" name="paperId" value="${escapeHtml(editing?.id || "")}"><label>Exam<select class="form-input" name="examId" required>${EXAMS.map(exam => `<option value="${exam.id}" ${editing?.examId === exam.id ? "selected" : ""}>${escapeHtml(exam.name)}</option>`).join("")}</select></label><label>Year<input class="form-input" name="year" type="number" min="1990" max="2100" value="${editing?.year || new Date().getFullYear() - 1}" required></label><label>Subject<select class="form-input" name="subject" required>${SUBJECTS.map(subject => `<option value="${subject}" ${editing?.subject === subject ? "selected" : ""}>${subject}</option>`).join("")}</select></label><label>Paper title<input class="form-input" name="title" maxlength="180" value="${escapeHtml(editing?.title || "")}" required></label><label>Source name<input class="form-input" name="sourceName" maxlength="120" value="${escapeHtml(editing?.sourceName || examById(editing?.examId || EXAMS[0].id).sourceName)}" required></label><label>Official source URL<input class="form-input" name="sourceUrl" type="url" value="${escapeHtml(editing?.sourceUrl || examById(editing?.examId || EXAMS[0].id).sourceUrl)}" required></label><label>Paper PDF ${editing?.pdfUrl ? "(optional replacement)" : "(required)"}<input class="form-input" name="pdfFile" type="file" accept="application/pdf,.pdf" ${editing?.pdfUrl ? "" : "required"}></label><label>Answer key PDF (optional)<input class="form-input" name="answerFile" type="file" accept="application/pdf,.pdf"></label><label>Answer key URL (optional)<input class="form-input" name="answerKeyUrl" type="url" value="${escapeHtml(editing?.answerKeyUrl || "")}" placeholder="Official answer key link"></label><label class="paper-publish-toggle"><input type="checkbox" name="published" ${editing?.published !== false ? "checked" : ""}> Publish to students</label><div class="paper-admin-actions"><button class="button small" type="submit">${editing ? "Save changes" : "Add verified paper"}</button>${editing ? `<button class="button secondary small" type="button" data-paper-action="cancel-edit">Cancel edit</button>` : ""}</div></form><div class="paper-admin-list"><h3>Published and draft records</h3>${papers.length ? papers.map(paper => `<div class="paper-admin-row"><span><strong>${escapeHtml(paper.title)}</strong><small>${escapeHtml(paper.examName)} · ${paper.year} · ${paper.published ? "Published" : "Draft"}</small></span><button class="button secondary small" type="button" data-paper-action="edit" data-paper-id="${paper.id}">Edit</button><button class="button secondary small danger-button" type="button" data-paper-action="delete" data-paper-id="${paper.id}">Remove</button></div>`).join("") : `<div class="empty-state">No paper records yet.</div>`}</div><div class="paper-admin-questions"><h3>Add online-practice questions</h3><label>Paper<select class="form-input" data-admin-paper-select><option value="">Select a paper</option>${papers.map(paper => `<option value="${paper.id}" ${adminQuestionPaperId === paper.id ? "selected" : ""}>${escapeHtml(paper.examName)} · ${paper.year} · ${escapeHtml(paper.title)}</option>`).join("")}</select></label>${questionPaper ? `<p class="paper-admin-note">${adminQuestions.length} question${adminQuestions.length === 1 ? "" : "s"} saved. Online practice becomes available when the first question is added.</p><form class="paper-admin-form" data-admin-question-form><input type="hidden" name="paperId" value="${questionPaper.id}"><label>Question<textarea class="form-input" name="prompt" maxlength="1500" required></textarea></label><label>Subject<select class="form-input" name="subject">${SUBJECTS.map(subject => `<option value="${subject}" ${questionPaper.subject === subject ? "selected" : ""}>${subject}</option>`).join("")}</select></label>${[0, 1, 2, 3].map(index => `<label>Option ${String.fromCharCode(65 + index)}<input class="form-input" name="option${index}" maxlength="500" required></label>`).join("")}<label>Correct option<select class="form-input" name="answerIndex"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></label><label>Explanation · English<textarea class="form-input" name="explanationEnglish" maxlength="2000"></textarea></label><label>Explanation · Telugu-English mixed<textarea class="form-input" name="explanationTelugu" maxlength="2000" placeholder="Optional simple Telugu explanation with English terminology"></textarea></label><button class="button small" type="submit">Add question ${adminQuestions.length + 1}</button></form><div class="paper-question-admin-list">${adminQuestions.map(question => `<div class="paper-admin-row"><span><strong>Q${question.questionNumber}. ${escapeHtml(question.prompt)}</strong><small>Correct option ${String.fromCharCode(65 + question.answerIndex)}</small></span><button class="button secondary small danger-button" type="button" data-paper-action="delete-question" data-paper-id="${questionPaper.id}" data-question-id="${question.id}">Remove</button></div>`).join("")}</div>` : `<div class="empty-state">Add or select a paper to enter its sourced questions.</div>`}</div></details>`;
}

export function renderPreviousPapers() {
  if (paperMode === "quiz") return renderPaperQuiz();
  if (paperMode === "result") return `${appHeading("Paper attempt results", "Review your score, correct answers and explanations.")}${renderPaperResult()}`;
  const selectedPaper = getActivePaper();
  const selectedYearCount = filteredPapers().length;
  const adminButton = isPaperAdmin ? `<button class="button secondary small" type="button" data-paper-action="refresh">Refresh catalog</button>` : "";
  const paperCountLabel = isPaperAdmin
    ? `${papers.filter(paper => paper.published).length} published · ${papers.length} total`
    : `${filteredPapers().length} matching`;
  return `${appHeading("Previous Year Question Papers", "Find sourced papers, view PDFs, download answer keys, or attempt verified questions online.", adminButton)}${renderSourceList()}${renderPaperFilters()}<div class="section-title paper-results-heading"><div><h2>Available papers</h2><p data-paper-count>${paperCountLabel}</p></div></div><div class="paper-results-grid" data-paper-results>${renderPaperRows()}</div>${paperMode === "viewer" ? renderPaperViewer(selectedPaper) : ""}${paperUser ? renderAttempts() : ""}${renderAdminPaperPanel()}`;
}

export function appendPaperAttemptDashboard() {
  const root = document.querySelector("#app");
  if (!root || !paperUser) return;
  const section = document.createElement("section");
  section.className = "card section-card dashboard-paper-attempts";
  section.innerHTML = `<div class="section-title"><div><h2>Previous paper attempts</h2><p>${paperAttempts.length ? "Saved to your account" : "Your completed question papers will appear here"}</p></div><a class="text-link" href="#/previous-papers">Browse papers →</a></div>${paperAttempts.length ? paperAttempts.slice(0, 3).map(attempt => `<div class="history-row"><span class="history-date">${formatAttemptDate(attempt.attemptedAt)}</span><span class="history-copy"><strong>${escapeHtml(attempt.paperTitle)}</strong><small>${escapeHtml(attempt.examName)} · ${attempt.year} · ${attempt.correct}/${attempt.total} correct</small></span><span class="history-score">${attempt.accuracy}%<small>${attempt.score}</small></span></div>`).join("") : `<div class="empty-state">Finish a verified paper online to start tracking your results.</div>`}`;
  root.append(section);
}

async function loadAdminQuestions(paperId) {
  adminQuestions = [];
  if (paperId && db && isPaperAdmin) {
    try {
      const snapshot = await getDocs(collection(db, "previousYearPapers", paperId, "questions"));
      adminQuestions = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
        .sort((first, second) => first.questionNumber - second.questionNumber);
    } catch (error) {
      showMessage("Could not load paper questions. Confirm admin Firestore rules.", "error");
    }
  }
  updatePage();
}

async function uploadPdfFile(file, paperId, kind) {
  if (!file) return null;
  if (!storage) throw new Error("Firebase Storage is not configured.");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Upload a PDF file.");
  }
  if (file.size > MAX_PDF_SIZE) throw new Error("PDF files must be 25 MB or smaller.");
  const path = `previousYearPapers/${paperId}/${kind}.pdf`;
  const uploaded = await uploadBytes(ref(storage, path), file, { contentType: "application/pdf" });
  return { path, url: await getDownloadURL(uploaded.ref) };
}

async function savePaper(form) {
  if (!isPaperAdmin || !paperUser) return showMessage("Only authorized admins can publish papers.", "error");
  const data = new FormData(form);
  const exam = examById(String(data.get("examId")));
  const title = String(data.get("title") || "").trim();
  const sourceName = String(data.get("sourceName") || "").trim();
  const sourceUrl = String(data.get("sourceUrl") || "").trim();
  const year = Number(data.get("year"));
  if (!exam || !title || !sourceName || !hasHttpsUrl(sourceUrl) || !Number.isInteger(year) || year < 1990 || year > 2100) {
    return showMessage("Enter a valid exam, paper title, year and HTTPS source.", "error");
  }
  const paperId = String(data.get("paperId") || crypto.randomUUID());
  const previous = papers.find(paper => paper.id === paperId);
  const pdfFile = form.elements.pdfFile.files[0];
  if (!pdfFile && !previous?.pdfUrl) return showMessage("Upload the genuine source PDF before saving this paper.", "error");
  const answerFile = form.elements.answerFile.files[0];
  const answerUrlInput = String(data.get("answerKeyUrl") || "").trim();
  if (answerUrlInput && !hasHttpsUrl(answerUrlInput)) return showMessage("Answer key links must use HTTPS.", "error");
  try {
    const newPdf = await uploadPdfFile(pdfFile, paperId, "question-paper");
    const newAnswer = await uploadPdfFile(answerFile, paperId, "answer-key");
    const paper = {
      examId: exam.id,
      examName: exam.name,
      category: exam.category,
      year,
      subject: String(data.get("subject")),
      title,
      sourceName,
      sourceUrl,
      pdfPath: newPdf?.path || previous?.pdfPath || "",
      pdfUrl: newPdf?.url || previous?.pdfUrl || "",
      answerKeyPath: newAnswer?.path || previous?.answerKeyPath || "",
      answerKeyUrl: newAnswer?.url || answerUrlInput || previous?.answerKeyUrl || "",
      questionCount: Number(previous?.questionCount) || 0,
      published: form.elements.published.checked,
      addedBy: paperUser.uid,
      createdAt: previous?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, "previousYearPapers", paperId), paper, { merge: true });
    editingPaperId = "";
    activePaperId = paperId;
    await loadPreviousPaperCatalog();
    showMessage(paper.published ? "Verified paper published." : "Paper saved as a draft.");
  } catch (error) {
    console.error("Paper upload failed.", error);
    showMessage(error.message || "Could not save this paper. Check Storage and Firestore rules.", "error");
  }
}

async function savePaperQuestion(form) {
  if (!isPaperAdmin || !paperUser) return showMessage("Only authorized admins can add practice questions.", "error");
  const data = new FormData(form);
  const paperId = String(data.get("paperId") || "");
  const paper = papers.find(item => item.id === paperId);
  const prompt = String(data.get("prompt") || "").trim();
  const options = [0, 1, 2, 3].map(index => String(data.get(`option${index}`) || "").trim());
  if (!paper || !prompt || options.some(option => !option)) return showMessage("Select a paper and enter the question with four options.", "error");
  const questionNumber = Math.max(0, ...adminQuestions.map(question => Number(question.questionNumber) || 0)) + 1;
  const questionId = crypto.randomUUID();
  const question = {
    questionNumber,
    subject: String(data.get("subject") || paper.subject),
    prompt,
    options,
    answerIndex: Number(data.get("answerIndex")),
    explanationEnglish: String(data.get("explanationEnglish") || "").trim(),
    explanationTelugu: String(data.get("explanationTelugu") || "").trim(),
    createdAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, "previousYearPapers", paperId, "questions", questionId), question);
    await setDoc(doc(db, "previousYearPapers", paperId), { questionCount: questionNumber, updatedAt: serverTimestamp() }, { merge: true });
    form.reset();
    adminQuestionPaperId = paperId;
    await loadAdminQuestions(paperId);
    await loadPreviousPaperCatalog();
    showMessage("Question and explanations added to the paper.");
  } catch (error) {
    console.error("Paper question save failed.", error);
    showMessage(error.message || "Could not add this question. Check admin Firestore rules.", "error");
  }
}

async function removePaper(paperId) {
  const paper = papers.find(item => item.id === paperId);
  if (!isPaperAdmin || !paper || !window.confirm(`Remove ${paper.title} and its online questions?`)) return;
  try {
    const questions = await getDocs(collection(db, "previousYearPapers", paperId, "questions"));
    await Promise.all(questions.docs.map(question => deleteDoc(question.ref)));
    for (const path of [paper.pdfPath, paper.answerKeyPath].filter(Boolean)) {
      try { await deleteObject(ref(storage, path)); } catch (error) { console.warn("Could not remove a stored paper file.", error); }
    }
    await deleteDoc(doc(db, "previousYearPapers", paperId));
    editingPaperId = "";
    if (activePaperId === paperId) activePaperId = null;
    await loadPreviousPaperCatalog();
    showMessage("Paper and its questions removed.");
  } catch (error) {
    console.error("Paper removal failed.", error);
    showMessage(error.message || "Could not remove this paper.", "error");
  }
}

async function removePaperQuestion(paperId, questionId) {
  if (!isPaperAdmin || !window.confirm("Remove this online-practice question?")) return;
  try {
    await deleteDoc(doc(db, "previousYearPapers", paperId, "questions", questionId));
    const paper = papers.find(item => item.id === paperId);
    const count = Math.max(0, (Number(paper?.questionCount) || 1) - 1);
    await setDoc(doc(db, "previousYearPapers", paperId), { questionCount: count, updatedAt: serverTimestamp() }, { merge: true });
    await loadAdminQuestions(paperId);
    await loadPreviousPaperCatalog();
    showMessage("Question removed.");
  } catch (error) {
    showMessage(error.message || "Could not remove the question.", "error");
  }
}

async function startPaperPractice(paperId) {
  if (!paperUser) return showMessage("Sign in to attempt and save a paper test.", "error");
  const uid = paperUser.uid;
  const paper = papers.find(item => item.id === paperId);
  if (!paper) return;
  try {
    const snapshot = await getDocs(collection(db, "previousYearPapers", paperId, "questions"));
    if (paperUser?.uid !== uid) return;
    const questions = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
      .filter(question => typeof question.prompt === "string" && Array.isArray(question.options) && question.options.length === 4 && Number.isInteger(question.answerIndex) && question.answerIndex >= 0 && question.answerIndex < 4)
      .sort((first, second) => first.questionNumber - second.questionNumber);
    if (!questions.length) return showMessage("Online practice is unavailable for this paper until verified questions are published.", "error");
    activePaperId = paperId;
    activePaperQuestions = questions;
    paperAnswers = {};
    paperQuestionIndex = 0;
    paperResult = null;
    paperMode = "quiz";
    paperStartedAt = Date.now();
    paperSeconds = Math.max(10 * 60, questions.length * 60);
    paperDeadline = Date.now() + paperSeconds * 1000;
    startPaperTimer();
    onActivity();
    updatePage();
  } catch (error) {
    showMessage("Could not load the verified question set. Check Firestore rules.", "error");
  }
}

function startPaperTimer() {
  stopPaperTimer();
  paperTimer = window.setInterval(() => {
    paperSeconds = Math.max(0, Math.ceil((paperDeadline - Date.now()) / 1000));
    const timer = document.querySelector("[data-paper-timer]");
    if (timer) {
      timer.textContent = formatTimer(paperSeconds);
      timer.classList.toggle("urgent", paperSeconds <= 60);
    }
    if (paperSeconds === 0) void submitPaperTest(true);
  }, 1000);
}
function stopPaperTimer() {
  if (paperTimer !== null) window.clearInterval(paperTimer);
  paperTimer = null;
}
async function submitPaperTest(automatic = false) {
  if (!activePaperQuestions.length || paperMode !== "quiz" || paperSubmitting) return;
  if (!automatic && !window.confirm("Submit this paper now? You cannot change answers after submission.")) return;
  stopPaperTimer();
  const paper = getActivePaper();
  if (!paper || !paperUser) return;
  paperSubmitting = true;
  const attemptedAt = new Date();
  const correct = activePaperQuestions.filter(question => paperAnswers[question.id] === question.answerIndex).length;
  const answered = Object.keys(paperAnswers).length;
  const incorrect = activePaperQuestions.filter(question => paperAnswers[question.id] !== undefined && paperAnswers[question.id] !== question.answerIndex).length;
  const unanswered = activePaperQuestions.length - answered;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - paperStartedAt) / 1000));
  const result = {
    id: crypto.randomUUID(),
    uid: paperUser.uid,
    paperId: paper.id,
    examId: paper.examId,
    examName: paper.examName,
    year: paper.year,
    paperTitle: paper.title,
    total: activePaperQuestions.length,
    correct,
    incorrect,
    unanswered,
    score: `${correct} / ${activePaperQuestions.length}`,
    accuracy: Math.round(correct / activePaperQuestions.length * 100),
    answers: { ...paperAnswers },
    elapsedSeconds,
    attemptedAt,
  };
  const attemptUid = paperUser.uid;
  try {
    await setDoc(doc(db, "paperAttempts", attemptUid, "attempts", result.id), {
      ...result,
      attemptedAt: serverTimestamp(),
    });
    if (paperUser?.uid === attemptUid) {
      paperAttempts.unshift(result);
      onActivity();
    }
  } catch (error) {
    console.error("Paper attempt could not be saved.", error);
    showMessage("Your score is ready, but Firestore could not save this attempt. Check your connection and rules.", "error");
  } finally {
    paperSubmitting = false;
  }
  if (paperUser?.uid !== attemptUid) return;
  paperResult = result;
  paperMode = "result";
  updatePage();
  if (automatic) showMessage("Time is up. Your paper was submitted automatically.");
}

async function handlePaperAction(target) {
  const action = target.dataset.paperAction;
  const paperId = target.dataset.paperId;
  if (action === "view") {
    activePaperId = paperId;
    paperMode = "viewer";
    updatePage();
  } else if (action === "close-viewer" || action === "back-to-papers") {
    stopPaperTimer();
    paperMode = "list";
    paperResult = null;
    updatePage();
  } else if (action === "practice") {
    await startPaperPractice(paperId);
  } else if (action === "answer") {
    const question = activePaperQuestions[paperQuestionIndex];
    if (question) paperAnswers[question.id] = Number(target.dataset.answerIndex);
    updatePage();
  } else if (action === "previous-question") {
    paperQuestionIndex = Math.max(0, paperQuestionIndex - 1);
    updatePage();
  } else if (action === "next-question") {
    paperQuestionIndex = Math.min(activePaperQuestions.length - 1, paperQuestionIndex + 1);
    updatePage();
  } else if (action === "jump-question") {
    paperQuestionIndex = Number(target.dataset.questionIndex);
    updatePage();
  } else if (action === "submit-test") {
    await submitPaperTest();
  } else if (action === "refresh") {
    await loadPreviousPaperCatalog();
    showMessage("Paper catalog refreshed.");
  } else if (action === "edit") {
    editingPaperId = paperId;
    adminQuestionPaperId = paperId;
    await loadAdminQuestions(paperId);
    updatePage();
  } else if (action === "cancel-edit") {
    editingPaperId = "";
    updatePage();
  } else if (action === "delete") {
    await removePaper(paperId);
  } else if (action === "delete-question") {
    await removePaperQuestion(paperId, target.dataset.questionId);
  }
}

function updatePage() {
  if (location.hash.startsWith("#/previous-papers")) onUpdated();
  else if (location.hash.startsWith("#/dashboard")) onUpdated();
}
