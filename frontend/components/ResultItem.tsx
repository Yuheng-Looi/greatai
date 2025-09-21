// FIX: Replaced placeholder content with a complete and functional ResultItem component.
import React, { useState } from 'react';
import type { AnalysisResult, Regulation } from '../types';
import { AnalysisStatus } from '../types';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';
import { GavelIcon } from './icons/GavelIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { InformationCircleIcon } from './icons/InformationCircleIcon';

interface ResultItemProps {
  result: AnalysisResult;
}

const getStatusAppearance = (status: AnalysisResult['status']) => {
  switch (status) {
    case AnalysisStatus.Clear:
      return {
        icon: <CheckCircleIcon className="w-6 h-6 text-emerald-500" />,
        textColor: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
      };
    case AnalysisStatus.Caution:
      return {
        icon: <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />,
        textColor: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      };
    case AnalysisStatus.Restricted:
      return {
        icon: <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />,
        textColor: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
      };
    default:
      return {
        icon: <InformationCircleIcon className="w-6 h-6 text-slate-500" />,
        textColor: 'text-slate-600',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-200',
      };
  }
};

// Helper to determine the correct icon based on regulation content
const getRegulationIcon = (regulation: Regulation) => {
    const code = regulation.code.toLowerCase();
    const description = regulation.description.toLowerCase();

    if (code.startsWith('§') || description.includes('law')) {
        return <GavelIcon className="w-5 h-5" />;
    }
    if (code.includes('cert') || description.includes('permit')) {
        return <DocumentTextIcon className="w-5 h-5" />;
    }
    return <InformationCircleIcon className="w-5 h-5" />;
};

// Helper to truncate text
const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}


export const ResultItem: React.FC<ResultItemProps> = ({ result }) => {
  const [isOpen, setIsOpen] = useState(true);
  const { icon, textColor, bgColor, borderColor } = getStatusAppearance(result.status);

  return (
    <div className={`border rounded-lg shadow-sm transition-all duration-300 ${isOpen ? 'shadow-md' : ''} ${borderColor} ${bgColor}`}>
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">{icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{result.itemName}</h3>
            <p className={`font-medium ${textColor}`}>{result.status}</p>
          </div>
        </div>
        <div className="text-slate-500">
          {isOpen ? <ChevronUpIcon className="w-6 h-6" /> : <ChevronDownIcon className="w-6 h-6" />}
        </div>
      </button>

      {/* Collapsible Details */}
      {isOpen && (
        <div className="border-t border-slate-200 px-4 pt-4 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-white p-3 rounded-md border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Classification</p>
              <p className="text-slate-800 font-semibold">{result.classification}</p>
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Est. Total Cost</p>
              <p className="text-slate-800 font-semibold">{result.totalCost.toFixed(2)} {result.currency}</p>
            </div>
            <div className="bg-white p-3 rounded-md border border-slate-200">
              <p className="text-sm font-medium text-slate-500">Est. Tax / Duty</p>
              <p className="text-slate-800 font-semibold">{result.taxEstimate}%</p>
            </div>
          </div>

          <div>
            <h4 className="flex items-center gap-2 text-md font-semibold text-slate-700 mb-3">
              <GavelIcon className="w-5 h-5" />
              Key Regulations & Requirements
            </h4>
            <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
              {result.regulations.map((reg, index) => (
                <li key={index} className="flex items-start gap-4 p-4">
                  <div className="flex-shrink-0 pt-0.5 text-slate-500">
                    {getRegulationIcon(reg)}
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-semibold text-slate-800">{reg.code}</p>
                    <p className="text-sm text-slate-600 relative group cursor-help">
                      {truncate(reg.description, 80)}
                      {reg.description.length > 80 && (
                        <span className="absolute bottom-full left-0 mb-2 w-72 p-2 text-xs text-white bg-slate-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                            {reg.description}
                        </span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};