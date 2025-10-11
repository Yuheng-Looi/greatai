import json
import boto3
import logging
from datetime import datetime
import hashlib

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# S3 Configuration
SOURCE_BUCKET = "import-export-laws-v2"
TARGET_BUCKET = "import-export-laws-v2-translated"
s3_client = boto3.client('s3')

# Bedrock Configuration for translation
bedrock_client = boto3.client('bedrock-runtime')
TRANSLATION_MODEL = "amazon.nova-lite-v1:0"

# Language mapping
LANGUAGE_MAPPING = {
    "malaysia": "english",  # Malay to English
    "thailand": "english"   # Thai to English
}

def get_file_hash(content):
    """Generate MD5 hash of content for change detection."""
    return hashlib.md5(content).hexdigest()

def get_existing_translation_hash(s3_key):
    """Get hash of existing translated file in target S3."""
    try:
        response = s3_client.head_object(Bucket=TARGET_BUCKET, Key=s3_key)
        return response.get('Metadata', {}).get('source-hash')
    except s3_client.exceptions.NoSuchKey:
        return None

def extract_text_from_pdf(pdf_content):
    """Extract text from PDF content using Textract."""
    textract_client = boto3.client('textract')
    
    try:
        # Use Textract to extract text from PDF
        response = textract_client.detect_document_text(
            Document={'Bytes': pdf_content}
        )
        
        # Combine all text blocks
        extracted_text = ""
        for block in response['Blocks']:
            if block['BlockType'] == 'LINE':
                extracted_text += block['Text'] + "\n"
        
        return extracted_text.strip()
    
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {str(e)}")
        # Fallback: return empty string if Textract fails
        return ""

def translate_text_with_bedrock(text, source_country, target_language="english"):
    """Translate text using Amazon Bedrock."""
    
    # Determine source language
    source_language = "malay" if source_country == "malaysia" else "thai"
    
    prompt = f"""
Translate the following {source_language} legal document text to {target_language}. 
Maintain the legal terminology accuracy and document structure.
Preserve any legal references, article numbers, and official terms.

Original text:
{text}

Translated text:"""

    try:
        response = bedrock_client.invoke_model(
            modelId=TRANSLATION_MODEL,
            accept="application/json",
            contentType="application/json",
            body=json.dumps({
                "messages": [
                    {
                        "role": "user",
                        "content": [{"text": prompt}]
                    }
                ],
                "inferenceConfig": {
                    "temperature": 0.1,
                    "maxTokens": 4000,
                    "topP": 0.9
                }
            })
        )
        
        result = json.loads(response["body"].read())
        translated_text = result["output"]["message"]["content"][0]["text"]
        
        return translated_text.strip()
    
    except Exception as e:
        logger.error(f"Error translating text: {str(e)}")
        return text  # Return original text if translation fails

def create_translated_pdf(original_content, translated_text, metadata):
    """Create a simple text-based 'PDF' with translated content."""
    # For now, we'll store as text file with .txt extension
    # In production, you might want to use a proper PDF library
    
    header = f"""
TRANSLATED LEGAL DOCUMENT
=========================

Original Source: {metadata.get('source-url', 'Unknown')}
Translation Date: {datetime.utcnow().isoformat()}
Source Language: {metadata.get('source-language', 'Unknown')}
Target Language: English

TRANSLATED CONTENT:
==================

"""
    
    full_content = header + translated_text
    return full_content.encode('utf-8')

def process_file_translation(s3_key, source_country):
    """Process translation for a single file."""
    try:
        logger.info(f"Processing translation for: {s3_key}")
        
        # Download original file from source bucket
        response = s3_client.get_object(Bucket=SOURCE_BUCKET, Key=s3_key)
        original_content = response['Body'].read()
        original_metadata = response.get('Metadata', {})
        
        # Generate hash of source content
        source_hash = get_file_hash(original_content)
        
        # Check if we already have this version translated
        existing_translation_hash = get_existing_translation_hash(s3_key)
        
        if existing_translation_hash == source_hash:
            logger.info(f"Translation already up to date: {s3_key}")
            return {
                "action": "skipped",
                "file": s3_key,
                "reason": "already_translated"
            }
        
        # Extract text from PDF
        logger.info(f"Extracting text from: {s3_key}")
        extracted_text = extract_text_from_pdf(original_content)
        
        if not extracted_text.strip():
            logger.warning(f"No text extracted from: {s3_key}")
            return {
                "action": "failed",
                "file": s3_key,
                "reason": "no_text_extracted"
            }
        
        # Translate the text
        logger.info(f"Translating text for: {s3_key}")
        target_language = LANGUAGE_MAPPING.get(source_country, "english")
        translated_text = translate_text_with_bedrock(extracted_text, source_country, target_language)
        
        # Create translated document
        translated_content = create_translated_pdf(original_content, translated_text, {
            **original_metadata,
            'source-language': 'malay' if source_country == 'malaysia' else 'thai',
            'target-language': target_language
        })
        
        # Upload translated file to target bucket
        # Change extension to .txt for now (or keep .pdf and use proper PDF generation)
        target_key = s3_key.replace('.pdf', '_translated.txt')
        
        translation_metadata = {
            **original_metadata,
            'source-hash': source_hash,
            'translation-date': datetime.utcnow().isoformat(),
            'source-language': 'malay' if source_country == 'malaysia' else 'thai',
            'target-language': target_language,
            'original-file': s3_key
        }
        
        s3_client.put_object(
            Bucket=TARGET_BUCKET,
            Key=target_key,
            Body=translated_content,
            Metadata=translation_metadata,
            ContentType='text/plain'
        )
        
        logger.info(f"Translation completed: {s3_key} -> {target_key}")
        
        return {
            "action": "translated",
            "source_file": s3_key,
            "target_file": target_key,
            "source_language": 'malay' if source_country == 'malaysia' else 'thai',
            "target_language": target_language
        }
        
    except Exception as e:
        logger.error(f"Error processing translation for {s3_key}: {str(e)}")
        return {
            "action": "failed",
            "file": s3_key,
            "error": str(e)
        }

