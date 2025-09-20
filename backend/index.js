import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MistralAIEmbeddings } from '@langchain/mistralai';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const llm = new ChatGoogleGenerativeAI({
  model: 'gemini-2.0-flash',
  temperature: 0,
});

const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });
const pinecone = new PineconeClient({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
const NAMESPACE = process.env.PINECONE_NAMESPACE || 'import-export-law';
const countryMap = { malaysia: 'MY', singapore: 'SG' };

async function startServer() {
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: NAMESPACE,
  });

  app.post('/query', async (req, res) => {
    let { question, country = 'all', fromCountry, toCountry } = req.body;
    if (!question) return res.status(400).json({ error: 'Missing question' });

    const conversation = []; // multi-turn conversation history
    let confident = false;
    let answer = '';
    let turn = 0;
    const MAX_TURNS = 5;

    while (!confident && turn < MAX_TURNS) {
      // Retrieve relevant docs
      const results = await vectorStore.similaritySearch(question);
      // Prefer destination (toCountry) for filtering; fall back to provided 'country'
      const countryKey = (toCountry || country || 'all').toString().toLowerCase();
      const filtered =
        countryMap[countryKey] !== undefined
          ? results.filter(
              (doc) =>
                (doc.source || doc.metadata?.source) === countryMap[countryKey]
            )
          : results;
      const toUse = filtered.length > 0 ? filtered : results;
      const context = toUse.map((doc) => doc.pageContent).join('\n\n');

      // Prepare messages
      const systemPrompt = `You are an AI Legal Assistant specialized in import/export law for Malaysia and Singapore. 

You must **only respond in one of two formats**:

1. FOLLOW-UP QUESTION:
- If the user’s question is ambiguous or incomplete, ask exactly **one concise question** needed to clarify. 
- Do not add greetings, explanations, apologies, or commentary. 
- Example:
  Question: "How do I export milk from Malaysia?"
  Follow-up: "What type of license do you hold for exporting dairy products?"

2. FINAL ANSWER:
- Fill the following template exactly as key-value pairs.
- No extra text.
- Example:

Metadata / Context:
- Source Reference: Customs Act 1967
- Jurisdiction: Malaysia
- Document Type: Statute

Summary / Simplified Explanation:
- Plain language summary: Exporting milk requires proper licensing and compliance with dairy regulations.
- Key points:
  - Obtain export license
  - Ensure product meets health standards

Key Clauses / Obligations:
- Obligations: Submit export permit to customs
- Deadlines: Apply at least 7 days before shipment
- Documentation: Export license, health certificate
- Exemptions: Small sample shipments <10L

Risks / Considerations:
- Compliance risks: Penalties for exporting without license
- Common pitfalls: Forgetting health certificate

Suggested Actions / Next Steps:
- Apply for export license
- Prepare health certificate
- Schedule shipment

Follow-up / Clarifications:
- None

Confidence / Disclaimer:
- Confidence level: 95%
- Legal disclaimer: This is not legal advice.

ALWAYS:
- If asking follow-up, ONLY ask the question.
- If giving final answer, ONLY output the key-value template.
- Never include greetings, apologies, or commentary.
`;

      const routeInfo =
        fromCountry && toCountry
          ? `\n\nRoute: from ${fromCountry} to ${toCountry}`
          : '';
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversation,
        {
          role: 'user',
          content: `Question: ${question}${routeInfo}\n\nContext:\n${context}`,
        },
      ];

      const response = await llm.invoke(messages);
      const content = response.content;

      // Check confidence
      const confidenceMatch = content.match(/Confidence level\s*:\s*(\d+)%/i);
      const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;

      conversation.push({ role: 'assistant', content });
      answer = content;

      if (confidence >= 80) {
        confident = true;
      } else {
        // Ask user for clarification - include 'answer' for frontend fallback
        return res.json({
          followUp: true,
          message: content,
          answer: content,
          note: 'Please provide clarification for the follow-up question.',
        });
      }

      turn++;
    }

    res.json({ answer });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => console.error('❌ Server init error:', err));
