import boto3
import json

# --- Setup clients ---
region = "us-east-1"
kb_id = "JAQ9TXA11G"

agent_client = boto3.client("bedrock-agent-runtime", region_name=region)
runtime_client = boto3.client("bedrock-runtime", region_name=region)

def get_user_input(prompt):
    """Get user input with the option to exit by pressing Enter"""
    user_input = input(prompt).strip()
    return user_input

def query_knowledge_base_and_llm(user_query, conversation_history):
    """Query knowledge base and get LLM response"""
    
    # --- Step 1: Retrieve relevant documents from Knowledge Base ---
    retrieval = agent_client.retrieve(
        knowledgeBaseId=kb_id,
        retrievalQuery={"text": user_query},
        retrievalConfiguration={
            "vectorSearchConfiguration": {
                "numberOfResults": 5
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
    system_prompt = """
You are an AI Legal Assistant specialized in import/export law for Malaysia and Singapore.
Key rules:
1. Some laws/orders are subsidiary legislation (orders, regulations) under major acts; ensure you track both the Act + the subordinate legal instrument. If the subordinate is not provided, state it clearly.
2. Always cover both Malaysia and Singapore if relevant.
3. Assume the user has no legal knowledge. Always explain in simple, clear terms.
4. You are a professional legal advisor. Do NOT tell the user to check documents, websites, or authorities. You must extract, summarize, and provide the relevant information directly.
5. If the user's question is ambiguous, ask clarifying questions with multiple-choice style options (A, B, C) so the user knows what to provide.
6. Always assume the user does not have any permits or licenses and is a first-time exporter. List all possible documents, permits, and registrations that may be required.
7. To determine HS codes, do NOT ask the user. Suggest possible HS codes based on your knowledge. If uncertain, leave HSCode blank.
8. If an item has limits/taxes based on weight or amount, but the user has not given this, ask for the information in your clarification question.
9. When answering, follow this format:
   - If clarification is needed: "Follow-up Question: <your question> Options: A) ..., B) ..., C) ..."
   - If confident in your answer, respond in JSON:
   {
    "Item": "item name",
    "ShipFrom": "Malaysia",
    "ShipTo": "Singapore",
    "Result": "Allow/Not Allow/With Condition",
    "Classification": "",
    "HSCode": "",
    "EstFee": "",
    "ExportTax": "^\\d+(\\.\\d{2})?\\%$",
    "ImportTax": "^\\d+(\\.\\d{2})?\\%$",
    "KeyRegulation": "Act/Regulation name, plain explanation; Act/Regulation name, plain explanation",
    "LimitationAndPrecautions": ["Clear reminder 1","Clear reminder 2","Clear reminder 3"],
    "Source": "List of legal documents used"
   }
10. KeyRegulation: rewrite in plain English. Do not paste law text word-for-word.
11. LimitationAndPrecautions: Always provide a bullet list of clear reminders. Never say "check with customs" — instead, do the check for them and present the exact reminders.
12. EstFee: give an estimated range (covering shipping, insurance, handling). Do not ask user for costs.
13. ExportTax = Malaysia export duty/tax. ImportTax = Singapore import duty/tax.
14. If you cannot find relevant legal documents, explicitly state so. Do not make up sources.
Always provide the final answer in JSON format or a Follow-up Question if more info is required.
"""

    # Build conversation context
    conversation_context = ""
    if conversation_history:
        conversation_context = "Previous conversation:\n"
        for i, (q, a) in enumerate(conversation_history, 1):
            conversation_context += f"Q{i}: {q}\nA{i}: {a}\n\n"

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

def main():
    print("🤖 AI Legal Assistant for Import/Export Law (Malaysia & Singapore)")
    print("Press Enter (empty input) to end the conversation.")
    print("-" * 60)
    
    conversation_history = []
    
    # Get initial query
    initial_query = get_user_input("\n👤 Your question: ")
    
    if not initial_query:
        print("👋 Goodbye!")
        return
    
    current_query = initial_query
    
    while True:
        print("\n🔍 Searching legal documents and processing...")
        
        # Get AI response
        ai_response = query_knowledge_base_and_llm(current_query, conversation_history)
        
        # Store this exchange
        conversation_history.append((current_query, ai_response))
        
        print("\n🤖 AI Assistant:")
        print(ai_response)
        
        # Check if this is a follow-up question or final answer
        if ai_response.strip().startswith("Follow-up Question:") or "Options:" in ai_response:
            # AI is asking for more info
            user_response = get_user_input("\n👤 Your answer: ")
            
            if not user_response:
                print("👋 Chat ended. Goodbye!")
                break
                
            current_query = user_response
        else:
            # AI gave final answer, ask if user has more questions
            next_question = get_user_input("\n👤 Any other questions? (Press Enter to exit): ")
            
            if not next_question:
                print("👋 Chat ended. Goodbye!")
                break
                
            current_query = next_question
            # Reset conversation history for new topic if desired
            # conversation_history = []  # Uncomment to start fresh each time

if __name__ == "__main__":
    main()