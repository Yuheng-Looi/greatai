import boto3
import json
import uuid
from datetime import datetime
from decimal import Decimal

# --- Setup clients ---
region = "us-east-1"
kb_id = "ZJPFKLZF4U"

# --- Configuration ---
SUPPORTED_COUNTRIES = [
    "Malaysia",
    "Singapore", 
    "Thailand",
    "Indonesia"
]

# Add new countries here as needed
# Example: SUPPORTED_COUNTRIES.append("Vietnam")

agent_client = boto3.client("bedrock-agent-runtime", region_name=region)
runtime_client = boto3.client("bedrock-runtime", region_name=region)
dynamodb = boto3.resource("dynamodb", region_name=region)

# DynamoDB table
table = dynamodb.Table("userhistory")

def check_user_chat_exists(user_id, chat_id):
    """Check if user+chat combination exists in DynamoDB"""
    try:
        response = table.get_item(
            Key={
                'userId': user_id,
                'chatId': chat_id
            }
        )
        return 'Item' in response
    except Exception as e:
        print(f"Error checking user/chat existence: {e}")
        return False

def get_chat_history(user_id, chat_id):
    """Retrieve chat history from DynamoDB"""
    try:
        response = table.get_item(
            Key={
                'userId': user_id,
                'chatId': chat_id
            }
        )
        
        if 'Item' in response:
            # Convert DynamoDB Decimal to regular types for JSON serialization
            chat_history = response['Item'].get('chathistory', [])
            return convert_decimals(chat_history)
        else:
            return []
    except Exception as e:
        print(f"Error retrieving chat history: {e}")
        return []

def update_chat_history(user_id, chat_id, chat_history):
    """Update chat history in DynamoDB"""
    try:
        table.put_item(
            Item={
                'userId': user_id,
                'chatId': chat_id,
                'chathistory': chat_history,
                'lastUpdated': datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        print(f"Error updating chat history: {e}")

def convert_decimals(obj):
    """Convert DynamoDB Decimal objects to regular Python types"""
    if isinstance(obj, list):
        return [convert_decimals(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_decimals(value) for key, value in obj.items()}
    elif isinstance(obj, Decimal):
        return float(obj) if obj % 1 else int(obj)
    else:
        return obj

def get_system_prompt():
    """Generate system prompt with current supported countries"""
    countries_list = ", ".join(SUPPORTED_COUNTRIES)
    
    return f"""
You are an AI Legal Assistant specialized in import/export law for {countries_list}.

Key rules:
1. Some laws/orders are subsidiary legislation (orders, regulations) under major acts; ensure you track both the Act + the subordinate legal instrument. If the subordinate is not provided, state it clearly.
2. Always cover all relevant countries from this list: {countries_list}. If the user doesn't specify countries, ask them to clarify which countries they're interested in.
3. Assume the user has no legal knowledge. Always explain in simple, clear terms.
4. You are a professional legal advisor. Do NOT tell the user to check documents, websites, or authorities. You must extract, summarize, and provide the relevant information directly.
5. If the user's question is ambiguous, ask clarifying questions with multiple-choice style options (A, B, C) so the user knows what to provide.
6. Always assume the user does not have any permits or licenses and is a first-time exporter. List all possible documents, permits, and registrations that may be required.
7. To determine HS codes, do NOT ask the user. Suggest possible HS codes based on your knowledge. If uncertain, leave HSCode blank.
8. If an item has limits/taxes based on weight or amount, but the user has not given this, ask for the information in your clarification question.
9. When answering, follow this format:
   - If clarification is needed: "Follow-up Question: <your question> Options: A) ..., B) ..., C) ..."
   - If confident in your answer, respond in JSON:
   {{
    "Item": "item name",
    "ShipFrom": "source country",
    "ShipTo": "destination country", 
    "Result": "Allow/Not Allow/With Condition",
    "Classification": "",
    "HSCode": "",
    "EstFee": "",
    "ExportTax": "source country export duty/tax percentage",
    "ImportTax": "destination country import duty/tax percentage",
    "KeyRegulation": "Act/Regulation name, plain explanation; Act/Regulation name, plain explanation",
    "LimitationAndPrecautions": ["Clear reminder 1","Clear reminder 2","Clear reminder 3"],
    "Source": "List of legal documents used"
   }}
10. KeyRegulation: rewrite in plain English. Do not paste law text word-for-word.
11. LimitationAndPrecautions: Always provide a bullet list of clear reminders. Never say "check with customs" — instead, do the check for them and present the exact reminders.
12. EstFee: give an estimated range (covering shipping, insurance, handling). Do not ask user for costs.
13. ExportTax = export duty/tax from the source country. ImportTax = import duty/tax from the destination country.
14. If you cannot find relevant legal documents, explicitly state so. Do not make up sources.
15. ShipFrom and ShipTo should be specific country names from the supported list: {countries_list}.

Always provide the final answer in JSON format or a Follow-up Question if more info is required.
"""
def query_knowledge_base_and_llm(user_query, conversation_history):
    """Query knowledge base and get LLM response"""
    
    # --- Step 1: Retrieve relevant documents from Knowledge Base ---
    retrieval = agent_client.retrieve(
        knowledgeBaseId=kb_id,
        retrievalQuery={"text": user_query},
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": 8
            }
        }
    )

    retrieved_chunks = []
    for r in retrieval["retrievalResults"]:
        text = r["content"]["text"]
        source = r.get("location", {}).get("s3Location", {}).get("uri", "Unknown Source")
        retrieved_chunks.append(f"[Source: {source}]\n{text}")

    retrieved_context = "\n\n".join(retrieved_chunks)

    # --- Step 2: Build system + user prompt for Nova Lite ---
    system_prompt = get_system_prompt()

    # Build conversation context
    conversation_context = ""
    if conversation_history:
        conversation_context = "Previous conversation:\n"
        for i, exchange in enumerate(conversation_history, 1):
            if isinstance(exchange, dict) and 'question' in exchange and 'answer' in exchange:
                conversation_context += f"Q{i}: {exchange['question']}\nA{i}: {exchange['answer']}\n\n"
            elif isinstance(exchange, (list, tuple)) and len(exchange) >= 2:
                conversation_context += f"Q{i}: {exchange[0]}\nA{i}: {exchange[1]}\n\n"

    final_prompt = f"""
System Instructions:
{system_prompt}

{conversation_context}Current Question:
{user_query}

Retrieved Context:
{retrieved_context}
"""

    # --- Step 3: Call Amazon Nova Lite via Bedrock Runtime ---
    response = runtime_client.invoke_model(
        modelId="amazon.nova-lite-v1:0",
        accept="application/json",
        contentType="application/json",
        body=json.dumps({
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": final_prompt}]
                }
            ],
            "inferenceConfig": {
                "temperature": 0.2,
                "maxTokens": 1200,
                "topP": 0.9
            }
        })
    )

    model_output = json.loads(response["body"].read())
    return model_output["output"]["message"]["content"][0]["text"]

