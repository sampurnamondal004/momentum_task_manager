import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import { spawn, execSync } from "child_process";

// Default seed user
const DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111";

interface Task {
  id: string;
  user_id: string;
  title: string;
  category: string;
  deadline: string | null;
  estimated_effort: number; // in minutes
  calibrated_effort: number; // in minutes
  importance: number; // 1 to 5
  status: string; // "todo", "done"
  postponements: number;
  priority_score: number;
  explanation: string;
  created_at: string;
  google_event_id?: string;
  google_meet_link?: string;
  google_drive_attachment?: { name: string; url: string };
}

// In-Memory Database Store
const users = [
  {
    id: DEFAULT_USER_ID,
    timezone: "UTC",
    notification_prefs: { email: true, push: false },
    created_at: new Date().toISOString()
  }
];

// Pre-seeded tasks to make the "Bento Grid" immediately beautiful and interactive
const tasks: Task[] = [];

// Helper function to calculate priority
function calculatePriority(
  deadlineStr: string | null,
  calibratedEffort: number, // in minutes
  importance: number,       // 1 to 5
  postponements: number     // count
): { score: number; explanation: string } {
  const now = new Date();
  let urgency = 0.1;
  let timeText = "no deadline";

  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  if (deadline === null || isNaN(deadline.getTime())) {
    urgency = 0.1;
  } else {
    const timeRemainingMin = (deadline.getTime() - now.getTime()) / (60.0 * 1000.0);
    if (timeRemainingMin <= 0) {
      const overdueMin = Math.abs(timeRemainingMin);
      urgency = (calibratedEffort / 10.0) + 10.0 + (overdueMin / 60.0) * 5.0;
      timeText = `overdue by ${(overdueMin / 60.0).toFixed(1)} hours`;
    } else {
      let tempMin = timeRemainingMin;
      if (tempMin < 1.0) {
        tempMin = 1.0;
      }
      urgency = calibratedEffort / tempMin;
      const hours = timeRemainingMin / 60.0;
      if (hours < 24) {
        timeText = `due in ${hours.toFixed(1)} hours`;
      } else {
        timeText = `due in ${(hours / 24.0).toFixed(1)} days`;
      }
    }
  }

  // Score = Urgency * Importance + Postponements * 2.0
  let score = (urgency * importance) + (postponements * 2.0);
  score = Math.round(score * 100) / 100;

  let explanation = "";
  if (deadline === null || isNaN(deadline.getTime())) {
    explanation = `No deadline set. Priority is based on importance (${importance}/5) and effort (${calibratedEffort}m).`;
  } else if (deadline.getTime() <= now.getTime()) {
    explanation = `Task is ${timeText} and takes ${calibratedEffort}m. Immediate action is critical to prevent further delay.`;
  } else {
    const hoursLeft = (deadline.getTime() - now.getTime()) / (3600.0 * 1000.0);
    if (score > 15.0) {
      explanation = `Urgent task due in ${hoursLeft.toFixed(1)} hours. Requires ${calibratedEffort}m—start soon to avoid missing the deadline.`;
    } else if (postponements > 2) {
      explanation = `Postponed ${postponements} times already. Finishes in ${calibratedEffort}m—clear it now to reduce backlog friction.`;
    } else {
      explanation = `Due in ${(hoursLeft / 24.0).toFixed(1)} days with moderate urgency. Estimated effort is ${calibratedEffort}m.`;
    }
  }

  return { score, explanation };
}

