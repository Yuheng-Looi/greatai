import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ShipmentItem, ShipmentDetails, AnalysisResult, Regulation } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Using mock data.");
}

export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
export type { Chat };


const EXPORT_ADVICE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      itemName: { 
        type: Type.STRING,
        description: "The name of the item being analyzed, matching the input or derived from the image."
      },
      status: {
        type: Type.STRING,
        enum: ['Clear', 'Caution', 'Restricted'],
        description: "The overall customs clearance status for this item."
      },
      classification: { 
        type: Type.STRING,
        description: "A short, descriptive classification for the item type (e.g., 'Perishable Goods', 'Consumer Electronics')."
      },
      totalCost: { 
        type: Type.NUMBER,
        description: "The estimated total cost for shipping and duties, as a number."
      },
      currency: { 
        type: Type.STRING,
        description: "The currency for the totalCost (e.g., 'USD', 'EUR', 'RM')."
      },
      taxEstimate: { 
        type: Type.NUMBER,
        description: "The estimated tax or duty percentage, as a number."
      },
      regulations: {
        type: Type.ARRAY,
        description: "A list of relevant regulations, certifications, or warnings.",
        items: {
          type: Type.OBJECT,
          properties: {
            code: { 
              type: Type.STRING,
              description: "A legal code or identifier for the regulation (e.g., '§ 3.4.8.2', 'SIRIM Cert')."
            },
            description: { 
              type: Type.STRING,
              description: "A clear, concise description of the regulation or requirement."
            },
          },
          required: ['code', 'description']
        }
      },
    },
    required: ['itemName', 'status', 'classification', 'totalCost', 'currency', 'taxEstimate', 'regulations']
  }
};

const buildPromptParts = (items: ShipmentItem[], details: ShipmentDetails) => {
  const itemDescriptions = items.map(item => `- ${item.description}`).join('\n');

  let textPrompt = `
    As a world-class logistics and supply chain expert, analyze the export requirements for the following shipment.
    Provide a detailed breakdown for EACH item.

    Shipment Details:
    - Origin: ${details.from}
    - Destination: ${details.to}
    - Transport Mode: ${details.via}
  `;

  if (itemDescriptions) {
      textPrompt += `\nItems to Analyze:\n${itemDescriptions}\n`;
  }
  
  if (items.length === 0 && details.image) {
      textPrompt += "\nThe list of items is not provided in text. Please identify the item(s) and their quantities from the provided image and perform the analysis on them. If the image is of a single item, analyze that one item.";
  } else if (details.image) {
      textPrompt += "\nAn image is provided for additional context. Use it to better understand the items listed and refine the analysis.";
  }

  textPrompt += `
    For each item, provide the following information in a structured JSON format according to the provided schema:
    1.  'itemName': The description of the item.
    2.  'status': 'Clear' (no major issues), 'Caution' (needs special attention or documentation), or 'Restricted' (may be prohibited or require special licenses).
    3.  'classification': A brief category for the item.
    4.  'totalCost': An estimated total cost in the destination currency.
    5.  'currency': The destination currency code (e.g., RM for Malaysia).
    6.  'taxEstimate': The estimated tax/duty as a percentage.
    7.  'regulations': A list of 1-3 key regulations, laws, or required certifications, each with a 'code' and a 'description'.

    Return ONLY the JSON array of objects. Do not include any introductory text or markdown formatting.
  `;
  
  const textPart = { text: textPrompt };

  if (details.image) {
    const imagePart = {
      inlineData: {
        mimeType: details.image.mimeType,
        data: details.image.data,
      },
    };
    // For multimodal requests, it can be beneficial to place the image before the text prompt.
    return [imagePart, textPart];
  }
  
  return [textPart];
};

export const getExportAdvice = async (items: ShipmentItem[], details: ShipmentDetails): Promise<AnalysisResult[]> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured.");
  }
  
  const parts = buildPromptParts(items, details);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: EXPORT_ADVICE_SCHEMA,
    },
  });

  try {
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);
    return result as AnalysisResult[];
  } catch (e) {
    console.error("Failed to parse Gemini response:", response.text);
    throw new Error("Received an invalid response from the AI advisor.");
  }
};