def lambda_handler(event, context):
    """
    Lambda handler function
    Expected payload:
    {
      "userId": "u1",
      "chatId": "c2", 
      "question": "user question"
    }
    
    Frontend generates userId and chatId. If the combination doesn't exist in DynamoDB,
    a new chat history entry will be created.
    """
    
    try:
        # Parse the payload
        if isinstance(event, str):
            event = json.loads(event)
        
        user_id = event.get('userId')
        chat_id = event.get('chatId')
        user_question = event.get('question')
        
        # Validate required fields
        if not all([user_id, chat_id, user_question]):
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'Missing required fields: userId, chatId, or question'
                })
            }
        
        # Check if this is a new chat (user+chat combination doesn't exist)
        is_new_chat = not check_user_chat_exists(user_id, chat_id)
        
        # Get existing chat history (will be empty for new chats)
        chat_history = get_chat_history(user_id, chat_id)
        
        # Query the knowledge base and LLM
        ai_response = query_knowledge_base_and_llm(user_question, chat_history)
        
        # Update chat history with new Q&A
        new_exchange = {
            'question': user_question,
            'answer': ai_response,
            'timestamp': datetime.utcnow().isoformat()
        }
        chat_history.append(new_exchange)
        
        # Save updated chat history to DynamoDB
        update_chat_history(user_id, chat_id, chat_history)
        
        # Return the response in the requested format
        response_body = {
            'respond': ai_response
        }
        
        # Add flag for new chat if applicable
        if is_new_chat:
            response_body['newChat'] = True
        
        return {
            'statusCode': 200,
            'body': json.dumps(response_body)
        }
        
    except Exception as e:
        print(f"Error in lambda_handler: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': f'Internal server error: {str(e)}'
            })
        }