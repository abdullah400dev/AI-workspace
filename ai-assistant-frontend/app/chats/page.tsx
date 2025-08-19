'use client';
import { logActivity } from '@/utils/logActivity';
import { useEffect, useRef, useState } from 'react';
import { AiFillRobot } from 'react-icons/ai';
import { FiMessageSquare, FiUser } from 'react-icons/fi';

interface Message {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  session_id?: string;
  created_at?: string | Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => {
    // Generate a unique session ID for this chat session
    return 'session-' + Math.random().toString(36).substr(2, 9);
  });
  const bottomRef = useRef<HTMLDivElement>(null);

  // Track if we've logged the chat view
  const hasLoggedView = useRef(false);

  // Load all messages from the server when the component mounts
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:8000/api/chat/messages');
        if (response.ok) {
          const data = await response.json();
          // Sort messages by creation time
          const sortedMessages = data.sort((a: Message, b: Message) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          });
          setMessages(sortedMessages);

          // Log chat view activity only once when messages are loaded
          if (!hasLoggedView.current && sortedMessages.length > 0) {
            logActivity('Chat', {
              component: 'AIChat',
              messageCount: sortedMessages.length,
              sessionId: sessionId
            });
            hasLoggedView.current = true;
          }
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [sessionId]);

  // Log chat activity when messages change (but not too frequently)
  useEffect(() => {
    // Only log if we have messages and we haven't logged this session yet
    if (messages.length > 0 && !hasLoggedView.current) {
      logActivity('Chat', {
        component: 'AIChat',
        messageCount: messages.filter(m => m.role === 'user').length,
        sessionId: sessionId
      });
      hasLoggedView.current = true;
    }
    
    // Auto-scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });  
  }, [messages, sessionId]);

  // Save a message to the server
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    try {
      await fetch('http://localhost:8000/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role,
          content,
          session_id: sessionId,
        }),
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const question = input.trim();
    const userMessage = { role: 'user' as const, content: question, session_id: sessionId, created_at: new Date().toISOString() };
    
    // Update UI immediately
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Save user message to database
      await saveMessage('user', question);
      
      // Get AI response
      const res = await fetch(`http://localhost:8000/api/search-similar?query=${encodeURIComponent(question)}`);
      const data = await res.json();

      let assistantMessage: Message;
      if (data.ollama_answer) {
        assistantMessage = { 
          role: 'assistant', 
          content: data.ollama_answer,
          session_id: sessionId,
          created_at: new Date().toISOString()
        };
      } else {
        assistantMessage = { 
          role: 'assistant', 
          content: 'No answer found.',
          session_id: sessionId,
          created_at: new Date().toISOString()
        };
      }
      
      // Update UI with AI response
      setMessages(prev => [...prev, assistantMessage]);
      
      // Save AI response to database
      await saveMessage('assistant', assistantMessage.content);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error getting answer.' }]);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    logActivity("Chat", {
      component: "AIChat",
      sessionId: sessionId,
      messageCount: messages.length
    });
  }, [sessionId, messages.length]);
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-7xl mx-auto my-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 flex items-center">
        <FiMessageSquare className="mr-2 text-blue-600" />
        AI Assistant Chat
      </h2>
      <div className="flex flex-col h-[75vh] overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-700 gap-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet. Start a conversation!
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg._id || idx}
              className={`flex items-start gap-2 p-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <AiFillRobot className="h-5 w-5 mt-1 text-blue-500" />
              )}

              <div
                className={`max-w-xs p-3 rounded-lg break-words flex flex-col ${
                  msg.role === 'user' 
                    ? 'bg-blue-100 text-left text-black' 
                    : 'bg-gray-200 text-left text-black'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                <div className={`text-xs mt-1 opacity-70  text-right ${
                  msg.role === 'user' ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {msg.created_at 
                    ? new Date(msg.created_at).toLocaleTimeString() 
                    : 'Just now'}
                </div>
              </div>

              {msg.role === 'user' && (
                <FiUser className="h-5 w-5 mt-1 text-white bg-blue-500 rounded-full p-1" />
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} /> 
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 border px-4 py-2 rounded text-black"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
