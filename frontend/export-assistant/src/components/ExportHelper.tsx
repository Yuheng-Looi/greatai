import React, { useState } from 'react';
import { ChevronDown, Send, CheckCircle, XCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai' | 'result';
  content: string;
  isAllowed?: boolean;
  documents?: string[];
}

const ExportHelper: React.FC = () => {
  const [category, setCategory] = useState('xxx');
  const [fromCountry, setFromCountry] = useState('Malaysia');
  const [toCountry, setToCountry] = useState('Singapore');
  const [itemDescription, setItemDescription] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const categories = [
    'xxx', 'Electronics', 'Machinery', 'Textiles', 'Food & Agriculture', 
    'Chemicals', 'Automotive', 'Medical Equipment', 'Construction Materials'
  ];

  const countries = [
    'Malaysia', 'Singapore', 'Thailand', 'Indonesia', 'Philippines', 
    'Vietnam', 'China', 'Japan', 'South Korea', 'India', 'USA', 'Germany'
  ];

  const handleCheck = async () => {
    if (!itemDescription.trim()) return;

    setIsLoading(true);
    
    // Simulate AI processing
    setTimeout(() => {
      // Example result based on bicycle case
      if (itemDescription.toLowerCase().includes('bicycle') || itemDescription.toLowerCase().includes('bike')) {
        // AI asks question first (from left)
        const aiQuestion: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: "Can you provide the bicycle's material?"
        };
        
        setMessages([aiQuestion]);
        
        // Then user answers (from right)
        setTimeout(() => {
          const userAnswer: Message = {
            id: (Date.now() + 1).toString(),
            type: 'user',
            content: "It is made with aluminium."
          };
          
          setMessages(prev => [...prev, userAnswer]);
          
          // Finally AI shows result (from left)
          setTimeout(() => {
            const aiResult: Message = {
              id: (Date.now() + 2).toString(),
              type: 'ai',
              content: "According to Singapore Customs and MITI Malaysia, bicycles (HS Code 8712) are allowed.",
              isAllowed: true,
              documents: [
                'Commercial Invoice',
                'Packing List', 
                'Export Declaration (MY)',
                'Import Permit (SG, if required)',
                'Shipping arrangement'
              ]
            };
            
            setMessages(prev => [...prev, aiResult]);
            setIsLoading(false);
          }, 1000);
        }, 500);
      } else {
        // Generic processing for other items - show not allowed result
        const resultMessage: Message = {
          id: Date.now().toString(),
          type: 'ai',
          content: `❌ This item "${itemDescription}" is not allowed for export from ${fromCountry} to ${toCountry} according to trade regulations and customs clauses. Please check with relevant authorities for specific restrictions.`,
          isAllowed: false,
          documents: ['Export License Required', 'Special Permit Needed', 'Customs Declaration']
        };
        
        setMessages([resultMessage]);
        setIsLoading(false);
      }
    }, 1500);
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput
    };

    setMessages(prev => [...prev, newMessage]);
    setChatInput('');

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: "Thank you for your question. Let me help you with more details about the export requirements..."
      };
      
      setMessages(prev => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="export-helper">
      {/* Header */}
      <div className="header">
        <h1>Export Helper</h1>
      </div>

      <div className="container">
        {/* Form Section */}
        <div className="form-section">
          {/* Dropdowns Row */}
          <div className="dropdowns-row">
            <div className="dropdown-container">
              <label>Category</label>
              <div className="select-wrapper">
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="dropdown"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="dropdown-icon" />
              </div>
            </div>

            <div className="dropdown-container">
              <label>From</label>
              <div className="select-wrapper">
                <select 
                  value={fromCountry}
                  onChange={(e) => setFromCountry(e.target.value)}
                  className="dropdown"
                >
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                <ChevronDown className="dropdown-icon" />
              </div>
            </div>

            <div className="dropdown-container">
              <label>To</label>
              <div className="select-wrapper">
                <select 
                  value={toCountry}
                  onChange={(e) => setToCountry(e.target.value)}
                  className="dropdown"
                >
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                <ChevronDown className="dropdown-icon" />
              </div>
            </div>
          </div>

          {/* Item Description Row */}
          <div className="description-row">
            <div className="description-container">
              <label>Item/Description</label>
              <textarea
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                placeholder="Type here..."
                className="description-input"
                rows={3}
              />
            </div>
            <div className="check-button-container">
              <button
                onClick={handleCheck}
                disabled={isLoading || !itemDescription.trim()}
                className="check-button"
              >
                {isLoading ? 'Checking...' : 'Check'}
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {messages.length > 0 && (
          <div className="results-section">
            <h2>Result</h2>
            
            <div className="messages-container">
              {messages.map((message) => (
                <div key={message.id} className="message-wrapper">
                  {message.type === 'user' && (
                    <div className="user-message">
                      <p>{message.content}</p>
                    </div>
                  )}
                  
                  {message.type === 'ai' && (
                    <div className="ai-message-wrapper">
                      <div className={`ai-message ${message.documents ? (message.isAllowed ? 'allowed' : 'denied') : ''}`}>
                        {/* If result with documents, render with icon and formatting */}
                        {message.documents ? (
                          <div className="result-content">
                            {message.isAllowed ? (
                              <CheckCircle className="result-icon success" />
                            ) : (
                              <XCircle className="result-icon error" />
                            )}
                            <div className="result-text">
                              <p>{message.content}</p>
                              {message.isAllowed && (
                                <div className="checklist">
                                  <p className="checklist-title">Checklist:</p>
                                  <ul>
                                    {message.documents.map((doc, idx) => (
                                      <li key={idx}>• {doc}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {!message.isAllowed && (
                                <div className="checklist">
                                  <p className="checklist-title">Requirements:</p>
                                  <ul>
                                    {message.documents.map((doc, idx) => (
                                      <li key={idx}>• {doc}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p>{message.content}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {message.type === 'result' && (
                    <div className={`result-message ${message.isAllowed ? 'allowed' : 'denied'}`}>
                      <div className="result-content">
                        {message.isAllowed ? (
                          <CheckCircle className="result-icon success" />
                        ) : (
                          <XCircle className="result-icon error" />
                        )}
                        <div className="result-text">
                          <p>{message.content}</p>
                          {message.isAllowed && message.documents && (
                            <div className="checklist">
                              <p className="checklist-title">Checklist:</p>
                              <ul>
                                {message.documents.map((doc, idx) => (
                                  <li key={idx}>• {doc}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className="chat-section">
          <div className="chat-input-container">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type here..."
              className="chat-input"
              onKeyPress={(e) => e.key === 'Enter' && handleChatSubmit()}
            />
            <button
              onClick={handleChatSubmit}
              disabled={!chatInput.trim()}
              className="chat-send-button"
            >
              <Send className="send-icon" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportHelper;