FROM python:3.12-slim-bookworm

WORKDIR /app

# Chromium (via playwright install --with-deps) needs these system libs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN crawl4ai-setup && playwright install --with-deps chromium

COPY travel_scraper.py .

# targets.json is your real target list (see README) -- not committed to git,
# so it must exist in this directory at build time.
COPY targets.json .

CMD ["python", "travel_scraper.py", "targets.json"]
