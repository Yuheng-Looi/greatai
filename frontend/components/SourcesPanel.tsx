import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { LawReference } from '../types';
import ReferenceCard from './ReferenceCard';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { CloseIcon } from './icons/CloseIcon';

interface SourcesPanelProps {
  references: LawReference[];
}

const MIN_HEIGHT = 100;
const DEFAULT_HEIGHT = 350;

const SourcesPanel: React.FC<SourcesPanelProps> = ({ references }) => {
  const [selectedReference, setSelectedReference] = useState<LawReference | null>(null);
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleSelectReference = useCallback((reference: LawReference) => {
    setSelectedReference(prev => (prev?.uri === reference.uri ? null : reference));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !panelRef.current) return;
    const newHeight = panelRef.current.getBoundingClientRect().bottom - e.clientY;
    const maxHeight = (panelRef.current.offsetHeight * 0.8); // Max 80% of panel height

    if (newHeight >= MIN_HEIGHT && newHeight <= maxHeight) {
        setPanelHeight(newHeight);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  useEffect(() => {
    // Cleanup event listeners on unmount
    return () => {
      handleMouseUp();
    };
  }, [handleMouseUp]);
  
  // Reset selection when references change for a new query
  useEffect(() => {
    setSelectedReference(null);
  }, [references]);

  return (
    <div ref={panelRef} className="flex flex-col h-full bg-white">
      <div className="p-4 sm:p-6 flex-shrink-0">
        <h2 className="text-2xl font-semibold text-slate-800">Sources</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 space-y-3">
        {references.length > 0 ? (
          references.map((ref, index) => (
            <ReferenceCard
              key={`${ref.uri}-${index}`}
              reference={ref}
              onSelect={handleSelectReference}
              isSelected={selectedReference?.uri === ref.uri}
            />
          ))
        ) : (
          <div className="h-full flex items-center justify-center text-center text-slate-500">
            <div className="p-8 border-2 border-dashed border-slate-300 rounded-lg">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Cited Sources</h3>
                <p>Relevant legal documents and articles <br/> will be displayed here when the assistant <br/> provides sources in its responses.</p>
            </div>
          </div>
        )}
      </div>

      {selectedReference && (
        <div className="flex-shrink-0 flex flex-col border-t-2 border-slate-200">
          {/* Panel Header */}
          <div className="flex items-center justify-between h-8 bg-slate-100 flex-shrink-0 px-2">
            {/* Close Button */}
            <button 
              onClick={() => setSelectedReference(null)} 
              className="p-1 text-slate-600 hover:text-slate-800 rounded-full hover:bg-slate-200 transition-colors"
              aria-label="Close preview"
            >
              <CloseIcon className="w-5 h-5"/>
            </button>

            {/* Resize Handle */}
            <div onMouseDown={handleMouseDown} className="flex-grow h-full flex items-center justify-center cursor-row-resize group">
              <div className="w-8 h-1 bg-slate-300 rounded-full group-hover:bg-slate-400 transition-colors"></div>
            </div>

            {/* External Link */}
            <a 
              href={selectedReference.uri} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center text-sm text-slate-600 hover:text-indigo-600 transition-colors"
              aria-label="Open source in new tab"
            >
              <span className="hidden xl:inline mr-2">Open in new tab</span>
              <ExternalLinkIcon className="w-5 h-5" />
            </a>
          </div>
          
          {/* Iframe Content */}
          <div className="bg-white border border-slate-200" style={{ height: `${panelHeight}px` }}>
            <iframe
              key={selectedReference.uri}
              src={selectedReference.uri}
              title={selectedReference.title}
              className="w-full h-full border-none"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SourcesPanel;
