import dotenv from 'dotenv';
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone';

dotenv.config();

const pinecone = new PineconeClient({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX);

async function checkVectors() {
  try {
    const namespace = 'import-export-law';

    // 1️⃣ Get index stats with vector details
    const stats = await index.describeIndexStats({
      namespace,
      describeVector: true,
    });
    console.log('✅ Index Stats:');
    console.log(JSON.stringify(stats, null, 2));

    const vectorsInNamespace = stats.namespaces[namespace]?.vectors;
    if (!vectorsInNamespace || Object.keys(vectorsInNamespace).length === 0) {
      console.log('⚠️ No vectors found in this namespace.');
      return;
    }

    // 2️⃣ Pick first 5 IDs to fetch metadata/content
    const ids = Object.keys(vectorsInNamespace).slice(0, 5);

    // 3️⃣ Fetch actual vectors
    const response = await index.fetch({ ids, namespace });
    console.log('✅ First 5 vectors with metadata:');
    for (const [id, vector] of Object.entries(response.vectors)) {
      console.log(`ID: ${id}`);
      console.log('Metadata:', vector.metadata);
      console.log('-----------------------------');
    }
  } catch (err) {
    console.error('❌ Error fetching vectors:', err);
  }
}

checkVectors();
