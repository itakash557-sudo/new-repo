// Vercel Serverless Function — habit tracker storage backed by GitHub.
// No dependencies. Uses the GitHub Contents API.
//
// Secrets come ONLY from environment variables (set in Vercel, never in code):
//   GITHUB_TOKEN  - fine-grained Personal Access Token, Contents read/write,
//                   ONLY for this one repo. Never log it. Never commit it.
//   GITHUB_OWNER  - GitHub username / org that owns the repo.
//   GITHUB_REPO   - repo name, e.g. habit-tracker
//   GITHUB_BRANCH - optional, default "main"
//   GITHUB_DATA_PATH - optional, default "data.json"
//
// CORS: same-origin only. No wildcard CORS headers are set, so browsers
// block cross-origin calls. The page hosted on Vercel calls /api/data on
// the same origin. See README.md.
//
// Data shape (see README.md for full docs):
//   { version: 1, startDate: "2026-11-19", habits: [...], updatedAt: "..." }
//   habit: { id, name, desc, target, color, checks: { "<dayNumber>": true } }

const DEFAULT_BRANCH = "main";
const DEFAULT_PATH = "data.json";
const START_DATE = "2026-11-19";

function defaultState() {
  return {
    version: 1,
    startDate: START_DATE,
    habits: [],
    updatedAt: new Date().toISOString(),
  };
}

function json(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    return null;
  }
  return {
    token,
    owner,
    repo,
    branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH,
    path: process.env.GITHUB_DATA_PATH || DEFAULT_PATH,
  };
}

function githubUrl(cfg) {
  const path = cfg.path.split("/").map(encodeURIComponent).join("/");
  return (
    "https://api.github.com/repos/" +
    encodeURIComponent(cfg.owner) +
    "/" +
    encodeURIComponent(cfg.repo) +
    "/contents/" +
    path +
    "?ref=" +
    encodeURIComponent(cfg.branch)
  );
}

function headers(cfg) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + cfg.token,
    "User-Agent": "habit-tracker",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readBody(req) {
  // Vercel usually parses JSON bodies for us. Handle object, string, and stream.
  if (req.body && typeof req.body === "object") {
    return req.body;
  }
  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body);
  }
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) {
    return null;
  }
  return JSON.parse(text);
}

async function fetchFile(cfg) {
  // Returns { sha, content } or { sha: null, content: null } when missing (404).
  const r = await fetch(githubUrl(cfg), { method: "GET", headers: headers(cfg) });
  if (r.status === 404) {
    return { sha: null, content: null, status: 404 };
  }
  if (r.status === 401 || r.status === 403) {
    const err = new Error("GITHUB_AUTH_FAILED");
    err.status = r.status;
    throw err;
  }
  if (!r.ok) {
    const err = new Error("GITHUB_READ_FAILED");
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  const decoded = Buffer.from(data.content || "", "base64").toString("utf8");
  return { sha: data.sha, content: decoded, status: 200 };
}

async function writeFile(cfg, sha, base64Content, message) {
  const body = {
    message,
    content: base64Content,
    branch: cfg.branch,
  };
  if (sha) {
    body.sha = sha;
  }
  const r = await fetch(githubUrl(cfg), {
    method: "PUT",
    headers: { ...headers(cfg), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r;
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      // No CORS preflight allowance: same-origin only.
      res.status(204);
      res.end();
      return;
    }

    const cfg = getConfig();
    if (!cfg) {
      json(res, 500, {
        ok: false,
        code: "GITHUB_NOT_CONFIGURED",
        error:
          "Backend not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_REPO as environment variables in Vercel.",
      });
      return;
    }

    if (req.method === "GET") {
      let file;
      try {
        file = await fetchFile(cfg);
      } catch (e) {
        if (e && e.message === "GITHUB_AUTH_FAILED") {
          json(res, 502, {
            ok: false,
            code: "GITHUB_AUTH_FAILED",
            error:
              "GitHub authentication failed. Check the token and its Contents read/write permission for this repo.",
          });
          return;
        }
        throw e;
      }
      if (file.status === 404 || !file.content) {
        json(res, 200, defaultState());
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(file.content);
      } catch (e) {
        json(res, 502, {
          ok: false,
          code: "INVALID_DATA_FILE",
          error: "data.json in the repo is not valid JSON.",
        });
        return;
      }
      json(res, 200, parsed);
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      let body;
      try {
        body = await readBody(req);
      } catch (e) {
        json(res, 400, { ok: false, code: "INVALID_JSON", error: "Request body is not valid JSON." });
        return;
      }
      if (!body || typeof body !== "object" || !Array.isArray(body.habits)) {
        json(res, 400, {
          ok: false,
          code: "INVALID_STATE",
          error: "Body must be an object with a habits array.",
        });
        return;
      }

      const state = {
        version: 1,
        startDate: typeof body.startDate === "string" ? body.startDate : START_DATE,
        habits: body.habits,
        updatedAt: new Date().toISOString(),
      };
      const base64 = Buffer.from(JSON.stringify(state, null, 2), "utf8").toString("base64");

      // GET first to obtain the SHA; 404 means create the file.
      let current;
      try {
        current = await fetchFile(cfg);
      } catch (e) {
        if (e && e.message === "GITHUB_AUTH_FAILED") {
          json(res, 502, {
            ok: false,
            code: "GITHUB_AUTH_FAILED",
            error:
              "GitHub authentication failed. Check the token and its Contents read/write permission for this repo.",
          });
          return;
        }
        throw e;
      }

      let r = await writeFile(cfg, current.sha, base64, "Update habit tracker data");

      // Retry once on SHA conflict: re-read the SHA and try again.
      if (r.status === 409 || r.status === 422) {
        try {
          current = await fetchFile(cfg);
        } catch (e) {
          // Fall through to the error response below.
        }
        r = await writeFile(cfg, current && current.sha, base64, "Update habit tracker data");
      }

      if (r.status === 401 || r.status === 403) {
        json(res, 502, {
          ok: false,
          code: "GITHUB_AUTH_FAILED",
          error:
            "GitHub authentication failed. Check the token and its Contents read/write permission for this repo.",
        });
        return;
      }
      if (!r.ok) {
        json(res, 502, {
          ok: false,
          code: "GITHUB_WRITE_FAILED",
          error: "Could not write data to GitHub. Please try again.",
        });
        return;
      }

      json(res, 200, { ok: true, updatedAt: state.updatedAt });
      return;
    }

    res.setHeader("Allow", "GET, POST, PUT, OPTIONS");
    json(res, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed." });
  } catch (e) {
    // Never include env values or tokens in errors or logs.
    console.error("api/data error:", e && e.message ? e.message : "unknown");
    if (!res.headersSent) {
      json(res, 500, { ok: false, code: "INTERNAL_ERROR", error: "Internal error. Please try again." });
    }
  }
};
