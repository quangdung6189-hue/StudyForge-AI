# Documents and AI quiz creation

The document reader at `/documents` and builder at `/quizzes/create` use authenticated backend endpoints. The two AI modes use the real gateway; the third, `source_only`, uses verified original answer keys without calling a model. Failures never become sample questions.

The builder now saves questions/options in bulk inside one transaction. A client operation ID makes lost-response retries return the same saved draft. Use **Lưu bản nháp** to preserve review progress across reloads, then reopen it from the bank. Review pages show ten items at a time; document inspection shows twenty. Repeated identical publication returns the existing immutable version. See [document tools](DOCUMENT_TOOLS.md) for structured exports and optional Docling integration, and [embedded assistant](ASSISTANT.md) for streaming 9Router chat and Wikipedia lookup.

## Provider connection

Set these server-only values in the repository `.env`, then restart the development server:

For Netlify deployments, configure these values in the project's environment variables instead of committing a `.env` file. Use an HTTPS endpoint reachable from Netlify; a localhost router is only suitable for local development. Keep the API key scoped to server runtime and never expose it through Next.js public environment variables.

Netlify secret scanning remains enabled. The repository configuration excludes only the non-sensitive endpoint and model setting names (`AI_BASE_URL`, `AI_MODEL_GENERATE`, `AI_MODEL_REVIEW`) from value matching because their values can also appear in documentation, tests, and server defaults. `AI_API_KEY` and other credentials remain scanned. If a future failure identifies a credential, remove it and rotate the exposed credential rather than extending these exclusions.

```dotenv
AI_BASE_URL=http://127.0.0.1:20128/v1
AI_API_KEY=<your 9Router API key>
AI_MODEL_GENERATE=ag/gemini-3.8-flash-high
AI_MODEL_REVIEW=ag/gemini-3.8-flash-high
AI_TIMEOUT_MS=120000
OCR_MAX_PAGES=20
```

Keep the exact model ID advertised by the router. Flash High remains the default for generation, explanations and vision OCR. Never expose keys through `NEXT_PUBLIC_*` or a browser bundle. Google website login and the Antigravity account are separate from the AI gateway key.

9Router requests explicitly use `stream: false` for validated JSON. Schemas are supplied in `response_format` and the system prompt because an adapter may drop the former. JSON fences and direct arrays can be normalized before strict validation; answers and citations are never fabricated to repair invalid output. The website streams batch progress independently of provider token streaming.

## File reading and classification

- Native PDF reading retains pages/table separators and releases the worker. Sparse, text-free or detected merged-column pages use vision OCR. Advanced re-reading can force PDF OCR.
- PNG/JPG uploads use real vision OCR. Unreadable content remains `needs_ocr`, with warnings. OCR processes two pages concurrently, with a default 20-page cap per operation and hard maximum 40. Remaining pages are explicitly reported; split longer scans.
- DOCX reading preserves automatic question numbering, nested choices, tables and basic superscript/subscript notation. HTML is parsed on the server and never rendered from uploads. Embedded diagrams/images and unsupported formatting produce warnings; embedded DOCX images are not automatically OCRed.
- TXT supports strict UTF-8 and BOM-marked UTF-16LE, Unicode normalization and page breaks. Convert other encodings before uploading.
- Recognition supports numbered questions, Roman/PHẦN/MỤC headings, single/multiple choice, uppercase/lowercase true/false, short answers and fill sections. Each true/false substatement becomes one gradeable item with shared context.
- Inline tags, check marks, explicit keys, terminal ĐÚNG/SAI and supported answer grids retain source quotes. Reference lists are excluded. Starred keys warn the author. Essay, matching, ordering and uncertain formats remain visible as items requiring review.

The reader shows original answers/explanations, filters/search, editable text and protected original files. Saving reclassifies text and increments its revision; stale edits cannot overwrite newer text. Uncertain re-reading preserves saved content and offers a candidate for review. Missing text/unfinished OCR blocks quiz creation. For older uploads, use **Đọc lại file gốc** to rebuild text/chunks with the new reader; save current edits first.

