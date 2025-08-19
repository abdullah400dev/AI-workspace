'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { logActivity } from "../../utils/logActivity";

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  preview: string;
  date: string;
  timestamp: number;
  read: boolean;
  rawContent?: string;
  senderEmail?: string;
};

// Function to extract email content and headers from raw email data
const parseEmailContent = (email: any): Email => {
  // If we already have parsed fields, use them
  if (email.content && (email.from || email.to || email.subject)) {
    // Check if we need to extract from raw content
    if ((!email.from || email.from === 'Unknown Sender') && email.content) {
      const linkedInMatch = email.content.match(/View profile:https?:\/\/[^\s]+\/in\/([^?\/]+)/i);
      if (linkedInMatch && linkedInMatch[1]) {
        const name = linkedInMatch[1]
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (l: string) => l.toUpperCase())
          .trim();
        email.from = name;
        
        // Try to get email from LinkedIn URL
        const emailMatch = email.content.match(/inviterVanityName=([^&]+)/);
        if (emailMatch && emailMatch[1]) {
          email.senderEmail = `${emailMatch[1]}@linkedin.com`;
        }
      }
    }
    
    return {
      id: email.id || `email-${Date.now()}`,
      from: email.from || 'Unknown Sender',
      to: email.to || 'Unknown Recipient',
      subject: email.subject || 'No Subject',
      content: email.content,
      preview: email.preview || email.content.substring(0, 200) + '...',
      date: email.date || new Date().toISOString(),
      timestamp: email.timestamp || Date.now(),
      read: false,
      rawContent: email.content,
      senderEmail: email.senderEmail || ''
    };
  }

  // Get the raw content to parse
  const rawContent = email.content || email.body || '';
  
  // Initialize result with default values
  const result: Partial<Email> = {
    id: email.id || `email-${Date.now()}`,
    from: email.from || '',
    to: email.to || '',
    subject: email.subject || '',
    content: rawContent,
    preview: '',
    date: email.date || new Date().toISOString(),
    timestamp: email.timestamp || Date.now(),
    read: false,
    rawContent: rawContent,
    senderEmail: ''
  };
  
  // Special handling for LinkedIn invitation emails
  const linkedInMatch = rawContent.match(/View profile:https?:\/\/[^\s]+\/in\/([^?\/]+)/i);
  if (linkedInMatch && linkedInMatch[1]) {
    const name = linkedInMatch[1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase())
      .trim();
    
    // Only override if we don't have a sender yet
    if (!result.from || result.from === 'Unknown Sender') {
      result.from = name;
      
      // Try to get email from LinkedIn URL
      const emailMatch = rawContent.match(/inviterVanityName=([^&]+)/);
      if (emailMatch && emailMatch[1]) {
        result.senderEmail = `${emailMatch[1]}@linkedin.com`;
      }
    }
  }

  // Try to extract headers and content from raw email
  if (rawContent) {
    // First, try to parse the raw email content
    const emailParts = rawContent.split(/\r?\n\r?\n/);
    const headers = emailParts[0] || '';
    
    // Extract From (with multiple fallback patterns)
    let fromEmail = '';
    let fromName = '';
    
    // First, try to extract from LinkedIn specific format
    const linkedInMatch = rawContent.match(/View profile:https?:\/\/[^\s]+\/in\/([^?\/]+)/i);
    if (linkedInMatch && linkedInMatch[1]) {
      fromName = linkedInMatch[1]
        .replace(/-/g, ' ')  // Convert hyphens to spaces
        .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Capitalize first letters
        .trim();
      
      // Try to find the email in the LinkedIn URL
      const emailMatch = rawContent.match(/inviterVanityName=([^&]+)/);
      if (emailMatch && emailMatch[1]) {
        fromEmail = `${emailMatch[1]}@linkedin.com`;
      }
    }
    
    // If no LinkedIn specific info found, try standard email headers
    let fromMatch = null;
    if (!fromName) {
      fromMatch = 
        // Try to match From: header in the headers section
        headers.match(/From:[\s\r\n]*(.*?)(?:\r?\n(?!\s)|$)/im) || 
        // Try to match From: at the start of any line
        rawContent.match(/^From:[\s\r\n]*(.*?)(?:\r?\n|$)/im) ||
        // Try to match From: with content until the next header or end of line
        rawContent.match(/From:[\s\r\n]*(.*?)(?=\r?\n\S+:|$)/im) ||
        // Try to match common email patterns
        rawContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    }
    
    // Process the sender information
    if (fromName) {
      // If we have LinkedIn info, use that
      result.from = fromName;
      if (fromEmail) {
        result.senderEmail = fromEmail;
      }
    } else if (fromMatch && fromMatch[1]) {
      let sender = fromMatch[1];
      let email = '';
      
      // Try to extract a name and email if it's in the format "Name <email@example.com>"
      const nameEmailMatch = sender.match(/^\s*"?([^"]*?)"?\s*<([^>]+)>/);
      if (nameEmailMatch) {
        if (nameEmailMatch[1].trim()) {
          sender = nameEmailMatch[1].trim();
        }
        email = nameEmailMatch[2].trim();
      } else {
        // Otherwise clean up the sender string
        const emailMatch = sender.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          email = emailMatch[0];
          sender = sender.replace(email, '').trim();
        }
        
        sender = sender
          .replace(/^[\s"']+|[\s"']+$/g, '')  // Trim whitespace and quotes
          .replace(/<[^>]+>/g, '')              // Remove email addresses in <>
          .replace(/\([^)]*\)/g, '')           // Remove anything in parentheses
          .replace(/\s+/g, ' ')                 // Collapse multiple spaces
          .trim();
        
        // If no name found, try to extract from email
        if (!sender && email) {
          const namePart = email.split('@')[0]
            .replace(/[._-]/g, ' ')  // Replace common separators with spaces
            .replace(/\b\w/g, (l: string) => l.toUpperCase()) // Capitalize first letters
            .trim();
          if (namePart) sender = namePart;
        }
      }
      
      result.from = sender || 'Unknown Sender';
      if (email) {
        result.senderEmail = email;
      }
    } else {
      result.from = 'Unknown Sender';
    }
    
    // Extract Subject (with multiple fallback patterns)
    const subjectMatch = headers.match(/Subject:[\s\r\n]*(.*?)(?:\r?\n(?!\s)|$)/im) ||
                       rawContent.match(/^Subject:[\s\r\n]*(.*?)(?:\r?\n|$)/im) ||
                       rawContent.match(/Subject:[\s\r\n]*(.*?)(?=\r?\n\S+:|$)/im);
    
    if (subjectMatch && subjectMatch[1]) {
      result.subject = subjectMatch[1]
        .replace(/^[\s"'\[]+|[\s"'\]]+$/g, '')  // Trim whitespace, quotes, and brackets
        .replace(/\s+/g, ' ')                     // Collapse multiple spaces
        .trim();
    }
    
    // Extract To (with multiple fallback patterns)
    const toMatch = headers.match(/To:[\s\r\n]*(.*?)(?:\r?\n(?!\s)|$)/im) ||
                   rawContent.match(/^To:[\s\r\n]*(.*?)(?:\r?\n|$)/im) ||
                   rawContent.match(/To:[\s\r\n]*([^<\r\n]+)/im);
    
    if (toMatch && toMatch[1]) {
      result.to = toMatch[1]
        .replace(/^[\s"']+|[\s"']+$/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Extract Date (with multiple fallback patterns)
    const dateMatch = headers.match(/Date:[\s\r\n]*(.*?)(?:\r?\n(?!\s)|$)/im) ||
                     rawContent.match(/^Date:[\s\r\n]*(.*?)(?:\r?\n|$)/im) ||
                     rawContent.match(/Date:[\s\r\n]*(.*?)(?=\r?\n\S+:|$)/im);
    
    if (dateMatch && dateMatch[1]) {
      try {
        const dateStr = dateMatch[1].replace(/\([^)]*\)/g, '').trim();
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          result.date = date.toISOString();
          result.timestamp = date.getTime();
        }
      } catch (e) {
        console.warn('Failed to parse date:', dateMatch[1]);
      }
    }
    
    // If we still don't have a subject, try to extract it from common patterns
    if (!result.subject) {
      const subjectPatterns = [
        /Subject:[\s\r\n]*(.*?)(?:\r?\n|$)/im,
        /Subject:[\s\r\n]*(.*?)(?=\r?\n\S+:|$)/im,
        /Subject:[\s\r\n]*([^\r\n]+)/im
      ];
      
      for (const pattern of subjectPatterns) {
        const match = rawContent.match(pattern);
        if (match && match[1]) {
          const subject = match[1].trim();
          if (subject && subject.length > 0) {
            result.subject = subject
              .replace(/^[\s"'\[]+|[\s"'\]]+$/g, '')
              .replace(/\s+/g, ' ')
              .trim();
            break;
          }
        }
      }
    }

    // Extract the main content (everything after the first blank line after headers)
    const contentMatch = rawContent.split(/\r?\n\r?\n/).slice(1).join('\n\n').trim();
    if (contentMatch) {
      // Clean up the content - remove quoted text, signatures, etc.
      const cleanContent = contentMatch
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/^>.*$/gm, '') // Remove quoted lines
        .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
        .trim();
      
      result.content = cleanContent || contentMatch; // Fall back to original if cleaned is empty
      result.preview = (cleanContent || contentMatch).substring(0, 200) + '...';
    } else {
      // If we couldn't extract content, use the raw content with some cleaning
      result.content = rawContent.replace(/\r\n/g, '\n');
      result.preview = rawContent.substring(0, 200) + '...';
    }
  }

  // Ensure we have at least some content for display
  if (!result.content) {
    result.content = 'No content available';
    result.preview = 'No content available';
  }

  return result as Email;
};

type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam';

export default function EmailInbox() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [currentFolder, setCurrentFolder] = useState<EmailFolder>('inbox');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('30'); // days
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [filters, setFilters] = useState({
    unread: false,
    from: '',
    to: '',
    search: ''
  });

  // Update emails when filters or date range changes
  useEffect(() => {
    fetchEmails();
  }, [dateFilter, filters]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        query: filters.search || '', // Empty string returns all emails
        days: dateFilter,
        limit: '100',
        sort: 'newest', // Ensure backend sorts by newest first
        ...(filters.unread && { unread: 'true' }),
        ...(filters.from && { from_email: filters.from }),
        ...(filters.to && { to: filters.to })
      });
      
      const apiUrl = `http://localhost:8000/api/search/emails?${params.toString()}`;
      console.log('Fetching emails from:', apiUrl);
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', JSON.stringify(data, null, 2));
      
      if (!data || !Array.isArray(data.emails)) {
        console.error('Invalid API response format - emails array not found');
        setEmails([]);
        return;
      }
      
      // Process each email
      const processedEmails = data.emails.map((email: any) => {
        // If the email already has content, use it directly
        if (email.content) {
          return {
            id: email.id || `email-${Date.now()}`,
            from: email.from || 'Unknown Sender',
            to: email.to || '',
            subject: email.subject || 'No Subject',
            content: email.content,
            preview: email.preview || email.content.substring(0, 200) + '...',
            date: email.date || new Date().toISOString(),
            timestamp: email.timestamp || Date.now(),
            read: false,
            rawContent: email.content
          };
        }
        
        // Otherwise, try to parse raw content
        const parsed = parseEmailContent(email);
        return {
          id: email.id || `email-${Date.now()}`,
          from: parsed.from || 'Unknown Sender',
          to: parsed.to || '',
          subject: parsed.subject || 'No Subject',
          content: parsed.content,
          preview: parsed.preview,
          date: parsed.date,
          timestamp: parsed.timestamp,
          read: false,
          rawContent: email.content || ''
        };
      });
      
      setEmails(processedEmails);
    } catch (error) {
      console.error('Error fetching emails:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sort emails by timestamp (newest first) and filter out duplicates
  const filteredEmails = Array.from(new Map(
    emails
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)) // Sort by newest first
      .map(email => [email.id, email]) // Use email ID as key to deduplicate
  ).values());

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    // Mark as read
    setEmails(emails.map(e => 
      e.id === email.id ? { ...e, read: true } : e
    ));
  };

  const handleRefresh = () => {
    fetchEmails();
  };

  // Log activity when emails or folder changes
  useEffect(() => {
    if (!loading) { // Only log when we have data
      logActivity("EmailInboxView", {
        component: "EmailsPage",
        emailCount: emails.length,
        unreadCount: emails.filter(e => !e.read).length,
        currentFolder: currentFolder
      });
    }
  }, [emails.length, currentFolder, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Email Inbox</h1>
          <Button onClick={handleRefresh} variant="outline">
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar with filters */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Time Period</label>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full p-2 border rounded bg-transparent"
                  >
                    <option value="1">Last 24 hours</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="0">All time</option>
                  </select>
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.unread}
                      onChange={(e) => setFilters({...filters, unread: e.target.checked})}
                      className="rounded"
                    />
                    <span>Unread only</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">From</label>
                  <Input
                    placeholder="Filter by sender"
                    value={filters.from}
                    onChange={(e) => setFilters({...filters, from: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">To</label>
                  <Input
                    placeholder="Filter by recipient"
                    value={filters.to}
                    onChange={(e) => setFilters({...filters, to: e.target.value})}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="relative">
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Trigger search when user types
                  const query = e.target.value.trim();
                  setFilters(prev => ({
                    ...prev,
                    search: query
                  }));
                }}
                className="w-full pl-10"
              />
              <svg
                className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {filteredEmails.length === 0 ? (
              <div className="text-center py-10 text-gray-100">
                No emails found matching your criteria.
              </div>
            ) : (
              <div className="space-y-2 text-black">
                {filteredEmails.map((email) => {
                  // Extract and clean email data
                  const cleanFrom = (email.from || '').replace(/<[^>]*>/g, '').trim();
                  const cleanTo = (email.to || '').replace(/<[^>]*>/g, '').trim();
                  
                  // Format date with fallback to timestamp if date is invalid
                  let displayDate = 'Unknown date';
                  try {
                    const dateToFormat = email.date || new Date(email.timestamp).toISOString();
                    displayDate = format(new Date(dateToFormat), 'MMM d, yyyy h:mm a');
                  } catch (e) {
                    console.warn('Invalid date:', email.date, 'Timestamp:', email.timestamp);
                  }
                  
                  // Get preview text with better fallbacks
                  const previewText = email.preview || 
                    (email.content ? 
                      (email.content.split('\n')
                        .map(line => line.trim())
                        .find(line => line.length > 10) || 
                        email.content.substring(0, 100) + '...') : 
                      'No content');
                      
                  // Determine sender/recipient display
                  const displayFrom = cleanFrom || 'Unknown Sender';
                  const displayTo = cleanTo || 'Unknown Recipient';
                  
                  return (
                    <Card 
                      key={email.id}
                      className={`cursor-pointer border border-gray-200 transition-colors ${
                        !email.read ? 'border-l-4 border-blue-500' : 'border-l-4 border-transparent'
                      }`}
                      onClick={() => handleEmailClick(email)}
                    >
                      <CardContent className=" border border-gray-900 rounded ">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-400 truncate">
                                  {displayFrom}
                                </p>
                              </div>
                              <span className="text-xs text-gray-100 whitespace-nowrap ml-2 mt-0.5">
                                {displayDate}
                              </span>
                            </div>
                            
                            <p className="text-sm font-semibold text-gray-100 mt-1 truncate">
                              {email.subject || 'No Subject'}
                            </p>
                            
                            <p className="text-sm text-gray-200 mt-1 line-clamp-2">
                              {previewText}
                            </p>
                            
                            {displayTo && (
                              <div className="mt-1">
                                <span className="text-xs text-gray-100">
                                  To: <span className="text-gray-100">{displayTo}</span>
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {!email.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500 ml-2 mt-1.5 flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Detail View Modal */}
      {selectedEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
            <CardHeader className="border-b">
              <div className="flex justify-between items-start">
                <CardTitle>{selectedEmail.subject}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedEmail(null)}
                >
                  Close
                </Button>
              </div>
              <div className="text-sm text-gray-100 space-y-1">
                <p className="font-medium">From: {selectedEmail.from}</p>
                <p>To: {selectedEmail.to}</p>
                <p>Date: {format(new Date(selectedEmail.date), 'PPPpp')}</p>
              </div>
            </CardHeader>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="prose max-w-none text-gray-800">
                {/* Email Headers */}
                <div className="mb-6 space-y-1 text-sm border-b pb-4">
                  <div className="flex">
                    <span className="w-20 text-gray-100">From:</span>
                    <span className="flex-1 font-medium">{selectedEmail.from || 'Unknown'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-20 text-gray-100">To:</span>
                    <span className="flex-1">{selectedEmail.to || 'Unknown'}</span>
                  </div>
                  {selectedEmail.subject && (
                    <div className="flex">
                      <span className="w-20 text-gray-100">Subject:</span>
                      <span className="flex-1 font-semibold">{selectedEmail.subject}</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="w-20 text-gray-100">Date:</span>
                    <span className="flex-1">
                      {selectedEmail.date ? format(new Date(selectedEmail.date), 'PPPpp') : 'Unknown date'}
                    </span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="mt-6 whitespace-pre-wrap break-words">
                  {selectedEmail.content.split('\n').map((line, i) => {
                    // Skip empty lines or lines with just whitespace
                    if (!line.trim()) return <br key={i} />;
                    
                    // Style links
                    if (line.match(/https?:\/\/[^\s]+/)) {
                      const parts = line.split(/(https?:\/\/[^\s]+)/g);
                      return (
                        <p key={i} className="mb-4 text-gray-100">
                          {parts.map((part, j) =>
                            part.match(/^https?:\/\//) ? (
                              <a 
                                key={j} 
                                href={part} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {part}
                              </a>
                            ) : (
                              part
                            )
                          )}
                        </p>
                      );
                    }
                    
                    // Style list items
                    if (line.trim().match(/^[-•*]\s/)) {
                      return (
                        <div key={i} className="flex items-start mb-1 text-gray-100">
                          <span className="mr-2">•</span>
                          <span>{line.trim().substring(1).trim()}</span>
                        </div>
                      );
                    }
                    
                    // Style section headers
                    if (line.match(/^[A-Z][A-Z\s]+:$/)) {
                      return <h3 key={i} className="text-lg font-semibold mt-6 mb-2">{line}</h3>;
                    }
                    
                    // Regular text
                    return <p key={i} className="mb-4 text-gray-100">{line}</p>;
                  })}
                </div>
                
                {/* Raw content toggle */}
                <details className="mt-8 text-sm border-t pt-4">
                  <summary className="cursor-pointer text-gray-100 hover:text-gray-700">
                    View raw content
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-50 rounded-md overflow-auto text-xs">
                    {selectedEmail.rawContent || selectedEmail.content}
                  </pre>
                </details>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
                                                                                                                                                                            }
