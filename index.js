import express from "express";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import cookieSession from "cookie-session";

dotenv.config();

const app = express();
const { Pool } = pg;
const projectDirectory = process.cwd();

// In production, set PG_DATABASE_URL and SESSION_SECRET in Netlify.
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET must be configured in the production environment.");
}

if (!process.env.PG_DATABASE_URL) {
  console.warn("PG_DATABASE_URL is not set. Database routes will not work until it is configured.");
}

// Neon connection strings include sslmode=require. The pg driver reads this
// from the connection string, so a separate `sslmode` client option is not needed.
const pool = new Pool({
  connectionString: process.env.PG_DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 5,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

app.set("view engine", "ejs");
app.set("views", path.join(projectDirectory, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(projectDirectory, "public")));

app.use(
  cookieSession({
    name: "capital_quiz_session",
    keys: [process.env.SESSION_SECRET || "local-development-secret-change-this"],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
);

async function getRandomQuestion(excludeId) {
  let result;

  if (excludeId !== undefined && excludeId !== null) {
    result = await pool.query(
      "SELECT id, country, capital FROM public.capitals WHERE id <> $1",
      [excludeId]
    );
  }

  // If there is only one row, allow it to be selected again.
  if (!result || result.rows.length === 0) {
    result = await pool.query("SELECT id, country, capital FROM public.capitals");
  }

  if (result.rows.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * result.rows.length);
  return result.rows[randomIndex];
}

function renderDatabaseError(res, error) {
  console.error("Quiz database error:", error);
  return res.status(500).send(
    "Sorry, the quiz could not access its database. Please check the database configuration and try again."
  );
}

// Start a new game.
app.get("/", async (req, res) => {
  try {
    const question = await getRandomQuestion();

    if (!question) {
      return res.status(503).send("There are no quiz questions in the capitals table yet.");
    }

    req.session.score = 0;
    req.session.currentQuestionId = question.id;

    return res.render("index.ejs", {
      question,
      totalScore: 0,
      wasCorrect: false,
      gameOver: false,
    });
  } catch (error) {
    return renderDatabaseError(res, error);
  }
});

// Check the player's answer.
app.post("/submit", async (req, res) => {
  try {
    const questionId = req.session?.currentQuestionId;
    if (questionId === undefined || questionId === null) {
      return res.redirect("/");
    }

    const questionResult = await pool.query(
      "SELECT id, country, capital FROM public.capitals WHERE id = $1",
      [questionId]
    );

    if (questionResult.rows.length === 0) {
      req.session = null;
      return res.redirect("/");
    }

    const question = questionResult.rows[0];
    const answer = String(req.body.answer ?? "").trim();
    const isCorrect = answer.length > 0 &&
      question.capital.toLocaleLowerCase() === answer.toLocaleLowerCase();
    const currentScore = Number(req.session.score) || 0;

    if (!isCorrect) {
      return res.status(200).render("index.ejs", {
        question,
        correctAnswer: question.capital,
        totalScore: currentScore,
        wasCorrect: false,
        gameOver: true,
      });
    }

    const nextScore = currentScore + 1;
    const next = await getRandomQuestion(question.id);

    if (!next) {
      return res.status(503).send("There are no quiz questions available.");
    }

    req.session.score = nextScore;
    req.session.currentQuestionId = next.id;

    return res.render("index.ejs", {
      question: next,
      totalScore: nextScore,
      wasCorrect: true,
      gameOver: false,
    });
  } catch (error) {
    return renderDatabaseError(res, error);
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

export default app;
