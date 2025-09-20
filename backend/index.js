import dotenv from 'dotenv';
import express from 'express';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

dotenv.config();

const app = express();
app.use(express.json());

// LLM
const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0,
});

// Pinecone + embeddings
const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });
const pinecone = new PineconeClient({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

// Namespace mapping
const NAMESPACE = 'import-export-law';
const countryMap = { malaysia: 'MY', singapore: 'SG' };

async function startServer() {
  // Connect to PineconeStore
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: NAMESPACE,
  });

  app.post('/query', async (req, res) => {
    const { question, country = 'all' } = req.body;
    if (!question) return res.status(400).json({ error: 'Missing question' });

    try {
      // Retrieve
      const results = await vectorStore.similaritySearch(question);

      if (!results || results.length === 0) {
        return res.json({
          answer: 'I couldn’t find anything relevant in the law documents.',
        });
      }

      // Filter by country
      const filtered =
        countryMap[country.toLowerCase()] !== undefined
          ? results.filter(
              (doc) =>
                (doc.source || doc.metadata?.source) ===
                countryMap[country.toLowerCase()]
            )
          : results;

      const toUse = filtered.length > 0 ? filtered : results;

      // Combine context
      const context = toUse.map((doc) => doc.pageContent).join('\n\n');

      // Query LLM
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

      res.json({ answer: response.content });
    } catch (err) {
      console.error('❌ Query error:', err);
      res.status(500).json({ error: 'Failed to process query' });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

// Start server
startServer().catch((err) => console.error('❌ Server init error:', err));
