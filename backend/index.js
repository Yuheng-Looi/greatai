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
const pinecone = new PineconeClient({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });

// ✅ wait for vectorStore before starting server
const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
  pineconeIndex,
});

// Query endpoint
app.post('/query', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Missing question' });
  }

  try {
    const retrievedDocs = await vectorStore.similaritySearch(question, 5);

    if (retrievedDocs.length === 0) {
      return res.json({
        answer: 'I couldn’t find anything relevant in the law documents.',
      });
    }

    const context = retrievedDocs.map((doc) => doc.pageContent).join('\n\n');

    const response = await llm.invoke([
      {
        role: 'system',
        content:
          'You are an AI Legal Assistant for Malaysian and Singaporean import/export law. Use the provided context only. If unsure, say you don’t know.',
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
