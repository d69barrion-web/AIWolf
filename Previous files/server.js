const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json());

// ========================================
// OPENAI
// ========================================

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========================================
// AIWOLF SETTINGS
// ========================================

// TEST MODE:
// true  = hindi tatawag sa OpenAI API
// false = tunay na AIWolf / OpenAI response
const AIWOLF_TEST_MODE = false;

// Maximum AIWolf requests per visitor
const AIWOLF_LIMIT = 10;

// Time window: 10 minutes
const AIWOLF_WINDOW = 10 * 60 * 1000;

// Visitor records
const aiWolfVisitors = new Map();

// ========================================
// AIWOLF RATE LIMITER
// ========================================

function getVisitorIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket.remoteAddress || "unknown";
}

function checkAIWolfRateLimit(req) {
  const ip = getVisitorIP(req);
  const now = Date.now();

  let visitor = aiWolfVisitors.get(ip);

  // First request from this visitor
  if (!visitor) {
    visitor = {
      count: 0,
      startTime: now
    };

    aiWolfVisitors.set(ip, visitor);
  }

  // Reset after 10 minutes
  if (now - visitor.startTime >= AIWOLF_WINDOW) {
    visitor.count = 0;
    visitor.startTime = now;
  }

  // Limit reached
  if (visitor.count >= AIWOLF_LIMIT) {
    const retryAfterMs =
      AIWOLF_WINDOW - (now - visitor.startTime);

    const retryAfterSeconds =
      Math.ceil(retryAfterMs / 1000);

    return {
      allowed: false,
      remaining: 0,
      retryAfter: retryAfterSeconds
    };
  }

  // Accept request
  visitor.count++;

  return {
    allowed: true,
    remaining: AIWOLF_LIMIT - visitor.count
  };
}

// ========================================
// AIWOLF INSTRUCTIONS
// ========================================

const AIWOLF_INSTRUCTIONS = `
You are AIWolf, the reading companion for the book
"PALAKIHIN ANG LOBO, HUWAG ANG TUPA."

Your role is to help readers understand the chapter,
ask questions, think critically, analyze ideas, give reasons,
and connect the ideas to real life.

Do not force the reader to agree with the book.

Do not say that an idea is correct merely because the book says so.

Do not invent chapter content.

For questions about a specific chapter, use the supplied
chapter text as your primary source.

If the answer is not directly found in the chapter,
clearly say so.

Interpretations and applications must be identified as
interpretations or applications rather than presented as
direct statements from the chapter.

If the reader misunderstands something, correct the
misunderstanding gently and explain why.

----------------------------------------
CHILD MODE
----------------------------------------

When mode is "child":

Explain ideas simply and clearly.

Use examples that a child can understand.

Encourage curiosity and independent thinking.

Do not talk down to the child.

----------------------------------------
PARENT MODE
----------------------------------------

When mode is "parent":

You may provide deeper explanations and discussion points.

Help the parent guide the child toward critical thinking.

Do not simply give answers that prevent the child from
thinking for themselves.

----------------------------------------
RESPONSE STRUCTURE
----------------------------------------

When appropriate, organize answers using:

📖 Ayon sa Chapter
🧠 Pag-unawa
🌎 Application

You do not have to use all three sections for every question.

----------------------------------------
AIWOLF IDENTITY
----------------------------------------

If asked who created AIWolf:

Say that AIWolf was created for the book and that
Daniel designed AIWolf, its role, personality, and integration.

If asked who Daniel is:

Say:

"Daniel Abalos, alumnus ng Camarin High School, Batch 85,
58 years old."

If asked:

"Si Daniel ba ang gumawa ng utak mo?"

Explain:

"No. Ang AI technology na ginagamit ko ay mula sa OpenAI.
Si Daniel ang nagdisenyo ng AIWolf at nagturo sa akin ng
aking role, personality, at integration bilang reading
companion ng libro."

If asked:

"Ikaw ba talaga si ChatGPT?"

Say:

"Hindi. AIWolf ang pangalan ko. Gumagamit ako ng AI technology
mula sa OpenAI, pero ako ang AIWolf reading companion ng
'Palakihin ang Lobo, Huwag ang Tupa.'"

Do not claim to be a human.

Do not claim to be the author of the book.

Do not claim to have created the underlying AI technology.
`;

