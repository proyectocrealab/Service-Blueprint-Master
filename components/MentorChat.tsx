import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MessageSquare } from 'lucide-react';
import { getMentorAdvice } from '../services/geminiService';
import { BlueprintColumn, ChatMessage, Scenario } from '../types';

interface MentorChatProps {
  blueprint: BlueprintColumn[];
  scenario: Scenario;
}

const MentorChat: React.FC<MentorChatProps> = ({ blueprint, scenario }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: `Hi! I'm your Service Design mentor. I'm here to help you map out "${scenario.title}". Stuck? Just ask!` }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input;
    setInput('');
    const newMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: userText };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setLoading(true);

    // Format history for Gemini
    const history = updatedMessages.map(m => ({
      role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: m.text }] as [{ text: string }]
    }));

    const responseText = await getMentorAdvice(history, blueprint, scenario);

    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), sender: 'ai', text: responseText }
    ]);
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300" style={{ height: '500px' }}>
          {/* Header */}
          <div className="bg-indigo-600 p-4 flex justify-between items-center text-white shadow-sm">
            <div className="flex items-center gap-2">
              <Bot size={20} className="animate-pulse" />
              <span className="font-semibold tracking-tight">Professor AI</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-indigo-700 p-1.5 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm border ${
                  msg.sender === 'user'
                    ? 'bg-indigo-600 text-white border-indigo-700 self-end rounded-tr-none'
                    : 'bg-white border-gray-100 text-gray-800 self-start rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-none self-start shadow-sm w-16 flex items-center justify-center">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask for guidance..."
              className="flex-1 bg-gray-50 border border-gray-200 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 rounded-xl px-4 py-2.5 text-sm transition-all outline-none text-gray-900 placeholder:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white p-2.5 rounded-xl transition-all shadow-md hover:shadow-indigo-200 active:scale-95"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 group border-2 border-white/20"
        >
          <MessageSquare size={24} />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-bold text-sm uppercase tracking-wider">
            Ask Mentor
          </span>
        </button>
      )}
    </div>
  );
};

export default MentorChat;