def lambda_handler(event, context):
    """Main Lambda function handler for translation."""
    try:
        logger.info(f"Translation Lambda triggered with event: {json.dumps(event)}")
        
        # Parse the incoming event
        # This could come from the scraper Lambda or S3 event notification
        
        files_to_translate = []
        
        # Case 1: Direct invocation from scraper Lambda
        if 'updates' in event:
            # Extract files from scraper response
            for country, updates in event['updates'].items():
                for update in updates:
                    if update['action'] in ['new', 'updated']:
                        files_to_translate.append({
                            'file': update['file'],
                            'country': country
                        })
        
        # Case 2: S3 event notification
        elif 'Records' in event:
            for record in event['Records']:
                if record['eventSource'] == 'aws:s3' and record['eventName'].startswith('ObjectCreated'):
                    s3_key = record['s3']['object']['key']
                    # Determine country from S3 key prefix
                    if s3_key.startswith('malaysia/'):
                        country = 'malaysia'
                    elif s3_key.startswith('thailand/'):
                        country = 'thailand'
                    else:
                        continue
                    
                    files_to_translate.append({
                        'file': s3_key,
                        'country': country
                    })
        
        # Case 3: Manual invocation with specific files
        elif 'files' in event:
            files_to_translate = event['files']
        
        else:
            return {
                "statusCode": 400,
                "body": json.dumps({
                    "error": "Invalid event format. Expected 'updates', 'Records', or 'files'",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
        
        if not files_to_translate:
            return {
                "statusCode": 200,
                "body": json.dumps({
                    "message": "No files to translate",
                    "timestamp": datetime.utcnow().isoformat()
                })
            }
        
        # Process translations
        translation_results = []
        for file_info in files_to_translate:
            result = process_file_translation(file_info['file'], file_info['country'])
            translation_results.append(result)
        
        # Summary
        successful_translations = len([r for r in translation_results if r['action'] == 'translated'])
        skipped_translations = len([r for r in translation_results if r['action'] == 'skipped'])
        failed_translations = len([r for r in translation_results if r['action'] == 'failed'])
        
        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": f"Translation completed. {successful_translations} translated, {skipped_translations} skipped, {failed_translations} failed.",
                "successful": successful_translations,
                "skipped": skipped_translations,
                "failed": failed_translations,
                "results": translation_results,
                "timestamp": datetime.utcnow().isoformat()
            })
        }
        
    except Exception as e:
        logger.error(f"Translation Lambda failed: {str(e)}")
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
            self.function_name = "translate-test"
            self.memory_limit_in_mb = 512
    
    # Test cases
    test_events = [
        # Test Case 1: Scraper output format
        {
            "updates": {
                "malaysia": [
                    {
                        "action": "new",
                        "file": "malaysia/direct/customs_act.pdf",
                        "source": "https://example.com/customs_act.pdf"
                    }
                ],
                "thailand": [
                    {
                        "action": "updated", 
                        "file": "thailand/listings/export_law.pdf",
                        "source": "https://example.com/export_law.pdf"
                    }
                ]
            }
        },
        
        # Test Case 2: Manual file specification
        {
            "files": [
                {"file": "malaysia/direct/test.pdf", "country": "malaysia"},
                {"file": "thailand/listings/test2.pdf", "country": "thailand"}
            ]
        }
    ]
    
    for i, test_event in enumerate(test_events, 1):
        print(f"\n=== Translation Test Case {i} ===")
        result = lambda_handler(test_event, MockContext())
        print(json.dumps(result, indent=2))