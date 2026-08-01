# PDF Update Studio worker — Cloud Run reference image (UPD-2.1).
# Node (worker + shared TS libs) + Python (extractor) + poppler (pdftotext/pdfinfo).
#
# Build:  docker build -f worker/Dockerfile -t goto-sync-worker .
# Run:    docker run --rm -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... goto-sync-worker
#
# The service-role key is supplied at runtime as a secret. It is NEVER baked
# into the image, committed, or exposed to the browser.

FROM node:22-slim

# poppler-utils provides pdftotext and pdfinfo used by tools/extraction.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 \
      poppler-utils \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only the worker's own dependencies (@supabase/supabase-js).
COPY worker/package.json ./worker/package.json
RUN cd worker && npm install --omit=dev --no-audit --no-fund

# Shared, provider-neutral libraries + the extraction tools.
COPY lib ./lib
COPY tools/extraction ./tools/extraction
COPY worker ./worker

# Node 22 strips TypeScript types natively, so the worker imports lib/*.ts directly.
ENV NODE_ENV=production \
    PYTHON_BIN=python3 \
    TOOLS_DIR=/app/tools/extraction \
    POLL_INTERVAL_MS=15000 \
    EXTRACTOR_VERSION=upd2-1

# Run as an unprivileged user; temp files live in the per-run mkdtemp directory.
USER node

CMD ["node", "worker/index.mjs"]
