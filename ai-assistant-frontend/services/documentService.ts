export interface Document {
  id: string;
  name: string;
  path?: string;  // Optional path property
  type: string;
  size_bytes: number;
  last_modified: string;
  content?: string;
  metadata: {
    source?: string;
    document_id?: string;
    [key: string]: any;
  };
}

const API_BASE_URL = 'http://localhost:8000/api';

export const fetchDocuments = async (limit?: number): Promise<Document[]> => {
  try {
    const url = limit ? `${API_BASE_URL}/documents?limit=${limit}` : `${API_BASE_URL}/documents`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    const data = await response.json();
    return processDocuments(data.documents || []);
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

const processDocuments = (documents: any[]): Document[] => {
  const uniqueDocs = new Map<string, Document>();
  
  documents.forEach(doc => {
    // Use path as the unique key, fall back to name if path doesn't exist
    const docKey = doc.path || doc.name || doc.id;
    
    if (!uniqueDocs.has(docKey) || 
        new Date(doc.last_modified) > new Date(uniqueDocs.get(docKey)!.last_modified)) {
      
      const processedDoc: Document = {
        id: doc.id,
        name: doc.name || doc.metadata?.source?.split('/').pop() || 'Untitled Document',
        path: doc.path,
        type: doc.type || doc.metadata?.source?.split('.').pop()?.toLowerCase() || 'txt',
        size_bytes: doc.size_bytes || 0,
        last_modified: doc.last_modified,
        content: doc.content,
        metadata: {
          ...doc.metadata,
          original_id: doc.id,
          document_id: doc.metadata?.document_id || doc.id
        }
      };
      
      uniqueDocs.set(docKey, processedDoc);
    }
  });
  
  return Array.from(uniqueDocs.values());
};

export const searchDocuments = async (query: string, topK: number = 10): Promise<Document[]> => {
  try {
    const response = await fetch(
      `http://localhost:5000/api/search?query=${encodeURIComponent(query)}&top_k=${topK}`
    );
    const data = await response.json();
    
    return (data.results || []).map((result: any) => ({
      id: result.metadata.document_id || result.id || `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: result.metadata.source?.split('/').pop() || 'Search Result',
      path: result.metadata.source,
      type: result.metadata.source?.split('.').pop()?.toLowerCase() || 'txt',
      size_bytes: 0, // Not available in search results
      last_modified: new Date().toISOString(),
      content: result.content,
      metadata: {
        ...result.metadata,
        score: result.score
      }
    }));
  } catch (error) {
    console.error('Error searching documents:', error);
    throw error;
  }
};
