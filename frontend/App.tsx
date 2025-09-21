import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ResultsPanel } from './components/ResultsPanel';
import { ChatPanel } from './components/ChatPanel';
import type { ShipmentItem, ShipmentDetails, AnalysisResult, HistoryEntry } from './types';
import { getExportAdvice } from './services/geminiService';
import { loadHistory, saveHistory, clearHistory } from './services/historyService';

const MOCK_RESULTS: AnalysisResult[] = [
    {
        itemName: "20kg Onions",
        status: "Clear",
        classification: "Type 3.1-2 Foods",
        totalCost: 338.55,
        currency: "RM",
        taxEstimate: 3,
        regulations: [
            { code: "AG-101", description: "Standard agricultural goods declaration required." },
            { code: "FDA-45", description: "Must be free from specified pests and soil." }
        ]
    },
    {
        itemName: "30 Switch 2 Gaming Consoles",
        status: "Caution",
        classification: "Type A-Elec",
        totalCost: 483.52,
        currency: "RM",
        taxEstimate: 10,
        regulations: [
            { code: "§ 3.4.8.2", description: "A game console must be sold with appropriate age rating information." },
            { code: "CERT-MY", description: "SIRIM certification is required for all electronic devices with wireless capabilities." }
        ]
    }
];

const initialShipmentDetails: ShipmentDetails = {
    from: 'Malaysia',
    to: 'Singapore',
    via: 'Air Freight',
    image: null,
};

const App: React.FC = () => {
    const [shipmentItems, setShipmentItems] = useState<ShipmentItem[]>([
        { id: 1, description: '20kg Onions' },
        { id: 2, description: '30 Switch 2 Gaming Consoles' },
    ]);
    const [shipmentDetails, setShipmentDetails] = useState<ShipmentDetails>(initialShipmentDetails);
    const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>(MOCK_RESULTS);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    useEffect(() => {
        setHistory(loadHistory());
    }, []);

    const handleAnalyze = useCallback(async () => {
        if (shipmentItems.length === 0 && !shipmentDetails.image) {
            setError("Please add at least one item or an image to analyze.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setAnalysisResults([]);

        try {
            const results = await getExportAdvice(shipmentItems, shipmentDetails);
            setAnalysisResults(results);

            const newHistoryEntry: HistoryEntry = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                items: shipmentItems,
                details: shipmentDetails,
                results: results,
            };
            const updatedHistory = [newHistoryEntry, ...history];
            setHistory(updatedHistory);
            saveHistory(updatedHistory);

        } catch (err) {
            console.error("Error analyzing shipment:", err);
            setError("Failed to get advice. Please check your connection and API key.");
        } finally {
            setIsLoading(false);
        }
    }, [shipmentItems, shipmentDetails, history]);

    const handleClearShipment = useCallback(() => {
        setShipmentItems([]);
        setShipmentDetails(initialShipmentDetails);
        setAnalysisResults([]);
        setError(null);
    }, []);

    const handleLoadFromHistory = useCallback((entry: HistoryEntry) => {
        setShipmentItems(entry.items);
        setShipmentDetails(entry.details);
        setAnalysisResults(entry.results);
        setError(null);
    }, []);

    const handleClearHistory = useCallback(() => {
        setHistory([]);
        clearHistory();
    }, []);



    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
            <Header />
            <main className="p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-screen-2xl mx-auto">
                    <div className="lg:col-span-3">
                        <Sidebar
                            items={shipmentItems}
                            setItems={setShipmentItems}
                            details={shipmentDetails}
                            setDetails={setShipmentDetails}
                            onAnalyze={handleAnalyze}
                            onClear={handleClearShipment}
                            isLoading={isLoading}
                        />
                    </div>
                    <div className="lg:col-span-5">
                        <ResultsPanel
                            results={analysisResults}
                            isLoading={isLoading}
                            error={error}
                            history={history}
                            onLoadHistory={handleLoadFromHistory}
                            onClearHistory={handleClearHistory}
                        />
                    </div>
                    <div className="lg:col-span-4">
                        <ChatPanel 
                            shipmentItems={shipmentItems} 
                            shipmentDetails={shipmentDetails} 
                            analysisResults={analysisResults} 
                            key={analysisResults.length > 0 ? analysisResults[0].itemName + history.length : 'initial'} // Re-mount chat when results change
                        />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;