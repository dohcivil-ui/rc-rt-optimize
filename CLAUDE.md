# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 0. User & Communication

- **User:** หมู (Moo) — full name: นายสุริยา ปัตโชติชัย
- **Role:** **นายช่างโยธาอาวุโส** (Senior Civil Technician), กรมทางหลวง
  - ⚠️ ห้ามเรียก "Senior Civil Engineer" — ตำแหน่งราชการคือ "นายช่างโยธาอาวุโส"
- **Language:** Thai-first responses. ใช้ภาษาไทยเสมอ ยกเว้น code/file names/error messages
- **Token estimate:** ทุก response ต้องลงท้ายด้วยช่วงประมาณ tokens (เช่น `~40-50K used / ~150K remaining`) — ห้ามใส่ตัวเลขมั่ว
- **Tone:** ตรงไปตรงมา กระชับ ไม่ over-explain

---

## 1. Project Overview

RC Retaining Wall Optimization — modernizes legacy VB6 (RC_RT_HCA v2.8) into a bilingual Thai web platform for DOH practitioners. Uses BA/HCA optimization algorithms validated against VB6 baseline.

**Paper positioning:** Applied/integration paper (ไม่ใช่ algorithm paper)
**Contribution claims:** (1) Legacy VB6 → modern web with Thai NLP, (2) Validated against VB6 (270 trials, Δcost<1%), (3) DOH practitioner-ready (deploy + QR), (4) HCA vs BA stat comparison, (5) LLM-as-orchestrator

**ห้ามอ้าง:** "algorithm ใหม่", "production-grade", "best in field"

---

## 2. Architecture

```
web/     → React 19 + Vite + Tailwind v3 + Recharts (SPA)
api/     → Express REST (Node.js) + Anthropic SDK for Claude tool use
backend/ → FROZEN engine (668 VB6-validated tests) - DO NOT MODIFY
vb6-source/ → VB6 reference (Form1.frm, modShared.bas) - reference only
```

**Data Flow:** Browser → `/api/*` → Express routes → `engine.js` → `backend/src/ba.js`

---

## 3. Commands

```bash
# API (port 3000)
cd api && npm start          # Start server
cd api && npm test           # Run all tests (107 expected)

# Frontend (port 5173, proxies /api → :3000)
cd web && npm run dev        # Vite dev server
cd web && npm run build      # Production build → dist/
cd web && npm run lint       # ESLint
```

---

## 4. Key Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Liveness probe |
| `/api/optimize` | POST | Run BA (or HCA from Day 9.6) optimization |
| `/api/parse-input` | POST | Claude tool use: Thai NL → params |
| `/api/explain-result` | POST | Claude: generate Thai explanation (4 sections) |

---

## 5. Code Style (Follow Existing Patterns — STRICT)

- Plain JavaScript (no TypeScript)
- `var` for declarations (legacy-compatible)
- Single quotes, 2-space indent, **LF line endings**
- ASCII comments only (no Thai in code comments — use English)
- Zero-dep validator (no Joi/ajv) — collects ALL errors before returning
- Tests: plain Node `assert` module, no test framework
- Thai user-facing strings → may need base64 encoding for PowerShell patches

---

## 6. Important Files

| File | Purpose | Frozen? |
|------|---------|---------|
| `backend/src/ba.js` | BA optimization | ✅ FROZEN |
| `backend/src/hca.js` | HCA optimization (243 tests) | ✅ FROZEN |
| `api/src/lib/engine.js` | BA wrapper, steel decoder, cost sampler | ⚠️ careful |
| `api/src/lib/validator.js` | Schema validation | ⚠️ careful |
| `api/src/routes/explainResult.js` | Claude API integration | ⚠️ careful |
| `web/src/lib/api.js` | Frontend fetch wrapper | OK to edit |
| `web/src/pages/ResultPage.jsx` | Chart + dimensions + steel display | ⚠️ chart Day 8.5 FROZEN |

---

## 7. Mock Fallbacks

When `ANTHROPIC_API_KEY` not set, routes return mock responses (H3-280 case). This allows full UX testing without API key.

---

## 8. Working Rules (MANDATORY — บังคับทุก task)

### 8.1 Process
1. **ทำทีละ feature ทดสอบจนผ่าน** ก่อนไปข้อถัดไป — ห้ามทำหลายข้อพร้อมกัน
2. **Mockup ก่อน code** — propose JSX/UI structure → wait for "OK" → then code
3. **No code without explicit approval** — ถ้าไม่แน่ใจ ถามก่อน
4. **Targeted str_replace, not full rewrites** — แก้ส่วนที่จำเป็นเท่านั้น
5. **Backup source ก่อนจบ session** ถ้ามีการแก้สำคัญ

### 8.2 Frozen — ห้ามแตะ
- `backend/` — 668 tests VB6-validated
- `api/src/lib/engine.js` chart-related code (Day 8.5 baseline pass แล้ว)
- `web/src/pages/ResultPage.jsx` chart section (Day 8.5)
- `vb6-source/Form1.frm` Thai captions (encoding fragile)

### 8.3 Numbers Discipline
- Numbers come from SQL/Node.js execution — **never from LLM calculation**
- ถ้า user ถามตัวเลข → run code/test → report จริง

