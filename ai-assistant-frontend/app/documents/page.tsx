'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Search, FileText, Trash2, ExternalLink, Filter, X } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { DocumentViewer } from '../../components/DocumentViewer';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { logActivity } from "../../utils/logActivity";
import { fetchDocuments, searchDocuments, Document } from '../../services/documentService';

// Extend the Window interface to include our custom property
declare global {
  interface Window {
    highlightTimeout: number | undefined;
  }
}

type DocumentFilters = {
  fileType: string;
  dateRange: string;
  search?: string;
  sort?: string;
};

export default function DocumentsPage() {
  // State management
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DocumentFilters>({
    fileType: 'all',
    dateRange: 'all',
    search: '',
    sort: 'newest'
  });
  const [showFilters, setShowFilters] = useState(false);
  const highlightedDocRef = useRef<HTMLDivElement>(null);

  // Scroll to a specific document by ID with visual highlight
  const scrollToDocument = (docId: string) => {
    // Clear any existing timeouts to prevent multiple highlights
    const existingTimeout = window.highlightTimeout;
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    setTimeout(() => {
      const element = document.querySelector(`[data-doc-id="${docId}"]`);
      if (element) {
        console.log(`Scrolling to document: ${docId}`);
        
        // Find the document name element within the card
        const docNameElement = element.querySelector('.document-name');
        
        // Scroll to the element
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        
        // Add highlight classes to the card
        element.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2', 'rounded-lg', 'bg-gray-800', 'transition-all', 'duration-300');
        
        // Add highlight to the document name if found
        if (docNameElement) {
          docNameElement.classList.add('font-bold', 'text-blue-700', 'scale-105', 'transition-all', 'duration-300');
        }
        
        // Remove the highlight after 2 seconds and clear the highlightedDocId
        window.highlightTimeout = window.setTimeout(() => {
          element.classList.remove('ring-4', 'ring-blue-500', 'ring-offset-2', 'bg-gray-800');
          if (docNameElement) {
            docNameElement.classList.remove('font-bold', 'text-blue-700', 'scale-105');
          }
          // Clear the highlighted ID
          setHighlightedDocId(null);
        }, 2000);
      } else {
        console.warn(`Could not find DOM element for document: ${docId}`);
      }
    }, 300); // Small delay to ensure the document is rendered
  };
  
  // Clean up any pending timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (window.highlightTimeout) {
        clearTimeout(window.highlightTimeout);
      }
    };
  }, []);

  // Handle highlighting after documents are loaded
  useEffect(() => {
    const highlightName = searchParams.get('highlight');
    
    if (highlightName && documents.length > 0) {
      console.log('=== DOCUMENT HIGHLIGHT DEBUG ===');
      console.log('Looking for document with name:', highlightName);
      
      // Log all available documents with their names and IDs
      console.log('Available documents (first 10):', documents.slice(0, 10).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        path: d.path,
        isNameMatch: d.name?.toLowerCase().includes(highlightName.toLowerCase())
      })));

      // 1. First try exact name match (case insensitive)
      const exactNameMatch = documents.find(doc => 
        doc.name?.toLowerCase() === highlightName.toLowerCase()
      );
      
      if (exactNameMatch) {
        console.log(`✅ Found exact name match: "${exactNameMatch.name}" (ID: ${exactNameMatch.id})`);
        setHighlightedDocId(exactNameMatch.id);
        scrollToDocument(exactNameMatch.id);
        return;
      }

      // 2. Try partial name match (case insensitive)
      const partialNameMatches = documents.filter(doc => 
        doc.name?.toLowerCase().includes(highlightName.toLowerCase())
      );

      if (partialNameMatches.length === 1) {
        console.log(`✅ Found single partial name match: "${partialNameMatches[0].name}" (ID: ${partialNameMatches[0].id})`);
        setHighlightedDocId(partialNameMatches[0].id);
        scrollToDocument(partialNameMatches[0].id);
        return;
      } else if (partialNameMatches.length > 1) {
        console.warn(`⚠️ Found ${partialNameMatches.length} documents with similar names:`,
          partialNameMatches.map(d => `"${d.name}" (ID: ${d.id})`));
        // Highlight the first match if there are multiple
        setHighlightedDocId(partialNameMatches[0].id);
        scrollToDocument(partialNameMatches[0].id);
        return;
      }

      // 3. Fallback to ID matching if no name matches found
      console.log('🔍 No name matches, trying ID-based matching...');
      
      // Try to find the document by exact ID match
      const highlightedDoc = documents.find(doc => doc.id === highlightName);
      
      if (highlightedDoc) {
        console.log('✅ Found exact ID match:', highlightedDoc.id);
        setHighlightedDocId(highlightedDoc.id);
        scrollToDocument(highlightedDoc.id);
        return;
      }

      // If we get here, no matches were found
      console.warn('❌ No matching document found for:', highlightName);
      setHighlightedDocId(null);
    } else {
      setHighlightedDocId(null);
    }
  }, [searchParams, documents]);

  // Fetch documents when filters or search query changes
  useEffect(() => {
    fetchDocumentsList();
  }, [filters, searchQuery]);

  useEffect(() => {
    logActivity("DocumentPageView", {
      component: "DocumentsPage",
      documentCount: documents.length,
      filter: filters.search ? 'search' : 'all',
      sortOrder: filters.sort
    });
  }, [documents.length, filters.search, filters.sort]);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const docs = await fetchDocuments();
      console.log('Documents - Loaded documents:', {
        count: docs.length,
        ids: docs.map(d => d.id)
      });
      return docs;

    } catch (error) {
      console.error('Error loading documents:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to highlight matching text in content
  const highlightMatchingContent = (content: string, query: string) => {
    if (!content || !query.trim()) return content;
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    
    return content.split('\n').map((line, i) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        return (
          <div key={i} className="mb-1 p-1 bg-yellow-100 dark:bg-yellow-900/30 rounded">
            {line.split(regex).map((part, j) => 
              part.toLowerCase() === query.toLowerCase() 
                ? <mark key={j} className="bg-yellow-300 dark:bg-yellow-800/50 px-1 rounded">{part}</mark> 
                : part
            )}
          </div>
        );
      }
      return null;
    }).filter(Boolean);
  };

  const fetchDocumentsList = async () => {
    const docs = await loadDocuments();
    
    // Apply filters
    let filteredDocs = [...docs];
    const query = searchQuery.trim().toLowerCase();
    
    // Apply search filter if search query exists
    if (query) {
      filteredDocs = filteredDocs.map(doc => ({
        ...doc,
        // Add a flag to indicate if this document matches the search
        matchesSearch: doc.name?.toLowerCase().includes(query) || 
                      doc.content?.toLowerCase().includes(query)
      })).filter(doc => doc.matchesSearch);
    }
    
    // Apply file type filter
    if (filters.fileType !== 'all') {
      filteredDocs = filteredDocs.filter(doc => {
        const ext = doc.metadata?.source?.split('.').pop()?.toLowerCase() || doc.type;
        return ext === filters.fileType;
      });
    }
    
    setDocuments(filteredDocs);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSearching(true);
      // Update the filters with the search query
      setFilters(prev => ({
        ...prev,
        search: searchQuery.trim()
      }));
      
      // If search query is empty, reset to show all documents
      if (!searchQuery.trim()) {
        setFilters(prev => ({
          ...prev,
          search: ''
        }));
      }
      
      // Fetch documents with updated filters
      await fetchDocumentsList();
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) return;

    try {
      const response = await fetch(`http://localhost:8000/api/documents?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete document');
      }

      setDocuments(documents.filter(doc => doc.name !== name));

      if (viewingDoc?.name === name) {
        setViewingDoc(null);
      }

    } catch (error) {
      console.error('Error deleting document:', error);
      alert(`Error deleting document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className={cn("container mx-auto p-6 space-y-6")}>
      <DocumentViewer
        document={viewingDoc}
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
      />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            {isSearching ? 'Searching...' : `Showing ${documents.length} document${documents.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button asChild>
          <a href="/upload">
            <FileText className="mr-2 h-4 w-4" />
            Upload New
          </a>
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search documents..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant="outline" type="button" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {(filters.fileType !== 'all' || filters.dateRange !== 'all') && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-primary"></span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">File Type</h4>
                  <div className="space-y-2">
                    {['all', 'pdf', 'txt', 'docx', 'md'].map((type) => (
                      <label key={type} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          className="h-4 w-4 text-primary"
                          checked={filters.fileType === type}
                          onChange={() => {
                            setFilters({ ...filters, fileType: type });
                            setShowFilters(false);
                          }}
                        />
                        <span className="text-sm capitalize">
                          {type === 'all' ? 'All Types' : type}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Upload Date</h4>
                  <div className="space-y-2">
                    {[
                      { value: 'all', label: 'Any Time' },
                      { value: 'today', label: 'Today' },
                      { value: 'week', label: 'This Week' },
                      { value: 'month', label: 'This Month' },
                    ].map(({ value, label }) => (
                      <label key={value} className="flex items-center space-x-2">
                        <input
                          type="radio"
                          className="h-4 w-4 text-primary"
                          checked={filters.dateRange === value}
                          onChange={() => {
                            setFilters({ ...filters, dateRange: value });
                            setShowFilters(false);
                          }}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {(filters.fileType !== 'all' || filters.dateRange !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() => {
                      setFilters({ fileType: 'all', dateRange: 'all' });
                      setShowFilters(false);
                    }}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear all filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="submit"
            onClick={handleSearch}
            disabled={isSearching || isLoading}
            className="px-4"
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>

        {(filters.fileType !== 'all' || filters.dateRange !== 'all') && (
          <div className="flex flex-wrap gap-2">
            {filters.fileType !== 'all' && (
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {filters.fileType.toUpperCase()}
                <button
                  onClick={() => setFilters({ ...filters, fileType: 'all' })}
                  className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.dateRange !== 'all' && (
              <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/50 text-secondary-foreground">
                {filters.dateRange === 'today' ? 'Today' :
                  filters.dateRange === 'week' ? 'This Week' : 'This Month'}
                <button
                  onClick={() => setFilters({ ...filters, dateRange: 'all' })}
                  className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-secondary/50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-lg font-medium">No documents found</h3>
          <p className="mt-1 text-muted-foreground">
            {searchQuery ? 'Try a different search term' : 'Upload your first document to get started'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <div 
              ref={highlightedDocId === doc.id ? highlightedDocRef : null}
              data-doc-id={doc.id}
              className={cn(
                "transition-all duration-300",
                highlightedDocId === doc.id ? "scale-[1.02]" : ""
              )}
            >
              <Card 
                key={doc.id} 
                className={cn(
                  "hover:shadow-md transition-all cursor-pointer h-full flex flex-col relative overflow-hidden",
                  viewingDoc?.id === doc.id && "ring-2 ring-blue-500",
                  highlightedDocId === doc.id ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20" : ""
                )}
                onClick={() => setViewingDoc(doc)}
              >
                {highlightedDocId === doc.id && (
                  <div className="absolute top-2 right-2 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 animate-pulse"></span>
                    Here i'm
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="document-name text-lg font-medium line-clamp-1">
                        {doc.name || 'Untitled Document'}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {(() => {
                          if (!doc.id || typeof doc.id !== 'string') return '';
                          const parts = doc.id.split('_');
                          const last = parts[parts.length - 1];
                          const isPart = parts.length > 1 && !isNaN(Number(last)) && last !== '0';
                          return isPart ? `Part ${Number(last) + 1}` : '';
                        })()}
                      </CardDescription>

                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground max-h-24 overflow-y-auto">
                    {searchQuery.trim() ? (
                      highlightMatchingContent(doc.content || '', searchQuery.trim())
                    ) : (
                      <p className="line-clamp-3">{doc.content}</p>
                    )}
                  </div>
                  <div className="mt-4 flex justify-between items-center text-xs text-muted-foreground">
                    <span>
                      {doc.content
                        ? `${Math.ceil(doc.content.length / 5)} words • ${doc.content.length} chars`
                        : 'No content'}
                    </span>

                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(doc.name);
                        }}
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingDoc(doc);
                        }}
                        title="View document"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
