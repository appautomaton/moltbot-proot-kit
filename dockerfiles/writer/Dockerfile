ARG UV_IMAGE=ghcr.io/astral-sh/uv:latest
FROM ${UV_IMAGE} AS uv

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Base tooling + document stack for writer skills.
# - libreoffice/soffice: Office <-> PDF conversions, recalculating xlsx, etc.
# - pandoc: docx -> markdown (tracked changes supported)
# - poppler-utils: pdftotext/pdftoppm/pdfinfo (PDF text + images)
# - tesseract-ocr: OCR for scanned PDFs
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    coreutils \
    diffutils \
    findutils \
    gawk \
    git \
    grep \
    jq \
    less \
    openssh-client \
    patch \
    python3 \
    python3-venv \
    ripgrep \
    sed \
    tar \
    unzip \
    xz-utils \
    zip \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
    ghostscript \
    libreoffice \
    pandoc \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
  && rm -rf /var/lib/apt/lists/*

# Install uv (Python env manager) by copying the official binary (recommended for Docker).
# Docs: https://docs.astral.sh/uv/guides/integration/docker/
COPY --from=uv /uv /uvx /usr/local/bin/
RUN uv --version && uvx --version

# Node deps used by writer workspace skills.
# We keep them inside the image to avoid polluting the mounted workspace with node_modules.
#
# IMPORTANT: For Node's module resolver to find these packages when running ad-hoc scripts,
# we set NODE_PATH to this directory.
RUN mkdir -p /opt/openclaw-node \
  && cd /opt/openclaw-node \
  && npm init -y \
  && npm install --omit=dev \
    docx \
    playwright \
    pptxgenjs \
    react \
    react-dom \
    react-icons \
    sharp \
  && npm cache clean --force

ENV NODE_PATH="/opt/openclaw-node/node_modules"
ENV PATH="/opt/openclaw-node/node_modules/.bin:${PATH}"
ENV PLAYWRIGHT_BROWSERS_PATH="/ms-playwright"

# Ensure Playwright has a browser available inside the image.
# This downloads the Chromium binary into the image (larger, but friction-free).
RUN playwright --version \
  && playwright install --with-deps chromium

# Optional: keep rootfs writable. LibreOffice writes a user profile under ~/.config/libreoffice.
# Prefer setting `sandbox.docker.readOnlyRoot=false` for this image.

CMD ["sleep", "infinity"]
