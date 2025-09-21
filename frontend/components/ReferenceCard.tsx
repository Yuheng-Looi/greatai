import React from 'react';
import type { LawReference } from '../types';

interface ReferenceCardProps {
  reference: LawReference;
  onSelect: (reference: LawReference) => void;
  isSelected: boolean;
}

const ReferenceCard: React.FC<ReferenceCardProps> = ({ reference, onSelect, isSelected }) => {
  const domain = React.useMemo(() => {
    try {
      return new URL(reference.uri).hostname.replace(/^www\./, '');
    } catch (e) {
      return 'Invalid URL';
    }
  }, [reference.uri]);

  const containerClasses = `w-full text-left p-4 rounded-lg border transition-colors duration-200 ${
    isSelected
      ? 'bg-indigo-50 border-indigo-300'
      : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
  }`;

  return (
    <button onClick={() => onSelect(reference)} className={containerClasses}>
      <h4 className="text-lg text-indigo-600 hover:underline font-medium">
        {reference.title}
      </h4>
      {reference.description && (
        <p className="text-sm text-slate-600 mt-1">
          {reference.description}
        </p>
      )}
      <p className="text-sm text-green-600 mt-2 truncate font-mono">
        {domain}
      </p>
    </button>
  );
};

export default ReferenceCard;
