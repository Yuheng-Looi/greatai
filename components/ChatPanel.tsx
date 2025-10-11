import React, { useState, useEffect, useRef } from 'react';
import type { ShipmentItem, ShipmentDetails, AnalysisResult, ChatMessage, LawReference } from '../types';
import { getFollowUpResponse } from '../services/geminiService';
import { SparklesIcon } from './icons/SparklesIcon';
import { SendIcon } from './icons/SendIcon';
import { PaperAirplaneIcon } from './icons/PaperAirplaneIcon';
import ChartRenderer from './ChartRenderer';

// Declare globally imported scripts for TypeScript
declare var marked: { parse: (markdown: string) => string };
declare var DOMPurify: { sanitize: (html: string) => string };

// Extract and render charts from AI response
const renderMessageContent = (content: string) => {
    const chartRegex = /```json:chart\s*([\s\S]*?)\s*```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = chartRegex.exec(content)) !== null) {
        // Add text before chart
        if (match.index > lastIndex) {
            const textContent = content.slice(lastIndex, match.index);
            if (textContent.trim()) {
                parts.push(
                    <div 
                        key={`text-${lastIndex}`}
                        className="prose prose-sm max-w-none prose-slate"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(textContent)) }}
                    />
                );
            }
        }

        // Add chart
        try {
            const chartData = JSON.parse(match[1]);
            if (chartData.type === 'chart') {
                parts.push(
                    <ChartRenderer 
                        key={`chart-${match.index}`}
                        chartData={chartData} 
                    />
                );
            }
        } catch (e) {
            console.error('Failed to parse chart JSON:', e);
            parts.push(
                <div key={`error-${match.index}`} className="text-red-600 text-sm p-2 bg-red-50 rounded border">
                    Error rendering chart: Invalid JSON format
                </div>
            );
        }

        lastIndex = chartRegex.lastIndex;
    }

    // Add remaining text after last chart
    if (lastIndex < content.length) {
        const remainingContent = content.slice(lastIndex);
        if (remainingContent.trim()) {
            parts.push(
                <div 
                    key={`text-${lastIndex}`}
                    className="prose prose-sm max-w-none prose-slate"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(remainingContent)) }}
                />
            );
        }
    }

    // If no charts found, render as regular markdown
    if (parts.length === 0) {
        return (
            <div
                className="prose prose-sm max-w-none prose-slate"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content)) }}
            />
        );
    }

    return <div className="space-y-2">{parts}</div>;
};

interface ChatPanelProps {
    shipmentItems: ShipmentItem[];
    shipmentDetails: ShipmentDetails;
    analysisResults: AnalysisResult[];
    onReferencesUpdate?: (references: LawReference[]) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ shipmentItems, shipmentDetails, analysisResults, onReferencesUpdate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const hasAnalysis = analysisResults.length > 0;

    useEffect(() => {
        // Reset messages when analysis results change
        if (hasAnalysis) {
            setMessages([]);
        }
    }, [analysisResults, shipmentItems, shipmentDetails, hasAnalysis]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const newUserMessage: ChatMessage = { role: 'user', content: userInput };
        setMessages(prev => [...prev, newUserMessage]);
        setUserInput('');
        setIsLoading(true);

        try {
            const { text, references } = await getFollowUpResponse(
                userInput, 
                messages, 
                shipmentItems, 
                shipmentDetails, 
                analysisResults
            );
            
            const botMessage: ChatMessage = { 
                role: 'model', 
                content: text,
                references: references 
            };
            
            setMessages(prev => [...prev, botMessage]);

            // Extract references and notify parent
            if (references.length > 0 && onReferencesUpdate) {
                onReferencesUpdate(references);
            }

        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => [...prev, { role: 'model', content: "Sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!hasAnalysis) {
        return (
             <div className="bg-white p-6 rounded-xl shadow-lg h-full flex flex-col items-center justify-center text-center">
                <PaperAirplaneIcon className="w-16 h-16 text-slate-300 mb-4" />
                <h3 className="text-xl font-semibold text-slate-700">Follow-up Assistant</h3>
                <p className="text-slate-500 mt-2">Run a shipment analysis to activate the chat assistant and ask detailed questions about your results.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg flex flex-col h-full max-h-[calc(100vh-100px)]">
            <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                <SparklesIcon className="w-6 h-6 text-brand-primary" />
                <h2 className="text-xl font-semibold text-slate-800">Follow-up Assistant</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`${msg.role === 'user' ? 'max-w-xs md:max-w-md lg:max-w-lg' : 'max-w-full'} px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-800'}`}>
                           {msg.role === 'user' ? (
                               <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                           ) : (
                               <div className="text-sm">
                                   {renderMessageContent(msg.content)}
                               </div>
                           )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-slate-100 text-slate-800">
                           <div className="flex items-center gap-2">
                               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                               <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                           </div>
                        </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-200">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Ask about your results... (Try: 'Show me a cost breakdown chart' or 'Compare regulations in a table')"
                        className="flex-grow block w-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-full text-sm shadow-sm placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        disabled={isLoading}
                    />
                    <button type="submit" className="p-2 bg-brand-primary text-white rounded-full hover:bg-indigo-700 disabled:bg-slate-400 transition-colors" disabled={isLoading || !userInput.trim()}>
                        <SendIcon className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};