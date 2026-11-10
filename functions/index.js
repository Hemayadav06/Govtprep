const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const SUBJECTS = {
  aptitude: "Quantitative Aptitude",
  reasoning: "Logical Reasoning",
  english: "English",
  gk: "General Knowledge",
  science: "General Science",
  computer: "Computer Knowledge",
};
const DAILY_REQUEST_LIMIT = 40;
const MAX_PROMPT_LENGTH = 2000;

function boundedText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function requireLanguage(value) {
  if (value !== "English" && value !== "Telugu") {
    throw new HttpsError("invalid-argument", "Choose English or Telugu.");
  }
  return value;
}

async function consumeDailyRequest(uid) {
  const firestore = getFirestore();
  const usageRef = firestore.doc(`_privateAiUsage/${uid}`);
  const day = new Date().toISOString().slice(0, 10);
  await firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(usageRef);
    const data = snapshot.data() || {};
    const count = data.day === day ? Number(data.count) || 0 : 0;
    if (count >= DAILY_REQUEST_LIMIT) {
      throw new HttpsError("resource-exhausted", "Daily AI limit reached. Try again tomorrow.");
    }
    transaction.set(usageRef, { day, count: count + 1, updatedAt: Timestamp.now() });
  });
}

async function requestModel(messages, jsonMode = false, maxTokens = 1800) {
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY.value()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.35,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (error) {
    console.error("AI provider connection failed.", error);
    throw new HttpsError("unavailable", "The AI service is temporarily unavailable. Please try again.");
  }
  if (!response.ok) {
    const details = await response.text();
    console.error("AI provider returned an error.", response.status, details.slice(0, 500));
    if (response.status === 429) {
      throw new HttpsError("resource-exhausted", "The AI service is busy. Please try again shortly.");
    }
    throw new HttpsError("unavailable", "The AI service could not complete that request. Please try again.");
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new HttpsError("data-loss", "The AI service returned an empty response. Please try again.");
  }
  return content.trim();
}

function parseJson(content) {
  try {
    return JSON.parse(content);
  } catch {
    throw new HttpsError("data-loss", "The AI service returned an unreadable response. Please try again.");
  }
}

async function generateChat(data) {
  const question = data.question.trim();
  const language = requireLanguage(data.language);
  const mode = data.mode === "doubt" ? "doubt" : data.mode === "tutor" ? "tutor" : null;
  if (!mode) throw new HttpsError("invalid-argument", "Choose a valid assistant mode.");
  const targetExam = boundedText(data.targetExam, 100) ? data.targetExam.trim() : "government competitive examinations";
  const history = Array.isArray(data.history) ? data.history.slice(-12).flatMap(message => {
    if (!message || !["user", "assistant"].includes(message.role) || !boundedText(message.text, MAX_PROMPT_LENGTH)) return [];
    return [{ role: message.role, content: message.text.trim() }];
  }) : [];
  const modeInstruction = mode === "doubt"
    ? "Solve the student's doubt directly. For mathematics, show numbered steps and verify the result. For reasoning, explain an efficient shortcut and why it works. For English, clarify the grammar rule and give an example. For general knowledge, explain the context and distinguish stable facts from current information."
    : "Teach the topic in beginner-friendly language. Break difficult ideas into clear steps, use a small example when useful, and connect the explanation to exam preparation.";
  const content = await requestModel([
    { role: "system", content: `You are GovtPrep's tutor for Indian government competitive exams such as SSC, UPSC, banking, railways, and state services. Respond in ${language}. ${modeInstruction} Be accurate and concise. Never invent official notifications, dates, citations, or current facts; clearly say when something should be checked against an official source. Target exam: ${targetExam}.` },
    ...history,
    { role: "user", content: question },
  ], false, 1500);
  return { answer: content.slice(0, 8000) };
}