// Seed the initial database
function seedTasks() {
  const now = new Date();
  
  // Task 1: Fix Critical Login Bug (Due tomorrow, high importance)
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  const p1 = calculatePriority(tomorrow.toISOString(), 180, 5, 0);
  tasks.push({
    id: "22222222-2222-2222-2222-222222222222",
    user_id: DEFAULT_USER_ID,
    title: "Fix Critical Login Bug",
    category: "coding",
    deadline: tomorrow.toISOString(),
    estimated_effort: 180,
    calibrated_effort: 180,
    importance: 5,
    status: "todo",
    postponements: 0,
    priority_score: p1.score,
    explanation: p1.explanation,
    created_at: new Date().toISOString()
  });

  // Task 2: Draft Project Pitch Deck (Due in 3 days, medium importance)
  const threeDays = new Date(now);
  threeDays.setDate(now.getDate() + 3);
  threeDays.setHours(12, 0, 0, 0);
  const p2 = calculatePriority(threeDays.toISOString(), 120, 4, 1);
  tasks.push({
    id: "33333333-3333-3333-3333-333333333333",
    user_id: DEFAULT_USER_ID,
    title: "Draft Project Pitch Deck",
    category: "writing",
    deadline: threeDays.toISOString(),
    estimated_effort: 120,
    calibrated_effort: 120,
    importance: 4,
    status: "todo",
    postponements: 1,
    priority_score: p2.score,
    explanation: p2.explanation,
    created_at: new Date().toISOString()
  });

  // Task 3: Team Lunch Coordination (Due in 5 days, low importance)
  const fiveDays = new Date(now);
  fiveDays.setDate(now.getDate() + 5);
  fiveDays.setHours(13, 0, 0, 0);
  const p3 = calculatePriority(fiveDays.toISOString(), 45, 2, 0);
  tasks.push({
    id: "44444444-4444-4444-4444-444444444444",
    user_id: DEFAULT_USER_ID,
    title: "Team Lunch Coordination",
    category: "social",
    deadline: fiveDays.toISOString(),
    estimated_effort: 45,
    calibrated_effort: 45,
    importance: 2,
    status: "todo",
    postponements: 0,
    priority_score: p3.score,
    explanation: p3.explanation,
    created_at: new Date().toISOString()
  });
}

seedTasks();

