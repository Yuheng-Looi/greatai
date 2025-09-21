import React, { useState, useRef } from 'react';
import type { ShipmentItem, ShipmentDetails } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PaperAirplaneIcon } from './icons/PaperAirplaneIcon';
import { SwitchVerticalIcon } from './icons/SwitchVerticalIcon';
import { PhotographIcon } from './icons/PhotographIcon';
import { CameraIcon } from './icons/CameraIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface SidebarProps {
  items: ShipmentItem[];
  setItems: React.Dispatch<React.SetStateAction<ShipmentItem[]>>;
  details: ShipmentDetails;
  setDetails: React.Dispatch<React.SetStateAction<ShipmentDetails>>;
  onAnalyze: () => void;
  onClear: () => void;
  isLoading: boolean;
}

const COUNTRIES = ['Malaysia', 'Singapore', 'USA'];
const TRANSPORT_MODES = ['Air Freight', 'Ocean Freight', 'Rail Freight', 'Road Freight'];

// Helper to convert file to base64
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });


export const Sidebar: React.FC<SidebarProps> = ({ items, setItems, details, setDetails, onAnalyze, onClear, isLoading }) => {
  const [newItem, setNewItem] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItem.trim()) {
      setItems([...items, { id: Date.now(), description: newItem.trim() }]);
      setNewItem('');
    }
  };

  const handleRemoveItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };
  
  const handleDetailChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDetails({ ...details, [e.target.name]: e.target.value });
  };

  const handleReverse = () => {
    if (details.from === details.to) return;
    setDetails(prevDetails => ({
      ...prevDetails,
      from: prevDetails.to,
      to: prevDetails.from,
    }));
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const base64String = await toBase64(file);
        const base64Data = base64String.split(',')[1]; // Remove the data URI prefix
        setDetails({ ...details, image: { data: base64Data, mimeType: file.type } });
    } catch (error) {
        console.error("Error converting file to base64:", error);
    }
    // Reset file input value to allow re-selection of the same file
    event.target.value = '';
  };

  const removeImage = () => {
    setDetails({ ...details, image: null });
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg h-fit sticky top-8">
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Shipment Details</h2>
      
      {/* Image Upload */}
       <div className="space-y-3 mb-6">
        <label className="block text-sm font-medium text-slate-600">Image (Optional)</label>
        {details.image ? (
          <div className="relative group">
            <img 
              src={`data:${details.image.mimeType};base64,${details.image.data}`} 
              alt="Shipment Preview" 
              className="w-full h-40 object-cover rounded-lg border border-slate-200"
            />
            <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/75 transition-colors"
                aria-label="Remove image"
            >
                <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />
            <div className="flex gap-2">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors text-sm"
                >
                    <PhotographIcon className="w-5 h-5" />
                    Upload
                </button>
                <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-600 font-medium py-2 px-3 rounded-lg hover:bg-slate-100 transition-colors text-sm"
                >
                    <CameraIcon className="w-5 h-5" />
                    Take Photo
                </button>
            </div>
          </>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-3 mb-6">
        <label className="block text-sm font-medium text-slate-600">Items</label>
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-slate-100 p-2 rounded-md">
            <span className="text-slate-700 text-sm truncate pr-2">{item.description}</span>
            <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <form onSubmit={handleAddItem} className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="e.g., 50 Laptops"
            className="flex-grow block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button type="submit" className="p-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 transition-colors">
            <PlusIcon className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Shipment Route */}
      <div className="space-y-2 mb-8">
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-slate-600 mb-1">Ship from</label>
          <select id="from" name="from" value={details.from} onChange={handleDetailChange} className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <div className="text-center py-1">
          <button
            onClick={handleReverse}
            className="inline-flex items-center justify-center p-2 text-slate-500 bg-slate-100 rounded-full hover:bg-slate-200 hover:text-indigo-600 transition-colors disabled:opacity-50"
            aria-label="Reverse origin and destination"
            disabled={details.from === details.to}
          >
            <SwitchVerticalIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label htmlFor="to" className="block text-sm font-medium text-slate-600 mb-1">Ship to</label>
          <select id="to" name="to" value={details.to} onChange={handleDetailChange} className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="pt-2">
          <label htmlFor="via" className="block text-sm font-medium text-slate-600 mb-1">Via</label>
          <select id="via" name="via" value={details.via} onChange={handleDetailChange} className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
            {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button 
          onClick={onAnalyze}
          disabled={isLoading || (items.length === 0 && !details.image)}
          className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-300 disabled:bg-slate-400 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <PaperAirplaneIcon className="w-5 h-5" />
              Analyze Shipment
            </>
          )}
        </button>
        <button
          onClick={onClear}
          disabled={isLoading || (items.length === 0 && !details.image)}
          className="w-full text-center text-sm font-medium text-slate-600 bg-slate-100 py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          Clear Shipment
        </button>
      </div>
    </div>
  );
};