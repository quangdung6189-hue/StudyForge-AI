# Trình biên soạn đề thi — implementation report

## Scope delivered

- Renamed creation mode; rebuilt editor with outline, structured text, visual cards, responsive view tabs, error filters, import/export, undo/redo, point allocation and help dialog.
- Shared browser/server parser with stable editor IDs, section-local numbering, inline choices, marked answers, grouped true/false, short-answer alternatives, simple end answer tables and explicit diagnostics.
- No default A, no implicit false verdict and no automatic teacher-review approval.
- Real owner-scoped incomplete drafts, revision conflicts and exact retry handling using existing Document/File/Chunk tables. Private immutable source snapshots protect published quiz citations from later draft changes.
- Legacy code-exam endpoint uses the same validated preparation and unpublished save path; source refs and publication review are enforced.
- DOCX bounded ZIP/XML validation before conversion. Formatting evidence reads explicit/inherited ink and label underline; ambiguous, mixed, repeated or inline multi-option marks require teacher verification.
- Internal agent protocol at `skills/exam-document-reader/SKILL.md`, referenced by `AGENTS.md`; runtime remains application code.
- User guide: `docs/EXAM_STUDIO.md`; API contracts updated. No production migration or data reset required.

## Validation

- Node.js v26.13.0: 24 test files / 169 tests passed, including actual DOCX extraction, parser roundtrips, owner isolation, incomplete drafts, stale revisions, citations, publication and student-answer secrecy.
- Root and web TypeScript checks passed.
- Production Next.js build and postbuild trace verification passed: 42 manifests; no missing or build-only files.
- Real headless Chrome against compiled local production server and separate SQLite fixture: missing answer blocked, incomplete save/reload, recent draft navigation, malformed answer still blocked after visual edits, two-way editing, pending text + Ctrl+S, JSON title/time import, true/false and short alternatives, exact point total, concurrent-tab 409, desktop light/dark, 375px reduced motion, prepare and quiz draft save. No page runtime errors.
- Independent read-only review identified inline DOCX misassignment, diagnostics lost on serialization, and same-route recent draft navigation. Fixed all three and added unit/browser regressions. A follow-up review invocation did not produce a completed new report; no claim of an independently clean final review.
- Tests use isolated databases only. Secrets, browser fixtures, snapshots and logs stay under ignored `.data/`.

## Known limits

- This is compatible with documented/common input conventions, not a clone of Azota proprietary files or UI assets.
- Native PDF text extraction does not expose reliable color evidence; scan/OCR and complicated layout remain review-dependent. No universal visual-answer recognition claim.
- DOCX multi-option paragraphs, theme ink, ambiguous repeats and mixed formatting are conservatively flagged rather than guessed.
- True/false groups are expanded to existing two-option grading items. Parent points are split evenly; no new progressive MOET scoring policy.
- Visual text changes commit on blur or explicit save; backend save status reflects actual requests, not timers alone.