---

## 9. Day 9-15 Roadmap (LOCKED PLAN)

```
Day 9    ExplainPage (AI อธิบายผล) ← current
Day 9.5  Preset 3×3 + VB6 Form layout
Day 9.6  HCA toggle (Option B - NO compare mode)
Day 9.7  Statistical caption (precomputed 95% CI + Mann-Whitney U)
Day 10   E2E smoke test (optional)
Day 11   npm run build + fix warnings
Day 12   Deploy frontend → doh-thai.com/retaining-wall/
Day 13   Deploy backend + ANTHROPIC_API_KEY (PM2)
Day 14   nginx reverse proxy /api/* → backend
Day 15   QR code + 3 case study screenshots
─────────────────────────────────────────────
Post Day 15: paper writing (ห้ามเริ่มก่อน)
```

**Critical for paper:** 9, 9.5, 9.6, 9.7, 11, 12, 13, 14, 15
**Optional:** 10

---

## 10. Locked Decisions — DO NOT REOPEN

### Cut features (ห้ามเสนอใหม่):
- ❌ Animated convergence playback (สวยอย่างเดียว)
- ❌ Boxplot 30-trial mode in web (เก็บใน paper offline)
- ❌ PDF Export (engineer ยังไม่ต้องการ)
- ❌ Sample input ภาษาไทยแบบคลิกเติม (overlap กับ Preset)
- ❌ HCA vs BA Compare mode in web (Day 9.6 = toggle เฉยๆ Option B)

### Specifications:
- **Preset:** 3×3 grid = 9 cases (H=3,4,5 m × fc=240,280,320)
  - VB6 reference data ครบทั้ง 9 cases (BA + HCA raw data available)
- **HCA web mode:** Toggle BA/HCA only (Option B). No side-by-side compare. Single algorithm result per run.
- **Statistical caption (Day 9.7):** Precomputed from 540 offline trials (30 × 9 × 2). Show: median, bootstrap 95% CI, Mann-Whitney U p-value. **Do NOT run 30 trials at user click time.**

### Nice-to-have (post Day 15 only):
- 🟡 BOQ table, manual baseline, Save/Load case, About page

---

## 11. Day 9 Active Spec — ExplainPage

**Goal:** ปุ่ม "อธิบายผลด้วย AI" ใต้กราฟใน `/result` → POST `/api/explain-result` → render 4 sections

### Files to touch
- ✅ `web/src/pages/ResultPage.jsx` (only this file)

### Files frozen
- ❌ `api/src/routes/explainResult.js` (38 tests pass — DO NOT MODIFY)
- ❌ Chart section in ResultPage.jsx (Day 8.5 baseline)
- ❌ Anything in `api/src/lib/`, `backend/`

### Implementation
1. State machine: `idle → loading → success | error → (retry) loading`
2. Button "✨ อธิบายผลด้วย AI" — `bg-indigo-600 hover:bg-indigo-700`
3. Loading: spinner + "⏳ กำลังวิเคราะห์ผล..."
4. Success: 4 sections rendered conditionally (skip if field missing/empty array):
   - 📝 **สรุป** (`summary`) — `bg-gray-50 border-gray-200`
   - ⭐ **ประเด็นหลัก** (`key_points`) — `bg-blue-50 border-blue-200`
   - ⚠️ **ข้อควรระวัง** (`warnings`) — `bg-amber-50 border-amber-200`
   - 💡 **คำแนะนำ** (`recommendations`) — `bg-green-50 border-green-200`
5. Error: "❌ ไม่สามารถอธิบายผลได้ในขณะนี้" + [ลองใหม่] retry button
6. Network timeout: 30s

### Definition of Done
- [ ] Button + spinner working
- [ ] 4 sections render correctly with mock fallback
- [ ] Error handling + retry
- [ ] Tests still 107/107 PASS
- [ ] Commit: `Day 9: ExplainPage — wire /api/explain-result with 4 sections`

---

## 12. Git Conventions

- Branch: `main` only (no feature branches)
- Commit format: `Day X.Y: <scope> — <description>`
- Always run `cd api && npm test` before committing (107/107 must pass)
- Never force push
- Office network blocks GitHub — push from mobile hotspot if needed

---

## 13. Critical Rules (Quick Reference)

1. **`backend/` is FROZEN** — 668 tests, VB6-validated. Only `api/src/lib/engine.js` bridges to it.
2. **Restart Node API server** after modifying `api/src/lib/*.js` (Node caches require())
3. **Recharts XAxis** — use `domain={[0, 'dataMax']}` not hardcoded values (Day 8.5 lesson)
4. **Idempotency check ทุก patch** (`if Already patched - skipping`)
5. **Handoff `.md` only** — never `.docx`
6. **Token estimate ทุก response** — range format only

---

## 14. Workflow with Claude Chat

This repo is worked on with two AI surfaces:
- **Claude Code (here)** = executor (read/edit/test/commit)
- **Claude Chat (web)** = strategist (specs, mockups, decisions, debug stuck cases)

When user references "พี่หมู approve" or "Chat บอกว่า..." — they mean strategist Claude has aligned the spec already. Trust the spec and execute.
