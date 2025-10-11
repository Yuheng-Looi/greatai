import React, { useState } from 'react';
import type { AnalysisResult, HistoryEntry, LawReference } from '../types';
import { ResultItem } from './ResultItem';
import { ClockIcon } from './icons/ClockIcon';
import SourcesPanel from './SourcesPanel';

interface ResultsPanelProps {
  results: AnalysisResult[];
  isLoading: boolean;
  error: string | null;
  history: HistoryEntry[];
  onLoadHistory: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
  activeTab?: 'current' | 'history' | 'sources';
  onTabChange?: (tab: 'current' | 'history' | 'sources') => void;
  sources?: LawReference[];
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ 
  results, 
  isLoading, 
  error, 
  history, 
  onLoadHistory, 
  onClearHistory,
  activeTab: controlledActiveTab,
  onTabChange,
  sources = []
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<'current' | 'history' | 'sources'>('current');
  
  // Use controlled tab if provided, otherwise use internal state
  const activeTab = controlledActiveTab || internalActiveTab;
  
  const handleTabChange = (tab: 'current' | 'history' | 'sources') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  
  const handleLoad = (entry: HistoryEntry) => {
    onLoadHistory(entry);
    handleTabChange('current');
  };

  const renderCurrentAnalysis = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500 p-6">
          <svg className="animate-spin h-12 w-12 text-indigo-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-lg font-medium">Consulting our AI expert...</p>
          <p className="text-sm">This may take a moment.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-red-600 bg-red-50 p-6 rounded-lg">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold">An Error Occurred</p>
          <p className="text-sm text-center">{error}</p>
        </div>
      );
    }
    
    if (results.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500 text-center p-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-semibold mb-2">Ready to Analyze</h3>
                <p>Fill in your shipment details on the left and click "Analyze Shipment" to get AI-powered export advice.</p>
            </div>
        );
    }

    return (
      <div className="space-y-4 p-4 sm:p-6">
        {results.map((result, index) => (
          <ResultItem key={index} result={result} />
        ))}
      </div>
    );
  };
  
  const renderHistory = () => {
    if (history.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[500px] text-slate-500 text-center p-6">
          <ClockIcon className="w-16 h-16 mb-4 text-slate-400" />
          <h3 className="text-xl font-semibold mb-2">No Saved Shipments</h3>
          <p>Your past shipment analyses will appear here.</p>
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-700">Past Analyses</h3>
          <button
            onClick={onClearHistory}
            className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors disabled:text-slate-400"
            disabled={history.length === 0}
          >
            Clear History
          </button>
        </div>
        <div className="space-y-3">
          {history.map(entry => (
            <div key={entry.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div className="flex-grow">
                <p className="font-semibold text-slate-800">{entry.details.from} → {entry.details.to}</p>
                <p className="text-sm text-slate-500">
                  {entry.items.length} item(s) &bull; {new Date(entry.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => handleLoad(entry)}
                className="bg-indigo-100 text-indigo-700 font-semibold py-2 px-4 rounded-md hover:bg-indigo-200 transition-colors text-sm self-start sm:self-center"
              >
                View
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSources = () => {
    return <SourcesPanel references={sources} />;
  };

  return (
    <div className="lg:col-span-2">
      <div className="bg-white rounded-t-xl shadow-lg border-b border-slate-200">
        <div className="flex">
          <button
            onClick={() => handleTabChange('current')}
            className={`py-3 px-6 font-semibold text-sm transition-colors ${activeTab === 'current' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Current Analysis
          </button>
          <button
            onClick={() => handleTabChange('history')}
            className={`py-3 px-6 font-semibold text-sm transition-colors relative ${activeTab === 'history' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            History
            {history.length > 0 && <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white text-xs font-bold">{history.length}</span>}
          </button>
          <button
            onClick={() => handleTabChange('sources')}
            className={`py-3 px-6 font-semibold text-sm transition-colors relative ${activeTab === 'sources' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            Sources
            {sources.length > 0 && <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white text-xs font-bold">{sources.length}</span>}
          </button>
        </div>
      </div>
      <div className="bg-white rounded-b-xl shadow-lg min-h-[500px]">
        {activeTab === 'current' && renderCurrentAnalysis()}
        {activeTab === 'history' && renderHistory()}
        {activeTab === 'sources' && renderSources()}
      </div>
    </div>
  );
};
