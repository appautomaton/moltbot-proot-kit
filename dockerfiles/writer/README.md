# Writer sandbox image (LibreOffice + Pandoc + Poppler + Tesseract + uv)

This folder is a Docker build context for an OpenClaw sandbox image intended for a `writer` agent.

It includes the system binaries commonly required by the workspace skills in `bots/workspaces/writer/skills/*`:

- LibreOffice (`soffice`) for Office ↔ PDF conversion and spreadsheet recalculation
- Pandoc (`pandoc`) for `.docx` → Markdown (incl. tracked changes)
- Poppler (`pdftotext`, `pdftoppm`, `pdfinfo`) for PDF text extraction and PDF→image conversion
- Tesseract (`tesseract`) for OCR workflows
- `uv/uvx` for controlled Python environments inside the sandbox

This image also ships a small set of Node packages inside the image (not in the mounted workspace) and exposes them via `NODE_PATH`:

- `docx`, `pptxgenjs`, `playwright` (+ Chromium), `sharp`, `react`, `react-dom`, `react-icons`

## Build (use this folder as the build context)

```sh
docker build \
  -f dockerfiles/writer/Dockerfile \
  -t localhost/openclaw-sandbox-writer:bookworm \
  dockerfiles/writer
```

## OpenClaw agent config (reference)

Recommended: run with `readOnlyRoot: true` and redirect HOME/XDG paths into the mounted workspace so LibreOffice and Python/Node caches stay writable. Keep `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` so Playwright can find the preinstalled Chromium even if HOME changes.

```json
{
  "id": "writer",
  "sandbox": {
    "mode": "all",
    "workspaceAccess": "rw",
    "scope": "agent",
    "docker": {
      "image": "localhost/openclaw-sandbox-writer:bookworm",
      "readOnlyRoot": true,
      "network": "bridge",
      "env": {
        "HOME": "/workspace/.home",
        "XDG_CACHE_HOME": "/workspace/.cache",
        "XDG_CONFIG_HOME": "/workspace/.config",
        "XDG_DATA_HOME": "/workspace/.local/share",
        "PLAYWRIGHT_BROWSERS_PATH": "/ms-playwright"
      },
      "setupCommand": "mkdir -p /workspace/.home /workspace/.cache /workspace/.config /workspace/.local/share"
    }
  }
}
```

After updating agent config, recreate the sandbox container:

```sh
pnpm openclaw sandbox recreate --agent writer --force
```
