# Habit Tracker — GitHub + Vercel version

Simple habit tracker. Start date is **19 Nov 2026 = Day 1**. Open-ended, no fixed end date. Day number is counted from the real calendar date.

Preloaded habits: Java, LeetCode, English, Interview, SAP.

> Tanglish la: ithu ungalukku thani project. GitHub la push panni, Vercel la host pannunga. Data GitHub la `data.json` file la save aagum — backend sariya setup panna mattum.

## ⚠️ Safety first — read this

- **NEVER put your token in HTML / JS code.** Token ah code la poda koodathu.
- **NEVER commit the token to GitHub.** Token ah chat la share panna koodathu.
- Put the token ONLY in Vercel → Environment Variables.
- Use a fine-grained token with **Contents read/write ONLY for this one repo**. Vera repo ku access kodukka vendam.
- If a token ever leaks (pasted in code/chat/public repo), revoke it at once in GitHub Settings and create a new one.

## How it works

- `index.html` is one self-contained page. No build step. No dependencies.
- On load it tries the backend first: `GET /api/data`.
- On every change it tries `POST /api/data`.
- If the backend is missing or fails, it falls back to browser `localStorage`. A status line at the top of the page says where data is saved:
  - `Saved to GitHub via backend` — backend works.
  - `Saved in this browser only` — backend not configured / failed.
- `api/data.js` is a Vercel Serverless Function (Node, no dependencies). It reads secrets ONLY from environment variables and talks to the GitHub Contents API. It never logs the token and never hardcodes owner/repo/token.
- CORS is minimal: same-origin only. No wildcard CORS. The Vercel-hosted page calls `/api/data` on the same origin.
- No `vercel.json` is needed. Vercel serves `index.html` at `/` and `api/data.js` at `/api/data` automatically.

## Data shape

`data.json` and the API both use this shape:

```json
{
  "version": 1,
  "startDate": "2026-11-19",
  "habits": [
    {
      "id": "java",
      "name": "Java",
      "desc": "Java core concepts, OOP, collections",
      "target": "60 min",
      "color": "#f97316",
      "checks": {
        "1": true,
        "2": true
      }
    }
  ],
  "updatedAt": "2026-11-19T00:00:00.000Z"
}
```

- `startDate` is always `2026-11-19`. Day 1 = 19 Nov, Day 2 = 20 Nov, and so on. No end date.
- `checks` keys are absolute day numbers as strings. `"1": true` means done on Day 1.
- Habits live in ONE list. A new habit therefore appears on every day/week and in Focus Mode. There are no per-day copies.
- Streak = consecutive checked days ending today (or yesterday if today is not checked yet).
- If `data.json` is missing in the repo, `GET /api/data` returns an empty state (`habits: []`) and the page shows the 5 preloaded habits until the first save.

## Files

```
index.html      - the tracker page (open-ended weeks, Focus Mode, Add/Edit/Delete)
api/data.js     - Vercel function: GET/POST /api/data <-> GitHub data.json
data.json       - initial state: 5 habits, no check-offs yet. Do NOT gitignore this file.
.gitignore      - ignores node_modules, .vercel, .env — but NOT data.json
README.md       - this file
```

## Step 1 — Create a GitHub repo and push these files

1. GitHub la poi **New repository** click pannunga. Name: `habit-tracker` (vera name kooda ok). Private ah vechukonga — ithu recommend pannuren, data personal.
2. **Do NOT** add a README / .gitignore / license from GitHub's template screen if you already have these files locally. Empty repo va start pannunga, illa na merge conflict varum.
3. Unga computer la, intha folder la irunthu:

```bash
git init
git add .
git status
# Check: data.json irukkanum. .env file irukka koodathu.
git commit -m "Habit tracker with GitHub backend"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/habit-tracker.git
git push -u origin main
```

Replace `YOUR-USERNAME` and `habit-tracker` with your real values. Token ah inga type panna vendam — GitHub password/token prompt varum na, browser sign-in / GitHub CLI (`gh auth login`) use pannunga.

Check on GitHub: repo la `index.html`, `api/data.js`, `data.json`, `.gitignore`, `README.md` ellam theriyanum.

## Step 2 — Create a fine-grained Personal Access Token

1. GitHub → profile photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Token name: e.g. `habit-tracker-vercel`.
3. Expiration: 90 days (illa short ah vechukonga). Expiry aana, pudhu token create panni Vercel la update pannanum.
4. **Repository access: Only select repositories** → unga `habit-tracker` repo mattum select pannunga.
5. Permissions → **Repository permissions** → **Contents: Read and write**. Vera permission ethuvum kodukka vendam.
6. **Generate token** click panni, token ah copy pannunga. Oru thadava mattum thaan kaatum.
7. Token ah enga save panna: password manager la mattum. Code la, chat la, screenshot la share panna koodathu.

## Step 3 — Add Environment Variables in Vercel

1. Vercel la poi unga project ah open pannunga (illa Step 4 la import pannum pothu add pannunga).
2. **Settings → Environment Variables** poi itha add pannunga:

| Name | Value | Example |
|---|---|---|
| `GITHUB_TOKEN` | Token from Step 2 (paste it here only) | `github_pat_...` — neenga create pannathu |
| `GITHUB_OWNER` | GitHub username / org name | `your-username` |
| `GITHUB_REPO` | Repo name only | `habit-tracker` |

Optional (default irukku, add panna vendam unless vera branch/path venum):

