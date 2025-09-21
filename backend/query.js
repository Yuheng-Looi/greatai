import dotenv from 'dotenv';
import readline from 'readline';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

dotenv.config();

// 1️⃣ Init LLM
const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0,
});

// 2️⃣ Init embeddings + Pinecone
const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });
const pinecone = new PineconeClient({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

// 3️⃣ Connect to existing PineconeStore with correct namespace
const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
  namespace: 'import-export-law', // must match ingestion
});

// 4️⃣ Map country names to metadata
const countryMap = { malaysia: 'MY', singapore: 'SG' };

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to get user input
function getUserInput(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function interactiveChat() {
  console.log('🤖 AI Legal Assistant for Import/Export Law (Malaysia & Singapore)');
  console.log('Type "end chat" to exit the conversation.\n');
  
  // Initialize conversation history
  let conversationHistory = [
    {
  role: "system",
  content: `You are an AI Legal Assistant specialized in import/export law for Malaysia and Singapore.
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
     - If clarification is needed: "Follow-up Question: <your question> Options: A) ..., B) ..., C) ... "
     - If confident in your answer, respond in JSON:
     {
      "Item": "item name",
      "ShipFrom": "Malaysia",
      "ShipTo": "Singapore",
      "Result": "Allow/Not Allow/With Condition",
      "Classification": "",
      "HSCode": "",
      "EstFee": "",
      "ExportTax": "^\u005cd+(\\.\\d{2})?\\%$",
      "ImportTax": "^\u005cd+(\\.\\d{2})?\\%$",
      "KeyRegulation": "Act/Regulation name, plain explanation; Act/Regulation name, plain explanation",
      "LimitationAndPrecautions": ["Clear reminder 1","Clear reminder 2","Clear reminder 3"],
      "Source": "List of legal documents used"
     }
  10. KeyRegulation: rewrite in plain English. Do not paste law text word-for-word.
  11. LimitationAndPrecautions: Always provide a **bullet list of clear reminders** (e.g., ["Must register with MATRADE before export","Ensure packing list and invoice are prepared","Ensure volume below 30ml if liquid"]). Never say "check with customs" — instead, do the check for them and present the exact reminders.
  12. EstFee: give an estimated range (covering shipping, insurance, handling). Do not ask user for costs.
  13. ExportTax = Malaysia export duty/tax. ImportTax = Singapore import duty/tax. If not applicable, state 0%.
  14. If you cannot find relevant legal documents, explicitly state so. Do not make up sources.
  Always provide the final answer in JSON format or a Follow-up Question if more info is required.`
}

  ];

  while (true) {
    // Get user input
    const userInput = await getUserInput('\n👤 Your question: ');
    
    // Check if user wants to end chat
    if (userInput.toLowerCase().trim() === 'end chat') {
      console.log('\n👋 Chat session ended. Goodbye!');
      break;
    }
    
    if (!userInput.trim()) {
      console.log('\n👋 Chat session ended. Goodbye!');
      break;
    }

    console.log('\n🔍 Searching relevant legal documents...');

    // Append tax/duty instruction to user input
    const enhancedUserInput = "Can I export " + userInput + " from Malaysia to Singapore? Please tell related tax or duty for import/export " + userInput + ".";
    
    // Add user message to conversation history (use original input)
    conversationHistory.push({
      role: 'user',
      content: enhancedUserInput
    });

    try {
      // Retrieve relevant documents from Pinecone (use enhanced input for search)
      const results = await vectorStore.similaritySearch(enhancedUserInput, 10);
      
      if (!results || results.length === 0) {
        console.log('⚠️ No relevant legal documents found.');
        conversationHistory.push({
          role: 'assistant',
          content: 'I could not find relevant legal documents for your question. Please try rephrasing or ask about specific import/export regulations for Malaysia or Singapore. Find out the estimate cost to export as well.'
        });
        continue;
      }

      // Prepare context from retrieved documents
      const context = results.map((doc, i) => {
        const source = doc.source || doc.metadata?.source || 'unknown';
        return `[Document ${i+1} - ${source}]: ${doc.pageContent}`;
      }).join('\n\n');

      // Create the complete prompt with context
      const messagesWithContext = [
        ...conversationHistory,
        {
          role: 'user',
          content: `Context from legal documents:\n${context}\n\nPlease answer based on this context and our conversation history.`
        }
      ];

      // Get AI response
      console.log('🤖 AI Assistant is thinking...\n');
      const response = await llm.invoke(messagesWithContext);
      
      console.log('🤖 AI Assistant:', response.content);
      
      // Add AI response to conversation history (without the context part)
      conversationHistory.push({
        role: 'assistant',
        content: response.content
      });

    } catch (error) {
      console.error('❌ Error:', error.message);
      console.log('Please try again with a different question.');
    }
  }
  
  rl.close();
}

async function main() {
  try {
    // Start the interactive chat session
    await interactiveChat();
  } catch (error) {
    console.error('❌ Error starting chat:', error);
  }
}

// Call main
main().catch((err) => console.error(err));
