# Assistant image attachments

The document library already accepted PNG/JPG, but the newly added assistant composer and API accepted text only. There was no attachment control or vision content in streamed chat requests. This explains why an image could not be added to chat.

## Changes

- `LucianAssistant.tsx`: file picker, clipboard-file paste, drag/drop, previews/removal and image-only messages. Files are prepared sequentially to limit peak memory. Newest image context is bounded to three images. Existing text-only behavior is preserved.
- `assistant-image.ts`: validate PNG/JPG/WebP and 8MB input limit, decode locally, normalize orientation/transparency and resize to at most 2000 pixels before bounded JPEG encoding. No public storage service receives originals. HEIC/SVG/invalid/oversized files produce explicit messages.
- `assistant-images.ts` / `AssistantInput`: server validation of inline raster MIME/signatures/encoded size, per-conversation count and user-role restriction. Remote image URLs are rejected. Authentication, active-exam blocking and rate limits remain in force.
- `packages/ai/src/index.ts`: streamed user messages now include actual `image_url` vision blocks and text, using the existing configured Flash High model. No model downgrade, placeholder recognition or fabricated OCR was added.
- The document browser test scopes its upload selector to `.u032` because the workspace now correctly has a second file input in chat.

## Verification

- 85 automated tests pass, including image validation, spoofed MIME/remote URL rejection, active-exam image blocking, validated vision forwarding and provider content-block shape.
- Type checking and production build pass.
- Nine browser checks pass: visible file picker and preview/removal; native ClipboardEvent paste; native DragEvent drop; invalid-format feedback preserving the selected image; 375px layout; actual High-model image reading; authenticated/remote-URL guards; actual library PNG upload/OCR; no runtime/hydration errors.
- The browser fixture contains an unpredictable code that is not included in the question or filename. Actual vision returned the correct code in **8,146 ms**. The same PNG was then submitted through the actual library upload UI, and the persisted extracted text contained that code. These are measured local runs, not latency/accuracy guarantees.
- An initial browser test incorrectly dispatched a generic paste event without native clipboard data. The test now uses the browser's actual ClipboardEvent; the handler also safely handles missing clipboard data.

Private screenshots/report: `.data/assistant-image-checks`. Tests remove only their temporary account/document/files/rate buckets. No live schema migration/reset or credentials change.

Limits: original chat photos are not persisted across reloads or automatically added to the document library. PNG/JPG/WebP are supported; HEIC requires conversion. Large/complex, blurry images may need cropping, and text smaller than the resizing limit can lose detail. Other browser engines and all mobile clipboard implementations were not exhaustively checked. This extends the existing Lucian #215 application controls; it does not port another gallery element.
