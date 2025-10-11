import os
import re
import time
import argparse
import logging
import hashlib
from io import BytesIO
from urllib.parse import urljoin

import boto3
import requests
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
import langdetect

# ---------------------------
# AWS CONFIG
# ---------------------------
S3_BUCKET = "import-export-laws-v2"
s3_client = boto3.client("s3")

# Folder prefixes in S3
S3_PREFIX_TH = "Thailand"
S3_PREFIX_MY = "Malaysia"

# ---------------------------
# PATH CONFIG (Lambda /tmp)
# ---------------------------
BASE_TMP = "/tmp"
TH_BASE_DIR = os.path.join(BASE_TMP, "data/thailand")
MY_DOWNLOAD_DIR = os.path.join(BASE_TMP, "data/customs")
LOG_DIR = os.path.join(BASE_TMP, "logs")

for d in [TH_BASE_DIR, MY_DOWNLOAD_DIR, LOG_DIR]:
    os.makedirs(d, exist_ok=True)

# ---------------------------
# TARGET URLs
# ---------------------------
TH_CUSTOMS_LISTING = "https://www.customs.go.th/list_strc_download.php?ini_menu=menu_interest_and_law_160421_04&ini_content=general_interest_160426_05_160810_01&show_search=1&order_by=co_priority&sort_type=1&lang=th&root_left_menu=menu_interest_and_law_160421_04&left_menu=menu_interest_and_law_160421_04_160810_01"
TH_DFT_BASE = "https://www.dft.go.th/en-us/Legal-Translation"
TH_SEEDS = [
    "https://www.customs.go.th/data_files/a48902e107a80bbbfc83d38742957569.pdf",
]

MY_TARGET_URLS = [
    "https://www.customs.gov.my/en/tp/Pages/tp_tgl.aspx",
    "https://www.customs.gov.my/en/pg/Pages/pg_aktakastam.aspx"
]

# ---------------------------
# HEADERS / LOGGING
# ---------------------------
USER_AGENT = "Mozilla/5.0 (compatible; LawScraper/1.2; +https://example.com)"
HEADERS = {"User-Agent": USER_AGENT}

logging.basicConfig(
    filename=os.path.join(LOG_DIR, "scraper.log"),
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

# ---------------------------
# UTILITIES
# ---------------------------
def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return r

def sanitize_filename(name: str, max_length=150) -> str:
    name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name)
    name = re.sub(r'_+', '_', name)
    if len(name) > max_length:
        truncated = name[:max_length]
        h = hashlib.md5(name.encode("utf-8")).hexdigest()[:8]
        name = f"{truncated}_{h}"
    return name

def is_english_pdf(content: bytes) -> bool:
    try:
        reader = PdfReader(BytesIO(content))
        text = "".join((page.extract_text() or "") for page in reader.pages[:2])
        if not text.strip():
            return False
        return langdetect.detect(text) == "en"
    except Exception:
        return False

def upload_to_s3(file_path, s3_prefix):
    """Upload a file to S3 under given prefix."""
    s3_key = os.path.join(s3_prefix, os.path.basename(file_path))
    try:
        s3_client.upload_file(file_path, S3_BUCKET, s3_key)
        logging.info(f"Uploaded to S3: {s3_key}")
    except Exception as e:
        logging.error(f"S3 upload failed for {file_path}: {e}")

def download_pdf(title, url, folder, s3_prefix=None, english_check=True):
    os.makedirs(folder, exist_ok=True)
    fname = sanitize_filename(title)
    if not fname.lower().endswith(".pdf"):
        fname += ".pdf"
    dest = os.path.join(folder, fname)
    if os.path.exists(dest):
        logging.info("Already exists: %s", dest)
        return False

    try:
        resp = fetch(url)
        content = resp.content

        if english_check and not is_english_pdf(content):
            logging.info("Skipped non-English PDF: %s", url)
            return False

        with open(dest, "wb") as f:
            f.write(content)
        logging.info("Downloaded PDF: %s", dest)
        print(f"✅ Downloaded: {dest}")

        # Upload to S3
        if s3_prefix:
            upload_to_s3(dest, s3_prefix)

        return True
    except Exception as e:
        logging.error(f"Failed to download {title}: {e}")
        return False

# ---------------------------
# THAILAND SCRAPERS
# ---------------------------
def get_actual_pdf_url(intermediate_url):
    resp = fetch(intermediate_url)
    soup = BeautifulSoup(resp.text, "lxml")
    a_tag = soup.find("a", string=re.compile("คลิกตรงนี้", re.I))
    if a_tag and a_tag.has_attr("href"):
        return urljoin(intermediate_url, a_tag["href"])
    return None