async function generateQuestions(data) {
  const subject = SUBJECTS[data.subject];
  if (!subject) throw new HttpsError("invalid-argument", "Choose one of the supported subjects.");
  if (!["easy", "medium", "hard"].includes(data.difficulty)) {
    throw new HttpsError("invalid-argument", "Choose a valid difficulty level.");
  }
  if (![3, 5, 10].includes(data.count)) throw new HttpsError("invalid-argument", "Choose 3, 5, or 10 questions.");
  const language = requireLanguage(data.language);
  const targetExam = boundedText(data.targetExam, 100) ? data.targetExam.trim() : "government competitive examinations";
  const content = await requestModel([
    { role: "system", content: `Create original multiple-choice practice questions for Indian government competitive exams. Return only a JSON object with a "questions" array. Each item must have "question" (string), "options" (exactly four strings), "answerIndex" (integer 0-3), "explanation" (beginner-friendly explanation with steps where useful), and "topic" (short string). The correct answer must be unambiguous and exactly match options[answerIndex]. Use ${language}. Do not include markdown.` },
    { role: "user", content: `Create exactly ${data.count} ${data.difficulty} difficulty questions for ${subject}, suitable for ${targetExam}. Cover a mix of relevant syllabus topics without repeating questions.` },
  ], true, 3500);
  const parsed = parseJson(content);
  if (!Array.isArray(parsed.questions) || parsed.questions.length !== data.count) {
    throw new HttpsError("data-loss", "The AI service returned an incomplete question set. Please try again.");
  }
  const questions = parsed.questions.map(question => {
    if (!boundedText(question.question, 1000) || !Array.isArray(question.options) || question.options.length !== 4 ||
      question.options.some(option => !boundedText(option, 300)) || !Number.isInteger(question.answerIndex) ||
      question.answerIndex < 0 || question.answerIndex > 3 || !boundedText(question.explanation, 2000)) {
      throw new HttpsError("data-loss", "The AI service returned an invalid question. Please try again.");
    }
    return {
      question: question.question.trim(),
      options: question.options.map(option => option.trim()),
      answerIndex: question.answerIndex,
      explanation: question.explanation.trim(),
      topic: boundedText(question.topic, 100) ? question.topic.trim() : subject,
    };
  });
  return { questions };
}

async function generateRecommendations(data) {
  const language = requireLanguage(data.language);
  const targetExam = boundedText(data.targetExam, 100) ? data.targetExam.trim() : "government competitive examinations";
  const subjectStats = Array.isArray(data.subjectStats) ? data.subjectStats.slice(0, 6).flatMap(item => {
    if (!item || !boundedText(item.subject, 80) || !Number.isFinite(item.accuracy) || item.accuracy < 0 || item.accuracy > 100) return [];
    return [{ subject: item.subject, accuracy: Math.round(item.accuracy), attempts: Math.max(0, Math.min(500, Number(item.attempts) || 0)) }];
  }) : [];
  const content = await requestModel([
    { role: "system", content: `You are a study planner for Indian government exam preparation. Return only JSON with a "recommendations" array of 3 or 4 items. Each item must have "subject", "reason", "focusTopic", and "exercise" as short strings. Rank weak subjects first when results are supplied. Recommend practical daily exercises. If no results exist, clearly make general suggestions rather than claiming to know weaknesses. Use ${language}; no markdown.` },
    { role: "user", content: JSON.stringify({ targetExam, subjectStats }) },
  ], true, 1800);
  const parsed = parseJson(content);
  if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length < 2 || parsed.recommendations.length > 4) {
    throw new HttpsError("data-loss", "The AI service returned an invalid study plan. Please try again.");
  }
  const recommendations = parsed.recommendations.map(item => {
    if (!boundedText(item.subject, 100) || !boundedText(item.reason, 500) ||
      !boundedText(item.focusTopic, 200) || !boundedText(item.exercise, 500)) {
      throw new HttpsError("data-loss", "The AI service returned an incomplete study recommendation.");
    }
    return {
      subject: item.subject.trim(),
      reason: item.reason.trim(),
      focusTopic: item.focusTopic.trim(),
      exercise: item.exercise.trim(),
    };
  });
  return { recommendations };
}

exports.generateStudyContent = onCall({ secrets: [OPENAI_API_KEY], timeoutSeconds: 60 }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in to use the AI study assistant.");
  const data = request.data || {};
  if (!boundedText(data.task, 30)) throw new HttpsError("invalid-argument", "Choose a valid study assistant task.");
  if (data.task === "chat" && !boundedText(data.question, MAX_PROMPT_LENGTH)) {
    throw new HttpsError("invalid-argument", "Enter a question under 2,000 characters.");
  }
  await consumeDailyRequest(request.auth.uid);
  if (data.task === "chat") return generateChat(data);
  if (data.task === "questions") return generateQuestions(data);
  if (data.task === "recommendations") return generateRecommendations(data);
  throw new HttpsError("invalid-argument", "Unsupported study assistant task.");
});
