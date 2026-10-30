# Faithful document reading and faster Flash High generation

Owner: Codex. Scope: inaccurate document structure, slow quiz generation, source inspection and the database connection required by these workflows.

## Changes and review findings

- Resolved, high: Roman/uppercase true/false sections were misclassified and references could become questions. The user's five-page history text now yields 13 single-choice items, 16 true/false statements and 29 original keys. Unsupported formats remain visible for review.
- Resolved, high: extraction could rewrite stems/options. These are now deterministic server data. AI supplies compact solutions/metadata, checked against real source citations and original keys.
- Resolved, high: a single full-document response exceeded the timeout. Generation retains `ag/gemini-3.8-flash-high`, with three-item batches, two workers, relevant context, verified source-solution reuse and private 24-hour completed-batch caching. Keys include owner/document/revision/title/model/settings. New IDs avoid collisions between saved drafts. Real NDJSON progress, cancellation and retries reuse completed work.
- Resolved, high: DOCX numbering, nested options and answer tables could lose structure. Semantic conversion and regression checks cover those layouts, including blank lines between table rows. Native PDF/TXT parsing preserves pages/encoding. Images and selected PDF pages use real High vision OCR.
- Resolved, medium: edits could overwrite newer content. Revision checks run inside the update transaction. Uncertain re-reading preserves saved text and offers a candidate for review.
- Resolved, medium: raw Prisma errors could reach document views. List/detail/upload now return safe error messages and transient 503 responses.
- Resolved, medium: global frame denial blocked the original PDF view. An explicit configuration rule allows SAMEORIGIN only for protected document-file routes; other routes retain DENY.
- The reader now has source answers/explanations, filters/search, protected originals and native/OCR re-reading. Lucian #039 retains its spring/stagger motion and supports themes, keyboard and reduced motion. Upload/generation use actual processing states.
- Resolved, medium: resizing during the tab-pill spring could temporarily overflow the mobile viewport. The tab track now contains its animated pill; the final 375px browser run passes during resizing.

## Database

The Neon TCP connection failed to initialize during this work, while official HTTP and WebSocket probes succeeded against the same database. Neon runtime connections now use `@prisma/adapter-neon` 6.19.3 over WebSocket. Database/schema/data and credentials are preserved; other database providers retain existing transports. `DATABASE_TRANSPORT=tcp` is an explicit opt-out. The shared development server reloaded the configuration. Real uploads, edits, publication and authentication passed afterward. No live reset, seed or migration was performed.

## Verification

- 71 automated tests pass: source recognition, semantic DOCX text, encoding, strict AI validation, batching/progress/cache, citations, auth, transient database recovery and grading.
- Type checking and the production build pass.
- 21 auth browser checks pass, covering persisted hashes/sessions, logout/relogin, real Google authorization redirect, mobile themes and extension-attribute hydration cleanup. Interactive Google consent was not repeated in this run; linked-account authentication was verified in the earlier report.
- 19 quiz browser checks pass: native PDF recognition, validation, responsive themes, transactional draft/publication behavior, review enforcement and no active-exam answer leaks. Review-screen questions in this suite are labeled provider fixtures.
- 14 document browser checks cover actual TXT/DOCX uploads, keys, protected originals, revision conflicts, native re-reading, 375px themes, keyboard/reduced motion, actual Flash High NDJSON generation, cache reuse and builder display. No runtime/hydration errors.
- Real new-question provider check passes for single-choice, true/false and short answers, detailed explanations and valid citations, with review required.
- Private history-source benchmark: six items in 26,386 ms, two real High calls and 9,409 prompt-context characters. Repeat: 25 ms at engine level, zero calls. This uses a saved source snapshot and does not overwrite the user's document. The private benchmark JSON contains the last warm run; the cold timing was observed in command output.
- Actual website extraction: four mixed-format items in 17 seconds in the first successful browser run. This is a measurement, not an SLA.
- Controlled Vietnamese image OCR: 10,342 ms, three formats, four original keys and no uncertainty warnings.

Credential-free reports/screenshots remain private under `.data/document-studio-checks`, `.data/browser-quiz-checks`, `.data/browser-auth-checks`, `.data/history-benchmark.json` and `.data/ocr-probe-result.json`. Test scripts remove only their own records/files.

## Limits

Handwriting, diagrams, complex formulas, ambiguous marks and unfamiliar layouts still need source inspection. Embedded DOCX image content is flagged rather than automatically OCRed. Essay, matching and ordering remain visible but are not forced into auto-graded short answers. Default PDF OCR is limited to 20 pages per operation, configurable up to 40; unread pages are reported. Very large and varied real-world scan collections have not been exhaustively checked.

The cache resumes completed batches; generation is not an independent durable background job. Resubmit the same configuration after leaving the page. Provider/network outages still surface. Semantic correctness always requires author review. Existing uploads need **Đọc lại file gốc** to rebuild text/chunks with the new extraction logic.

Instructions: [AI/document setup](../../docs/QUIZ_AI_SETUP.md). Lucian source: [#039 Sliding pill tabs](https://lucianlabs.dev/uxui-prompt/#039). Transport references: [official Neon driver](https://github.com/neondatabase/serverless), [Prisma Neon documentation](https://docs.prisma.io/docs/orm/v6/overview/databases/neon).
