
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <h1 className="text-2xl font-bold text-brand-primary">ExportAdvisor</h1>
          <div className="flex items-center space-x-3">
            <span className="text-slate-600 font-medium hidden sm:block">John Doe</span>
            <div className="w-10 h-10 bg-brand-secondary rounded-full flex items-center justify-center text-white font-bold text-lg">
              JD
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
