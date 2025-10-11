import os
import re
import time
import argparse
import logging
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# === CONFIG ===
TARGET_URLS = [
    "https://www.customs.gov.my/en/tp/Pages/tp_tgl.aspx",
    "https://www.customs.gov.my/en/pg/Pages/pg_aktakastam.aspx"
]

DOWNLOAD_DIR = "data/customs"
LOG_DIR = "logs"
USER_AGENT = "Mozilla/5.0 (compatible; LawScraper/1.2; +https://example.com)"

# === LOGGING SETUP ===
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    filename=os.path.join(LOG_DIR, "scraper.log"),
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

def fetch_page(url):
    """Fetch and return HTML content of a given URL."""
    headers = {"User-Agent": USER_AGENT}
    res = requests.get(url, headers=headers, timeout=30)
    res.raise_for_status()
    return res.text

def find_pdfs():
    """Find all PDF links from both target URLs."""
    pdfs = []
    for page_url in TARGET_URLS:
        logging.info(f"Fetching: {page_url}")
        try:
            html = fetch_page(page_url)
        except Exception as e:
            logging.error(f"Failed to fetch {page_url}: {e}")
            continue

        soup = BeautifulSoup(html, "lxml")
        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = link.get_text(strip=True)
            if ".pdf" in href.lower():
                pdf_url = urljoin(page_url, href)
                pdfs.append((text or os.path.basename(href), pdf_url))
    return pdfs

def safe_filename(name):
    """Clean up filenames to be filesystem-safe."""
    name = name.strip().replace(" ", "_")
    return re.sub(r"[\\/*?\"<>|:]", "_", name)

def download_pdf(title, url):
    """Download a single PDF if not already downloaded."""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    filename = safe_filename(title)
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    file_path = os.path.join(DOWNLOAD_DIR, filename)

    if os.path.exists(file_path):
        logging.info(f"Already exists: {filename}")
        return False

    try:
        headers = {"User-Agent": USER_AGENT}
        with requests.get(url, headers=headers, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        logging.info(f"Downloaded: {filename}")
        print(f"✅ Downloaded: {filename}")
        return True
    except Exception as e:
        logging.error(f"Failed to download {title}: {e}")
        return False

def scrape_once():
    """Scrape both pages and download new PDFs."""
    pdfs = find_pdfs()
    new_downloads = 0

    for title, url in pdfs:
        if download_pdf(title, url):
            new_downloads += 1

    logging.info(f"Scrape complete. {new_downloads} new files downloaded.")
    print(f"✅ Completed scrape: {new_downloads} new files downloaded.")
    return new_downloads

def run_loop(interval):
    """Keep running the scraper periodically."""
    while True:
        print("🔄 Running scrape cycle...")
        scrape_once()
        print(f"Sleeping for {interval/3600:.2f} hours...\n")
        time.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Customs Malaysia laws & tariff PDFs.")
    parser.add_argument("--loop-interval", type=int, help="Run continuously, rechecking every N seconds.")
    args = parser.parse_args()

    if args.loop_interval:
        run_loop(args.loop_interval)
    else:
        scrape_once()
