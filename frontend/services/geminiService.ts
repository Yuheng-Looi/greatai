import { GoogleGenAI, Type, Chat } from "@google/genai";
import type { ShipmentItem, ShipmentDetails, AnalysisResult, Regulation, LawReference, ChatMessage } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Using mock data.");
}

export const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
export type { Chat };

interface SourceSummary {
    uri: string;
    description: string;
}


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

export const getFollowUpResponse = async (
  prompt: string, 
  history: ChatMessage[], 
  shipmentItems: ShipmentItem[], 
  shipmentDetails: ShipmentDetails, 
  analysisResults: AnalysisResult[]
): Promise<{ text: string; references: LawReference[] }> => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured.");
  }

  try {
    const formattedHistory = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const systemInstruction = `You are a helpful logistics and export/import assistant with access to current legal and regulatory information. 
    
    The user has completed a shipment analysis and is asking follow-up questions. Use the provided context to answer their questions accurately.
    
    **Response Formatting**:
    - Structure your response with clear visual hierarchy using Markdown
    - Use headers (#, ##), bullet points (-), and bold/italic text for clarity
    - Keep responses concise and actionable
    - AVOID long narrative paragraphs - make everything scannable
    - Use standard Markdown tables to compare information (costs, regulations, timelines, etc.)
    - When presenting numerical data, statistical information, or comparisons, generate interactive charts
    
    **Chart and Table Guidelines**:
    - Use Markdown tables for comparing regulations, costs, timelines, or requirements across items/countries
    - When presenting statistical data, cost breakdowns, or trends, generate a JSON object for a chart within a single \`\`\`json:chart code block
    - The JSON object **MUST** be perfectly valid and parsable
    - It **MUST** have a root-level property \`"type": "chart"\`
    - It **MUST** have properties for \`"chartType"\`, \`"data"\`, and \`"options"\` that follow the Chart.js structure
    - **Crucially**, the \`"data"\` array within a \`"datasets"\` object must contain **ONLY valid JSON numbers or \`null\`**. Do not include any text, annotations, or mathematical expressions. Pre-calculate any values before outputting.
    - The \`"options"\` object should contain only valid JSON values. Do not include JavaScript functions
    - **Example of Correct Chart Data**: \`"data": [338.55, 483.52, null, 620.00, 445.75]\`
    - **Example of Incorrect Chart Data**: \`"data": [338.55, 483.52 (estimated), 620.00 + tax]\`
    - Useful chart types: 'bar' (cost comparisons), 'pie' (tax breakdowns), 'line' (timeline/trends), 'doughnut' (category distributions)
    
    **When to Use Charts and Tables**:
    - Cost breakdowns across items → Bar chart or table
    - Tax/duty percentages → Pie or doughnut chart  
    - Shipping timeline comparisons → Line chart or table
    - Regulatory compliance by country → Table
    - Historical shipping costs → Line chart
    - Risk assessment scores → Bar chart
    - Always provide both visual (chart) AND tabular data when showing numerical comparisons
    
    **Citations and Grounding**:
    - Use the integrated Google Search tool to find relevant and up-to-date legal, regulatory, and logistics information
    - Always cite your sources by referencing the retrieved documents
    - At the very end of your entire response, add a single JSON code block with the language identifier \`json:source-summaries\`
    - This block must contain a JSON array of objects with "uri" and "description" keys
    - Do not include this block if no sources were used
    - Example: \`\`\`json:source-summaries\n[{"uri": "https://example.com/page1", "description": "Official customs regulations for electronics imports."}]\n\`\`\`

    **Current Shipment Context**:
    - From: ${shipmentDetails.from}
    - To: ${shipmentDetails.to}
    - Via: ${shipmentDetails.via}
    
    Items: ${shipmentItems.map(item => `- ${item.description}`).join('\n')}
    
    Analysis Results: ${JSON.stringify(analysisResults, null, 2)}`;

    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        history: formattedHistory,
        config: {
            systemInstruction: systemInstruction,
            tools: [{googleSearch: {}}],
        },
    });

    const result = await chat.sendMessage({ message: prompt });
    const response = result;

    let text = response.text;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    const references: LawReference[] = [];
    if (groundingChunks) {
        for (const chunk of groundingChunks) {
            if (chunk.web) {
                references.push({
                    uri: chunk.web.uri || '#',
                    title: chunk.web.title || 'Untitled Source',
                });
            }
        }
    }
    
    const uniqueReferences = Array.from(new Map(references.map(item => [item['uri'], item])).values());

    const summaryRegex = /```json:source-summaries\s*([\s\S]*?)\s*```/;
    const summaryMatch = text.match(summaryRegex);

    if (summaryMatch && summaryMatch[1]) {
        try {
            const summaries: SourceSummary[] = JSON.parse(summaryMatch[1]);
            const summaryMap = new Map(summaries.map(s => [s.uri, s.description]));
            
            uniqueReferences.forEach(ref => {
                if (summaryMap.has(ref.uri)) {
                    ref.description = summaryMap.get(ref.uri);
                }
            });

            text = text.replace(summaryRegex, '').trim();

        } catch (e) {
            console.error("Failed to parse source summaries JSON:", e);
        }
    }

    return { text, references: uniqueReferences };
  } catch (error) {
    console.error("Error calling Gemini API for follow-up:", error);
    return { 
      text: "I'm sorry, I encountered an error while processing your request. Please check your connection and try again.", 
      references: [] 
    };
  }
};