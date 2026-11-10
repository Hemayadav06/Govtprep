import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  firebaseConfigured,
  firebaseInitError,
  functions,
  getDoc,
  getDocs,
  httpsCallable,
  limit,
  onAuthStateChanged,
  orderBy,
  query,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
} from "./firebase.js?v=20261110-papers";
import {
  appendPaperAttemptDashboard,
  initializePreviousPapers,
  loadPreviousPaperCatalog,
  renderPreviousPapers,
  setPreviousPaperUser,
} from "./previous-papers.js?v=20261110-papers";

const app = document.querySelector("#app");
const pageLabel = document.querySelector("#page-label");
const routes = {
  home: "Home",
  dashboard: "Dashboard",
  exams: "Exam preparation",
  practice: "Practice tests",
  "mock-tests": "Mock tests",
  "previous-papers": "Previous Year Question Papers",
  "current-affairs": "Current affairs",
  "video-classes": "Telugu-English classes",
  planner: "Study planner",
  assistant: "AI study assistant",
  jobs: "Job notifications",
  login: "Welcome back",
  register: "Create your account",
  "reset-password": "Reset your password",
  "reset-password": "Reset your password",
};

let exams = [
  { name: "SSC CGL", area: "Staff Selection Commission", date: "Mar 2027", icon: "SSC", mode: "graduate", detail: "Combined Graduate Level · 12,480+ expected posts" },
  { name: "UPSC Civil Services", area: "Union Public Service Commission", date: "May 2027", icon: "UPSC", mode: "graduate", detail: "Preliminary examination · India's premier civil services" },
  { name: "IBPS PO", area: "Institute of Banking Personnel Selection", date: "Jun 2027", icon: "IBPS", mode: "graduate", detail: "Probationary Officer · 11 participating banks" },
  { name: "RRB NTPC", area: "Railway Recruitment Board", date: "Aug 2027", icon: "RRB", mode: "12th", detail: "Non-Technical Popular Categories · Graduate & 12th level" },
  { name: "APPSC Group 2", area: "Andhra Pradesh Public Service Commission", date: "Sep 2027", icon: "AP", mode: "graduate", detail: "Executive & non-executive posts · Andhra Pradesh" },
  { name: "State Police Constable", area: "State Police Recruitment Board", date: "Nov 2027", icon: "POL", mode: "12th", detail: "Police constable recruitment · Physical & written tests" },
];
let jobs = [
  { title: "SSC CGL 2027 — Combined Graduate Level", organization: "Staff Selection Commission", logo: "SSC", eligibility: "Bachelor's degree", posts: "12,480+ posts", deadline: "Jan 18, 2027", category: "SSC", detail: "Apply online through the official SSC portal. Tier I computer-based examination; age limit varies by post." },
  { title: "UPSC Civil Services Examination 2027", organization: "Union Public Service Commission", logo: "UP", eligibility: "Any graduate · Age 21–32", posts: "933 vacancies", deadline: "Jan 24, 2027", category: "UPSC", detail: "Three-stage selection: Preliminary, Main and Personality Test. Indian citizenship requirements apply to select services." },
  { title: "IBPS Probationary Officers — CRP PO/MT", organization: "Institute of Banking Personnel Selection", logo: "IB", eligibility: "Bachelor's degree", posts: "5,208 vacancies", deadline: "Feb 15, 2027", category: "Banking", detail: "Recruitment for participating public sector banks. Selection includes preliminary, main and interview stages." },
  { title: "RRB NTPC Graduate Level Recruitment", organization: "Railway Recruitment Board", logo: "RR", eligibility: "Bachelor's degree", posts: "8,113 vacancies", deadline: "Feb 28, 2027", category: "Railway", detail: "Posts include Station Master and Goods Train Manager. Selection process includes CBT stages and document verification." },
  { title: "APPSC Group II Services — Notification", organization: "Andhra Pradesh Public Service Commission", logo: "AP", eligibility: "Bachelor's degree · Andhra Pradesh", posts: "897 vacancies", deadline: "Mar 12, 2027", category: "State", detail: "Executive and non-executive posts across Andhra Pradesh state departments. Check the official notification for local-status rules." },
];
const sampleJobs = jobs;
let questions = {
  aptitude: [
    { prompt: "A train 180 metres long passes a pole in 12 seconds. What is its speed?", options: ["45 km/h", "54 km/h", "60 km/h", "64 km/h"], answer: 1, explanation: "Speed = distance ÷ time = 180 ÷ 12 = 15 m/s. Converting to km/h: 15 × 18/5 = 54 km/h." },
    { prompt: "If 25% of a number is 80, what is 40% of that number?", options: ["100", "120", "128", "140"], answer: 2, explanation: "The number is 80 ÷ 0.25 = 320. Therefore, 40% of 320 is 128." },
    { prompt: "A shopkeeper offers 20% off on an item marked ₹1,500. What is the selling price?", options: ["₹1,100", "₹1,200", "₹1,250", "₹1,300"], answer: 1, explanation: "A 20% discount is ₹300. The selling price is ₹1,500 − ₹300 = ₹1,200." },
    { prompt: "The average of 12, 18, 20 and 30 is:", options: ["18", "19", "20", "22"], answer: 2, explanation: "Add the values to get 80, then divide by the 4 values: 80 ÷ 4 = 20." },
    { prompt: "A sum of ₹8,000 earns ₹1,200 simple interest in 3 years. What is the annual rate?", options: ["4%", "5%", "6%", "8%"], answer: 1, explanation: "Using SI = P × R × T / 100, R = (1,200 × 100) ÷ (8,000 × 3) = 5%." },
  ],
  reasoning: [
    { prompt: "Find the next number in the series: 3, 8, 15, 24, 35, ?", options: ["46", "47", "48", "49"], answer: 2, explanation: "The differences are 5, 7, 9, 11, and then 13. So the next number is 35 + 13 = 48." },
    { prompt: "If NORTH is coded as OPSUI, how would SOUTH be coded?", options: ["TPVUI", "TPVTH", "RNTUG", "TPVUH"], answer: 0, explanation: "Each letter shifts forward by one in the alphabet: S→T, O→P, U→V, T→U, H→I." },
    { prompt: "All roses are flowers. Some flowers fade quickly. Which conclusion must be true?", options: ["All roses fade quickly", "Some roses fade quickly", "All roses are flowers", "No flowers are roses"], answer: 2, explanation: "The first statement directly establishes that every rose is a flower. The second does not say whether those flowers are roses." },
    { prompt: "Find the next letter in the series: B, D, G, K, P, ?", options: ["U", "V", "W", "X"], answer: 1, explanation: "The letter positions increase by 2, 3, 4 and 5. Add 6 to P (position 16) to get V (position 22)." },
    { prompt: "Mira is taller than Dev, and Dev is taller than Noor. Who is the shortest?", options: ["Mira", "Dev", "Noor", "Cannot be determined"], answer: 2, explanation: "The order is Mira > Dev > Noor in height, so Noor is the shortest." },
  ],
  english: [
    { prompt: "Choose the word closest in meaning to “diligent.”", options: ["Careless", "Hardworking", "Impatient", "Indifferent"], answer: 1, explanation: "Diligent means showing care and effort in one's work — most closely, hardworking." },
    { prompt: "Choose the grammatically correct sentence.", options: ["Neither of them are ready.", "Neither of them is ready.", "Neither are ready.", "Neither of them were ready."], answer: 1, explanation: "“Neither” is singular and takes a singular verb: “Neither of them is ready.”" },
    { prompt: "Choose the antonym of “expand.”", options: ["Enlarge", "Extend", "Contract", "Increase"], answer: 2, explanation: "To contract is to become smaller; it is the opposite of expand." },
    { prompt: "Fill in the blank: She has been preparing ___ the examination for six months.", options: ["at", "for", "on", "with"], answer: 1, explanation: "The correct collocation is “prepare for” an examination." },
    { prompt: "Choose the correctly spelled word.", options: ["Accomodation", "Acommodation", "Accommodation", "Acomodation"], answer: 2, explanation: "Accommodation is spelled with a double c and a double m." },
  ],
  gk: [
    { prompt: "Which article of the Indian Constitution guarantees equality before the law?", options: ["Article 12", "Article 14", "Article 19", "Article 21"], answer: 1, explanation: "Article 14 guarantees equality before the law and equal protection of the laws within the territory of India." },
    { prompt: "The Reserve Bank of India was established in which year?", options: ["1930", "1935", "1947", "1949"], answer: 1, explanation: "The RBI commenced operations on 1 April 1935 under the Reserve Bank of India Act, 1934." },
    { prompt: "Which body is responsible for conducting elections to the Lok Sabha?", options: ["Union Public Service Commission", "Election Commission of India", "Parliament Secretariat", "Supreme Court"], answer: 1, explanation: "The Election Commission of India is a constitutional body responsible for administering elections to Parliament and state legislatures." },
    { prompt: "The Directive Principles of State Policy are contained in which part of the Constitution?", options: ["Part III", "Part IV", "Part IVA", "Part V"], answer: 1, explanation: "Directive Principles of State Policy are contained in Part IV, Articles 36 to 51, of the Indian Constitution." },
    { prompt: "Which is the largest state in India by area?", options: ["Madhya Pradesh", "Maharashtra", "Rajasthan", "Uttar Pradesh"], answer: 2, explanation: "Rajasthan is India's largest state by area, covering approximately 342,239 square kilometres." },
  ],
  science: [
    { prompt: "What is the SI unit of electric current?", options: ["Volt", "Ohm", "Ampere", "Watt"], answer: 2, explanation: "Electric current is measured in amperes (A), named after physicist André-Marie Ampère." },
    { prompt: "Which part of a plant cell carries out photosynthesis?", options: ["Mitochondrion", "Chloroplast", "Nucleus", "Ribosome"], answer: 1, explanation: "Chloroplasts contain chlorophyll, which captures light energy for photosynthesis." },
    { prompt: "At standard atmospheric pressure, water boils at what temperature?", options: ["90°C", "95°C", "100°C", "110°C"], answer: 2, explanation: "At one standard atmosphere of pressure, pure water boils at 100°C (212°F)." },
    { prompt: "Which vitamin is produced in the skin when exposed to sunlight?", options: ["Vitamin A", "Vitamin B12", "Vitamin C", "Vitamin D"], answer: 3, explanation: "Ultraviolet B radiation helps the skin synthesise vitamin D, which supports calcium absorption." },
    { prompt: "Which blood cells help the body fight infections?", options: ["Red blood cells", "White blood cells", "Platelets", "Plasma cells only"], answer: 1, explanation: "White blood cells, also called leukocytes, are key components of the immune system." },
  ],
  computer: [
    { prompt: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Primary Utility", "Central Program Upload", "Core Processing User"], answer: 0, explanation: "CPU stands for Central Processing Unit, the main processor that executes program instructions." },
    { prompt: "Which of these is volatile computer memory?", options: ["ROM", "Hard disk", "RAM", "Flash drive"], answer: 2, explanation: "Random Access Memory (RAM) is volatile: its contents are generally lost when power is switched off." },
    { prompt: "What does URL stand for?", options: ["Universal Reference Link", "Uniform Resource Locator", "Unified Routing Language", "User Resource List"], answer: 1, explanation: "A URL (Uniform Resource Locator) is the address used to locate a resource on the internet." },
    { prompt: "Which keyboard shortcut commonly copies selected text in Windows?", options: ["Ctrl + X", "Ctrl + V", "Ctrl + C", "Ctrl + Z"], answer: 2, explanation: "Ctrl + C copies selected content; Ctrl + X cuts it, Ctrl + V pastes, and Ctrl + Z undoes." },
    { prompt: "Which digits are used in the binary number system?", options: ["0 and 1", "1 and 2", "0 through 7", "0 through 9"], answer: 0, explanation: "Binary is a base-2 number system and uses only the digits 0 and 1." },
  ],
};
const practiceSubjects = [
  { id: "aptitude", label: "Quantitative Aptitude", icon: "%", color: "blue" },
  { id: "reasoning", label: "Logical Reasoning", icon: "⌘", color: "purple" },
  { id: "english", label: "English", icon: "Aa", color: "green" },
  { id: "gk", label: "General Knowledge", icon: "◉", color: "orange" },
  { id: "science", label: "General Science", icon: "⚗", color: "blue" },
  { id: "computer", label: "Computer Knowledge", icon: "▣", color: "purple" },
];
const videoSubjects = [
  { id: "aptitude", label: "Quantitative Aptitude" },
  { id: "reasoning", label: "Logical Reasoning" },
  { id: "english", label: "English" },
  { id: "gk", label: "General Knowledge" },
  { id: "science", label: "General Science" },
  { id: "computer", label: "Computer Awareness" },
  { id: "current-affairs", label: "Current Affairs" },
];
const videoLessons = [
  { id: "HSByvHGp8tY", subject: "aptitude", topic: "Time and Work · Core concepts", level: "beginner", title: "Time Work Short Tricks in Telugu Part 1 | Concepts & Problems", channel: "Ramesh Sir Maths Class", views: "840K views", note: "Work rate, efficiency and LCM method explained in Telugu.", trick: "Set total work to the LCM of the given days; each worker's one-day rate is total work divided by their days." },
  { id: "g3kaopXpx-o", subject: "aptitude", topic: "Time and Work · Six problem types", level: "advanced", title: "Time Work Short Tricks in Telugu Part 2 | Concepts & Six Types", channel: "Ramesh Sir Maths Class", views: "249K views", note: "Practice six common question patterns and faster methods.", trick: "Add the workers' one-day rates first, then take the reciprocal to get the days needed together." },
  { id: "JyFj_42X5jw", subject: "reasoning", topic: "Syllogism · Fundamentals to advanced", level: "intermediate", title: "Syllogism Reasoning in One Video | Basic to Advance", channel: "Adda247 Telugu", views: "237K views", note: "Understand statements, Venn diagrams and conclusions.", trick: "Draw a small Venn diagram and accept only conclusions that must be true." },
  { id: "HXSGB2SEuLU", subject: "reasoning", topic: "Syllogism · Short tricks", level: "advanced", title: "Syllogism Part 1 | Best Short Tricks for SSC, Bank, RRB & State Exams", channel: "Chandan Logics - TELUGU", views: "880K views", note: "Use shortcut methods to evaluate exam-style conclusions.", trick: "Put every 'All A are B' statement in the form A inside B; do not turn 'some' into 'all'." },
  { id: "7ev_avmZ7D0", subject: "english", topic: "English grammar · Tenses Part 1", level: "beginner", title: "Tenses Part 1 | English Grammar in Telugu", channel: "Jan's English Academy", views: "2.2M views", note: "Learn tense forms with Telugu explanations and English examples.", trick: "Underline the time marker first, then match it to the verb form." },
  { id: "KutwQyGCFFU", subject: "english", topic: "English grammar · Tenses Part 2", level: "intermediate", title: "Tenses Part 2 | English Grammar in Telugu", channel: "Jan's English Academy", views: "1M views", note: "Continue with tense usage and exam-focused examples.", trick: "For perfect tenses, check the helping verb and past participle as a pair." },
  { id: "MNskrudG7NY", subject: "gk", topic: "Indian Polity · Full class", level: "intermediate", title: "Indian Polity Complete Class for SSC, RRB, APPSC & TSPSC", channel: "Chandan Logics", views: "92K views", note: "Build a structured understanding of Indian Polity for government exams.", trick: "Compare similar institutions in a table: article, term, composition and key power." },
  { id: "EX0Snlvv3tk", subject: "science", topic: "General Science · Concepts and questions", level: "beginner", title: "General Science 1000 Questions | TSPSC, APPSC & Police Exams", channel: "Entri App తెలుగు", views: "405K views", note: "A Telugu class with practical questions across the science syllabus.", trick: "Try recalling the rule before checking the answer, then connect it to one everyday example." },
  { id: "xovAh2Snrlk", subject: "science", topic: "General Science · Top 1000 questions", level: "advanced", title: "General Science Top 1000 Questions | TSPSC, APPSC & Police", channel: "Entri App తెలుగు", views: "558K views", note: "Use rapid question practice to revise key concepts and facts.", trick: "Eliminate options using units and basic facts, then revisit the concept behind each miss." },
  { id: "fxhgbdNEf3M", subject: "computer", topic: "Computer Awareness · Rapid revision", level: "intermediate", title: "Computer Awareness Rapid Revision for RRB, SSC, Bank & Govt Exams", channel: "Chandan Logics", views: "12K views", note: "Review common computer-awareness terms and expected questions.", trick: "Expand each acronym once and link it to its job; CPU processes instructions, RAM holds working data." },
  { id: "utq_A_PmgaY", subject: "current-affairs", topic: "Daily Current Affairs · 7–9 November 2026", level: "intermediate", title: "Daily Current Affairs in Telugu | Praveen Sir | 7–9 November 2026", channel: "PRAVEEN SIR CLASSES", views: "21K views", note: "Recent GK and current updates; verify changing facts from official sources.", trick: "Recall each update with four prompts: what happened, where, why, and exam relevance." },
];
let questionBank = Object.entries(questions).flatMap(([subject, items]) =>
  items.map((question, index) => ({ ...question, id: `${subject}-${index + 1}`, subject }))
);
const MOCK_QUESTION_COUNT = 25;
const news = [
  { tag: "POLICY", date: "Today · 8:30 AM", title: "Union Cabinet approves new National Mission for Clean Energy", text: "The Cabinet has approved a five-year mission to accelerate domestic manufacturing of solar modules and green hydrogen technology. The initiative includes a ₹10,000 crore outlay.", more: "For exam preparation: focus on the policy objectives, nodal ministries, funding mechanism and India’s renewable energy targets." },
  { tag: "ECONOMY", date: "Today · 7:15 AM", title: "RBI keeps repo rate unchanged in latest Monetary Policy Committee review", text: "The Reserve Bank of India maintained the policy repo rate at 5.50%, citing stable inflation and a resilient domestic growth outlook.", more: "For exam preparation: revise the monetary policy corridor, the RBI’s inflation target and the role of the Monetary Policy Committee." },
  { tag: "INTERNATIONAL", date: "Yesterday", title: "India and ASEAN strengthen cooperation on digital public infrastructure", text: "Member nations announced a new working group to expand cooperation on digital payments, cybersecurity and cross-border technology.", more: "For exam preparation: revise ASEAN membership, India’s Act East Policy and the key outcomes of bilateral and multilateral summits." },
  { tag: "SCIENCE", date: "Yesterday", title: "ISRO successfully tests next-generation semi-cryogenic engine", text: "The successful long-duration test marks an important milestone in the development of higher-capacity launch vehicles for future space missions.", more: "For exam preparation: review India’s launch vehicle programme, engine types and the role of the Liquid Propulsion Systems Centre." },
];
const quickLinks = [
  { icon: "◎", color: "blue", label: "Daily practice", detail: "12 questions · 15 min", route: "practice" },
  { icon: "◷", color: "purple", label: "Mock test", detail: "SSC CGL · 60 min", route: "mock-tests" },
  { icon: "▦", color: "green", label: "Study planner", detail: "Keep on track", route: "planner" },
  { icon: "✳", color: "orange", label: "Ask AI assistant", detail: "Get unstuck faster", route: "assistant" },
];
const examSymbols = ["▤", "◈", "▥", "⌁", "▧", "✦"];
let activePracticeCategory = "aptitude";
let activeVideoId = videoLessons[0].id;
let videoSubjectFilter = "all";
let videoLevelFilter = "all";
let videoStatusFilter = "all";
let videoChannelFilter = "all";
let videoSearchTerm = "";
let practiceIndex = 0;
let practiceQuestionSet = [];
let practiceAnswers = {};
let practiceStartedAt = 0;
let practiceResult = null;
let practiceIsDaily = false;
let mockIndex = 0;
let activeMockQuestions = [];
let mockAnswers = {};
let mockSeconds = 30 * 60;
let mockTimer = null;
let mockDeadline = 0;
let mockStartedAt = 0;
let mockResult = null;
let selectedPlannerDay = (new Date().getDay() + 6) % 7;
let selectedJobCategory = "All";
let jobSearchTerm = "";
let jobCatalogSource = "sample";
let jobLastUpdatedAt = null;
let jobRefreshInProgress = false;
let lastRenderedPage = null;
let currentUser = null;
let studentProfile = { displayName: "Arjun Sharma", targetExam: "SSC CGL", studyGoal: "" };
let assistantView = "chat";
let assistantConversationId = null;
let assistantConversations = [];
let assistantMessages = [];
let assistantBookmarks = [];
let assistantBusy = false;
let assistantError = "";
let assistantQuestions = [];
let assistantRecommendations = [];
let assistantGenerating = false;
let assistantQuestionOptions = { subject: "aptitude", difficulty: "medium", count: 5, language: "en" };

const privateStorageKeys = new Set([
  "govtprep-tasks",
  "govtprep-tasks-date",
  "govtprep-test-history",
  "govtprep-bookmarked-questions",
  "govtprep-planner",
  "govtprep-profile",
  "govtprep-saved-jobs",
  "govtprep-news-saved",
  "govtprep-activity-days",
  "govtprep-video-bookmarks",
  "govtprep-video-completed",
]);
function storageKey(key) {
  return currentUser && privateStorageKeys.has(key) ? `govtprep:${currentUser.uid}:${key}` : key;
}

function readStorage(key, fallback) {
  try { const value = localStorage.getItem(storageKey(key)); return value === null ? fallback : JSON.parse(value); } catch { return fallback; }
}
function writeStorage(key, value) {
  try { localStorage.setItem(storageKey(key), JSON.stringify(value)); } catch { showToast("Your browser couldn't save this change.", "error"); }
}
function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function getDashboardTasks() {
  const today = localDateKey(new Date());
  const savedDay = readStorage("govtprep-tasks-date", null);
  const savedTasks = readStorage("govtprep-tasks", [false, false, false]);
  const tasks = Array.isArray(savedTasks) && savedTasks.length === 3 ? savedTasks : [false, false, false];
  if (savedDay && savedDay !== today) {
    tasks.fill(false);
    writeStorage("govtprep-tasks", tasks);
  }
  if (savedDay !== today) writeStorage("govtprep-tasks-date", today);
  return tasks;
}
function recordStudyActivity() {
  const activityDays = readStorage("govtprep-activity-days", []);
  const days = Array.isArray(activityDays) ? activityDays : [];
  const today = localDateKey(new Date());
  if (!days.includes(today)) writeStorage("govtprep-activity-days", [...days, today]);
  updateAuthChrome();
}
function getStudyStreak() {
  const storedDays = readStorage("govtprep-activity-days", []);
  const activityDays = new Set(Array.isArray(storedDays) ? storedDays : []);
  let date = new Date();
  if (!activityDays.has(localDateKey(date))) date.setDate(date.getDate() - 1);
  let streak = 0;
  while (activityDays.has(localDateKey(date))) {
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}
function getWeeklyPracticeSeconds(history) {
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  return history.reduce((total, result) => {
    const completedAt = new Date(result.completedAt);
    const elapsedSeconds = Number(result.elapsedSeconds);
    return Number.isFinite(completedAt.getTime()) && completedAt >= weekStart && Number.isFinite(elapsedSeconds)
      ? total + Math.max(0, elapsedSeconds)
      : total;
  }, 0);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.querySelector(".toast-region").append(toast);
  window.setTimeout(() => toast.remove(), 3000);
}
function statCard(icon, color, value, label) {
  const valueAttribute = label === "Focus tasks done today" ? "data-today-task-count" : "";
  return `<div class="card stat-card"><div class="stat-icon ${color}">${icon}</div><div><div class="stat-value" ${valueAttribute}>${value}</div><div class="stat-label">${label}</div></div></div>`;
}
function pageHeading(title, description, actions = "") {
  return `<div class="page-heading"><div><div class="eyebrow">YOUR PREPARATION, YOUR PACE</div><h1>${title}</h1><p class="subheading">${description}</p></div>${actions ? `<div class="heading-actions">${actions}</div>` : ""}</div>`;
}
function heading(name) {
  pageLabel.textContent = routes[name] || "Dashboard";
  document.title = `${routes[name] || "Dashboard"} — GovtPrep`;
}
function navigate(name) {
  if (location.hash === `#/${name}`) render();
  else location.hash = `/${name}`;
}
function updateAuthChrome() {
  const signedIn = Boolean(currentUser);
  const name = studentProfile.displayName || currentUser?.displayName || currentUser?.email || "Student";
  const exam = studentProfile.targetExam || "Choose a target exam";
  const streak = getStudyStreak();
  document.querySelector("[data-profile-name]").textContent = signedIn ? name : "Arjun Sharma";
  document.querySelector("[data-profile-exam]").textContent = signedIn ? `${exam} aspirant` : "SSC CGL aspirant";
  document.querySelector("[data-profile-avatar]").textContent = (name.trim()[0] || "S").toUpperCase();
  document.querySelector("[data-profile-avatar]").setAttribute("aria-label", name);
  document.querySelector("[data-profile]").href = signedIn ? "#/dashboard" : "#/login";
  document.querySelector("[data-profile-button]").textContent = (name.trim()[0] || "S").toUpperCase();
  document.querySelector("[data-profile-button]").setAttribute("aria-label", signedIn ? `${name}'s dashboard` : "Open sign in");
  document.querySelector(".streak-pill").innerHTML = `<span>✦</span> ${streak} day${streak === 1 ? "" : "s"} streak`;
  document.querySelector("[data-auth-login]").hidden = signedIn;
  document.querySelector("[data-logout]").hidden = !signedIn;
}
function firebaseErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists for this email. Try signing in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect. Check your details and try again.",
    "auth/user-disabled": "This account has been disabled. Contact the project administrator.",
    "auth/user-not-found": "No account was found for this email. Create an account or check the address.",
    "auth/wrong-password": "The email or password is incorrect. Try again or reset your password.",
    "auth/weak-password": "Choose a stronger password with at least six characters.",
    "auth/too-many-requests": "Too many attempts. Wait a little while and try again.",
    "auth/network-request-failed": "Firebase could not connect. Check your internet connection and try again.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication.",
    "auth/unauthorized-domain": "This website's domain is not authorized in Firebase Authentication settings.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled before it finished.",
    "auth/missing-email": "Enter your email address to continue.",
    "permission-denied": "Firebase denied this request. Check the published Firestore rules and signed-in account.",
    "unavailable": "Firebase is temporarily unavailable. Check your connection and try again.",
  };
  return messages[error?.code] || `Firebase request failed: ${error?.message || "Unexpected error."}`;
}
function reportFirebaseError(error, context) {
  console.error(`${context}:`, error);
  showToast(firebaseErrorMessage(error), "error");
}
function catalogText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}
function applyCloudCatalogs(examDocuments, questionDocuments, jobDocuments) {
  let rejected = 0;
  const cloudExams = examDocuments.map(snapshot => {
    const data = snapshot.data();
    if (!catalogText(data.name, 120) || !catalogText(data.area, 150) ||
      !catalogText(data.date, 40) || !catalogText(data.icon, 12) ||
      !catalogText(data.detail, 300) || !["graduate", "12th"].includes(data.mode)) return null;
    return { name: data.name, area: data.area, date: data.date, icon: data.icon, detail: data.detail, mode: data.mode };
  });
  if (cloudExams.length) {
    const validExams = cloudExams.filter(Boolean);
    rejected += cloudExams.length - validExams.length;
    if (validExams.length) exams = validExams;
  }
  const cloudQuestions = Object.fromEntries(Object.keys(questions).map(subject => [subject, []]));
  for (const snapshot of questionDocuments) {
    const data = snapshot.data();
    if (!Object.hasOwn(cloudQuestions, data.subject) || !catalogText(data.prompt, 1000) ||
      !catalogText(data.explanation, 2000) || !Array.isArray(data.options) ||
      data.options.length !== 4 || data.options.some(option => !catalogText(option, 300)) ||
      !Number.isInteger(data.answer) || data.answer < 0 || data.answer > 3) {
      rejected += 1;
      continue;
    }
    cloudQuestions[data.subject].push({
      id: snapshot.id,
      subject: data.subject,
      prompt: data.prompt,
      options: data.options,
      answer: data.answer,
      explanation: data.explanation,
    });
  }
  for (const [subject, items] of Object.entries(cloudQuestions)) {
    if (items.length) {
      questions[subject] = [
        ...items,
        ...questions[subject].filter(sample => !items.some(question => question.prompt === sample.prompt)),
      ];
    }
  }
  questionBank = Object.entries(questions).flatMap(([subject, items]) =>
    items.map((question, index) => ({
      ...question,
      id: question.id || `${subject}-${index + 1}`,
      subject,
    }))
  );
  const cloudJobs = jobDocuments.map(snapshot => {
    const data = snapshot.data();
    if (!catalogText(data.title, 180) || !catalogText(data.organization, 150) ||
      !catalogText(data.logo, 12) || !catalogText(data.eligibility, 180) ||
      !catalogText(data.posts, 60) || !catalogText(data.deadline, 60) ||
      !catalogText(data.category, 40) || !catalogText(data.detail, 1000)) return null;
    return {
      title: data.title, organization: data.organization, logo: data.logo,
      eligibility: data.eligibility, posts: data.posts, deadline: data.deadline,
      category: data.category, detail: data.detail,
    };
  });
  if (cloudJobs.length) {
    const validJobs = cloudJobs.filter(Boolean);
    rejected += cloudJobs.length - validJobs.length;
    jobs = validJobs;
    jobCatalogSource = "firestore";
  }
  if (rejected) showToast(`${rejected} invalid cloud catalog item${rejected === 1 ? " was" : "s were"} ignored.`, "error");
}
async function refreshJobNotifications(notify = true) {
  if (jobRefreshInProgress) return;
  if (!firebaseConfigured || !currentUser) {
    if (notify) showToast("Sign in to refresh published job notifications.", "error");
    return;
  }
  const uid = currentUser.uid;
  jobRefreshInProgress = true;
  if (location.hash.startsWith("#/jobs")) render();
  try {
    const snapshot = await getDocs(query(collection(db, "jobNotifications"), limit(100)));
    if (currentUser?.uid !== uid) return;
    if (snapshot.empty) {
      jobs = sampleJobs;
      jobCatalogSource = "sample";
    } else {
      applyCloudCatalogs([], [], snapshot.docs);
      jobCatalogSource = "firestore";
    }
    if (selectedJobCategory !== "All" && !jobs.some(job => job.category === selectedJobCategory)) {
      selectedJobCategory = "All";
    }
    jobLastUpdatedAt = new Date();
    if (notify) showToast("Job notifications refreshed from Firebase.");
  } catch (error) {
    reportFirebaseError(error, "Could not refresh job notifications");
  } finally {
    jobRefreshInProgress = false;
    if (location.hash.startsWith("#/jobs")) render();
  }
}
async function loadStudentCloudData(user) {
  const [studentSnapshot, profileSnapshot, resultSnapshot, bookmarkSnapshot, plansSnapshot, examSnapshot, questionSnapshot, jobSnapshot] = await Promise.all([
    getDoc(doc(db, "students", user.uid)),
    getDoc(doc(db, "profiles", user.uid)),
    getDocs(query(collection(db, "testResults", user.uid, "results"), orderBy("createdAt", "desc"), limit(30))),
    getDocs(collection(db, "bookmarks", user.uid, "items")),
    getDocs(collection(db, "studyPlans", user.uid, "plans")),
    getDocs(query(collection(db, "exams"), limit(100))),
    getDocs(query(collection(db, "questions"), limit(100))),
    getDocs(query(collection(db, "jobNotifications"), limit(100))),
  ]);
  if (currentUser?.uid !== user.uid) return;
  applyCloudCatalogs(examSnapshot.docs, questionSnapshot.docs, jobSnapshot.docs);
  if (jobSnapshot.empty) {
    jobs = sampleJobs;
    jobCatalogSource = "sample";
  }
  jobLastUpdatedAt = new Date();
  practiceQuestionSet = [];
  practiceAnswers = {};
  practiceIndex = 0;
  practiceResult = null;
  const student = studentSnapshot.exists() ? studentSnapshot.data() : {};
  const profile = profileSnapshot.exists() ? profileSnapshot.data() : {};
  studentProfile = {
    displayName: profile.displayName || student.displayName || user.displayName || user.email || "Student",
    targetExam: profile.targetExam || student.targetExam || "SSC CGL",
    studyGoal: profile.studyGoal || "",
  };
  const initializationWrites = [];
  if (!studentSnapshot.exists()) {
    initializationWrites.push(setDoc(doc(db, "students", user.uid), {
      uid: user.uid,
      email: user.email || "",
      displayName: studentProfile.displayName,
      targetExam: studentProfile.targetExam,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }
  if (!profileSnapshot.exists()) {
    initializationWrites.push(setDoc(doc(db, "profiles", user.uid), {
      uid: user.uid,
      displayName: studentProfile.displayName,
      targetExam: studentProfile.targetExam,
      studyGoal: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
  }
  if (initializationWrites.length) await Promise.all(initializationWrites);
  if (currentUser?.uid !== user.uid) return;
  const results = resultSnapshot.docs.map(result => result.data());
  const bookmarks = bookmarkSnapshot.docs.map(bookmark => bookmark.id);
  const tasks = {};
  let dashboardTasks = null;
  for (const plan of plansSnapshot.docs) {
    const data = plan.data();
    if (data.day === "dashboard") {
      dashboardTasks = [0, 1, 2].map(index => Boolean(data.tasks?.[String(index)]));
      continue;
    }
    for (const [taskId, completed] of Object.entries(data.tasks || {})) {
      tasks[`${data.day}-${taskId}`] = completed;
    }
  }
  const savedGoals = [...plansSnapshot.docs].map(plan => plan.data().goal).find(goal => typeof goal === "string" && goal.length > 0);
  if (!studentProfile.studyGoal && savedGoals) studentProfile.studyGoal = savedGoals;
  writeStorage("govtprep-test-history", results);
  writeStorage("govtprep-bookmarked-questions", bookmarks);
  writeStorage("govtprep-planner", tasks);
  if (dashboardTasks) writeStorage("govtprep-tasks", dashboardTasks);
  writeStorage("govtprep-profile", studentProfile);
  await Promise.all([loadAssistantData(user), loadVideoLearningProgress(user)]);
}
async function loadAssistantData(user) {
  const uid = user.uid;
  const [conversationSnapshot, bookmarkSnapshot] = await Promise.all([
    getDocs(query(collection(db, "aiChats", uid, "conversations"), orderBy("updatedAt", "desc"), limit(20))),
    getDocs(query(collection(db, "aiBookmarks", uid, "items"), orderBy("createdAt", "desc"), limit(100))),
  ]);
  if (currentUser?.uid !== uid) return;
  assistantConversations = conversationSnapshot.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
  assistantBookmarks = bookmarkSnapshot.docs.map(snapshot => snapshot.id);
  assistantConversationId = assistantConversations[0]?.id || null;
  assistantMessages = [];
  if (assistantConversationId) await loadAssistantConversation(assistantConversationId);
}
async function loadVideoLearningProgress(user) {
  const uid = user.uid;
  const snapshot = await getDocs(collection(db, "learningProgress", uid, "items"));
  if (currentUser?.uid !== uid) return;
  const progress = snapshot.docs.map(item => item.data());
  writeStorage("govtprep-video-bookmarks", progress.filter(item => item.bookmarked).map(item => item.videoId));
  writeStorage("govtprep-video-completed", progress.filter(item => item.completed).map(item => item.videoId));
}
async function loadAssistantConversation(conversationId) {
  if (!currentUser) return;
  const uid = currentUser.uid;
  const snapshot = await getDocs(query(
    collection(db, "aiChats", uid, "conversations", conversationId, "messages"),
    orderBy("createdAt", "desc"),
    limit(60),
  ));
  if (currentUser?.uid !== uid) return;
  assistantConversationId = conversationId;
  assistantMessages = snapshot.docs.reverse().map(message => ({ id: message.id, ...message.data() }));
  assistantError = "";
}
function assistantId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
async function persistStudentProfile(profile) {
  if (!firebaseConfigured || !currentUser) return;
  const uid = currentUser.uid;
  const updatedAt = serverTimestamp();
  const profileData = {
    uid,
    displayName: profile.displayName,
    targetExam: profile.targetExam,
    studyGoal: profile.studyGoal || "",
    updatedAt,
  };
  try {
    await Promise.all([
      setDoc(doc(db, "profiles", uid), profileData, { merge: true }),
      setDoc(doc(db, "students", uid), {
        uid,
        email: currentUser.email || "",
        displayName: profile.displayName,
        targetExam: profile.targetExam,
        updatedAt,
      }, { merge: true }),
    ]);
  } catch (error) {
    reportFirebaseError(error, "Could not save your student profile");
  }
}
async function persistStudyPlan(day, tasks, goal) {
  if (!firebaseConfigured || !currentUser) return;
  try {
    await setDoc(doc(db, "studyPlans", currentUser.uid, "plans", day), {
      uid: currentUser.uid,
      day,
      tasks,
      goal,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    reportFirebaseError(error, "Could not save your study plan");
  }
}
function plannerTasksForDay(dayIndex) {
  const allTasks = readStorage("govtprep-planner", {});
  return Object.fromEntries(
    Object.entries(allTasks)
      .filter(([key]) => key.startsWith(`${dayIndex}-`))
      .map(([key, complete]) => [key.slice(`${dayIndex}-`.length), Boolean(complete)])
  );
}
async function persistBookmark(question) {
  if (!firebaseConfigured || !currentUser) return;
  const reference = doc(db, "bookmarks", currentUser.uid, "items", question.id);
  try {
    const saved = getQuestionBookmarks().includes(question.id);
    if (saved) {
      await setDoc(reference, {
        uid: currentUser.uid,
        questionId: question.id,
        question: question.prompt,
        subject: question.subject,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(reference);
    }
  } catch (error) {
    reportFirebaseError(error, "Could not sync your bookmark");
  }
}
async function persistTestResult(result) {
  if (!firebaseConfigured || !currentUser) return;
  try {
    await setDoc(doc(db, "testResults", currentUser.uid, "results", result.id), {
      ...result,
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    reportFirebaseError(error, "Could not sync your test result");
  }
}
function initializeFirebaseAuth() {
  if (!firebaseConfigured) {
    if (firebaseInitError) reportFirebaseError(firebaseInitError, "Firebase initialization failed");
    const savedProfile = readStorage("govtprep-profile", studentProfile);
    if (savedProfile && typeof savedProfile === "object") {
      studentProfile = {
        displayName: String(savedProfile.displayName || "Arjun Sharma"),
        targetExam: String(savedProfile.targetExam || "SSC CGL"),
        studyGoal: String(savedProfile.studyGoal || ""),
      };
    }
    updateAuthChrome();
    return;
  }
  onAuthStateChanged(auth, async user => {
    const previousUid = currentUser?.uid;
    const userChanged = previousUid !== user?.uid;
    currentUser = user;
    void setPreviousPaperUser(user);
    if (userChanged) {
      practiceResult = null;
      practiceAnswers = {};
      mockResult = null;
      activeMockQuestions = [];
      mockAnswers = {};
      mockIndex = 0;
      stopTimer();
      assistantConversationId = null;
      assistantConversations = [];
      assistantMessages = [];
      assistantBookmarks = [];
      assistantError = "";
    }
    if (!user) {
      jobs = sampleJobs;
      jobCatalogSource = "sample";
      jobLastUpdatedAt = null;
      studentProfile = { displayName: "Arjun Sharma", targetExam: "SSC CGL", studyGoal: "" };
      updateAuthChrome();
      if (userChanged || location.hash.startsWith("#/dashboard")) render();
      return;
    }
    studentProfile = {
      displayName: user.displayName || user.email || "Student",
      targetExam: "SSC CGL",
      studyGoal: "",
    };
    updateAuthChrome();
    if (userChanged) render();
    try {
      await loadStudentCloudData(user);
      if (currentUser?.uid === user.uid) {
        updateAuthChrome();
        render();
      }
    } catch (error) {
      reportFirebaseError(error, "Could not load your student data");
      if (currentUser?.uid === user.uid) render();
    }
  }, error => reportFirebaseError(error, "Firebase authentication state failed"));
}
function renderDashboard() {
  const tasks = getDashboardTasks();
  const history = readStorage("govtprep-test-history", []);
  const testHistory = Array.isArray(history) ? history : [];
  const recent = testHistory.slice(0, 3);
  const scoredTests = testHistory.filter(result => Number.isFinite(result.accuracy));
  const averageAccuracy = scoredTests.length
    ? `${Math.round(scoredTests.reduce((total, result) => total + result.accuracy, 0) / scoredTests.length)}%`
    : "—";
  const weeklyHours = (getWeeklyPracticeSeconds(testHistory) / 3600).toFixed(1);
  const completedTasks = tasks.filter(Boolean).length;
  const taskProgress = tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).toUpperCase();
  const studentName = currentUser ? escapeHtml(studentProfile.displayName.split(/\s+/)[0]) : "Arjun";
  const exam = studentProfile.targetExam || "SSC CGL";
  return `<section class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">${todayLabel}</div><h1>One focused day can change everything, ${studentName}.</h1><p>${currentUser ? `Your target examination: ${escapeHtml(exam)}.` : "Build a steady study routine one day at a time."} Keep making steady progress.</p><a class="button" href="#/planner">Pick up where you left off <span>→</span></a></div><div class="welcome-art" aria-hidden="true"><div class="orbit"><span>✦</span></div><small>Your goals are closer than they feel.</small></div></section>
  <form class="dashboard-goal card" data-goal-form><div><label class="eyebrow" for="dashboard-goal-input">YOUR STUDY GOAL</label><strong>${escapeHtml(studentProfile.studyGoal || "Choose one achievable goal for today.")}</strong></div><input class="form-input" id="dashboard-goal-input" name="goal" maxlength="500" value="${escapeHtml(studentProfile.studyGoal)}" placeholder="e.g. Revise polity for 30 minutes"><button class="button secondary small" type="submit">Save goal</button></form>
  <div class="stats-grid">${statCard("◷", "blue", `${weeklyHours} <small>hrs</small>`, "Practice time this week")}${statCard("◎", "purple", averageAccuracy, "Average test accuracy")}${statCard("✦", "green", testHistory.length, "Tests completed")}${statCard("✓", "orange", `${completedTasks} <small>/ ${tasks.length}</small>`, "Focus tasks done today")}</div>
  <div class="dashboard-grid"><section class="card section-card"><div class="section-title"><div><h2>Continue learning</h2><p>Pick up right where you left off</p></div><a class="text-link" href="#/exams">All courses →</a></div><div class="continue-card"><div class="course-art">▤</div><div class="course-meta"><strong>${escapeHtml(exam)} · Today's focus</strong><small>${completedTasks} of ${tasks.length} study tasks complete</small><div class="progress-track"><div class="progress-fill" style="width:${taskProgress}%"></div></div></div><div class="course-percent">${taskProgress}%</div></div><div class="section-title" style="margin:22px 0 12px"><div><h2>Today's focus</h2><p>A little progress adds up</p></div><a class="text-link" href="#/planner">View plan →</a></div><div class="task-list">${["Complete 15 speed & distance questions", "Read today's current affairs digest", "Review Indian Polity: Fundamental Rights"].map((item, i) => `<label class="task-row ${tasks[i] ? "is-done" : ""}"><input class="task-check dashboard-task" type="checkbox" data-task="${i}" ${tasks[i] ? "checked" : ""}><span class="task-copy">${item}<small>${["20 minutes · Aptitude", "10 minutes · General awareness", "30 minutes · Revision"][i]}</small></span><span class="task-tag">${["Practice", "Reading", "Revision"][i]}</span></label>`).join("")}</div></section>
  <section class="card section-card"><div class="section-title"><div><h2>Coming up</h2><p>Stay ahead of your exam calendar</p></div><a class="text-link" href="#/exams">See all →</a></div><div class="exam-list">${exams.slice(0, 4).map(exam => `<div class="exam-row"><div class="exam-mark">${escapeHtml(exam.icon)}</div><div class="exam-copy"><strong>${escapeHtml(exam.name)}</strong><small>${escapeHtml(exam.area)}</small></div><span class="date-chip">${escapeHtml(exam.date)}</span></div>`).join("")}</div></section></div>
  <div class="dashboard-grid" style="margin-top:16px"><section class="card section-card"><div class="section-title"><div><h2>Recent test history</h2><p>${history.length ? `${history.length} saved test${history.length === 1 ? "" : "s"}` : "Your completed practice and mock tests appear here"}</p></div><a class="text-link" href="#/mock-tests">Take a mock →</a></div>${recent.length ? recent.map(result => `<div class="history-row dashboard-history"><span class="history-date">${new Date(result.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><span class="history-copy"><strong>${escapeHtml(result.title)}</strong><small>${result.total} questions · ${formatDuration(result.elapsedSeconds)}</small></span><span class="history-score">${result.score}<small>${result.accuracy}% accuracy</small></span></div>`).join("") : `<div class="empty-state">Finish a practice set to start tracking your progress.</div>`}</section><section class="card section-card"><div class="section-title"><div><h2>Your target exam</h2><p>Keep your preparation focused</p></div></div><div class="exam-row"><div class="exam-mark">${exams.find(item => item.name === exam)?.icon || "✦"}</div><div class="exam-copy"><strong>${escapeHtml(exam)}</strong><small>${currentUser ? `Signed in as ${escapeHtml(currentUser.email)}` : "Sample student profile"}</small></div></div><a class="text-link" href="#/exams">Explore exam preparation →</a></section></div><div class="section-title" style="margin:24px 0 12px"><div><h2>Your next step</h2><p>Everything you need, all in one place</p></div></div><div class="quick-grid">${quickLinks.map(link => `<a class="card quick-card" href="#/${link.route}"><div class="stat-icon ${link.color}">${link.icon}</div><div><strong>${link.label}</strong><small>${link.detail}</small></div></a>`).join("")}</div>`;
}
function renderHome() {
  return `${pageHeading("A little progress, every day.", "The right tools, a clear plan, and a community of future changemakers. Let's get you exam-ready.", `<a class="button" href="#/dashboard">Go to my dashboard →</a>`)}<section class="welcome-banner"><div class="welcome-copy"><div class="eyebrow">WELCOME TO GOVTPREP</div><h1>Your dream job starts with today's first step.</h1><p>Prepare for India's most competitive government exams, all in one focused space.</p><a class="button" href="#/exams">Explore exam preparation <span>→</span></a></div><div class="welcome-art"><div class="orbit"><span>✦</span></div><small>Learn with purpose. Grow with confidence.</small></div></section><div class="stats-grid">${statCard("▤", "blue", "6+", "Exam categories")}${statCard("◎", "purple", "2,400+", "Practice questions")}${statCard("◷", "green", "Daily", "Fresh current affairs")}${statCard("✳", "orange", "Always on", "Your AI study buddy")}</div><div class="section-title"><div><h2>Everything in one place</h2><p>Build your routine and prepare with confidence.</p></div></div><div class="quick-grid">${quickLinks.map(link => `<a class="card quick-card" href="#/${link.route}"><div class="stat-icon ${link.color}">${link.icon}</div><div><strong>${link.label}</strong><small>${link.detail}</small></div></a>`).join("")}</div><div style="margin-top:24px"><div class="section-title"><div><h2>Find your next exam</h2><p>Structured learning for the exams that matter to you</p></div><a class="text-link" href="#/exams">Browse all exams →</a></div><div class="category-grid">${renderExamCards(exams.slice(0, 3))}</div></div>`;
}
function renderExamCards(items) {
  return items.map((exam, i) => `<article class="card category-card"><div class="stat-icon ${["blue", "purple", "green", "orange"][i % 4]}">${escapeHtml(exam.icon)}</div><h3>${escapeHtml(exam.name)}</h3><p>${escapeHtml(exam.detail)}</p><div class="category-foot"><span>Exam date · ${escapeHtml(exam.date)}</span><a class="text-link" href="#/practice">Start preparing →</a></div></article>`).join("");
}
function renderExams() {
  return `${pageHeading("Your next chapter starts here.", "Choose an exam and find a structured path to get you there.", `<input class="search-input" type="search" placeholder="Search exams..." aria-label="Search exams" data-exam-search>`)}<div class="filter-row">${["All exams", "Graduate level", "12th pass"].map((label, i) => `<button class="filter-chip ${i === 0 ? "active" : ""}" type="button" data-exam-filter="${["all", "graduate", "12th"][i]}">${label}</button>`).join("")}</div><div class="category-grid exam-cards">${renderExamCards(exams)}</div>`;
}
function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
function balancedMockQuestions() {
  const subjectQueues = practiceSubjects.map(subject =>
    questionBank.filter(question => question.subject === subject.id)
  );
  const selected = [];
  while (selected.length < MOCK_QUESTION_COUNT && subjectQueues.some(queue => queue.length)) {
    for (const queue of subjectQueues) {
      if (queue.length) selected.push(queue.shift());
      if (selected.length === MOCK_QUESTION_COUNT) break;
    }
  }
  return selected;
}
function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
function getDailyChallengeQuestions() {
  const today = new Date().toISOString().slice(0, 10);
  const key = `govtprep-daily-challenge-${today}`;
  const storedIds = readStorage(key, []);
  const storedQuestions = storedIds.map(id => questionBank.find(question => question.id === id)).filter(Boolean);
  if (storedQuestions.length === 5) return storedQuestions;
  const dailyQuestions = shuffle(questionBank).slice(0, 5);
  writeStorage(key, dailyQuestions.map(question => question.id));
  return dailyQuestions;
}
function setupPractice(category, daily = false, randomize = false) {
  activePracticeCategory = category;
  practiceIsDaily = daily;
  const selectedQuestions = daily ? getDailyChallengeQuestions() : questions[category].map(question =>
    questionBank.find(item => item.prompt === question.prompt)
  ).filter(Boolean);
  practiceQuestionSet = randomize ? shuffle(selectedQuestions) : selectedQuestions;
  practiceAnswers = {};
  practiceIndex = 0;
  practiceStartedAt = Date.now();
  practiceResult = null;
}
function calculateResult(type, title, testQuestions, answers, elapsedSeconds, completedAt = new Date().toISOString()) {
  const correct = testQuestions.reduce((total, question, index) => total + (answers[index] === question.answer ? 1 : 0), 0);
  const answered = Object.keys(answers).filter(index => answers[index] !== undefined).length;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    questions: testQuestions,
    answers,
    total: testQuestions.length,
    correct,
    incorrect: answered - correct,
    unanswered: testQuestions.length - answered,
    score: `${correct} / ${testQuestions.length}`,
    accuracy: testQuestions.length ? Math.round((correct / testQuestions.length) * 100) : 0,
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
    completedAt,
  };
}
function saveTestResult(type, title, testQuestions, answers, elapsedSeconds) {
  const result = calculateResult(type, title, testQuestions, answers, elapsedSeconds);
  const history = readStorage("govtprep-test-history", []);
  history.unshift(result);
  writeStorage("govtprep-test-history", history.slice(0, 30));
  recordStudyActivity();
  void persistTestResult(result);
  return result;
}
function getQuestionBookmarks() {
  return readStorage("govtprep-bookmarked-questions", []);
}
function renderQuestionPalette(testQuestions, answers, currentIndex, kind) {
  return `<div class="question-palette">${testQuestions.map((question, index) => `<button class="palette-dot ${index === currentIndex ? "current" : ""} ${answers[index] !== undefined ? "answered" : ""} ${getQuestionBookmarks().includes(question.id) ? "bookmarked" : ""}" type="button" data-${kind}-jump="${index}" aria-label="Go to question ${index + 1}">${index + 1}</button>`).join("")}</div>`;
}
function renderTestHistory(type) {
  const history = readStorage("govtprep-test-history", []).filter(result => result.type === type).slice(0, 5);
  if (!history.length) return `<section class="card section-card history-card"><div class="section-title"><div><h2>Test history</h2><p>Your completed tests will appear here</p></div></div><div class="empty-state">Complete a test to start building your history.</div></section>`;
  return `<section class="card section-card history-card"><div class="section-title"><div><h2>Test history</h2><p>Your latest ${history.length} completed ${type === "mock" ? "mock exams" : "practice tests"}</p></div></div>${history.map(result => `<button class="history-row" type="button" data-history-view="${result.id}" data-history-type="${type}"><span class="history-date">${new Date(result.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span><span class="history-copy"><strong>${result.title}</strong><small>${result.total} questions · ${formatDuration(result.elapsedSeconds)}</small></span><span class="history-score">${result.score}<small>${result.accuracy}% accuracy</small></span><span class="history-arrow">→</span></button>`).join("")}</section>`;
}
function renderResult(result, kind) {
  const headingText = kind === "mock" ? "Mock examination results" : "Practice results";
  return `<section class="card section-card result-card"><div class="result-header"><div><div class="eyebrow">${kind === "mock" ? "EXAM SUBMITTED" : "PRACTICE COMPLETE"}</div><h1>${headingText}</h1><p class="subheading">${result.title} · ${new Date(result.completedAt).toLocaleString("en-IN")}</p></div><span class="result-score">${result.accuracy}%<small>accuracy</small></span></div><div class="stats-grid result-stats">${statCard("▤", "blue", result.total, "Total questions")}${statCard("✓", "green", result.correct, "Correct answers")}${statCard("×", "orange", result.incorrect, "Incorrect answers")}${statCard("—", "purple", result.unanswered, "Unanswered")}${statCard("◎", "blue", result.score, "Total score")}${statCard("◷", "orange", formatDuration(result.elapsedSeconds), "Time taken")}</div><div class="section-title" style="margin-top:22px"><div><h2>Answer review</h2><p>Correct answers and simple explanations for every question</p></div></div><div class="review-list">${result.questions.map((question, index) => {
    const selected = result.answers[index];
    return `<article class="review-item"><div class="review-question-head"><span class="task-tag">QUESTION ${index + 1}</span><span class="${selected === question.answer ? "review-correct" : selected === undefined ? "review-unanswered" : "review-incorrect"}">${selected === question.answer ? "Correct" : selected === undefined ? "Unanswered" : "Incorrect"}</span></div><h3>${escapeHtml(question.prompt)}</h3><p class="review-answer"><strong>Your answer:</strong> ${selected === undefined ? "Not answered" : escapeHtml(question.options[selected])}</p><p class="review-answer correct-answer"><strong>Correct answer:</strong> ${escapeHtml(question.options[question.answer])}</p><p class="explanation"><strong>Explanation:</strong> ${escapeHtml(question.explanation)}</p></article>`;
  }).join("")}</div><div class="result-actions"><button class="button" type="button" data-retry-${kind}>Retry ${kind === "mock" ? "mock exam" : "practice"} →</button>${kind === "practice" ? `<button class="button secondary" type="button" data-practice-back>Choose another subject</button>` : `<a class="button secondary" href="#/practice">Choose a subject</a>`}</div></section>`;
}
function renderPractice() {
  if (!practiceQuestionSet.length) setupPractice(activePracticeCategory);
  if (practiceResult) return `${pageHeading("Every attempt helps you grow.", "Review your answers, learn from each explanation and try again when you're ready.")}${renderResult(practiceResult, "practice")}${renderTestHistory("practice")}`;
  const question = practiceQuestionSet[practiceIndex];
  const selectedAnswer = practiceAnswers[practiceIndex];
  const bookmarks = getQuestionBookmarks();
  return `${pageHeading("Practice makes prepared.", "Choose a subject, work through sample questions and review your progress.", `<button type="button" class="button secondary" data-practice-randomize>↻ Randomize questions</button>`)}<div class="practice-challenge card"><div class="challenge-icon">✦</div><div class="challenge-copy"><strong>Today's daily challenge</strong><small>A fresh, mixed-subject set of 5 questions · your daily challenge stays the same today</small></div><button type="button" class="button small purple" data-practice-daily>Start daily challenge →</button></div><div class="category-grid practice-subject-grid">${practiceSubjects.map(subject => `<button type="button" class="card category-card practice-category ${activePracticeCategory === subject.id && !practiceIsDaily ? "practice-active" : ""}" data-practice-category="${subject.id}" style="text-align:left;cursor:pointer;border-color:${activePracticeCategory === subject.id && !practiceIsDaily ? "#abb3ff" : ""}"><div class="stat-icon ${subject.color}">${subject.icon}</div><h3>${subject.label}</h3><div class="category-foot"><span>${questions[subject.id].length} sample questions</span><span class="text-link">${activePracticeCategory === subject.id && !practiceIsDaily ? "Selected ✓" : "Practice →"}</span></div></button>`).join("")}</div><div class="split-grid"><section class="card quiz-card"><div class="quiz-top"><span class="question-number">QUESTION ${practiceIndex + 1} OF ${practiceQuestionSet.length} · ${practiceIsDaily ? "DAILY CHALLENGE" : practiceSubjects.find(subject => subject.id === activePracticeCategory).label.toUpperCase()}</span><button type="button" class="bookmark-button ${bookmarks.includes(question.id) ? "is-bookmarked" : ""}" data-bookmark="${escapeHtml(question.id)}" aria-label="${bookmarks.includes(question.id) ? "Remove bookmark" : "Bookmark question"}">${bookmarks.includes(question.id) ? "★ Bookmarked" : "☆ Bookmark"}</button></div><div class="mock-progress"><div class="progress-fill" style="width:${((practiceIndex + 1) / practiceQuestionSet.length) * 100}%"></div></div><h2 class="question-prompt">${escapeHtml(question.prompt)}</h2><div class="answers">${question.options.map((option, i) => `<button type="button" class="answer-option ${selectedAnswer === i ? "selected" : ""}" data-practice-answer="${i}"><span class="option-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(option)}</button>`).join("")}</div><div class="mock-footer"><button class="button secondary small" type="button" data-practice-prev ${practiceIndex === 0 ? "disabled" : ""}>← Previous</button><span class="muted" style="font-size:10px">${Object.keys(practiceAnswers).length} of ${practiceQuestionSet.length} answered</span><button class="button small" type="button" data-practice-next ${practiceIndex === practiceQuestionSet.length - 1 ? "disabled" : ""}>Next question →</button></div>${renderQuestionPalette(practiceQuestionSet, practiceAnswers, practiceIndex, "practice")}<div class="submit-row"><span class="muted">You can change answers until you submit.</span><button class="button" type="button" data-practice-submit>Submit practice</button></div></section><aside><section class="feature-panel"><div class="eyebrow">DAILY PROGRESS</div><h2>Consistency beats cramming.</h2><p>Practice a few questions every day and watch your confidence grow. Bookmark tricky questions to revisit them later.</p><div style="display:flex;gap:8px;align-items:center;margin:15px 0"><span style="font-size:22px">✦</span><strong style="font-size:13px">7 days in a row</strong></div><a class="button" href="#/mock-tests">Take a 25-question mock exam →</a></section><section class="card section-card" style="margin-top:13px"><div class="section-title"><div><h2>Bookmarked questions</h2><p>Save questions you want to revisit</p></div></div><p class="subheading">${bookmarks.length} question${bookmarks.length === 1 ? "" : "s"} saved across your subjects.</p></section></aside></div>${renderTestHistory("practice")}`;
}
function renderMock() {
  if (mockResult) return `${pageHeading("Every attempt helps you grow.", "Review your mock exam, learn from each explanation and try another practice set.")}${renderResult(mockResult, "mock")}${renderTestHistory("mock")}`;
  if (!activeMockQuestions.length) return `${pageHeading("Mock test, real momentum.", "Build exam-day confidence with a timed, 25-question examination across all six subjects.")}<div class="split-grid"><section class="card section-card mock-intro"><div class="stat-icon purple" style="width:48px;height:48px;font-size:22px">◷</div><div class="eyebrow" style="margin-top:15px">SAMPLE MOCK EXAMINATION</div><h1 style="font-size:25px;margin-top:8px">SSC CGL · Mixed subjects</h1><p class="subheading">A timed sample test with questions from aptitude, reasoning, English, general knowledge, science and computer knowledge. Your answers are saved as you go.</p><div class="mock-facts"><span>25 questions</span><span>30 minutes</span><span>4 options each</span><span>Explanations after submission</span></div><div class="heading-actions"><button type="button" class="button" data-mock-start>Start mock examination →</button><button type="button" class="button secondary" data-mock-start-random>↻ Randomize & start</button></div><p class="muted" style="font-size:9px;margin:14px 0 0">The timer starts when you begin. Your test submits automatically when time runs out.</p></section><aside><section class="feature-panel"><div class="eyebrow">NO PRESSURE, JUST PRACTICE</div><h2>Make every attempt count.</h2><p>Navigate freely between questions, change answers before submission and bookmark questions for review. Your detailed result is saved in this browser.</p></section><section class="card section-card" style="margin-top:13px"><h2>Test structure</h2><div class="task-list"><div class="task-row"><span class="task-copy">Quantitative aptitude</span><span>✓</span></div><div class="task-row"><span class="task-copy">Reasoning & English</span><span>✓</span></div><div class="task-row"><span class="task-copy">GK, science & computer</span><span>✓</span></div></div></section></aside></div>${renderTestHistory("mock")}`;
  const question = activeMockQuestions[mockIndex];
  const answer = mockAnswers[mockIndex];
  return `${pageHeading("Mock test, real momentum.", "SSC CGL · Mixed subjects · 25 questions", `<button type="button" class="button secondary" data-mock-submit>Submit test</button>`)}<div class="split-grid"><section class="card mock-question"><div class="mock-topline"><span class="question-number">QUESTION ${mockIndex + 1} OF ${activeMockQuestions.length} · ${practiceSubjects.find(subject => subject.id === question.subject).label.toUpperCase()}</span><div class="timer" data-timer>${formatDuration(mockSeconds)}</div></div><div class="mock-progress"><div class="progress-fill" style="width:${((mockIndex + 1) / activeMockQuestions.length) * 100}%"></div></div><div class="quiz-top"><span class="task-tag">Mixed subject mock</span><button type="button" class="bookmark-button ${getQuestionBookmarks().includes(question.id) ? "is-bookmarked" : ""}" data-bookmark="${escapeHtml(question.id)}" aria-label="${getQuestionBookmarks().includes(question.id) ? "Remove bookmark" : "Bookmark question"}">${getQuestionBookmarks().includes(question.id) ? "★ Bookmarked" : "☆ Bookmark"}</button></div><h2 class="question-prompt">${escapeHtml(question.prompt)}</h2><div class="answers">${question.options.map((option, i) => `<button type="button" class="answer-option ${answer === i ? "selected" : ""}" data-mock-answer="${i}"><span class="option-letter">${String.fromCharCode(65 + i)}</span>${escapeHtml(option)}</button>`).join("")}</div><div class="mock-footer"><button class="button secondary small" type="button" data-mock-prev ${mockIndex === 0 ? "disabled" : ""}>← Previous</button><span class="muted" style="font-size:10px">${Object.keys(mockAnswers).length} of ${activeMockQuestions.length} answered</span><button class="button small" type="button" data-mock-next ${mockIndex === activeMockQuestions.length - 1 ? "disabled" : ""}>Next question →</button></div>${renderQuestionPalette(activeMockQuestions, mockAnswers, mockIndex, "mock")}<div class="submit-row"><span class="muted">You can change answers until submission.</span><button class="button" type="button" data-mock-submit>Submit test</button></div></section><aside><section class="card section-card"><div class="section-title"><div><h2>Test overview</h2><p>SSC CGL · Sample examination</p></div></div><div class="task-list"><div class="task-row"><span class="task-copy">Questions<small>Multiple choice</small></span><strong>25</strong></div><div class="task-row"><span class="task-copy">Time limit<small>Auto-submit at zero</small></span><strong>30 min</strong></div><div class="task-row"><span class="task-copy">Questions answered</span><strong>${Object.keys(mockAnswers).length}/25</strong></div></div></section><section class="feature-panel" style="margin-top:13px"><div class="eyebrow">A GENTLE REMINDER</div><h2>It's practice, not pressure.</h2><p>Check your remaining time and submit whenever you're ready. Every answer is saved as you go.</p></section></aside></div>`;
}
function renderAffairs() {
  return `${pageHeading("Stay informed. Stay ahead.", "A concise daily briefing for the topics that matter in your government exams.", `<button type="button" class="button secondary" data-news-save>☆ Save today's digest</button>`)}<div class="split-grid"><section class="news-list">${news.map(item => `<article class="card news-card"><div class="news-meta"><span class="news-tag">${item.tag}</span><span>${item.date}</span></div><h3>${item.title}</h3><p>${item.text}</p><details><summary>What to remember for your exam</summary><p>${item.more}</p></details></article>`).join("")}</section><aside><section class="card section-card"><div class="section-title"><div><h2>Today's briefing</h2><p>Friday, 6 November 2026 · Sample digest</p></div></div>${statCard("◉", "purple", news.length, "Stories to review")}<p class="subheading" style="margin:13px 0">Focus on the facts, context and constitutional connections behind every headline.</p><a class="button small" href="#/practice">Practice general knowledge →</a></section><section class="feature-panel" style="margin-top:13px"><div class="eyebrow">STUDY TIP</div><h2>Read with purpose.</h2><p>Make a quick note of one important fact from every story. Revisit your notes at the end of the week.</p></section></aside></div>`;
}
function renderVideoCardList() {
  const bookmarks = readStorage("govtprep-video-bookmarks", []);
  const completed = readStorage("govtprep-video-completed", []);
  const term = videoSearchTerm.trim().toLowerCase();
  const matches = videoLessons.filter(lesson => {
    const subjectMatch = videoSubjectFilter === "all" || lesson.subject === videoSubjectFilter;
    const levelMatch = videoLevelFilter === "all" || lesson.level === videoLevelFilter;
    const channelMatch = videoChannelFilter === "all" || lesson.channel === videoChannelFilter;
    const statusMatch = videoStatusFilter === "all" ||
      (videoStatusFilter === "bookmarked" && bookmarks.includes(lesson.id)) ||
      (videoStatusFilter === "completed" && completed.includes(lesson.id));
    const searchable = `${lesson.title} ${lesson.topic} ${lesson.channel} ${videoSubjects.find(subject => subject.id === lesson.subject)?.label || ""}`.toLowerCase();
    return subjectMatch && levelMatch && channelMatch && statusMatch && (!term || searchable.includes(term));
  });
  return matches.length
    ? matches.map(lesson => `<article class="card video-class-card"><button class="video-thumbnail" type="button" data-play-lesson="${lesson.id}" aria-label="Play ${escapeHtml(lesson.title)}"><img src="https://i.ytimg.com/vi/${lesson.id}/hqdefault.jpg" alt="Thumbnail for ${escapeHtml(lesson.title)}" loading="lazy"><span class="video-play-icon" aria-hidden="true">▶</span>${completed.includes(lesson.id) ? `<span class="video-complete-mark">Completed</span>` : ""}</button><div class="video-class-copy"><div class="video-class-tags"><span>${escapeHtml(videoSubjects.find(subject => subject.id === lesson.subject)?.label || lesson.subject)}</span><span class="level-tag ${lesson.level}">${lesson.level}</span></div><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.topic)}</p><div class="video-class-meta"><span>${escapeHtml(lesson.channel)}</span><span>${escapeHtml(lesson.views)}</span></div><div class="video-class-actions"><button class="button small" type="button" data-play-lesson="${lesson.id}">Play lesson</button><button class="bookmark-button ${bookmarks.includes(lesson.id) ? "is-bookmarked" : ""}" type="button" data-video-bookmark="${lesson.id}" aria-pressed="${bookmarks.includes(lesson.id)}">${bookmarks.includes(lesson.id) ? "★ Saved" : "☆ Save"}</button></div></div></article>`).join("")
    : `<div class="card empty-state video-empty">No lessons match these filters. Try another subject, topic, channel or level.</div>`;
}
function renderVideoLessons() {
  const channels = [...new Set(videoLessons.map(lesson => lesson.channel))].sort();
  const activeMatches = videoLessons.filter(lesson => {
    const bookmarks = readStorage("govtprep-video-bookmarks", []);
    const completed = readStorage("govtprep-video-completed", []);
    const term = videoSearchTerm.trim().toLowerCase();
    const searchable = `${lesson.title} ${lesson.topic} ${lesson.channel} ${videoSubjects.find(subject => subject.id === lesson.subject)?.label || ""}`.toLowerCase();
    return (videoSubjectFilter === "all" || lesson.subject === videoSubjectFilter) &&
      (videoLevelFilter === "all" || lesson.level === videoLevelFilter) &&
      (videoChannelFilter === "all" || lesson.channel === videoChannelFilter) &&
      (videoStatusFilter === "all" || (videoStatusFilter === "bookmarked" && bookmarks.includes(lesson.id)) ||
        (videoStatusFilter === "completed" && completed.includes(lesson.id))) && (!term || searchable.includes(term));
  });
  const active = activeMatches.find(lesson => lesson.id === activeVideoId) || activeMatches[0] || null;
  if (active) activeVideoId = active.id;
  const bookmarks = readStorage("govtprep-video-bookmarks", []);
  const completed = readStorage("govtprep-video-completed", []);
  const player = active
    ? `<section class="card video-player-card"><div class="video-player-frame"><iframe src="https://www.youtube-nocookie.com/embed/${active.id}?rel=0" title="${escapeHtml(active.title)} · ${escapeHtml(active.channel)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div><div class="video-player-details"><div class="video-class-tags"><span>${escapeHtml(videoSubjects.find(subject => subject.id === active.subject)?.label || active.subject)}</span><span class="level-tag ${active.level}">${active.level}</span></div><h2>${escapeHtml(active.title)}</h2><p>${escapeHtml(active.channel)} · ${escapeHtml(active.topic)}</p><p class="video-lesson-note">${escapeHtml(active.note)}</p><div class="video-player-actions"><button type="button" class="bookmark-button ${bookmarks.includes(active.id) ? "is-bookmarked" : ""}" data-video-bookmark="${active.id}" aria-pressed="${bookmarks.includes(active.id)}">${bookmarks.includes(active.id) ? "★ Bookmarked" : "☆ Bookmark lesson"}</button><button type="button" class="button small ${completed.includes(active.id) ? "secondary" : ""}" data-video-complete="${active.id}" aria-pressed="${completed.includes(active.id)}">${completed.includes(active.id) ? "✓ Completed" : "Mark complete"}</button><a class="video-watch-link" href="https://www.youtube.com/watch?v=${active.id}" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a></div></div></section>`
    : `<section class="card video-player-card video-no-selection"><strong>No lesson selected</strong><p>Clear one or more filters to choose a class.</p></section>`;
  return `${pageHeading("Learn in Telugu-English.", "Popular, topic-focused classes with Telugu explanations and English exam terminology.")}<section class="video-learning-intro"><div><strong>Start with the concept. Keep the exam terms.</strong><p>Telugu explanations, practical examples and shortcuts from established exam-prep channels.</p></div><small>Popularity snapshot · 10 Nov 2026</small></section><div class="video-filter-bar"><input class="search-input" type="search" value="${escapeHtml(videoSearchTerm)}" placeholder="Search subject, topic or channel..." aria-label="Search video classes" data-video-search><select class="form-input" aria-label="Filter by subject" data-video-subject><option value="all">All subjects</option>${videoSubjects.map(subject => `<option value="${subject.id}" ${videoSubjectFilter === subject.id ? "selected" : ""}>${subject.label}</option>`).join("")}</select><select class="form-input" aria-label="Filter by channel" data-video-channel><option value="all">All channels</option>${channels.map(channel => `<option value="${escapeHtml(channel)}" ${videoChannelFilter === channel ? "selected" : ""}>${escapeHtml(channel)}</option>`).join("")}</select></div><div class="video-filter-groups"><div class="filter-row" role="group" aria-label="Filter by learning level">${[["all", "All levels"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]].map(([level, label]) => `<button type="button" class="filter-chip ${videoLevelFilter === level ? "active" : ""}" data-video-level="${level}" aria-pressed="${videoLevelFilter === level}">${label}</button>`).join("")}</div><div class="filter-row" role="group" aria-label="Filter by lesson status">${[["all", "All classes"], ["bookmarked", "☆ Saved"], ["completed", "✓ Completed"]].map(([status, label]) => `<button type="button" class="filter-chip ${videoStatusFilter === status ? "active" : ""}" data-video-status="${status}" aria-pressed="${videoStatusFilter === status}">${label}</button>`).join("")}</div></div><div class="video-learning-layout">${player}<section class="video-results"><div class="section-title"><div><h2>Popular classes</h2><p>${activeMatches.length} selected lessons · view counts checked 10 Nov 2026</p></div></div><div class="video-class-grid" data-video-cards>${renderVideoCardList()}</div></section></div>`;
}
async function toggleVideoProgress(videoId, progressType) {
  const lesson = videoLessons.find(item => item.id === videoId);
  if (!lesson || !["bookmarked", "completed"].includes(progressType)) return;
  const key = progressType === "bookmarked" ? "govtprep-video-bookmarks" : "govtprep-video-completed";
  const current = readStorage(key, []);
  const updated = current.includes(videoId) ? current.filter(id => id !== videoId) : [...current, videoId];
  writeStorage(key, updated);
  if (progressType === "completed" && updated.includes(videoId)) recordStudyActivity();
  if (firebaseConfigured && currentUser) {
    try {
      await setDoc(doc(db, "learningProgress", currentUser.uid, "items", videoId), {
        videoId,
        subject: lesson.subject,
        topic: lesson.topic,
        title: lesson.title,
        channel: lesson.channel,
        bookmarked: readStorage("govtprep-video-bookmarks", []).includes(videoId),
        completed: readStorage("govtprep-video-completed", []).includes(videoId),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      reportFirebaseError(error, "Could not sync your video learning progress");
    }
  }
  render();
  showToast(updated.includes(videoId)
    ? progressType === "bookmarked" ? "Lesson bookmarked." : "Lesson marked complete."
    : progressType === "bookmarked" ? "Lesson bookmark removed." : "Lesson marked incomplete.");
}
function appendVideoQuickTrick() {
  const lesson = videoLessons.find(item => item.id === activeVideoId);
  const details = app.querySelector(".video-player-details");
  const actions = details?.querySelector(".video-player-actions");
  if (!lesson || !details || !actions) return;
  const tip = document.createElement("aside");
  tip.className = "video-quick-trick";
  tip.setAttribute("role", "note");
  const title = document.createElement("strong");
  title.textContent = "Easy trick";
  const text = document.createElement("p");
  text.textContent = lesson.trick;
  tip.append(title, text);
  actions.before(tip);
}
function renderPlanner() {
  const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const selectedTasks = readStorage("govtprep-planner", {});
  const items = [["7:00 – 7:45 AM", "Quantitative aptitude", "Time & work · 15 questions", "blue-line"], ["10:30 – 11:15 AM", "Indian polity", "Fundamental rights · Chapter 3", "purple-line"], ["4:00 – 4:20 PM", "Current affairs", "Daily digest · 4 headlines", "green-line"], ["7:30 – 8:00 PM", "English revision", "Vocabulary · 20 new words", "blue-line"]];
  const completed = items.filter((_, i) => selectedTasks[`${selectedPlannerDay}-${i}`]).length;
  const weeklyCompleted = week.reduce((count, _, day) =>
    count + items.filter((_, task) => Boolean(selectedTasks[`${day}-${task}`])).length, 0);
  const weeklyMinutes = week.reduce((minutes, _, day) =>
    minutes + items.reduce((dayMinutes, _, task) =>
      dayMinutes + (selectedTasks[`${day}-${task}`] ? [45, 45, 20, 30][task] : 0), 0), 0);
  const weeklyProgress = Math.round((weeklyCompleted / (week.length * items.length)) * 100);
  const completedHours = (weeklyMinutes / 60).toFixed(1);
  return `${pageHeading("Make room for what matters.", "A realistic study rhythm you can make your own. Today is a great day to begin.", `<button type="button" class="button secondary" data-planner-reset>Reset today's tasks</button>`)}<div class="split-grid"><section class="card section-card"><form class="goal-form" data-goal-form><label for="planner-goal">Study goal</label><div><input class="form-input" id="planner-goal" name="goal" maxlength="500" value="${escapeHtml(studentProfile.studyGoal)}" placeholder="e.g. Revise polity for 30 minutes"><button class="button small" type="submit">Save goal</button></div></form><div class="section-title"><div><h2>Your week at a glance</h2><p>Small, consistent blocks build strong foundations</p></div></div><div class="week-strip">${week.map((day, i) => { const date = new Date(weekStart); date.setDate(date.getDate() + i); return `<button class="day-tile ${i === selectedPlannerDay ? "active" : ""}" type="button" data-planner-day="${i}"><small>${day}</small><strong>${date.getDate()}</strong></button>`; }).join("")}</div><div class="section-title" style="margin-top:5px"><div><h2>${["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][selectedPlannerDay]}'s study plan</h2><p>${completed} of ${items.length} sessions complete</p></div><span class="task-tag">${completed === items.length ? "Day complete!" : "Your plan"}</span></div>${items.map(([time, title, detail, color], i) => `<label class="planner-item"><span class="planner-time">${time}</span><span class="planner-subject ${color}"><strong>${title}</strong><small>${detail}</small></span><input class="planner-done" type="checkbox" data-planner-task="${i}" ${selectedTasks[`${selectedPlannerDay}-${i}`] ? "checked" : ""}></label>`).join("")}</section><aside><section class="card section-card"><div class="section-title"><div><h2>Your weekly rhythm</h2><p>A little effort goes a long way</p></div></div><div style="display:flex;align-items:baseline;gap:6px;margin:16px 0"><strong style="font-family:Manrope;font-size:31px">${completedHours}</strong><span class="muted" style="font-size:10px">planned hours completed this week</span></div><div class="progress-track" style="height:8px"><div class="progress-fill" style="width:${weeklyProgress}%"></div></div><p class="subheading" style="margin-top:12px">${weeklyCompleted} of ${week.length * items.length} planned study sessions complete.</p></section><section class="feature-panel" style="margin-top:13px"><div class="eyebrow">A KIND REMINDER</div><h2>Rest is part of the plan.</h2><p>Short breaks help you focus longer. Take one between study sessions and come back refreshed.</p></section></aside></div>`;
}
function renderAssistant() {
  const tabs = [["chat", "AI chat"], ["questions", "Question generator"], ["recommendations", "Study recommendations"]];
  return `${pageHeading("A study buddy, whenever you need one.", "Ask questions, practise a topic or build a plan around your results.")}<nav class="assistant-tabs" aria-label="Study assistant tools">${tabs.map(([view, label]) => `<button type="button" class="assistant-tab ${assistantView === view ? "active" : ""}" data-ai-view="${view}" aria-pressed="${assistantView === view}">${label}</button>`).join("")}</nav>${assistantView === "chat" ? renderAssistantChat() : assistantView === "questions" ? renderAiQuestionGenerator() : renderAiRecommendations()}`;
}
function renderAssistantChat() {
  const suggestions = ["Explain Article 21 in simple terms", "Solve a time and work problem step by step", "How are the Lok Sabha and Rajya Sabha different?", "Explain subject-verb agreement with examples"];
  const messages = assistantMessages.length
    ? assistantMessages.map(message => `<article class="chat-message ${message.role === "user" ? "user" : ""}"><div>${escapeHtml(message.text).replace(/\n/g, "<br>")}</div>${message.role === "assistant" ? `<button type="button" class="assistant-bookmark ${assistantBookmarks.includes(message.id) ? "saved" : ""}" data-ai-bookmark="${escapeHtml(message.id)}" aria-label="${assistantBookmarks.includes(message.id) ? "Remove saved explanation" : "Save explanation"}">${assistantBookmarks.includes(message.id) ? "★ Saved" : "☆ Save explanation"}</button>` : ""}</article>`).join("")
    : `<div class="assistant-welcome"><strong>Start with a doubt or a topic.</strong><p>Get beginner-friendly explanations, worked steps and exam-focused context in English or Telugu.</p></div>`;
  const history = assistantConversations.length
    ? assistantConversations.map(conversation => `<button type="button" class="assistant-history-item ${assistantConversationId === conversation.id ? "active" : ""}" data-ai-conversation="${escapeHtml(conversation.id)}">${escapeHtml(conversation.title || "Study conversation")}</button>`).join("")
    : `<p class="assistant-empty">Your conversations will appear here.</p>`;
  return `<div class="assistant-layout"><section class="card chat-panel"><div class="chat-head"><div class="bot-avatar">✳</div><div><strong>GovtPrep study buddy</strong><small>AI tutor · English and Telugu</small></div></div><div class="chat-messages" data-chat-messages>${messages}${assistantBusy ? `<div class="chat-message assistant-loading" role="status" aria-label="Generating answer"><span></span><span></span><span></span></div>` : ""}</div>${assistantError ? `<div class="assistant-error" role="alert">${escapeHtml(assistantError)}</div>` : ""}<form class="chat-compose" data-chat-form><div class="assistant-compose-tools"><select name="mode" aria-label="Assistant mode"><option value="tutor">Study chat</option><option value="doubt">Solve a doubt</option></select><select name="language" aria-label="Response language"><option value="English">English</option><option value="Telugu">తెలుగు</option></select></div><div class="assistant-compose-row"><input type="text" name="question" maxlength="2000" placeholder="Ask an exam question..." aria-label="Ask the study assistant" required ${assistantBusy ? "disabled" : ""}><button class="button" type="submit" ${assistantBusy ? "disabled" : ""}>Ask <span>→</span></button></div></form></section><aside class="assistant-side"><section class="card section-card assistant-history"><div class="section-title"><div><h2>Chat history</h2><p>${currentUser ? "Saved to your account" : "Sign in to save conversations"}</p></div><button type="button" class="icon-button assistant-new-chat" data-ai-new-chat aria-label="Start a new chat" title="Start a new chat">＋</button></div>${history}${assistantConversationId ? `<button class="assistant-clear" type="button" data-ai-clear>Clear current chat</button>` : ""}</section><section class="card section-card assistant-prompts"><div class="section-title"><div><h2>Suggested prompts</h2><p>Try a question to get started</p></div></div><div class="suggestion-list">${suggestions.map(text => `<button class="suggestion" type="button" data-suggestion="${escapeHtml(text)}">${escapeHtml(text)} →</button>`).join("")}</div></section></aside></div>`;
}
function renderAiQuestionGenerator() {
  const subjectOptions = practiceSubjects.map(subject => `<option value="${subject.id}" ${assistantQuestionOptions.subject === subject.id ? "selected" : ""}>${subject.label}</option>`).join("");
  const questionCards = assistantQuestions.map((question, index) => `<article class="card ai-question-card"><div class="ai-question-meta"><span>${escapeHtml(question.topic || practiceSubjects.find(subject => subject.id === assistantQuestionOptions.subject)?.label || "Practice")}</span><span>${escapeHtml(assistantQuestionOptions.difficulty)} difficulty</span></div><div class="quiz-top"><h3>${index + 1}. ${escapeHtml(question.question)}</h3><button type="button" class="assistant-bookmark ${assistantBookmarks.includes(question.id) ? "saved" : ""}" data-ai-question-bookmark="${escapeHtml(question.id)}">${assistantBookmarks.includes(question.id) ? "★ Saved" : "☆ Save explanation"}</button></div><div class="answers">${question.options.map((option, optionIndex) => `<div class="answer-option ${optionIndex === question.answerIndex ? "correct" : ""}"><span class="option-letter">${String.fromCharCode(65 + optionIndex)}</span>${escapeHtml(option)}${optionIndex === question.answerIndex ? " · Correct" : ""}</div>`).join("")}</div><div class="explanation"><strong>Explanation</strong><br>${escapeHtml(question.explanation)}</div></article>`).join("");
  return `<div class="ai-tool-grid"><section class="card section-card"><div class="section-title"><div><h2>Build a focused practice set</h2><p>Questions are generated for your selected exam subject.</p></div></div><form class="ai-generator-form" data-ai-question-form><label>Subject<select class="form-input" name="subject">${subjectOptions}</select></label><label>Difficulty<select class="form-input" name="difficulty"><option value="easy" ${assistantQuestionOptions.difficulty === "easy" ? "selected" : ""}>Beginner</option><option value="medium" ${assistantQuestionOptions.difficulty === "medium" ? "selected" : ""}>Intermediate</option><option value="hard" ${assistantQuestionOptions.difficulty === "hard" ? "selected" : ""}>Advanced</option></select></label><label>Questions<select class="form-input" name="count">${[3, 5, 10].map(count => `<option value="${count}" ${assistantQuestionOptions.count === count ? "selected" : ""}>${count} questions</option>`).join("")}</select></label><label>Language<select class="form-input" name="language"><option value="English">English</option><option value="Telugu">తెలుగు</option></select></label><button class="button" type="submit" ${assistantGenerating ? "disabled" : ""}>${assistantGenerating ? "Generating..." : "Generate questions →"}</button></form><p class="assistant-note">AI-generated practice should be checked against your official syllabus and study material.</p></section><section class="ai-generated-list" aria-live="polite">${assistantGenerating ? `<div class="card section-card assistant-generating"><span class="loading-spinner"></span>Generating your question set...</div>` : questionCards || `<div class="card section-card empty-state">Your generated questions will appear here.</div>`}</section></div>`;
}
function renderAiRecommendations() {
  const stats = getWeakSubjectStats();
  const items = assistantRecommendations.map(item => `<article class="card recommendation-row"><div class="recommendation-subject"><strong>${escapeHtml(item.subject)}</strong><span>${escapeHtml(item.reason)}</span></div><div class="recommendation-focus"><small>Focus next</small><strong>${escapeHtml(item.focusTopic)}</strong></div><div class="recommendation-exercise"><small>Daily exercise</small><p>${escapeHtml(item.exercise)}</p></div></article>`).join("");
  return `<div class="ai-tool-grid"><section class="card section-card"><div class="section-title"><div><h2>Your next best study step</h2><p>Recommendations use your recent test results and target exam.</p></div></div>${stats.length ? `<div class="weak-subject-list">${stats.map(item => `<div><span>${escapeHtml(item.subject)}</span><strong>${item.accuracy}% <small>(${item.attempts} questions)</small></strong></div>`).join("")}</div>` : `<p class="assistant-note">Complete a practice test to get recommendations based on your results. You can still request a general plan now.</p>`}<form data-ai-recommend-form class="recommend-form"><label for="recommend-language">Language</label><select class="form-input" id="recommend-language" name="language"><option value="English">English</option><option value="Telugu">తెలుగు</option></select><button class="button" type="submit" ${assistantGenerating ? "disabled" : ""}>${assistantGenerating ? "Building your plan..." : "Get my study plan →"}</button></form></section><section class="recommendation-list" aria-live="polite">${assistantGenerating ? `<div class="card section-card assistant-generating"><span class="loading-spinner"></span>Building recommendations from your study data...</div>` : items || `<div class="card section-card empty-state">Your personalized recommendations will appear here.</div>`}</section></div>`;
}
function getWeakSubjectStats() {
  const totals = new Map();
  for (const result of readStorage("govtprep-test-history", []).slice(0, 20)) {
    for (const [index, question] of (result.questions || []).entries()) {
      if (!question.subject) continue;
      const current = totals.get(question.subject) || { subject: practiceSubjects.find(item => item.id === question.subject)?.label || question.subject, correct: 0, attempts: 0 };
      current.attempts += 1;
      if (Number(result.answers?.[index]) === question.answer) current.correct += 1;
      totals.set(question.subject, current);
    }
  }
  return [...totals.values()].map(item => ({ ...item, accuracy: Math.round(item.correct / item.attempts * 100) })).sort((a, b) => a.accuracy - b.accuracy);
}
function renderJobs() {
  const categories = ["All", ...new Set(jobs.map(job => job.category))];
  return `${pageHeading("The next opportunity is out there.", "Browse sample notifications and keep track of the dates that matter.", `<input class="search-input" type="search" placeholder="Search vacancies..." aria-label="Search job notifications" data-job-search>`)}<div class="filter-row">${categories.map(c => `<button type="button" class="filter-chip ${selectedJobCategory === c ? "active" : ""}" data-job-filter="${c}">${c}</button>`).join("")}</div><div class="split-grid"><section class="card section-card"><div class="section-title"><div><h2>Latest opportunities</h2><p>Sample listings · Verify dates on official portals</p></div><span class="task-tag">${jobs.length} notifications</span></div><div data-job-list>${renderJobRows(jobs)}</div></section><aside><section class="feature-panel"><div class="eyebrow">A FRIENDLY REMINDER</div><h2>Check the official notification.</h2><p>Vacancies and deadlines below are sample information for this frontend demo. Always confirm eligibility and dates with the official recruiting organization.</p><a class="button" href="#/exams">Explore exams →</a></section><section class="card section-card" style="margin-top:13px"><div class="section-title"><div><h2>Keep it organised</h2><p>Save a vacancy to revisit it later</p></div></div><p class="subheading">Tap “Save vacancy” on any listing to add it to your personal shortlist. Your saved listings stay in this browser.</p></section></aside></div>`;
}
function appendJobRefreshControls() {
  const actions = app.querySelector(".page-heading .heading-actions");
  if (!actions) return;
  const search = actions.querySelector("[data-job-search]");
  if (search) search.value = jobSearchTerm;
  const refresh = document.createElement("button");
  refresh.className = "button secondary small";
  refresh.type = "button";
  refresh.dataset.jobRefresh = "";
  refresh.disabled = jobRefreshInProgress;
  refresh.textContent = jobRefreshInProgress ? "Refreshing..." : "Refresh";
  refresh.setAttribute("aria-label", "Refresh job notifications");
  const status = document.createElement("small");
  status.className = "job-refresh-status";
  if (!currentUser) status.textContent = "Sample listings · Sign in to check published updates";
  else if (jobCatalogSource === "firestore" && jobLastUpdatedAt) {
    status.textContent = `Firestore · Updated ${jobLastUpdatedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
  } else status.textContent = "Sample listings · No published Firebase catalog";
  const description = app.querySelector(".page-heading .subheading");
  if (description && currentUser && jobCatalogSource === "firestore") {
    description.textContent = "Browse the latest opportunities published to the GovtPrep Firestore catalog.";
  }
  actions.append(refresh, status);
}
function renderJobRows(list) {
  const saved = readStorage("govtprep-saved-jobs", []);
  if (!list.length) return `<div class="empty-state">No sample vacancies match your search. Try another keyword or category.</div>`;
  return list.map(job => `<article class="job-row"><div class="job-logo">${escapeHtml(job.logo)}</div><div class="job-info"><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.organization)}</p><div class="job-tags"><span>${escapeHtml(job.eligibility)}</span><span>${escapeHtml(job.posts)}</span></div></div><div class="job-actions"><small>Deadline · ${escapeHtml(job.deadline)}</small><button type="button" class="button secondary small" data-save-job="${escapeHtml(job.title)}">${saved.includes(job.title) ? "Saved ✓" : "Save vacancy"}</button></div></article>`).join("");
}
function renderAuth(mode) {
  const reset = mode === "reset-password";
  const register = mode === "register";
  const headingText = reset ? "Let's get you back in." : register ? "Your next chapter starts here." : "Welcome back.";
  const description = reset
    ? "Enter your email and Firebase will send you a secure password reset link."
    : "Continue securely with your Google Account. No email or password entry needed.";
  const setupMessage = firebaseConfigured
    ? ""
    : `<div class="auth-setup-note">${firebaseInitError ? "Firebase could not initialize. Check your Firebase configuration and browser console." : "Firebase is not configured yet. Add your project settings to firebase-config.js and follow FIREBASE_SETUP.md to enable authentication."}</div>`;
  if (!reset) {
    return `<section class="auth-shell"><div class="card form-card"><a class="brand" href="#/dashboard"><span class="brand-icon">g</span><span>govt<span class="brand-accent">prep</span></span></a><h1>${headingText}</h1><p class="subheading">${description}</p>${setupMessage}<button class="button google-button" type="button" data-google-sign-in><span class="google-mark" aria-hidden="true">G</span>Continue with Google</button><p class="auth-footnote">${firebaseConfigured ? "Your Google Account securely verifies your sign-in." : "Demo mode · Configure Firebase to enable Google sign-in."}</p></div></section>`;
  }
  return `<section class="auth-shell"><form class="card form-card" data-auth-form data-auth-mode="${mode}"><a class="brand" href="#/dashboard"><span class="brand-icon">g</span><span>govt<span class="brand-accent">prep</span></span></a><h1>${headingText}</h1><p class="subheading">${description}</p>${setupMessage}<div class="form-field"><label for="auth-email">Email address</label><input class="form-input" id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div><button class="button" type="submit">Send password reset link →</button><p class="form-note">Remembered your password? <a href="#/login">Sign in with Google</a></p></form></section>`;
}
async function handleAuthSubmission(form) {
  const mode = form.dataset.authMode;
  const values = new FormData(form);
  const email = String(values.get("email") || "").trim();
  const submitButton = form.querySelector('button[type="submit"]');
  if (!firebaseConfigured) {
    showToast(firebaseInitError
      ? "Firebase could not initialize. Check firebase-config.js and the browser console."
      : "Set up your Firebase project in firebase-config.js to enable authentication.", "error");
    return;
  }
  submitButton.disabled = true;
  try {
    if (mode !== "reset-password") return;
    await sendPasswordResetEmail(auth, email);
    showToast("If an account exists for that email, Firebase will send a password reset link.");
  } catch (error) {
    reportFirebaseError(error, "Password reset failed");
  } finally {
    submitButton.disabled = false;
  }
}
async function handleGoogleSignIn(button) {
  if (!firebaseConfigured) {
    showToast(firebaseInitError
      ? "Firebase could not initialize. Check firebase-config.js and the browser console."
      : "Set up your Firebase project in firebase-config.js to enable authentication.", "error");
    return;
  }
  button.disabled = true;
  try {
    const credential = await signInWithPopup(auth, new GoogleAuthProvider());
    currentUser = credential.user;
    navigate("dashboard");
    showToast("You're signed in to GovtPrep with Google.");
  } catch (error) {
    reportFirebaseError(error, "Google sign-in failed");
  } finally {
    button.disabled = false;
  }
}
function render() {
  const page = (location.hash.replace(/^#\/?/, "") || "dashboard").split("?")[0];
  const knownPage = routes[page] ? page : "dashboard";
  const enteredPage = knownPage !== lastRenderedPage;
  lastRenderedPage = knownPage;
  heading(knownPage);
  const sidebar = document.querySelector(".sidebar");
  const topbar = document.querySelector(".topbar");
  const mobileBar = document.querySelector(".mobile-topbar");
  const backdrop = document.querySelector(".sidebar-backdrop");
  const authPage = knownPage === "login" || knownPage === "register" || knownPage === "reset-password";
  sidebar.style.display = authPage ? "none" : "";
  topbar.style.display = authPage ? "none" : "";
  mobileBar.style.display = authPage ? "none" : "";
  document.querySelector(".main-content").style.marginLeft = authPage ? "0" : "";
  app.innerHTML = ({
    dashboard: renderDashboard, home: renderHome, exams: renderExams, practice: renderPractice,
    "mock-tests": renderMock, "current-affairs": renderAffairs, planner: renderPlanner,
    assistant: renderAssistant, "video-classes": renderVideoLessons, jobs: renderJobs,
    "previous-papers": renderPreviousPapers,
  }[knownPage] || (() => renderAuth(knownPage)))();
  if (knownPage === "video-classes") appendVideoQuickTrick();
  if (knownPage === "jobs") appendJobRefreshControls();
  if (knownPage === "dashboard") appendPaperAttemptDashboard();
  document.querySelectorAll(".side-nav a").forEach(link => link.classList.toggle("active", link.dataset.route === knownPage));
  document.querySelector(".sidebar").classList.remove("open");
  backdrop.classList.remove("visible");
  if (knownPage === "mock-tests" && activeMockQuestions.length && !mockResult) startTimer();
  if (enteredPage && knownPage === "jobs" && currentUser && firebaseConfigured) {
    void refreshJobNotifications(false);
  }
  if (enteredPage && knownPage === "previous-papers") void loadPreviousPaperCatalog();
}
function startTimer() {
  if (mockTimer !== null || !mockDeadline || mockResult) return;
  mockTimer = window.setInterval(() => {
    mockSeconds = Math.max(0, Math.ceil((mockDeadline - Date.now()) / 1000));
    updateTimer();
    if (mockSeconds === 0) {
      stopTimer();
      submitMock(true);
    }
  }, 1000);
  updateTimer();
}
function stopTimer() { if (mockTimer !== null) { window.clearInterval(mockTimer); mockTimer = null; } }
function updateTimer() {
  const element = document.querySelector("[data-timer]");
  if (!element) return;
  element.textContent = formatDuration(mockSeconds);
  element.classList.toggle("urgent", mockSeconds <= 60);
}
function startMock(randomize = false) {
  const balancedQuestions = balancedMockQuestions();
  activeMockQuestions = randomize ? shuffle(balancedQuestions) : balancedQuestions;
  mockIndex = 0;
  mockAnswers = {};
  mockResult = null;
  mockStartedAt = Date.now();
  mockSeconds = 30 * 60;
  mockDeadline = Date.now() + mockSeconds * 1000;
  startTimer();
  render();
}
function submitMock(automatic = false) {
  if (!activeMockQuestions.length || mockResult) return;
  if (!automatic && !window.confirm("Submit your mock examination now? You can’t change answers after submission.")) return;
  mockSeconds = Math.max(0, Math.ceil((mockDeadline - Date.now()) / 1000));
  mockResult = saveTestResult("mock", "SSC CGL · Mixed subjects", activeMockQuestions, mockAnswers, (Date.now() - mockStartedAt) / 1000);
  stopTimer();
  if (location.hash.startsWith("#/mock-tests")) render();
  showToast(automatic ? "Time is up. Your mock exam was submitted automatically." : "Your mock exam has been submitted.");
}
function filterJobList() {
  const search = document.querySelector("[data-job-search]")?.value.trim().toLowerCase() || jobSearchTerm.trim().toLowerCase();
  const filtered = jobs.filter(job => (selectedJobCategory === "All" || job.category === selectedJobCategory) &&
    `${job.title} ${job.organization} ${job.eligibility} ${job.category}`.toLowerCase().includes(search));
  const list = document.querySelector("[data-job-list]");
  if (list) list.innerHTML = renderJobRows(filtered);
}
async function submitChat(text, options = {}) {
  const prompt = String(text || "").trim();
  if (!prompt || assistantBusy) return;
  if (!firebaseConfigured || !currentUser || !functions) {
    showToast("Sign in with Google to use the AI study assistant.", "error");
    navigate("login");
    return;
  }
  if (prompt.length > 2000) {
    showToast("Keep your question under 2,000 characters.", "error");
    return;
  }
  const uid = currentUser.uid;
  const startsConversation = !assistantConversationId;
  if (!assistantConversationId) {
    assistantConversationId = assistantId();
    const conversation = { id: assistantConversationId, title: prompt.slice(0, 80), updatedAt: new Date() };
    assistantConversations.unshift(conversation);
  }
  const conversationId = assistantConversationId;
  const userMessage = { id: assistantId(), role: "user", text: prompt, mode: options.mode || "tutor" };
  assistantMessages.push(userMessage);
  assistantBusy = true;
  assistantError = "";
  if (location.hash.startsWith("#/assistant")) render();
  try {
    if (startsConversation) {
      await setDoc(doc(db, "aiChats", uid, "conversations", conversationId), {
        title: prompt.slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await setDoc(doc(db, "aiChats", uid, "conversations", conversationId, "messages", userMessage.id), {
      role: userMessage.role,
      text: userMessage.text,
      mode: userMessage.mode,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "aiChats", uid, "conversations", conversationId), { updatedAt: serverTimestamp() }, { merge: true });
    const callable = httpsCallable(functions, "generateStudyContent");
    const result = await callable({
      task: "chat",
      question: prompt,
      mode: options.mode || "tutor",
      language: options.language || "English",
      targetExam: studentProfile.targetExam,
      history: assistantMessages.slice(-13, -1).map(message => ({ role: message.role, text: message.text })),
    });
    const answer = result.data?.answer;
    if (typeof answer !== "string" || !answer.trim()) throw new Error("The AI service returned an empty answer. Please try again.");
    const assistantMessage = { id: assistantId(), role: "assistant", text: answer.trim(), mode: options.mode || "tutor" };
    assistantMessages.push(assistantMessage);
    await setDoc(doc(db, "aiChats", uid, "conversations", conversationId, "messages", assistantMessage.id), {
      role: assistantMessage.role,
      text: assistantMessage.text,
      mode: assistantMessage.mode,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "aiChats", uid, "conversations", conversationId), { updatedAt: serverTimestamp() }, { merge: true });
    assistantConversations.sort((first, second) => new Date(second.updatedAt?.toDate?.() || second.updatedAt) - new Date(first.updatedAt?.toDate?.() || first.updatedAt));
  } catch (error) {
    assistantError = error?.message || "The AI service is unavailable. Please try again shortly.";
    console.error("AI study chat failed.", error);
  } finally {
    assistantBusy = false;
    if (location.hash.startsWith("#/assistant")) render();
  }
}
async function generateAiQuestions(form) {
  if (!currentUser || !functions) {
    showToast("Sign in with Google to generate and save AI questions.", "error");
    navigate("login");
    return;
  }
  const values = new FormData(form);
  assistantQuestionOptions = {
    subject: String(values.get("subject")),
    difficulty: String(values.get("difficulty")),
    count: Number(values.get("count")),
    language: String(values.get("language")),
  };
  assistantGenerating = true;
  render();
  try {
    const callable = httpsCallable(functions, "generateStudyContent");
    const result = await callable({ task: "questions", ...assistantQuestionOptions, targetExam: studentProfile.targetExam });
    const questionsToSave = result.data?.questions;
    if (!Array.isArray(questionsToSave) || !questionsToSave.length) throw new Error("The AI service returned no questions. Please try again.");
    assistantQuestions = questionsToSave.map(question => {
      if (typeof question.question !== "string" || !Array.isArray(question.options) || question.options.length !== 4 ||
        !Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3 ||
        typeof question.explanation !== "string") throw new Error("The AI service returned an invalid question set. Please try again.");
      return { ...question, id: assistantId() };
    });
    await Promise.all(assistantQuestions.map(question => setDoc(doc(db, "aiQuestions", currentUser.uid, "items", question.id), {
      subject: assistantQuestionOptions.subject,
      difficulty: assistantQuestionOptions.difficulty,
      question: question.question,
      options: question.options,
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      topic: question.topic || "",
      createdAt: serverTimestamp(),
    })));
  } catch (error) {
    showToast(error?.message || "Could not generate questions. Please try again.", "error");
  } finally {
    assistantGenerating = false;
    if (location.hash.startsWith("#/assistant")) render();
  }
}
async function generateAiRecommendations(language) {
  if (!currentUser || !functions) {
    showToast("Sign in with Google to get personalized study recommendations.", "error");
    navigate("login");
    return;
  }
  assistantGenerating = true;
  render();
  try {
    const callable = httpsCallable(functions, "generateStudyContent");
    const result = await callable({
      task: "recommendations",
      language,
      targetExam: studentProfile.targetExam,
      subjectStats: getWeakSubjectStats().map(({ subject, accuracy, attempts }) => ({ subject, accuracy, attempts })),
    });
    if (!Array.isArray(result.data?.recommendations) || !result.data.recommendations.length) throw new Error("The AI service returned no recommendations. Please try again.");
    assistantRecommendations = result.data.recommendations;
  } catch (error) {
    showToast(error?.message || "Could not build recommendations. Please try again.", "error");
  } finally {
    assistantGenerating = false;
    if (location.hash.startsWith("#/assistant")) render();
  }
}
async function toggleAssistantBookmark(itemId, kind) {
  if (!currentUser || !firebaseConfigured) {
    showToast("Sign in with Google to save AI explanations.", "error");
    navigate("login");
    return;
  }
  const reference = doc(db, "aiBookmarks", currentUser.uid, "items", itemId);
  try {
    if (assistantBookmarks.includes(itemId)) {
      await deleteDoc(reference);
      assistantBookmarks = assistantBookmarks.filter(id => id !== itemId);
      showToast("Saved explanation removed.");
    } else {
      const question = assistantQuestions.find(item => item.id === itemId);
      const message = assistantMessages.find(item => item.id === itemId);
      if (!question && !message) return;
      await setDoc(reference, {
        kind,
        prompt: question?.question || assistantMessages[assistantMessages.indexOf(message) - 1]?.text || "Study explanation",
        text: question?.explanation || message?.text || "",
        subject: question ? assistantQuestionOptions.subject : "",
        createdAt: serverTimestamp(),
      });
      assistantBookmarks = [itemId, ...assistantBookmarks];
      showToast("AI explanation saved to your account.");
    }
    if (location.hash.startsWith("#/assistant")) render();
  } catch (error) {
    reportFirebaseError(error, "Could not save your AI explanation");
  }
}
async function clearAssistantConversation() {
  if (!currentUser || !assistantConversationId) return;
  const uid = currentUser.uid;
  const conversationId = assistantConversationId;
  try {
    const messages = await getDocs(collection(db, "aiChats", uid, "conversations", conversationId, "messages"));
    await Promise.all(messages.docs.map(message => deleteDoc(message.ref)));
    await deleteDoc(doc(db, "aiChats", uid, "conversations", conversationId));
    assistantConversations = assistantConversations.filter(conversation => conversation.id !== conversationId);
    assistantConversationId = null;
    assistantMessages = [];
    assistantError = "";
    render();
  } catch (error) {
    reportFirebaseError(error, "Could not clear this conversation");
  }
}

document.addEventListener("click", event => {
  const target = event.target.closest("button, [data-menu-toggle], [data-menu-close]");
  if (!target) return;
  if (target.hasAttribute("data-menu-toggle")) {
    document.querySelector(".sidebar").classList.toggle("open");
    document.querySelector(".sidebar-backdrop").classList.toggle("visible");
  } else if (target.hasAttribute("data-menu-close")) {
    document.querySelector(".sidebar").classList.remove("open");
    document.querySelector(".sidebar-backdrop").classList.remove("visible");
  } else if (target.hasAttribute("data-notification")) {
    showToast("You're all caught up on notifications.");
  } else if (target.hasAttribute("data-profile")) {
    navigate(currentUser ? "dashboard" : "login");
  } else if (target.hasAttribute("data-profile-button")) {
    navigate(currentUser ? "dashboard" : "login");
  } else if (target.hasAttribute("data-google-sign-in")) {
    void handleGoogleSignIn(target);
  } else if (target.hasAttribute("data-logout")) {
    if (!firebaseConfigured || !currentUser) {
      showToast("Firebase is not configured. Follow FIREBASE_SETUP.md to enable sign out.", "error");
      return;
    }
    signOut(auth).then(() => {
      navigate("home");
      showToast("You have been signed out.");
    }).catch(error => reportFirebaseError(error, "Could not sign out"));
  } else if (target.hasAttribute("data-exam-filter")) {
    document.querySelectorAll("[data-exam-filter]").forEach(b => b.classList.toggle("active", b === target));
    const term = document.querySelector("[data-exam-search]")?.value.toLowerCase() || "";
    const mode = target.dataset.examFilter;
    document.querySelector(".exam-cards").innerHTML = renderExamCards(exams.filter(e => (mode === "all" || e.mode === mode) && `${e.name} ${e.area} ${e.detail}`.toLowerCase().includes(term)));
  } else if (target.hasAttribute("data-practice-category")) {
    setupPractice(target.dataset.practiceCategory); render();
  } else if (target.hasAttribute("data-practice-daily")) {
    setupPractice("daily", true); render();
  } else if (target.hasAttribute("data-practice-randomize")) {
    setupPractice(activePracticeCategory, practiceIsDaily, true); render();
    showToast("Your questions have been shuffled.");
  } else if (target.hasAttribute("data-practice-answer")) {
    practiceAnswers[practiceIndex] = Number(target.dataset.practiceAnswer); render();
  } else if (target.hasAttribute("data-practice-next")) {
    practiceIndex = Math.min(practiceQuestionSet.length - 1, practiceIndex + 1); render();
  } else if (target.hasAttribute("data-practice-prev")) {
    practiceIndex = Math.max(0, practiceIndex - 1); render();
  } else if (target.hasAttribute("data-practice-jump")) {
    practiceIndex = Number(target.dataset.practiceJump); render();
  } else if (target.hasAttribute("data-practice-submit")) {
    practiceResult = saveTestResult(
      "practice",
      practiceIsDaily ? "Daily mixed-subject challenge" : `${practiceSubjects.find(subject => subject.id === activePracticeCategory).label} practice`,
      practiceQuestionSet,
      practiceAnswers,
      (Date.now() - practiceStartedAt) / 1000,
    );
    render();
  } else if (target.hasAttribute("data-retry-practice")) {
    setupPractice(activePracticeCategory, practiceIsDaily);
    render();
  } else if (target.hasAttribute("data-practice-back")) {
    practiceResult = null;
    setupPractice(activePracticeCategory, practiceIsDaily);
    render();
  } else if (target.hasAttribute("data-mock-start")) {
    startMock();
  } else if (target.hasAttribute("data-mock-start-random")) {
    startMock(true);
  } else if (target.hasAttribute("data-mock-answer")) {
    mockAnswers[mockIndex] = Number(target.dataset.mockAnswer); render();
  } else if (target.hasAttribute("data-mock-next")) {
    mockIndex = Math.min(activeMockQuestions.length - 1, mockIndex + 1); render();
  } else if (target.hasAttribute("data-mock-prev")) {
    mockIndex = Math.max(0, mockIndex - 1); render();
  } else if (target.hasAttribute("data-mock-jump")) {
    mockIndex = Number(target.dataset.mockJump); render();
  } else if (target.hasAttribute("data-mock-submit")) {
    submitMock();
  } else if (target.hasAttribute("data-retry-mock")) {
    mockResult = null;
    activeMockQuestions = [];
    mockIndex = 0;
    mockAnswers = {};
    mockSeconds = 30 * 60;
    mockDeadline = 0;
    mockStartedAt = 0;
    render();
  } else if (target.hasAttribute("data-bookmark")) {
    const bookmarks = getQuestionBookmarks();
    const questionId = target.dataset.bookmark;
    const updated = bookmarks.includes(questionId) ? bookmarks.filter(id => id !== questionId) : [...bookmarks, questionId];
    writeStorage("govtprep-bookmarked-questions", updated);
    const question = questionBank.find(item => item.id === questionId);
    if (question) void persistBookmark(question);
    render();
    showToast(updated.includes(questionId) ? "Question bookmarked." : "Bookmark removed.");
  } else if (target.hasAttribute("data-history-view")) {
    const result = readStorage("govtprep-test-history", []).find(item => item.id === target.dataset.historyView);
    if (!result) {
      showToast("This saved result is no longer available.", "error");
      return;
    }
    if (target.dataset.historyType === "mock") mockResult = result;
    else practiceResult = result;
    render();
  } else if (target.hasAttribute("data-planner-day")) {
    selectedPlannerDay = Number(target.dataset.plannerDay); render();
  } else if (target.hasAttribute("data-planner-reset")) {
    const saved = readStorage("govtprep-planner", {});
    for (let i = 0; i < 4; i++) delete saved[`${selectedPlannerDay}-${i}`];
    writeStorage("govtprep-planner", saved);
    void persistStudyPlan(String(selectedPlannerDay), plannerTasksForDay(selectedPlannerDay), studentProfile.studyGoal);
    render(); showToast("Today's study plan has been reset.");
  } else if (target.hasAttribute("data-job-filter")) {
    selectedJobCategory = target.dataset.jobFilter;
    document.querySelectorAll("[data-job-filter]").forEach(b => b.classList.toggle("active", b === target));
    filterJobList();
  } else if (target.hasAttribute("data-save-job")) {
    const saved = readStorage("govtprep-saved-jobs", []);
    const title = target.dataset.saveJob;
    const next = saved.includes(title) ? saved.filter(item => item !== title) : [...saved, title];
    writeStorage("govtprep-saved-jobs", next); filterJobList();
    showToast(next.includes(title) ? "Vacancy saved to your shortlist." : "Vacancy removed from your shortlist.");
  } else if (target.hasAttribute("data-news-save")) {
    writeStorage("govtprep-news-saved", true); showToast("Today's current affairs digest is saved.");
  } else if (target.hasAttribute("data-play-lesson")) {
    activeVideoId = target.dataset.playLesson;
    render();
  } else if (target.hasAttribute("data-video-bookmark")) {
    void toggleVideoProgress(target.dataset.videoBookmark, "bookmarked");
  } else if (target.hasAttribute("data-video-complete")) {
    void toggleVideoProgress(target.dataset.videoComplete, "completed");
  } else if (target.hasAttribute("data-video-level")) {
    videoLevelFilter = target.dataset.videoLevel;
    render();
  } else if (target.hasAttribute("data-video-status")) {
    videoStatusFilter = target.dataset.videoStatus;
    render();
  } else if (target.hasAttribute("data-job-refresh")) {
    void refreshJobNotifications();
  } else if (target.hasAttribute("data-ai-view")) {
    assistantView = target.dataset.aiView;
    render();
  } else if (target.hasAttribute("data-ai-new-chat")) {
    assistantConversationId = null;
    assistantMessages = [];
    assistantError = "";
    render();
  } else if (target.hasAttribute("data-ai-clear")) {
    void clearAssistantConversation();
  } else if (target.hasAttribute("data-ai-conversation")) {
    void loadAssistantConversation(target.dataset.aiConversation)
      .then(() => render())
      .catch(error => reportFirebaseError(error, "Could not load this conversation"));
  } else if (target.hasAttribute("data-ai-bookmark")) {
    void toggleAssistantBookmark(target.dataset.aiBookmark, "explanation");
  } else if (target.hasAttribute("data-ai-question-bookmark")) {
    void toggleAssistantBookmark(target.dataset.aiQuestionBookmark, "question");
  } else if (target.hasAttribute("data-suggestion")) {
    void submitChat(target.dataset.suggestion, { mode: "tutor", language: "English" });
  }
});
document.addEventListener("change", event => {
  if (event.target.matches("[data-video-subject]")) {
    videoSubjectFilter = event.target.value;
    render();
  } else if (event.target.matches("[data-video-channel]")) {
    videoChannelFilter = event.target.value;
    render();
  } else if (event.target.matches(".dashboard-task")) {
    const tasks = getDashboardTasks();
    tasks[Number(event.target.dataset.task)] = event.target.checked;
    writeStorage("govtprep-tasks", tasks);
    if (event.target.checked) recordStudyActivity();
    void persistStudyPlan("dashboard", Object.fromEntries(tasks.map((complete, index) => [String(index), Boolean(complete)])), studentProfile.studyGoal);
    event.target.closest(".task-row").classList.toggle("is-done", event.target.checked);
    document.querySelector("[data-today-task-count]").innerHTML = `${tasks.filter(Boolean).length} <small>/ ${tasks.length}</small>`;
  } else if (event.target.matches(".planner-done")) {
    const tasks = readStorage("govtprep-planner", {});
    tasks[`${selectedPlannerDay}-${event.target.dataset.plannerTask}`] = event.target.checked;
    writeStorage("govtprep-planner", tasks);
    if (event.target.checked) recordStudyActivity();
    void persistStudyPlan(String(selectedPlannerDay), plannerTasksForDay(selectedPlannerDay), studentProfile.studyGoal);
    render();
  }
});
document.addEventListener("input", event => {
  if (event.target.matches("[data-exam-search]")) {
    const mode = document.querySelector("[data-exam-filter].active")?.dataset.examFilter || "all";
    const term = event.target.value.toLowerCase();
    document.querySelector(".exam-cards").innerHTML = renderExamCards(exams.filter(e => (mode === "all" || e.mode === mode) && `${e.name} ${e.area} ${e.detail}`.toLowerCase().includes(term)));
  } else if (event.target.matches("[data-job-search]")) {
    jobSearchTerm = event.target.value;
    filterJobList();
  } else if (event.target.matches("[data-video-search]")) {
    videoSearchTerm = event.target.value;
    const list = document.querySelector("[data-video-cards]");
    if (list) list.innerHTML = renderVideoCardList();
  }
});
document.addEventListener("submit", event => {
  if (event.target.matches("[data-chat-form]")) {
    event.preventDefault();
    const form = event.target;
    const input = form.elements.question;
    void submitChat(input.value, {
      mode: form.elements.mode.value,
      language: form.elements.language.value,
    });
    input.value = "";
  } else if (event.target.matches("[data-goal-form]")) {
    event.preventDefault();
    const goal = String(new FormData(event.target).get("goal") || "").trim();
    if (goal.length > 500) {
      showToast("Keep your study goal under 500 characters.", "error");
      return;
    }
    studentProfile.studyGoal = goal;
    writeStorage("govtprep-profile", studentProfile);
    void persistStudentProfile(studentProfile);
    void persistStudyPlan(String(selectedPlannerDay), plannerTasksForDay(selectedPlannerDay), goal);
    render();
    showToast("Your study goal has been saved.");
  } else if (event.target.matches("[data-auth-form]")) {
    event.preventDefault();
    void handleAuthSubmission(event.target);
  } else if (event.target.matches("[data-ai-question-form]")) {
    event.preventDefault();
    void generateAiQuestions(event.target);
  } else if (event.target.matches("[data-ai-recommend-form]")) {
    event.preventDefault();
    void generateAiRecommendations(String(new FormData(event.target).get("language") || "English"));
  }
});
window.addEventListener("hashchange", render);
initializePreviousPapers({
  onUpdated: () => {
    if (location.hash.startsWith("#/previous-papers") || location.hash.startsWith("#/dashboard")) render();
  },
  onActivity: recordStudyActivity,
});
initializeFirebaseAuth();
updateAuthChrome();
render();
