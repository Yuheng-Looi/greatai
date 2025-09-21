export enum AnalysisStatus {
  Clear = 'Clear',
  Caution = 'Caution',
  Restricted = 'Restricted',
}

export interface Regulation {
  code: string;
  description: string;
}

export interface AnalysisResult {
  itemName: string;
  status: AnalysisStatus | string;
  classification: string;
  totalCost: number;
  currency: string;
  taxEstimate: number;
  regulations: Regulation[];
}

export interface ShipmentItem {
  id: number;
  description: string;
}

export interface ShipmentDetails {
  from: string;
  to: string;
  via: string;
  image: {
    data: string; // base64 encoded data
    mimeType: string;
  } | null;
}

export interface HistoryEntry {
  id: number; // Using timestamp for unique ID
  timestamp: string;
  items: ShipmentItem[];
  details: ShipmentDetails;
  results: AnalysisResult[];
}

export interface LawReference {
  uri: string;
  title: string;
  description?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  references?: LawReference[];
}