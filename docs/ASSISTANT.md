# Embedded StudyForge assistant

The authenticated workspace has a floating **Trợ lý AI** button, built from [Lucian #215 Support chat from a launcher bubble](https://lucianlabs.dev/uxui-prompt/#215). It preserves the opening spring, launcher-icon transition, message entry and typing dots. The demo backdrop is replaced by the real workspace, and the window expands to readable desktop/375px dimensions. Development mode reserves space above the Next.js toolbar. Escape closes the panel even after a send button loses focus.

Requests go through `/api/assistant` to the server-only 9Router gateway. The model remains `ag/gemini-3.8-flash-high`. The provider uses actual SSE text streaming, with a 60-second bound and bounded output. UTF-8/SSE fragments are buffered correctly; incomplete/error streams are reported and partial text remains visible. The React view batches updates every 40 ms instead of re-rendering every token. Stop aborts the request. No sample replies or simulated delays are used.

The assistant can explain the site, help with code and study questions, or answer against a selected owned document. It retrieves at most five relevant source chunks and displays their source excerpts. Only the authenticated owner's documents are accessible. Code is rendered as text, never executed. A fresh conversation can clear the local history; history is not persisted across page reloads.

## Image attachments

Use **＋ Đính kèm ảnh**, paste a clipboard image into the composer, or drop images into the chat. PNG/JPG/WebP files up to 8MB each are accepted, at most three per turn. HEIC/SVG are rejected with a format message. Selected images have previews and individual remove buttons; sending an image without typing asks the model to read/explain it.

Images are decoded and resized locally to at most 2000 pixels, flattened onto white when transparent, and encoded as bounded JPEGs before sending. Preparation is sequential to limit peak memory on phones. The API validates inline raster signatures/size/count and allows image blocks only in user messages. Remote image URLs are not accepted. The same Flash High model receives the actual vision content blocks and streams its response. At most the three newest images are retained in the model context. Images are not saved to the document library automatically; use `/documents` when a persistent OCR document is wanted. Chat photos/history disappear on reload.

Run `npm run test:browser:images` to check the file picker, preview/removal, paste, drop, format errors, mobile layout, real vision reading of an unpredictable code, authentication and actual PNG library OCR. Test artifacts stay private in `.data/assistant-image-checks`.

**Tra cứu Wikipedia kèm nguồn** performs a real server-side Vietnamese Wikipedia lookup and attaches verified source URLs/excerpts to the model context. This is Wikipedia lookup, not general web browsing or a guarantee of up-to-date news. If lookup fails or finds nothing, an explicit warning is shown; the model is instructed not to claim that it searched the web. Without that toggle, the answer comes from model knowledge and optional document context.

The endpoint validates conversation length/roles, checks authentication and active attempts, and enforces 30 requests per account per 15-minute window in database buckets. Active exams disable the widget and the backend rejects requests even if called manually. The model is not given keys, cookies, other users' files or hidden exam payloads.

Checks: `npm run test:browser:workspace`, `npm test`, `npm run typecheck`, `npm run build`. Browser reports and screenshots are private under `.data/workspace-upgrade-checks`. The suite exercises real High-model responses, persisted drafts, source-only creation, downloads, theme/mobile/keyboard behavior and active-exam blocking; it creates and removes only its own fixtures.
