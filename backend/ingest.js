// ingest.js
import fs from 'fs';
import dotenv from 'dotenv';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { MistralAIEmbeddings } from '@langchain/mistralai';

dotenv.config();

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX;

// Helper: split array into batches
function chunkArray(array, batchSize) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

async function run() {
  console.log('📥 Loading law documents...');

  const lawDocs = [
    { path: './laws/Import_Export_Law_MY.pdf', name: 'Malaysia', source: 'MY' },
    {
      path: './laws/Import_Export_Law_SG.pdf',
      name: 'Singapore',
      source: 'SG',
    },
  ];

  let allDocs = [];

  for (const law of lawDocs) {
    if (!fs.existsSync(law.path)) {
      console.warn(`⚠️ File missing: ${law.path}`);
      continue;
    }
    console.log(`✅ Loading ${law.name}`);
    const loader = new PDFLoader(law.path, { splitPages: false });
    const docs = await loader.load();

    // Tag documents with metadata
    const taggedDocs = docs.map((d) => ({
      ...d,
      metadata: { ...d.metadata, source: law.source },
    }));

    allDocs.push(...taggedDocs);
  }

  if (allDocs.length === 0) {
    console.error('❌ No documents loaded. Exiting.');
    return;
  }

  // 1️⃣ Ensure index exists
  const existingIndexesResponse = await pinecone.listIndexes();
  const existingIndexes = Array.isArray(existingIndexesResponse)
    ? existingIndexesResponse
    : existingIndexesResponse?.indexes || [];
  const existingIndexNames = existingIndexes
    .map((idx) => (typeof idx === 'string' ? idx : idx?.name))
    .filter(Boolean);

  if (!existingIndexNames.includes(indexName)) {
    console.log(`📌 Creating new index: ${indexName}`);
    try {
      await pinecone.createIndex({
        name: indexName,
        dimension: 1024, // your embedding dimension
        metric: 'cosine', // typical for text embeddings
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      console.log('✅ Index created, waiting for it to be ready...');
      await new Promise((res) => setTimeout(res, 60000)); // wait ~1 min
    } catch (error) {
      const message = String(error?.message || '');
      const status = error?.status || error?.code || error?.response?.status;
      if (status === 409 || message.includes('ALREADY_EXISTS')) {
        console.log(`ℹ️ Index ${indexName} already exists. Skipping creation.`);
      } else {
        throw error;
      }
    }
  }

  console.log('📦 Splitting documents into chunks...');
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  let splitDocs = [];
  for (const doc of allDocs) {
    const chunks = await splitter.splitDocuments([doc]);
    const chunksWithMetadata = chunks.map((chunk) => ({
      ...chunk,
      metadata: { ...chunk.metadata, source: doc.metadata.source },
    }));
    splitDocs.push(...chunksWithMetadata);
  }

  console.log(
    `📦 Created ${splitDocs.length} chunks. Indexing into Pinecone...`
  );

  const embeddings = new MistralAIEmbeddings({ model: 'mistral-embed' });
  const index = pinecone.Index(indexName);

  // 2️⃣ Batch indexing
  const BATCH_SIZE = 50;
  const batches = chunkArray(splitDocs, BATCH_SIZE);

  for (const [i, batch] of batches.entries()) {
    console.log(`📤 Indexing batch ${i + 1} / ${batches.length}...`);
    await PineconeStore.fromDocuments(batch, embeddings, {
      pineconeIndex: index,
      namespace: 'import-export-law',
    });
  }

  console.log('✅ Indexing complete!');
}

run().catch((err) => {
  console.error('❌ Error in ingest.js:', err);
});