| Name | Default |
|---|---|
| `GITHUB_BRANCH` | `main` |
| `GITHUB_DATA_PATH` | `data.json` |

3. Environment: **Production** (and Preview, if you want previews to work too) select pannunga.
4. **Save** pannunga. Aprom **Deployments → Redeploy** pannunga — env variables change panna redeploy venum, illa backend old config thaan use pannum.

Token ah code la, `data.json` la, `.env` file la commit panna koodathu. `.gitignore` already `.env` ah ignore pannum.

## Step 4 — Deploy on Vercel from the repo

1. Vercel la **Add New → Project** → **Import Git Repository** → unga `habit-tracker` repo ah select pannunga.
2. Framework Preset: **Other** (illa default). Build Command / Output Directory: empty ah vidunga. Intha project ku build step illa.
3. Root Directory: repo root (default).
4. Environment Variables: Step 3 la add pannathu inga theriyanum. Illa na, inga add pannunga.
5. **Deploy** click pannunga.
6. Deploy mudinja, Vercel unga URL kodukkum, e.g. `https://habit-tracker-....vercel.app`. Atha open pannunga.

## Step 5 — Test: add / check-off / refresh

1. Page open panni, top la status line paarunga. Backend sariya iruntha: **Saved to GitHub via backend** nu theriyanum.
2. Oru habit ku **✓ Mark done for today** click pannunga.
3. **＋ Add Habit** click panni, test habit add pannunga (e.g. `Test`). **Next week** click pannunga — antha habit angayum theriyanum.
4. Page ah **refresh** pannunga. Check-off um test habit um innum irukkanum.
5. GitHub repo la `data.json` ah open pannunga. `checks` la day number irukkanum, `updatedAt` pudhusa irukkanum. Commit history la `Update habit tracker data` commit theriyanum.
6. Test habit ah delete pannunga (Delete → tap again to delete).

Test fail aana: Step 6 paarunga.

## Step 6 — If backend is missing (localStorage fallback)

Status line **Saved in this browser only** nu kaatina:

- Backend configure aagala, illa fail aachu. Page innum work aagum, aana data unga browser la mattum save aagum (`localStorage`). Vera phone/laptop la theriyathu. Browser data clear panna pogum.
- Check pannunga:
  1. Vercel Environment Variables 3 um sariya irukka? Spelling check pannunga: `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`.
  2. Token expire aagala? Token repo access sariya? Contents Read and write irukka?
  3. Redeploy panneengala after adding env variables?
  4. Vercel → Project → **Logs / Functions** la `/api/data` error irukka paarunga. Token error na, token ah regenerate panni Vercel la update pannunga.
- Browser-only data ah GitHub ku move panna: backend ah sari pannitu, page ah refresh pannunga, aprom oru small change pannunga (check/uncheck). Athu backend ku save aagum. Aana careful: backend la pazhaya data iruntha, browser data overwrite pannidum. Rendu edathulayum different data iruntha, last save thaan win pannum (last-write-wins).

## Limitations — therinjikonga

- **Single user only.** Ithu unga personal tracker. Pala peru same time la use panna, overwrite aagalam.
- **Last-write-wins.** Rendu tab/device la same time la edit panna, kadasi save mattum thaan irukkum. Backend SHA conflict na oru thadava retry pannum, aana full merge pannathu.
- **GitHub API rate limits.** Authenticated limit 5,000 requests/hour. Normal use ku pothum. Refresh/check-off ovvoru thadava GitHub ku oru write pogum — ithu commit history ah fill pannum. Athu normal.
- **Every save = one GitHub commit.** `data.json` history la neraya commits varum. Athu itha design thaan.
- **Token expiry.** Fine-grained token expire aana, backend fail aagum, page browser-only mode ku pogum. Token ah renew panni Vercel la update pannunga.
- **No login / auth on the page.** Vercel URL thericha yaarum page ah open pannalam, aana avanga browser la backend ku save panna mudiyum — backend same-origin mattum thaan, aana page public na yaarum use pannalam. Private ah venum na, Vercel Deployment Protection / password protection use pannunga (Vercel settings la irukku).
- **Day counting uses your device clock.** Device date/time thappa iruntha, Day number thappa kaatum.

## Run locally (optional)

Backend illama page ah mattum test panna:

```bash
# Intha folder la irunthu — Python iruntha:
python3 -m http.server 8000
# Aprom browser la: http://localhost:8000/
```

Local la `/api/data` work aagathu, so page browser-only mode la run aagum. Backend ah local la test panna, Vercel CLI (`vercel dev`) use pannunga with env variables set locally in `.env` (commit panna koodathu).

## Troubleshooting

| Problem | Check pannunga |
|---|---|
| Status: browser only | Env variables + redeploy + token expiry (Step 6) |
| Page blank / old version | Hard refresh (Ctrl+Shift+R), Vercel deployment success aacha paarunga |
| Add habit refresh la poguthu | Backend work aagala — browser-only mode. Step 5/6 paarunga |
| `GITHUB_NOT_CONFIGURED` | Env variables missing in Vercel |
| `GITHUB_AUTH_FAILED` | Token wrong / expired / no Contents write / wrong repo selected |
| `INVALID_DATA_FILE` | GitHub la `data.json` valid JSON illa. GitHub web la file ah check panni fix pannunga |

Nalla luck! Day 1 la irunthu start pannunga — Java, LeetCode, English, Interview, SAP, daily konjam konjam. 💪
