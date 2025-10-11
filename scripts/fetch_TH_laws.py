import os
import re
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from PyPDF2 import PdfReader
from io import BytesIO
import langdetect

# ---------------------------
# Configuration
# ---------------------------
BASE_DIR = "data/thailand"
os.makedirs(BASE_DIR, exist_ok=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

CUSTOMS_LISTING = "https://www.customs.go.th/list_strc_download.php?ini_menu=menu_interest_and_law_160421_04&ini_content=general_interest_160426_05_160810_01&show_search=1&order_by=co_priority&sort_type=1&lang=th&root_left_menu=menu_interest_and_law_160421_04&left_menu=menu_interest_and_law_160421_04_160810_01"
DFT_BASE = "https://www.dft.go.th/en-us/Legal-Translation"

SEEDS = [
    "https://www.customs.go.th/data_files/a48902e107a80bbbfc83d38742957569.pdf",
]

# ---------------------------
# Utilities
# ---------------------------
def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r

def get_actual_pdf_url(intermediate_url):
    resp = fetch(intermediate_url)
    soup = BeautifulSoup(resp.text, "lxml")
    a_tag = soup.find("a", string=re.compile("คลิกตรงนี้", re.I))
    if a_tag and a_tag.has_attr("href"):
        return urljoin(intermediate_url, a_tag["href"])
    return None

def is_english_pdf(content: bytes) -> bool:
    try:
        reader = PdfReader(BytesIO(content))
        text = "".join((page.extract_text() or "") for page in reader.pages[:2])
        if not text.strip():
            return False
        return langdetect.detect(text) == "en"
    except Exception:
        return False

def sanitize_filename(name: str, max_length=150) -> str:
    # Replace illegal characters with underscore
    name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name)
    # Collapse multiple underscores
    name = re.sub(r'_+', '_', name)
    # Trim length to avoid Windows path limit
    if len(name) > max_length:
        name = name[:max_length]
    return name

def download_pdf(title, url, folder, english_check=True):
    folder_path = os.path.join(BASE_DIR, folder)
    os.makedirs(folder_path, exist_ok=True)

    fname = sanitize_filename(title)
    if not fname.lower().endswith(".pdf"):
        fname += ".pdf"

    dest = os.path.join(folder_path, fname)
    if os.path.exists(dest):
        logging.info("Already exists: %s", dest)
        return

    # Resolve Customs two-step URLs
    if "cont_strc_download.php" in url:
        pdf_url = get_actual_pdf_url(url)
        if not pdf_url:
            logging.warning("Failed to resolve PDF for %s", url)
            return
        url = pdf_url

    resp = fetch(url)
    content = resp.content

    if english_check and not is_english_pdf(content):
        logging.info("Skipped non-English PDF: %s", url)
        return

    with open(dest, "wb") as f:
        f.write(content)
    logging.info("Downloaded PDF: %s", dest)

# ---------------------------
# Scrapers
# ---------------------------
def scrape_customs():
    resp = fetch(CUSTOMS_LISTING)
    soup = BeautifulSoup(resp.text, "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(" ", strip=True)
        if "cont_strc_download.php" in href and "ภาษาอังกฤษ" in text:
            full_url = urljoin(CUSTOMS_LISTING, href)
            download_pdf(text, full_url, folder="customs")

def scrape_dft():
    page_num = 1
    while True:
        url = f"{DFT_BASE}?page={page_num}"
        resp = fetch(url)
        soup = BeautifulSoup(resp.text, "lxml")
        links = soup.find_all("a", href=True)
        pdf_found = False
        for a in links:
            href = a["href"]
            text = a.get_text(" ", strip=True)
            if href.lower().endswith(".pdf"):
                full_url = urljoin(DFT_BASE, href)
                download_pdf(text, full_url, folder="dft", english_check=False)
                pdf_found = True
        if not pdf_found:
            break
        page_num += 1

# ---------------------------
# Main
# ---------------------------
def main():
    # Seed PDFs
    for pdf_url in SEEDS:
        title = pdf_url.split("/")[-1]
        download_pdf(title, pdf_url, folder="seeds")

    logging.info("Scraping Customs site...")
    scrape_customs()

    logging.info("Scraping DFT site...")
    scrape_dft()

    logging.info("✅ Thailand English PDF scrape completed.")

if __name__ == "__main__":
    main()
