# Written-answer parsing and safe document reread

- Lifecycle: todo -> ready -> running -> review -> done.
- Continued existing uncommitted reader/reread work; preserved unrelated changes.

## Findings and changes

- Shared answer-boundary parser separates question body, explicit answers and explanations for both editor/export parsing and server document analysis. Recognizes inline/standalone labels, missing colons on standalone labels, full-width colons, dash separators and bold labels. Ordinary prose mentioning answers does not itself create a boundary.
- Final written-answer sections attach by section and original question number, including `Bài` labels. Bare final `ĐÁP ÁN` headings followed by section headings no longer create duplicate exam questions. Unscoped final keys are not applied to duplicated numbers in different sections. Local MCQ answer tables do not swallow later exam sections.
- Repeated contradictory written keys now require review instead of silently becoming alternative accepted answers. Equivalent explicit `|` alternatives compare without regard to order. Review markers from question bodies and final answer sections remain blocking; normalization does not make conflicting evidence verified.
- Preserves multiline short answers and wrapped units until an explicit explanation boundary. Does not truncate to the first line. Fractions, decimal commas and source characters remain unchanged. Essay answers preserve multiline subparts and literal `|` characters rather than splitting them into auto-graded alternatives.
- Missing question body stays empty with `EMPTY_STEM`; answer text is never reused as the question body.
- Existing reread changes commit raw text, chunks, status, revision and extraction metadata in one transaction; concurrent edits produce conflict instead of overwrite. Partial OCR/error keeps saved content. Original bytes remain available. Guest/cross-owner/editor-source rereads are blocked.
- Existing reader UI shows essay model answers and explanations separately. Unsupported-question review warnings also appear in the reader's warning summary. Essays remain manual-review content, not automatic quiz-grading support.
- Counts question-number occurrences once before attaching final keys rather than repeatedly scanning all questions.

## Validation

- Final run: Node.js **v26.13.0**, **28 test files / 220 tests passed** with one worker.
- Root and web `npm run typecheck`: passed.
- `npm run build`: passed. Production trace validation: **42 manifests / 17,867 file references**, no missing/build-only references.
- **20 Chrome checks passed**, no browser runtime errors, against compiled local production server and a newly created isolated SQLite database. Server stopped after validation. No production reset, seed, migration or document rewrite.
- Real TXT upload, repeated API reread, UI reread button, separate essay-answer display, final keys with duplicate numbering, four-category export and deterministic source-only generation verified through actual backend.
- Real DOCX reread verified in API integration tests. Concurrent edit conflict, partial OCR/error retention, source-byte preservation, metadata revisions and ownership checks covered.
- Source-only quiz retains `answerOrigin: document`, `reviewed: false` and actual source citations. Student projection contains only `id`, `type`, `stem`, `points`, `options`; answers/explanations/citations absent and answer text excluded from stems.
- `git diff --check`: passed.
- Regression-first additions initially reproduced eight failing cases before fixes. Final full test/build/browser run repeated after all runtime edits.

## Use and limits

1. Open the document library and select an existing source document.
2. Save pending text edits before using **Đọc lại file gốc**. Reread deliberately restores extraction from original bytes; it is not a merge with teacher-edited raw text.
3. Check question body, original answer and explanation separately. Conflicting/uncertain evidence still needs teacher verification.

- No live PDF/image OCR or live Docling accuracy benchmark claimed. Docling normalization remains contract-tested; OCR fidelity depends on original quality and configured services.
- Without an explicit answer/explanation boundary, wrapped text is preserved as answer evidence, not semantically guessed or discarded. Long/ambiguous responses require teacher review.
- No new dependencies, schema changes, automated essay grading or production deployment.

## Main files

- `apps/web/src/lib/exam-answer-blocks.ts`
- `apps/web/src/lib/exam-code.ts`
- `apps/web/src/server/question-sections.ts`
- `apps/web/src/server/document-reread.ts`
- `apps/web/src/app/api/documents/[id]/reprocess/route.ts`
- `tests/written-answers.test.ts`
- `tests/document-reread.test.ts`
- `scripts/test_exam_studio_browser.mjs`