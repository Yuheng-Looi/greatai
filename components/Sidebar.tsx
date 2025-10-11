import React, { useState, useRef, useEffect } from 'react';
import type { ShipmentItem, ShipmentDetails } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PaperAirplaneIcon } from './icons/PaperAirplaneIcon';
import { SwitchVerticalIcon } from './icons/SwitchVerticalIcon';
import { PhotographIcon } from './icons/PhotographIcon';
import { CameraIcon } from './icons/CameraIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import { FileTextIcon } from './icons/FileTextIcon';
import { analyzeDocument } from '../services/documentAnalysisService';

interface SidebarProps {
  items: ShipmentItem[];
  setItems: React.Dispatch<React.SetStateAction<ShipmentItem[]>>;
  details: ShipmentDetails;
  setDetails: React.Dispatch<React.SetStateAction<ShipmentDetails>>;
  onAnalyze: () => void;
  onClear: () => void;
  isLoading: boolean;
}

const COUNTRIES = ['Malaysia', 'Singapore', 'Thailand', 'Indonesia'];
const TRANSPORT_MODES = ['Air Freight', 'Ocean Freight', 'Rail Freight', 'Road Freight'];

// Helper to convert file to base64
const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

// Helper to determine document type
const getDocumentType = (file: File): 'image' | 'text' | 'pdf' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('text/') || file.type === 'application/rtf') return 'text';
  // Default to text for unknown types
  return 'text';
};

// Helper to check if file type is supported
const isSupportedFileType = (file: File): boolean => {
  const supportedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    // PDFs
    'application/pdf',
    // Text files
    'text/plain', 'text/csv', 'text/html', 'text/markdown', 'application/rtf'
  ];
  return supportedTypes.includes(file.type) || file.type.startsWith('text/');
};

// Helper to apply analysis results to form
const applyAnalysisResults = (
  analysisResult: any,
  setItems: React.Dispatch<React.SetStateAction<ShipmentItem[]>>,
  setDetails: React.Dispatch<React.SetStateAction<ShipmentDetails>>,
  currentDetails: ShipmentDetails,
  setAnalysisResult: React.Dispatch<React.SetStateAction<{confidence: number, itemsAdded: number, fieldsUpdated: string[]} | null>>,
  setShowFeedback: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const feedback = {
    confidence: analysisResult.confidence || 0,
    itemsAdded: 0,
    fieldsUpdated: [] as string[]
  };

  if (analysisResult.confidence > 30) { // Lowered threshold for better extraction
    console.log('Applying analysis results:', analysisResult);
    
    // Update items - replace existing items if new ones are found with good confidence
    if (analysisResult.items && analysisResult.items.length > 0) {
      const newItems = analysisResult.items.map((item: any, index: number) => ({
        id: Date.now() + index,
        description: item.description
      }));
      
      // If confidence is high, replace all items; otherwise, add to existing
      if (analysisResult.confidence > 70) {
        console.log('High confidence - replacing all items:', newItems);
        setItems(newItems);
        feedback.itemsAdded = newItems.length;
      } else {
        console.log('Medium confidence - adding items:', newItems);
        setItems(prevItems => {
          feedback.itemsAdded = newItems.length;
          return [...prevItems, ...newItems];
        });
      }
    }

    // Update shipment details - be more aggressive about updates
    setDetails(prevDetails => {
      const updatedDetails = { ...prevDetails };

      // Update origin if found and different
      if (analysisResult.shipmentDetails?.from && 
          analysisResult.shipmentDetails.from !== prevDetails.from && 
          ['Malaysia', 'Singapore', 'Thailand', 'Indonesia'].includes(analysisResult.shipmentDetails.from)) {
        updatedDetails.from = analysisResult.shipmentDetails.from;
        feedback.fieldsUpdated.push('Origin');
        console.log('Updated origin to:', analysisResult.shipmentDetails.from);
      }
      
      // Update destination if found and different
      if (analysisResult.shipmentDetails?.to && 
          analysisResult.shipmentDetails.to !== prevDetails.to && 
          ['Malaysia', 'Singapore', 'Thailand', 'Indonesia'].includes(analysisResult.shipmentDetails.to)) {
        updatedDetails.to = analysisResult.shipmentDetails.to;
        feedback.fieldsUpdated.push('Destination');
        console.log('Updated destination to:', analysisResult.shipmentDetails.to);
      }
      
      // Update transport method if found and different
      if (analysisResult.shipmentDetails?.via && 
          analysisResult.shipmentDetails.via !== prevDetails.via && 
          ['Air Freight', 'Ocean Freight', 'Rail Freight', 'Road Freight'].includes(analysisResult.shipmentDetails.via)) {
        updatedDetails.via = analysisResult.shipmentDetails.via;
        feedback.fieldsUpdated.push('Transport Method');
        console.log('Updated transport method to:', analysisResult.shipmentDetails.via);
      }

      return updatedDetails;
    });
  } else {
    console.log('Low confidence analysis result - skipping auto-population:', analysisResult.confidence);
  }

  // Show feedback
  setAnalysisResult(feedback);
  setShowFeedback(true);
  
  // Hide feedback after 5 seconds
  setTimeout(() => {
    setShowFeedback(false);
  }, 5000);
};


