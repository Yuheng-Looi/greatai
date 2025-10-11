import json
import boto3
import hashlib
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 Configuration
S3_BUCKET = "import-export-laws-v2"
s3_client = boto3.client('s3')

# Lambda Configuration for triggering translation
lambda_client = boto3.client('lambda')
TRANSLATION_LAMBDA_NAME = "translate-law-documents"

# Country configurations
COUNTRY_CONFIGS = {
    "malaysia": {
        "listing_pages": [
            "https://www.customs.gov.my/en/tp/Pages/tp_tgl.aspx",
            "https://www.customs.gov.my/en/pg/Pages/pg_aktakastam.aspx"
        ],
        "direct_pdfs": [],
        "s3_prefix": "malaysia/"
    },
    "thailand": {
        "listing_pages": [
            "https://www.customs.go.th",
            "https://www.dft.go.th"
        ],
        "direct_pdfs": [
            "https://www.customs.go.th/data_files/a48902e107a80bbbfc83d38742957569.pdf",
            "https://www.dft.go.th/Portals/0/Law/EXPORT%20AND%20IMPORT%20OF%20GOODS%202522-01.pdf"
        ],
        "s3_prefix": "thailand/"
    }
}

USER_AGENT = "Mozilla/5.0 (compatible; LawScraper/2.0)"

def get_file_hash(content):
    """Generate MD5 hash of file content for change detection."""
    return hashlib.md5(content).hexdigest()

def fetch_page(url):
    """Fetch HTML content from URL."""
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.text

def fetch_pdf(url):
    """Fetch PDF content from URL."""
    headers = {"User-Agent": USER_AGENT}
    response = requests.get(url, headers=headers, timeout=60)
    response.raise_for_status()
    return response.content

def find_pdfs_in_page(base_url, html):
    """Extract PDF links from HTML page."""
    soup = BeautifulSoup(html, "html.parser")
    pdfs = []
    
    for link in soup.find_all("a", href=True):
        href = link["href"]
        text = link.get_text(strip=True)
        
        if ".pdf" in href.lower():
            full_url = urljoin(base_url, href)
            title = text or href.split('/')[-1]
            pdfs.append({"title": title, "url": full_url})
    
    return pdfs

def get_existing_file_hash(s3_key):
    """Get hash of existing file in S3."""
    try:
        response = s3_client.head_object(Bucket=S3_BUCKET, Key=s3_key)
        return response.get('Metadata', {}).get('content-hash')
    except s3_client.exceptions.NoSuchKey:
        return None

def upload_to_s3(content, s3_key, content_hash, metadata=None):
    """Upload file to S3 with metadata."""
    if metadata is None:
        metadata = {}
    
    metadata.update({
        'content-hash': content_hash,
        'last-updated': datetime.utcnow().isoformat(),
        'source': 'lambda-scraper'
    })
    
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=content,
        Metadata=metadata,
        ContentType='application/pdf'
    )

def sanitize_filename(name):
    """Clean filename for S3 key."""
    import re
    name = name.strip().replace(" ", "_")
    name = re.sub(r'[\\/*?:"<>|]', "_", name)
    if not name.lower().endswith('.pdf'):
        name += '.pdf'
    return name

def process_country(country, config):
    """Process all PDFs for a specific country."""
    updates = []
    s3_prefix = config["s3_prefix"]
    
    # Process direct PDF links
    for pdf_url in config["direct_pdfs"]:
        try:
            logger.info(f"Checking direct PDF: {pdf_url}")
            
            # Fetch PDF content
            pdf_content = fetch_pdf(pdf_url)
            content_hash = get_file_hash(pdf_content)
            
            # Generate S3 key
            filename = sanitize_filename(pdf_url.split('/')[-1])
            s3_key = f"{s3_prefix}direct/{filename}"
            
            # Check if file changed
            existing_hash = get_existing_file_hash(s3_key)
            
            if existing_hash != content_hash:
                upload_to_s3(pdf_content, s3_key, content_hash, {
                    'source-url': pdf_url,
                    'pdf-type': 'direct'
                })
                updates.append({
                    "action": "updated" if existing_hash else "new",
                    "file": s3_key,
                    "source": pdf_url
                })
                logger.info(f"Updated: {s3_key}")
            else:
                logger.info(f"No change: {s3_key}")
                
        except Exception as e:
            logger.error(f"Error processing direct PDF {pdf_url}: {str(e)}")
    
    # Process listing pages
    for page_url in config["listing_pages"]:
        try:
            logger.info(f"Checking listing page: {page_url}")
            
            # Get PDFs from listing page
            html = fetch_page(page_url)
            pdfs = find_pdfs_in_page(page_url, html)
            
            for pdf_info in pdfs:
                try:
                    pdf_url = pdf_info["url"]
                    title = pdf_info["title"]
                    
                    # Fetch PDF content
                    pdf_content = fetch_pdf(pdf_url)
                    content_hash = get_file_hash(pdf_content)
                    
                    # Generate S3 key
                    filename = sanitize_filename(title)
                    s3_key = f"{s3_prefix}listings/{filename}"
                    
                    # Check if file changed
                    existing_hash = get_existing_file_hash(s3_key)
                    
                    if existing_hash != content_hash:
                        upload_to_s3(pdf_content, s3_key, content_hash, {
                            'source-url': pdf_url,
                            'pdf-type': 'listing',
                            'original-title': title
                        })
                        updates.append({
                            "action": "updated" if existing_hash else "new",
                            "file": s3_key,
                            "source": pdf_url,
                            "title": title
                        })
                        logger.info(f"Updated: {s3_key}")
                    else:
                        logger.info(f"No change: {s3_key}")
                        
                except Exception as e:
                    logger.error(f"Error processing PDF {pdf_info}: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error processing listing page {page_url}: {str(e)}")
    
    return updates