## Faster generation and resume

The server creates batches of at most three questions with two concurrent workers. Extraction sends immutable source stems/options plus compact solution requests and relevant cited chunks. Existing source solutions are reused only when the answer and explanation can be verified. New-question generation distributes context windows across the document instead of silently discarding later sections. Types/difficulty targets are planned before batching.

Validated batches are cached privately in `.data/generation-cache` for 24 hours. Keys include owner/document/revision, title, model, source context and settings. Repeat the same configuration to reuse completed batches. Concurrent identical requests share work; failed output is not cached. Each draft receives independent question/option IDs.

`POST /api/quizzes/generate?stream=1` returns NDJSON progress/result/error events with actual completed/cached counts. The builder shows elapsed time and **Dừng và giữ tiến độ**. Stopping aborts unfinished calls; completed batches remain reusable. Without the query, the existing JSON contract remains available. This is a completed-batch cache, not an independent durable background job: resubmit the same configuration after closing the page.

Observed local runs on 2026-10-21 with the saved key:

- The user's five-page history text classified as 13 single-choice questions and 16 true/false statements, with 29 original keys. Six-item extraction took 26.4 seconds with two real High calls. Repeating the identical engine request took 25 ms without an AI call; warm timing excludes HTTP/browser/database work.
- The authenticated website extracted four mixed-format items in 17 seconds. A repeat reused all four items and the builder consumed the progress stream.
- A controlled Vietnamese image produced three question formats and four original keys in 10.3 seconds using real OCR.
- Real new-question generation passed for single-choice, true/false and short answers, with detailed explanations and verified citations.

These measurements are examples, not latency guarantees. Router load, network, document complexity and uncached batch count affect duration. Semantic correctness still requires author review.

## Data integrity and database transport

Original answers retain `answerOrigin: document`; inferred answers are `ai_suggested`. Citations/answer shapes are validated. All items need explicit review before publication. Transactional writes prevent partial banks on invalid citations/duplicate IDs. Active attempts receive no keys or explanations.

Neon runtime connections now use its official Prisma WebSocket adapter. During diagnosis, Prisma TCP could not connect while the same database worked through Neon HTTP and WebSocket. Database, credentials, schema and data were preserved without migration/reset. Set `DATABASE_TRANSPORT=tcp` to explicitly restore TCP. Other PostgreSQL hosts and SQLite retain existing transports. Read retries remain bounded and never automatically replay writes. Document failures return safe messages instead of Prisma diagnostics.

References: [Neon serverless driver](https://github.com/neondatabase/serverless), [Prisma with Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon).

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run test:browser:auth
npm run test:browser:quiz
npm run test:browser:documents
npm run check:quiz:ai
```

The document browser check uses real TXT/DOCX uploads, PostgreSQL writes, revision conflicts, protected originals, native re-reading, mobile themes, keyboard/reduced motion, real Flash High generation, NDJSON progress and cache reuse. It removes only its temporary account/records/files. The quiz browser suite checks actual PDF reading/publication/security with a labeled provider fixture for review questions. That fixture alone is not AI evidence. The document test and `check:quiz:ai` call the real provider. Private reports/screenshots remain under `.data/`.

## Lucian elements

- [#039 Sliding pill tabs](https://lucianlabs.dev/uxui-prompt/#039): question/text/original views, original spring and staggered row motion, adapted to full-width variable-height content.
- [#042 Step-by-step wizard](https://lucianlabs.dev/uxui-prompt/#042): builder stages and directional motion expanded to fit real editor/mobile layouts.
- [#015 Plan radio cards](https://lucianlabs.dev/uxui-prompt/#015): creation-mode selection, original selection frame and keyboard support.
- [#219 Circular-reveal dark mode](https://lucianlabs.dev/uxui-prompt/#219): page transition, cookie/SSR theme and immediate reduced-motion switching.

The existing #032 upload element reports actual transfer/processing states without inventing processing percentages.