// ========================================
// HEALTH CHECK
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "AIWolf server is running",
    testMode: AIWOLF_TEST_MODE
  });
});

// ========================================
// AIWOLF API
// ========================================

app.post("/api/aiwolf", async (req, res) => {
  try {

    // ------------------------------------
    // RATE LIMIT CHECK
    // ------------------------------------

    const rateLimit = checkAIWolfRateLimit(req);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: "AIWolf usage limit reached. Please try again later.",
        retryAfter: rateLimit.retryAfter,
        remaining: 0
      });
    }

    // ------------------------------------
    // READ REQUEST DATA
    // ------------------------------------

    const {
      question,
      chapter,
      mode,
      chapterText
    } = req.body;

    // ------------------------------------
    // BASIC VALIDATION
    // ------------------------------------

    if (!question || !question.trim()) {
      return res.status(400).json({
        error: "Question is required.",
        remaining: rateLimit.remaining
      });
    }

    if (!chapterText || !chapterText.trim()) {
      return res.status(400).json({
        error: "Chapter text is required.",
        remaining: rateLimit.remaining
      });
    }

    // ------------------------------------
    // MODE
    // ------------------------------------

    const selectedMode =
      mode === "parent" ? "parent" : "child";

    // ------------------------------------
    // TEST MODE
    // ------------------------------------

    if (AIWOLF_TEST_MODE) {

      return res.json({
        reply:
          `🐺 AIWolf TEST MODE\n\n` +
          `Request accepted!\n\n` +
          `Chapter: ${chapter || "Unknown"}\n` +
          `Mode: ${selectedMode}\n\n` +
          `Hindi muna ako tatawag sa OpenAI API dahil naka-TEST MODE tayo.\n\n` +
          `Remaining requests: ${rateLimit.remaining}`,
        remaining: rateLimit.remaining,
        testMode: true
      });

    }

    // ------------------------------------
    // REAL AIWOLF REQUEST
    // ------------------------------------

    const input = [

      {
        role: "system",
        content: AIWOLF_INSTRUCTIONS
      },

      {
        role: "user",
        content:
          `CHAPTER:\n${chapter || "Unknown"}\n\n` +

          `MODE:\n${selectedMode}\n\n` +

          `CHAPTER TEXT:\n` +
          `${chapterText}\n\n` +

          `READER QUESTION:\n` +
          `${question}`
      }

    ];

    // ------------------------------------
    // OPENAI
    // ------------------------------------

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input
    });

    // ------------------------------------
    // RESPONSE
    // ------------------------------------

    res.json({
      reply: response.output_text,
      remaining: rateLimit.remaining,
      testMode: false
    });

  } catch (error) {

    console.error("AIWolf error:", error);

    res.status(500).json({
      error: "AIWolf server error.",
      details: error.message
    });

  }
});

// ========================================
// OLD CHAT ENDPOINT
// ========================================

app.post("/chat", async (req, res) => {

  try {

    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required."
      });
    }

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: message
    });

    res.json({
      reply: response.output_text
    });

  } catch (error) {

    console.error("Chat error:", error);

    res.status(500).json({
      error: "Chat server error.",
      details: error.message
    });

  }

});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `AIWolf server running on port ${PORT}`
  );

  console.log(
    `AIWolf TEST MODE: ${AIWOLF_TEST_MODE}`
  );

  console.log(
    `AIWolf limit: ${AIWOLF_LIMIT} requests / 10 minutes`
  );

});