def trigger_translation_lambda(updates):
    """Trigger translation Lambda if there are new/updated files."""
    # Check if there are any new or updated files
    has_updates = any(
        any(update['action'] in ['new', 'updated'] for update in country_updates)
        for country_updates in updates.values()
    )
    
    if not has_updates:
        logger.info("No new/updated files to translate")
        return None
    
    try:
        # Prepare payload for translation Lambda
        translation_payload = {
            "updates": updates
        }
        
        # Invoke translation Lambda asynchronously
        response = lambda_client.invoke(
            FunctionName=TRANSLATION_LAMBDA_NAME,
            InvocationType='Event',  # Asynchronous invocation
            Payload=json.dumps(translation_payload)
        )
        
        logger.info(f"Translation Lambda triggered successfully. StatusCode: {response['StatusCode']}")
        return {
            "triggered": True,
            "status_code": response['StatusCode']
        }
        
    except Exception as e:
        logger.error(f"Failed to trigger translation Lambda: {str(e)}")
        return {
            "triggered": False,
            "error": str(e)
        }

def lambda_handler(event, context):
    """Main Lambda function handler."""
    try:
        # Get country parameter from event payload
        target_country = event.get("country", "all").upper()
        
        # Validate country parameter
        valid_countries = {"MY": "malaysia", "TH": "thailand", "ALL": "all"}
        
        if target_country not in valid_countries:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": f"Invalid country '{target_country}'. Must be one of: MY, TH, ALL",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
        
        all_updates = {}
        
        # Determine which countries to process
        if target_country == "ALL":
            countries_to_process = COUNTRY_CONFIGS.items()
            logger.info("Processing all countries")
        else:
            country_key = valid_countries[target_country]
            if country_key in COUNTRY_CONFIGS:
                countries_to_process = [(country_key, COUNTRY_CONFIGS[country_key])]
                logger.info(f"Processing single country: {country_key}")
            else:
                return {
                    "statusCode": 400,
                    "body": json.dumps({
                        "error": f"Country configuration not found for '{target_country}'",
                        "timestamp": datetime.utcnow().isoformat()
                    })
                }
        
        # Process selected countries
        for country, config in countries_to_process:
            logger.info(f"Processing {country}...")
            updates = process_country(country, config)
            all_updates[country] = updates
            logger.info(f"Completed {country}: {len(updates)} updates")
        
        # Summary
        total_updates = sum(len(updates) for updates in all_updates.values())
        processed_countries = list(all_updates.keys())
        
        # Trigger translation Lambda if there are updates
        translation_result = trigger_translation_lambda(all_updates)
        
        result = {
            "statusCode": 200,
            "body": json.dumps({
                "message": f"Law scraping completed for {', '.join(processed_countries)}. {total_updates} total updates.",
                "target_country": target_country,
                "processed_countries": processed_countries,
                "updates": all_updates,
                "translation_triggered": translation_result,
                "timestamp": datetime.utcnow().isoformat()
            })
        }
        
        logger.info(f"Lambda completed successfully. Target: {target_country}, Total updates: {total_updates}")
        return result
        
    except Exception as e:
        logger.error(f"Lambda function failed: {str(e)}")
        return {
            "statusCode": 500,
            "body": json.dumps({
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
        }

# For local testing
if __name__ == "__main__":
    # Mock context for local testing
    class MockContext:
        def __init__(self):
            self.function_name = "test"
            self.memory_limit_in_mb = 128
    
    # Test different scenarios
    test_cases = [
        {"country": "MY"},     # Malaysia only
        {"country": "TH"},     # Thailand only
        {"country": "ALL"},    # All countries
        {}                     # Default (all countries)
    ]
    
    for i, test_event in enumerate(test_cases, 1):
        print(f"\n=== Test Case {i}: {test_event} ===")
        result = lambda_handler(test_event, MockContext())
        print(json.dumps(result, indent=2))