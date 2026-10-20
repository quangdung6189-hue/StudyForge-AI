# Lucian UX/UI Elements Documentation

Inventory of ported UI components from `Seokwoooo/lucian-uxui` (catalog 34c4b3e61d):

## 1. #062 — Sign-in card feedback
- **Source Link**: [https://lucianlabs.dev/uxui-prompt/#062](https://lucianlabs.dev/uxui-prompt/#062)
- **Component**: `apps/web/src/components/lucian/LucianSignIn.tsx`
- **Location Used**: `/sign-in` (Auth screen)
- **Adapted**: Connected button shrinking spinner to real `POST /api/auth/login` and `POST /api/auth/register`, integrated CapsLock indicator, hooked password visibility toggle, preserved `.u062.shake` animation on authentication failure, and mapped all `--ux-*` theme tokens with Be Vietnam Pro font stack.
- **Accessibility & Mobile**: Tested at 375px viewport (no horizontal overflow), full Tab/Enter keyboard navigation, `aria-pressed`, `aria-label`, and `aria-live`.

## 2. #032 — Drag-and-drop upload
- **Source Link**: [https://lucianlabs.dev/uxui-prompt/#032](https://lucianlabs.dev/uxui-prompt/#032)
- **Component**: `apps/web/src/components/lucian/LucianUpload.tsx`
- **Location Used**: `/documents` (Document management screen)
- **Adapted**: Connected drag-and-drop dropzone to `POST /api/documents/upload` with `FormData`. Preserved marching dashed border SVG animation (`@keyframes u032-march`), dynamic extension badges (`PDF`, `DOCX`, `TXT`), live progress indicator bar, and checkmark pop animation upon successful extraction.
- **Accessibility & Mobile**: Tested at 375px mobile layout, accessible file input trigger.

## 3. #039 — Sliding pill tabs
- **Source Link**: [https://lucianlabs.dev/uxui-prompt/#039](https://lucianlabs.dev/uxui-prompt/#039)
- **Component**: `apps/web/src/components/lucian/LucianTabs.tsx`
- **Location Used**: Workspace navigation and filter bars
- **Adapted**: Reusable React component with `ref` tracking active tab bounds, CSS spring cubic-bezier transitions (`--ux-spring`), count badges, and left/right arrow key navigation (`role="tablist"` / `aria-selected`).
- **Accessibility & Mobile**: Keyboard navigation with ArrowLeft/ArrowRight, responsive scroll with hidden scrollbars.

## 4. #042 — Step-by-step wizard
- **Source Link**: [https://lucianlabs.dev/uxui-prompt/#042](https://lucianlabs.dev/uxui-prompt/#042)
- **Component**: `apps/web/src/app/(workspace)/quizzes/create/page.tsx`
- **Location Used**: `/quizzes/create` (AI Quiz Generation flow)
- **Adapted**: 4-step wizard: 1) Chọn tài liệu nguồn -> 2) Cấu hình đề -> 3) Duyệt bản nháp câu hỏi có căn cứ trích dẫn nguồn -> 4) Xuất bản đề thi với shareCode.

## Theme & Responsive Checks
- Light Mode & Dark Mode: Verified with CSS variables `--ux-*` and `[data-theme="dark"]`.
- Mobile 375px viewport: Responsive grid layouts and wrap utilities prevent horizontal overflow.
- Reduced Motion: Base rules include `@media (prefers-reduced-motion: reduce)` clamping all animation and transition durations.
