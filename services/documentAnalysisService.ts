import { GoogleGenAI, Type } from "@google/genai";
import type { ShipmentItem, ShipmentDetails } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const DOCUMENT_ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      description: "Complete list of ALL items, products, goods, or commodities found in the document. Be thorough and extract everything mentioned.",
      items: {
        type: Type.OBJECT,
        properties: {
          description: {
            type: Type.STRING,
            description: "Full description of the item including quantity, weight, dimensions, model numbers, etc. Examples: '50 Dell Laptops XPS 13', '25kg Rice Basmati Premium', 'Medical Equipment - 10 Stethoscopes'"
          }
        },
        required: ['description']
      }
    },
    shipmentDetails: {
      type: Type.OBJECT,
      description: "Shipping route and method details extracted from the document",
      properties: {
        from: {
          type: Type.STRING,
          description: "Origin country - must be exactly 'Malaysia', 'Singapore', or 'USA', or keep current value if not clearly identified"
        },
        to: {
          type: Type.STRING,
          description: "Destination country - must be exactly 'Malaysia', 'Singapore', or 'USA', or keep current value if not clearly identified"
        },
        via: {
          type: Type.STRING,
          description: "Transport method - must be exactly 'Air Freight', 'Ocean Freight', 'Rail Freight', or 'Road Freight', or keep current value if not clearly identified"
        }
      },
      required: ['from', 'to', 'via']
    },
    confidence: {
      type: Type.NUMBER,
      description: "Overall confidence level (0-100) in the extraction quality, with emphasis on item extraction completeness"
    }
  },
  required: ['items', 'shipmentDetails', 'confidence']
};

interface DocumentAnalysisResult {
  items: { description: string }[];
  shipmentDetails: {
    from: string;
    to: string;
    via: string;
  };
  confidence: number;
}

export const analyzeDocument = async (
  document: { data: string; mimeType: string; name: string; type: 'image' | 'text' | 'pdf' },
  currentDetails: ShipmentDetails
): Promise<DocumentAnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  const prompt = `
    Analyze this document thoroughly and extract ALL shipping/shipment information. Focus heavily on finding items, products, and goods being shipped.
    
    CRITICAL INSTRUCTIONS FOR ITEMS:
    - Look for ANY mention of products, goods, items, commodities, materials
    - Include quantities, weights, dimensions when available
    - Check invoices, packing lists, shipping manifests, product descriptions
    - Look in tables, lists, line items, product catalogs
    - Include both finished goods and raw materials
    - Extract even partial item information if visible
    
    CRITICAL INSTRUCTIONS FOR SHIPMENT DETAILS:
    - Origin/From: Look for "Ship from", "Origin", "Departure", "Export from", sender address
    - Destination/To: Look for "Ship to", "Destination", "Arrival", "Import to", recipient address  
    - Transport: Look for "Via", "Mode", "Method", "Air/Sea/Land/Rail", shipping method
    
    Document type: ${document.type}
    Document name: ${document.name}
    
    Current form values (keep if not found in document):
    - Current Origin: ${currentDetails.from}
    - Current Destination: ${currentDetails.to}
    - Current Transport: ${currentDetails.via}
    
    ITEM EXTRACTION EXAMPLES:
    - "50 Laptops Dell XPS" → "50 Laptops Dell XPS"
    - "Rice 25kg bags x 10" → "Rice 25kg bags x 10" 
    - "Medical equipment" → "Medical equipment"
    - "Auto parts - brake pads" → "Auto parts - brake pads"
    - "Textiles: Cotton shirts 200 pcs" → "Cotton shirts 200 pcs"
    
    COUNTRY MAPPING (use exact matches only):
    - Malaysia, MY, Kuala Lumpur → "Malaysia"
    - Singapore, SG, Singapore City → "Singapore"  
    - United States, USA, US, America → "USA"
    
    TRANSPORT MAPPING (use exact matches only):
    - Air, Flight, Airplane, Aviation → "Air Freight"
    - Sea, Ocean, Ship, Vessel, Maritime → "Ocean Freight"
    - Rail, Train, Railway → "Rail Freight"
    - Road, Truck, Land, Ground → "Road Freight"
    
    CONFIDENCE SCORING:
    - 90-100: Clear, explicit information found
    - 70-89: Strong indicators with good context
    - 50-69: Some relevant information found
    - 30-49: Partial/unclear information
    - 0-29: No relevant information found
    
    Return structured JSON only. Be thorough in item extraction - this is the most important part.
  `;

  let parts: any[];
  
  if (document.type === 'text') {
    // For text files, decode base64 and include as text
    const textContent = atob(document.data);
    parts = [
      { text: prompt },
      { text: `\n\nDocument Content:\n${textContent}` }
    ];
  } else if (document.type === 'image') {
    // For images, use inline data
    parts = [
      {
        inlineData: {
          mimeType: document.mimeType,
          data: document.data,
        },
      },
      { text: prompt }
    ];
  } else if (document.type === 'pdf') {
    // For PDFs, use inline data (Gemini can process PDF files)
    parts = [
      {
        inlineData: {
          mimeType: document.mimeType,
          data: document.data,
        },
      },
      { text: prompt }
    ];
  } else {
    throw new Error(`Unsupported document type: ${document.type}`);
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: DOCUMENT_ANALYSIS_SCHEMA,
    },
  });

  try {
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result as DocumentAnalysisResult;
  } catch (e) {
    console.error("Failed to parse document analysis response:", response.text);
    throw new Error("Received an invalid response from the document analyzer.");
  }
};