def scrape_thailand_customs():
    resp = fetch(TH_CUSTOMS_LISTING)
    soup = BeautifulSoup(resp.text, "lxml")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(" ", strip=True)
        if "cont_strc_download.php" in href and "ภาษาอังกฤษ" in text:
            full_url = urljoin(TH_CUSTOMS_LISTING, href)
            pdf_url = get_actual_pdf_url(full_url)
            if pdf_url:
                download_pdf(text, pdf_url, folder=os.path.join(TH_BASE_DIR, "customs"), s3_prefix=S3_PREFIX_TH)

# ---------------------------
# THAILAND DFT SCRAPER (FIRST PAGE)
# ---------------------------
DFT_BASE_URL = "https://www.dft.go.th"
DFT_TARGET_URL = "https://www.dft.go.th/en-us/Legal-Translation"
DFT_DOWNLOAD_DIR = os.path.join(TH_BASE_DIR, "dft")  # separate folder for DFT

def scrape_thailand_dft_first_page():
    os.makedirs(DFT_DOWNLOAD_DIR, exist_ok=True)
    try:
        resp = fetch(DFT_TARGET_URL)
    except Exception as e:
        logging.error(f"Failed to fetch DFT page: {e}")
        return

    soup = BeautifulSoup(resp.text, "lxml")

    # The links to PDFs are usually in <a> tags, may contain Thai in href
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(" ", strip=True)

        # Only PDF links
        if href.lower().endswith(".pdf"):
            pdf_url = urljoin(DFT_BASE_URL, href)
            title = text or os.path.basename(href)
            download_pdf(title, pdf_url, folder=DFT_DOWNLOAD_DIR, s3_prefix=S3_PREFIX_TH, english_check=True)

def scrape_thailand():
    # Seed PDFs
    for pdf_url in TH_SEEDS:
        title = pdf_url.split("/")[-1]
        download_pdf(title, pdf_url, folder=os.path.join(TH_BASE_DIR, "seeds"), s3_prefix=S3_PREFIX_TH)

    logging.info("Scraping Thailand Customs...")
    scrape_thailand_customs()

    logging.info("Scraping Thailand DFT (first page only)...")
    scrape_thailand_dft_first_page()  # <-- NEW

# ---------------------------
# MALAYSIA SCRAPERS
# ---------------------------
def find_my_pdfs():
    pdfs = []
    for page_url in MY_TARGET_URLS:
        logging.info(f"Fetching: {page_url}")
        try:
            html = fetch(page_url).text
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
    name = name.strip().replace(" ", "_")
    return re.sub(r"[\\/*?\"<>|:]", "_", name)

def download_my_pdf(title, url):
    os.makedirs(MY_DOWNLOAD_DIR, exist_ok=True)
    filename = safe_filename(title)
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    file_path = os.path.join(MY_DOWNLOAD_DIR, filename)
    if os.path.exists(file_path):
        logging.info(f"Already exists: {filename}")
        return False

    try:
        with requests.get(url, headers=HEADERS, stream=True, timeout=60) as r:
            r.raise_for_status()
            with open(file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        logging.info(f"Downloaded: {filename}")
        print(f"✅ Downloaded: {filename}")

        # Upload to S3
        upload_to_s3(file_path, S3_PREFIX_MY)

        return True
    except Exception as e:
        logging.error(f"Failed to download {title}: {e}")
        return False

def scrape_malaysia():
    pdfs = find_my_pdfs()
    new_downloads = 0
    for title, url in pdfs:
        if download_my_pdf(title, url):
            new_downloads += 1
    logging.info(f"Malaysia scrape complete. {new_downloads} new files downloaded.")
    print(f"✅ Completed Malaysia scrape: {new_downloads} new files downloaded.")

# ---------------------------
# LAMBDA HANDLER
# ---------------------------
def lambda_handler(event, context):
    print("🔄 Scraping Thailand PDFs...")
    scrape_thailand()
    print("🔄 Scraping Malaysia PDFs...")
    scrape_malaysia()
    return {"status": "success"}

if __name__ == "__main__":
    print("🔄 Scraping Thailand PDFs...")
    scrape_thailand()
    print("🔄 Scraping Malaysia PDFs...")
    scrape_malaysia()
    print("✅ All scrapes completed.")