// Fallback regex parsing heuristics
function heuristicFallbackParse(text: string): {
  title: string;
  deadline: string | null;
  estimated_effort: number;
  category: string;
} {
  const textLower = text.toLowerCase();
  
  let category = "admin";
  const words: string[] = textLower.match(/\b\w+\b/g) || [];
  const hasWord = (wordList: string[]) => wordList.some(w => words.includes(w));
  
  if (hasWord(["call", "phone", "talk", "ring", "calls", "calling"])) {
    category = "calls";
  } else if (hasWord(["write", "draft", "report", "paper", "essay", "blog", "writing", "reports"])) {
    category = "writing";
  } else if (hasWord(["code", "debug", "develop", "program", "build", "frontend", "backend", "coding"])) {
    category = "coding";
  } else if (hasWord(["pay", "bill", "invoice", "bank", "financial", "tax", "rent", "payment"])) {
    category = "financial";
  } else if (hasWord(["meet", "coffee", "lunch", "social", "party", "dinner", "visit", "meeting"])) {
    category = "social";
  } else if (hasWord(["admin", "organize", "schedule", "clean", "file", "sort"])) {
    category = "admin";
  }

  let effortMinutes = 30; // Default
  const hourMatch = textLower.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|hours|hrs)/);
  if (hourMatch) {
    effortMinutes = Math.round(parseFloat(hourMatch[1]) * 60);
  } else {
    const minMatch = textLower.match(/(\d+)\s*(?:minute|min|minutes|mins)/);
    if (minMatch) {
      effortMinutes = parseInt(minMatch[1], 10);
    }
  }

  let deadline: Date | null = null;
  const now = new Date();
  
  if (textLower.includes("today")) {
    deadline = new Date(now);
    deadline.setHours(17, 0, 0, 0);
  } else if (textLower.includes("tomorrow")) {
    deadline = new Date(now);
    deadline.setDate(now.getDate() + 1);
    deadline.setHours(12, 0, 0, 0);
  } else if (textLower.includes("next week")) {
    deadline = new Date(now);
    deadline.setDate(now.getDate() + 7);
    deadline.setHours(12, 0, 0, 0);
  } else if (textLower.includes("friday")) {
    let daysAhead = 5 - now.getDay();
    if (daysAhead <= 0) daysAhead += 7;
    deadline = new Date(now);
    deadline.setDate(now.getDate() + daysAhead);
    deadline.setHours(17, 0, 0, 0);
  } else if (textLower.includes("monday")) {
    let daysAhead = 1 - now.getDay();
    if (daysAhead <= 0) daysAhead += 7;
    deadline = new Date(now);
    deadline.setDate(now.getDate() + daysAhead);
    deadline.setHours(12, 0, 0, 0);
  }

  let title = text;
  const cleanupPatterns = [
    /by\s+(?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next\s+week\w*)/gi,
    /(?:takes|taking|estimated)\s+(?:about\s+)?\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?/gi,
    /for\s+(?:about\s+)?\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?/gi,
    /\b\d+(?:\.\d+)?\s*(?:hour|hr|minute|min)s?\b/gi
  ];
  
  for (const pattern of cleanupPatterns) {
    title = title.replace(pattern, "");
  }
  
  title = title.replace(/\s+/g, " ").trim().replace(/^["',.!?]+|["',.!?]+$/g, "");
  if (!title) {
    title = text;
  }

  return {
    title,
    deadline: deadline ? deadline.toISOString() : null,
    estimated_effort: effortMinutes,
    category
  };
}

// LLM Parsing using modern @google/genai SDK
async function parseTaskLLM(text: string): Promise<{
  title: string;
  deadline: string | null;
  estimated_effort: number;
  category: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not defined. Using regex-based heuristics parser instead.");
    return heuristicFallbackParse(text);
  }

  const now = new Date();
  const nowStr = now.toISOString();
  const dayOfWeek = now.toLocaleString("en-US", { weekday: "long" });

  const prompt = `You are an NLP parser for Momentum. Extract the task details from this user input: "${text}"

Reference Current Time: ${nowStr} (${dayOfWeek}).
Ensure relative deadlines (like 'today', 'tomorrow', 'Friday', 'next week') are resolved to specific ISO strings relative to this reference time.`;

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            task_name: {
              type: Type.STRING,
              description: "The extracted name or action of the task."
            },
            deadline: {
              type: Type.STRING,
              description: "ISO-8601 format string representing the deadline, or null if none."
            },
            estimated_effort_hours: {
              type: Type.NUMBER,
              description: "Estimated time needed to complete the task in hours."
            },
            category: {
              type: Type.STRING,
              description: "The task category. Must be one of: writing, calls, admin, coding, financial, social."
            }
          },
          required: ["task_name", "category"]
        }
      }
    });

    const resultText = response.text;
    if (resultText) {
      const parsed = JSON.parse(resultText);
      const effort_minutes = Math.round((parsed.estimated_effort_hours || 0.5) * 60);
      let category = parsed.category || "admin";
      const allowedCategories = ["writing", "calls", "admin", "coding", "financial", "social"];
      if (!allowedCategories.includes(category)) {
        category = "admin";
      }

      let deadline_str = null;
      if (parsed.deadline) {
        try {
          const dt = new Date(parsed.deadline);
          if (!isNaN(dt.getTime())) {
            deadline_str = dt.toISOString();
          }
        } catch {
          deadline_str = null;
        }
      }

      return {
        title: parsed.task_name,
        deadline: deadline_str,
        estimated_effort: effort_minutes,
        category
      };
    }
  } catch (err) {
    console.error("Error invoking Gemini parsing API:", err);
  }

  // Fallback on error
  return heuristicFallbackParse(text);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Start FastAPI backend
  let pythonProcess: any = null;
  let usePythonBackend = false;

  try {
    console.log("Checking for Python environments to start the FastAPI backend...");
    let pythonCmd = "python3";
    try {
      execSync("python3 --version", { stdio: "ignore" });
    } catch {
      try {
        execSync("python --version", { stdio: "ignore" });
        pythonCmd = "python";
      } catch {
        pythonCmd = "";
      }
    }

    if (pythonCmd) {
      console.log(`Python command found: ${pythonCmd}. Installing dependencies from backend/requirements.txt...`);
      try {
        execSync(`${pythonCmd} -m pip install -r backend/requirements.txt`, { stdio: "inherit" });
        console.log("Python dependencies installed successfully!");

        console.log("Spawning FastAPI server on port 8000...");
        pythonProcess = spawn(pythonCmd, ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], {
          cwd: path.join(process.cwd(), "backend"),
          env: { ...process.env, PORT: "8000", PYTHONPATH: "." }
        });

        pythonProcess.stdout.on("data", (data: any) => {
          console.log(`[FastAPI stdout]: ${data.toString().trim()}`);
        });

        pythonProcess.stderr.on("data", (data: any) => {
          console.error(`[FastAPI stderr]: ${data.toString().trim()}`);
        });

        usePythonBackend = true;
        console.log("FastAPI backend initialization completed.");
      } catch (pipErr: any) {
        console.error("Failed to install Python dependencies or start FastAPI:", pipErr.message);
      }
    } else {
      console.warn("Python is not installed in the environment. Falling back to built-in In-Memory Node API.");
    }
  } catch (err: any) {
    console.error("Error during Python backend initialization:", err);
  }

  app.use(express.json());

  // CORS Headers for API accessibility
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "*");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Proxy middleware for /api/* to FastAPI
  app.use("/api", async (req, res, next) => {
    if (!usePythonBackend) {
      return next();
    }

    const targetPath = req.originalUrl.replace(/^\/api/, "");
    const finalPath = targetPath || "/";
    const targetUrl = `http://127.0.0.1:8000${finalPath}`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, val] of Object.entries(req.headers)) {
        if (typeof val === "string" && key !== "host") {
          headers[key] = val;
        }
      }

      const options: any = {
        method: req.method,
        headers,
      };

      if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
        options.body = JSON.stringify(req.body);
        options.headers["content-type"] = "application/json";
      }

      const proxyRes = await fetch(targetUrl, options);

      res.status(proxyRes.status);
      proxyRes.headers.forEach((value, name) => {
        if (name !== "transfer-encoding") {
          res.setHeader(name, value);
        }
      });

      const resText = await proxyRes.text();
      res.send(resText);
    } catch (err: any) {
      console.warn(`Proxy to FastAPI failed (${err.message}). Falling back to built-in in-memory API.`);
      next();
    }
  });

  // Base / root backend check
  app.get("/api", (req, res) => {
    res.json({
      app: "Momentum Phase 0 MVP Backend",
      status: "healthy",
      documentation: "/docs"
    });
  });

  // POST /api/users
  app.post("/api/users", (req, res) => {
    const { timezone, notification_prefs } = req.body;
    const newUser = {
      id: crypto.randomUUID(),
      timezone: timezone || "UTC",
      notification_prefs: notification_prefs || null,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    res.status(201).json(newUser);
  });

  // GET /api/users
  app.get("/api/users", (req, res) => {
    res.json(users);
  });

  // POST /api/tasks
  app.post("/api/tasks", (req, res) => {
    const { user_id, title, category, deadline, estimated_effort, importance } = req.body;

    // Check if user exists
    const userExists = users.some(u => u.id === user_id);
    if (!userExists && user_id !== DEFAULT_USER_ID) {
      return res.status(400).json({ detail: `User with ID ${user_id} does not exist.` });
    }

    const tCategory = category || "other";
    const tImportance = typeof importance === "number" ? importance : 3;
    const tEffort = typeof estimated_effort === "number" ? estimated_effort : 30;
    
    // Calculate initial priority score & explanation
    const { score, explanation } = calculatePriority(deadline || null, tEffort, tImportance, 0);

    const newTask: Task = {
      id: crypto.randomUUID(),
      user_id: user_id || DEFAULT_USER_ID,
      title: title || "Untitled Task",
      category: tCategory,
      deadline: deadline || null,
      estimated_effort: tEffort,
      calibrated_effort: tEffort,
      importance: tImportance,
      status: "todo",
      postponements: 0,
      priority_score: score,
      explanation: explanation,
      created_at: new Date().toISOString(),
      google_event_id: req.body.google_event_id,
      google_meet_link: req.body.google_meet_link,
      google_drive_attachment: req.body.google_drive_attachment
    };

    tasks.push(newTask);
    res.status(201).json(newTask);
  });

  // GET /api/tasks/:task_id
  app.get("/api/tasks/:task_id", (req, res) => {
    const task = tasks.find(t => t.id === req.params.task_id);
    if (!task) {
      return res.status(404).json({ detail: `Task with ID ${req.params.task_id} not found.` });
    }
    res.json(task);
  });

  // GET /api/users/:user_id/tasks
  app.get("/api/users/:user_id/tasks", (req, res) => {
    const userTasks = tasks
      .filter(t => t.user_id === req.params.user_id)
      .sort((a, b) => b.priority_score - a.priority_score);
    res.json(userTasks);
  });

  // PUT /api/tasks/:task_id
  app.put("/api/tasks/:task_id", (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.params.task_id);
    if (taskIndex === -1) {
      return res.status(404).json({ detail: `Task with ID ${req.params.task_id} not found.` });
    }

    const currentTask = tasks[taskIndex];
    const updates = req.body;

    // Update fields
    const updatedTitle = updates.title !== undefined ? updates.title : currentTask.title;
    const updatedCategory = updates.category !== undefined ? updates.category : currentTask.category;
    const updatedDeadline = updates.deadline !== undefined ? updates.deadline : currentTask.deadline;
    const updatedEffort = updates.estimated_effort !== undefined ? updates.estimated_effort : currentTask.estimated_effort;
    const updatedCalibrated = updates.calibrated_effort !== undefined ? updates.calibrated_effort : currentTask.calibrated_effort;
    const updatedStatus = updates.status !== undefined ? updates.status : currentTask.status;
    const updatedImportance = updates.importance !== undefined ? updates.importance : currentTask.importance;
    const updatedPostponements = updates.postponements !== undefined ? updates.postponements : currentTask.postponements;

    const updatedEventId = updates.google_event_id !== undefined ? updates.google_event_id : currentTask.google_event_id;
    const updatedMeetLink = updates.google_meet_link !== undefined ? updates.google_meet_link : currentTask.google_meet_link;
    const updatedDriveAttachment = updates.google_drive_attachment !== undefined ? updates.google_drive_attachment : currentTask.google_drive_attachment;

    // Recompute priority score & explanation
    const { score, explanation } = calculatePriority(
      updatedDeadline,
      updatedCalibrated,
      updatedImportance,
      updatedPostponements
    );

    const updatedTask: Task = {
      ...currentTask,
      title: updatedTitle,
      category: updatedCategory,
      deadline: updatedDeadline,
      estimated_effort: updatedEffort,
      calibrated_effort: updatedCalibrated,
      status: updatedStatus,
      importance: updatedImportance,
      postponements: updatedPostponements,
      priority_score: score,
      explanation: explanation,
      google_event_id: updatedEventId,
      google_meet_link: updatedMeetLink,
      google_drive_attachment: updatedDriveAttachment
    };

    tasks[taskIndex] = updatedTask;
    res.json(updatedTask);
  });

  // DELETE /api/tasks/:task_id
  app.delete("/api/tasks/:task_id", (req, res) => {
    const taskIndex = tasks.findIndex(t => t.id === req.params.task_id);
    if (taskIndex === -1) {
      return res.status(404).json({ detail: `Task with ID ${req.params.task_id} not found.` });
    }
    tasks.splice(taskIndex, 1);
    res.status(204).send();
  });

  // GET /api/tasks/:task_id/priority
  app.get("/api/tasks/:task_id/priority", (req, res) => {
    const task = tasks.find(t => t.id === req.params.task_id);
    if (!task) {
      return res.status(404).json({ detail: `Task with ID ${req.params.task_id} not found.` });
    }
    res.json({
      task_id: task.id,
      priority_score: task.priority_score,
      explanation: task.explanation
    });
  });

  // POST /api/parse-task
  app.post("/api/parse-task", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ detail: "Required field 'text' is missing." });
    }

    try {
      const parsedResult = await parseTaskLLM(text);
      res.json(parsedResult);
    } catch (err: any) {
      res.status(500).json({ detail: `Failed parsing task description: ${err.message}` });
    }
  });

  // Vite development middleware OR static fallback for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express fullstack server running on http://localhost:${PORT}`);
  });
}

startServer();