export const Sidebar: React.FC<SidebarProps> = ({ items, setItems, details, setDetails, onAnalyze, onClear, isLoading }) => {
  const [newItem, setNewItem] = useState('');
  const [isAnalyzingDocument, setIsAnalyzingDocument] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{confidence: number, itemsAdded: number, fieldsUpdated: string[]} | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

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

  const handleDocumentSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if file type is supported
    if (!isSupportedFileType(file)) {
      alert('Unsupported file type. Please upload an image, PDF, or text file.');
      event.target.value = '';
      return;
    }

    try {
      const base64String = await toBase64(file);
      const base64Data = base64String.split(',')[1]; // Remove the data URI prefix
      const documentType = getDocumentType(file);
      
      const documentData = {
        data: base64Data,
        mimeType: file.type,
        name: file.name,
        type: documentType
      };

      // Immediately update details with the document
      setDetails({ ...details, document: documentData });

      // Start document analysis in the background
      setIsAnalyzingDocument(true);
      
      // Run analysis asynchronously without blocking UI
      analyzeDocument(documentData, details)
        .then((analysisResult) => {
          applyAnalysisResults(analysisResult, setItems, setDetails, details, setAnalysisResult, setShowFeedback);
        })
        .catch((error) => {
          console.error("Error analyzing document:", error);
          // Document uploaded but analysis failed - user can still proceed manually
        })
        .finally(() => {
          setIsAnalyzingDocument(false);
        });

    } catch (error) {
      console.error("Error processing file:", error);
      alert('Error processing file. Please try again.');
    } finally {
      // Reset file input value to allow re-selection of the same file
      event.target.value = '';
    }
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        setIsAnalyzingDocument(true); // Use same loading state for images
        
        const base64String = await toBase64(file);
        const base64Data = base64String.split(',')[1]; // Remove the data URI prefix
        
        const documentData = { 
          data: base64Data, 
          mimeType: file.type, 
          name: file.name,
          type: 'image' as const
        };
        
        // Immediately update details with the document
        setDetails({ ...details, document: documentData });

        // Start image analysis in the background
        analyzeDocument(documentData, details)
          .then((analysisResult) => {
            applyAnalysisResults(analysisResult, setItems, setDetails, details, setAnalysisResult, setShowFeedback);
          })
          .catch((error) => {
            console.error("Error analyzing image:", error);
            // Image uploaded but analysis failed - user can still proceed manually
          })
          .finally(() => {
            setIsAnalyzingDocument(false);
          });

    } catch (error) {
        console.error("Error converting file to base64:", error);
        setIsAnalyzingDocument(false);
    }
    // Reset file input value to allow re-selection of the same file
    event.target.value = '';
  };

  const openCamera = async () => {
    try {
      // Get available cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // Select the first camera or the back camera if available
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      const defaultCamera = backCamera || videoDevices[0];
      
      if (defaultCamera) {
        setSelectedCamera(defaultCamera.deviceId);
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          deviceId: defaultCamera ? { exact: defaultCamera.deviceId } : undefined,
          facingMode: defaultCamera ? undefined : 'environment'
        }
      });
      setCameraStream(stream);
      setIsCameraOpen(true);
      
      // Wait for next tick to ensure modal is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => {
            console.error("Error playing video:", err);
          });
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert('Unable to access camera. Please check permissions or use file upload instead.');
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
    setAvailableCameras([]);
    setSelectedCamera('');
  };

  const switchCamera = async (deviceId: string) => {
    try {
      // Stop current stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      
      // Start new stream with selected camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      
      setCameraStream(stream);
      setSelectedCamera(deviceId);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Error playing video:", err);
        });
      }
    } catch (error) {
      console.error("Error switching camera:", error);
      alert('Unable to switch camera. Please try again.');
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw the video frame to canvas
    context.drawImage(video, 0, 0);
    
    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      try {
        setIsAnalyzingDocument(true);
        closeCamera();
        
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = async () => {
          const base64String = reader.result as string;
          const base64Data = base64String.split(',')[1];
          
          const documentData = {
            data: base64Data,
            mimeType: 'image/jpeg',
            name: `captured-photo-${Date.now()}.jpg`,
            type: 'image' as const
          };
          
          // Update details with the captured photo
          setDetails({ ...details, document: documentData });

          // Start image analysis
          try {
            const analysisResult = await analyzeDocument(documentData, details);
            applyAnalysisResults(analysisResult, setItems, setDetails, details, setAnalysisResult, setShowFeedback);
          } catch (error) {
            console.error("Error analyzing captured photo:", error);
          } finally {
            setIsAnalyzingDocument(false);
          }
        };
        reader.onerror = () => {
          console.error("Error reading captured photo");
          setIsAnalyzingDocument(false);
        };
          
      } catch (error) {
        console.error("Error processing captured photo:", error);
        setIsAnalyzingDocument(false);
      }
    }, 'image/jpeg', 0.8);
  };

  const removeDocument = () => {
    setDetails({ ...details, document: null });
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg h-fit sticky top-8 relative">
      {/* Loading overlay when analyzing document or image */}
      {isAnalyzingDocument && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl z-10 flex items-start justify-center pt-4">
          <div className="bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm font-medium text-indigo-800">Analyzing content...</span>
          </div>
        </div>
      )}

      {/* Analysis Feedback */}
      {showFeedback && analysisResult && (
        <div className="absolute top-4 right-4 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0">
              {analysisResult.confidence >= 70 ? (
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : analysisResult.confidence >= 50 ? (
                <div className="w-5 h-5 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900">Analysis Complete</p>
              <p className="text-xs text-slate-600 mt-1">
                Confidence: {analysisResult.confidence}%
              </p>
              {analysisResult.itemsAdded > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Added {analysisResult.itemsAdded} item(s)
                </p>
              )}
              {analysisResult.fieldsUpdated.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  ✓ Updated: {analysisResult.fieldsUpdated.join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowFeedback(false)}
              className="flex-shrink-0 text-slate-400 hover:text-slate-600"
            >
              <XCircleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 max-w-2xl w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Take Photo</h3>
              <button onClick={closeCamera} className="text-slate-500 hover:text-slate-700">
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            
            {/* Camera Selection Dropdown */}
            {availableCameras.length > 1 && (
              <div className="mb-3">
                <label htmlFor="camera-select" className="block text-sm font-medium text-slate-600 mb-1">
                  Select Camera
                </label>
                <select
                  id="camera-select"
                  value={selectedCamera}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {availableCameras.map((camera, index) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-lg"
                style={{ minHeight: '400px', maxHeight: '60vh' }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={capturePhoto}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                📸 Capture Photo
              </button>
              <button
                onClick={closeCamera}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Shipment Details</h2>
      
      {/* Document Upload */}
       <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-600">Document (Optional)</label>
          {isAnalyzingDocument && (
            <div className="flex items-center gap-1 text-xs text-indigo-600">
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing...
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">Upload images, PDFs, or text files to automatically populate shipment details</p>
        {details.document ? (
          <div className="relative group">
            {details.document.type === 'image' ? (
              <img 
                src={`data:${details.document.mimeType};base64,${details.document.data}`} 
                alt="Shipment Preview" 
                className="w-full h-40 object-cover rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-full h-32 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                <div className="text-center">
                  {details.document.type === 'pdf' ? (
                    <DocumentIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  ) : (
                    <FileTextIcon className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                  )}
                  <p className="text-sm text-slate-600 font-medium">{details.document.name}</p>
                  <p className="text-xs text-slate-500">{details.document.type.toUpperCase()}</p>
                </div>
              </div>
            )}
            <button
                onClick={removeDocument}
                className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/75 transition-colors"
                aria-label="Remove document"
            >
                <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        ) : (
          <>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
            <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />
            <input 
              type="file" 
              accept="image/*,.pdf,.txt,.csv,.rtf" 
              ref={documentInputRef} 
              onChange={handleDocumentSelect} 
              className="hidden" 
            />
            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1 border border-slate-300 text-slate-600 font-medium py-3 px-2 rounded-lg hover:bg-slate-100 transition-colors text-xs"
                >
                    <PhotographIcon className="w-4 h-4" />
                    Upload Image
                </button>
                <button
                    onClick={openCamera}
                    className="flex flex-col items-center justify-center gap-1 border border-slate-300 text-slate-600 font-medium py-3 px-2 rounded-lg hover:bg-slate-100 transition-colors text-xs"
                >
                    <CameraIcon className="w-4 h-4" />
                    Take Photo
                </button>
                <button
                    onClick={() => documentInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1 border border-slate-300 text-slate-600 font-medium py-3 px-2 rounded-lg hover:bg-slate-100 transition-colors text-xs"
                >
                    <DocumentIcon className="w-4 h-4" />
                    Upload Document
                </button>
            </div>
          </>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-slate-600">Items</label>
          {isAnalyzingDocument && (
            <div className="flex items-center gap-1 text-xs text-indigo-600">
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Auto-extracting items...
            </div>
          )}
        </div>
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-slate-100 p-2 rounded-md">
            <span className="text-slate-700 text-sm truncate pr-2">{item.description}</span>
            <button 
              onClick={() => handleRemoveItem(item.id)} 
              disabled={isAnalyzingDocument}
              className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <form onSubmit={handleAddItem} className="flex items-center gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={isAnalyzingDocument ? "Extracting items from content..." : "e.g., 50 Laptops"}
            disabled={isAnalyzingDocument}
            className="flex-grow block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          />
          <button 
            type="submit" 
            disabled={isAnalyzingDocument}
            className="p-2 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Shipment Route */}
      <div className="space-y-2 mb-8">
        <div>
          <label htmlFor="from" className="block text-sm font-medium text-slate-600 mb-1">
            Ship from
            {isAnalyzingDocument && (
              <span className="ml-2 text-xs text-indigo-600 font-normal">
                (Auto-updating from content...)
              </span>
            )}
          </label>
          <select 
            id="from" 
            name="from" 
            value={details.from} 
            onChange={handleDetailChange} 
            disabled={isAnalyzingDocument}
            className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        
        <div className="text-center py-1">
          <button
            onClick={handleReverse}
            disabled={isAnalyzingDocument || details.from === details.to}
            className="inline-flex items-center justify-center p-2 text-slate-500 bg-slate-100 rounded-full hover:bg-slate-200 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Reverse origin and destination"
          >
            <SwitchVerticalIcon className="w-5 h-5" />
          </button>
        </div>

        <div>
          <label htmlFor="to" className="block text-sm font-medium text-slate-600 mb-1">
            Ship to
            {isAnalyzingDocument && (
              <span className="ml-2 text-xs text-indigo-600 font-normal">
                (Auto-updating from content...)
              </span>
            )}
          </label>
          <select 
            id="to" 
            name="to" 
            value={details.to} 
            onChange={handleDetailChange} 
            disabled={isAnalyzingDocument}
            className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="pt-2">
          <label htmlFor="via" className="block text-sm font-medium text-slate-600 mb-1">
            Via
            {isAnalyzingDocument && (
              <span className="ml-2 text-xs text-indigo-600 font-normal">
                (Auto-updating from content...)
              </span>
            )}
          </label>
          <select 
            id="via" 
            name="via" 
            value={details.via} 
            onChange={handleDetailChange} 
            disabled={isAnalyzingDocument}
            className="block w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
          >
            {TRANSPORT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button 
          onClick={onAnalyze}
          disabled={isLoading || (items.length === 0 && !details.document)}
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
          disabled={isLoading || isAnalyzingDocument || (items.length === 0 && !details.document)}
          className="w-full text-center text-sm font-medium text-slate-600 bg-slate-100 py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          Clear Shipment
        </button>
      </div>
    </div>
  );
};