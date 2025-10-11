import os
import re
import time
import logging
import argparse
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup

# === Configuration ===
# Seed pages known to host laws / regulations
SEEDS = [
    "https://www.customs.go.th/data_files/a48902e107a80bbbfc83d38742957569.pdf",  # Customs Act translation
    "https://www.dft.go.th/Portals/0/Law/EXPORT%20AND%20IMPORT%20OF%20GOODS%202522-01.pdf",  # Import/Export Act
    # You should add the Royal Gazette listing pages (e.g. ratchakitcha.soc.go.th) here when you identify them
]

# Also pages (HTML) which list PDFs / laws (candidates)
LISTING_PAGES = [
    "https://www.customs.go.th", 
    "https://www.dft.go.th", 
    # and the Royal Gazette listing site when you find the URL
]

DOWNLOAD_DIR = "data/thailand"
LOG_FILE = "logs/th_scraper.log"
USER_AGENT = "Mozilla/5.0 (compatible; ThaiLawScraper/1.0)"

os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(os.path.dirname(LOG_FILE) or ".", exist_ok=True)
logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

def sanitize_filename(name: str) -> str:
    name = name.strip().replace(" ", "_")
    return re.sub(r'[\\/*?:"<>|]', "_", name)

def fetch(url):
    headers = {"User-Agent": USER_AGENT}
    resp = requests.get(url, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp

def find_pdfs_in_html(base_url, html):
    soup = BeautifulSoup(html, "lxml")
    results = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if href.lower().endswith(".pdf"):
            full = urljoin(base_url, href)
            results.append((text or os.path.basename(href), full))
    return results

def download_pdf(title, url):
    fname = sanitize_filename(title)
    if not fname.lower().endswith(".pdf"):
        fname += ".pdf"
    dest = os.path.join(DOWNLOAD_DIR, fname)
    if os.path.exists(dest):
        logging.info("Already exists: %s", dest)
        return False
    try:
        resp = fetch(url)
        with open(dest, "wb") as f:
            f.write(resp.content)
        logging.info("Downloaded: %s from %s", dest, url)
        return True
    except Exception as e:
        logging.error("Failed to download %s from %s: %s", title, url, e)
        return False

def scrape_once():
    new_count = 0

    # Direct seed PDFs
    for pdf_url in SEEDS:
        title = os.path.basename(pdf_url)
        if download_pdf(title, pdf_url):
            new_count += 1

    # From listing pages, find more PDFs
    for page in LISTING_PAGES:
        try:
            resp = fetch(page)
        except Exception as e:
            logging.error("Failed fetch page %s: %s", page, e)
            continue
        pdfs = find_pdfs_in_html(page, resp.text)
        for (title, link) in pdfs:
            if download_pdf(title, link):
                new_count += 1

    print(f"✅ Thailand scrape: {new_count} new PDFs downloaded")
    logging.info("Thailand scrape: %d new PDFs", new_count)

def run_loop(interval):
    while True:
        scrape_once()
        time.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Thailand import/export law PDFs")
    parser.add_argument("--loop-interval", type=int, help="Run in loop every N seconds")
    args = parser.parse_args()

    if args.loop_interval:
        run_loop(args.loop_interval)
    else:
        scrape_once()
