import dotenv from 'dotenv';
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

async function askQuestion(question, country = 'all') {
  console.log(`\n❓ Question: ${question} (${country})`);

  // 5️⃣ Retrieve top 20 chunks from Pinecone explicitly with namespace
  const results = await vectorStore.similaritySearch(question);

  // 6️⃣ Debug: print raw results
  console.log('Raw Pinecone results:', results);

  if (!results || results.length === 0) {
    console.log('⚠️ No results returned from Pinecone.');
    return;
  }

  // 7️⃣ Filter by country using doc.source
  const filtered =
    countryMap[country.toLowerCase()] !== undefined
      ? results.filter(
          (doc) =>
            (doc.source || doc.metadata?.source) ===
            countryMap[country.toLowerCase()]
        )
      : results;

  const toUse = filtered.length > 0 ? filtered : results;

  // 8️⃣ Show top 5 chunks
  toUse.slice(0, 5).forEach((doc, i) => {
    console.log(`\n📄 Context ${i + 1} [source: ${doc.source || 'unknown'}]:`);
    console.log(doc.pageContent.slice(0, 400) + '...\n');
  });

  // 9️⃣ Combine context and send to LLM
  const context = toUse.map((doc) => doc.pageContent).join('\n\n');

  const response = await llm.invoke([
    {
      role: 'system',
      content: `You are an AI Legal Assistant specialized in import/export law for Malaysia and Singapore. 
Given the following query and documents retrieved, respond using the structure below:

1. Metadata / Context
   - Source Reference:
   - Jurisdiction:
   - Document Type:

2. Summary / Simplified Explanation
   - Plain language summary
   - Key points (bullets)

3. Key Clauses / Obligations
   - Obligations, deadlines, documentation, exemptions

4. Risks / Considerations
   - Compliance risks, common pitfalls

5. Suggested Actions / Next Steps
   - Step-by-step guidance

6. Follow-up / Clarifications
   - Possible next questions or actions

7. Confidence / Disclaimer
   - Confidence level
   - Legal disclaimer`,
    },
    {
      role: 'user',
      content: `Question: ${question}\n\nContext:\n${context}`,
    },
  ]);

  console.log('💡 Answer:', response.content);
}

async function main() {
  // Super simple test query to check retrieval first
  // await askQuestion('customs duty', 'Malaysia');

  // // Your real queries
  // await askQuestion(
  //   'What happens if customs duty or penalties are not paid on time?',
  //   'Malaysia'
  // );

  // await askQuestion(
  //   'Can the Director General detain goods if customs duties or fees are unpaid?',
  //   'Malaysia'
  // );

  // await askQuestion(
  //   'How long can goods be held under customs control for unpaid duties or refunds?',
  //   'Malaysia'
  // );

  await askQuestion(
    'How can I export milk from malaysia to singapore',
    'Malaysia'
  );
}

// Call main
main().catch((err) => console.error(err));
