# Document tools and structured exams

Research checked against upstream GitHub repositories on 2026-10-22. A file converter reads layout/text; the application must still recognize question types, preserve answer provenance, validate citations and require author review.

| Tool | Suitable use | Integration decision |
| --- | --- | --- |
| [Docling](https://github.com/docling-project/docling) / [Docling Serve](https://github.com/docling-project/docling-serve) | PDF/Office layout, reading order, tables, OCR and structured JSON | Recommended optional private service for complex layouts. Server connector added; native parsing remains the fast default. |
| [Microsoft MarkItDown](https://github.com/microsoft/markitdown) | Converting office files and PDFs to Markdown for downstream processing | Useful for broader import formats. It does not supply verified exam answers or replace the question classifier. Not installed in this workspace. |
| [MinerU](https://github.com/opendatalab/MinerU) | Complex document parsing into model-ready Markdown/JSON | Alternative for a separate parsing service; assess its current model/runtime requirements and upstream license for deployment. Not installed. |
| [Mammoth.js](https://github.com/mwilliamson/mammoth.js) | Semantic DOCX HTML, automatic lists and tables | Already used locally. Server-side HTML conversion feeds the question classifier; uploaded HTML is never executed in the browser. |

Docling describes its code as MIT; individual model licenses remain separate. The recommendation is based on its stated layout/JSON capabilities, not an accuracy benchmark on every user's files. No public parsing demo receives private uploads.

## Working now without extra services

1. Upload a PDF/DOCX/TXT/image in `/documents`; inspect the questions/text/original views.
2. Download **Xuất cấu trúc JSON**, **CSV câu hỏi** or **Văn bản Markdown**. JSON uses `studyforge.document.v1` and includes type classification, source keys, unsupported items and warnings. CSV escapes spreadsheet formula prefixes. Downloads require authenticated ownership and are not publicly cached.
3. In the builder choose **Dùng đáp án gốc · Không gọi AI**. This deterministic mode only includes questions whose original key is present in saved source chunks. It never guesses an absent key or fabricates a worked solution. Unanswered/unsupported items stay in the document reader for inspection.
4. Review individual items; **Lưu bản nháp** persists current review state. Reopen it from `/quizzes` or reload the editor URL. Publication requires every item to be reviewed.

The two existing AI modes remain available for new questions and missing solutions. They still use the saved 9Router Flash High model.

## Optional private Docling service

The machine currently has Python 3.12 but no Docker command. A Docling service/model bundle has **not** been installed or benchmarked here. The adapter is tested against the current upstream API contract using controlled responses; this is not evidence of live conversion.

For a dedicated local Python environment, follow the [official installation guide](https://github.com/docling-project/docling-serve#readme), for example:

```powershell
python -m venv .data/docling-venv
.data/docling-venv/Scripts/python.exe -m pip install docling-serve
.data/docling-venv/Scripts/docling-serve.exe run
```

Initial installation/model downloads and CPU inference can be substantial. Verify the service at `http://127.0.0.1:5001/docs`, then set server-only configuration and restart Next:

```dotenv
DOCLING_BASE_URL=http://127.0.0.1:5001
# DOCLING_API_KEY=<only if your private service requires it>
```

The document page then exposes **Đọc bố cục phức tạp**. The adapter sends a typed `sources: [{kind: "file", filename, base64_string}]` request with `target: {kind: "inbody"}` to `/v1/convert/source`, requesting text/JSON. Remote servers require HTTPS; redirects are rejected. Partial conversion is marked uncertain and existing saved text is preserved by the re-read flow. Page-level source locations are not reconstructed from Docling's JSON yet; the reader explicitly warns about this limit.

API contracts were checked in [Docling requests](https://github.com/docling-project/docling/blob/main/docling/datamodel/service/requests.py), [targets](https://github.com/docling-project/docling/blob/main/docling/datamodel/service/targets.py) and [responses](https://github.com/docling-project/docling/blob/main/docling/datamodel/service/responses.py). The older Serve usage document still lists legacy `file_sources`; use the typed-source contract for the current integration.
