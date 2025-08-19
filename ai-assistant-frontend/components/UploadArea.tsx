'use client';

import { useState, useCallback } from 'react';
import { FiUpload, FiX, FiFile, FiCheckCircle, FiLink, FiExternalLink } from 'react-icons/fi';
import { FaGoogleDrive } from 'react-icons/fa';
import { Dialog } from '@headlessui/react';

export default function UploadArea() {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isGoogleDocsOpen, setIsGoogleDocsOpen] = useState(false);
  const [googleDocsUrl, setGoogleDocsUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    const uploadPromises = files.map((file, index) => 
      uploadFile(file, index)
    );

    try {
      await Promise.all(uploadPromises);
      // Handle successful upload
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const uploadFile = async (file: File, index: number) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Show initial progress
    setUploadProgress(prev => ({
      ...prev,
      [`${file.name}-${index}`]: 10,
    }));
  
    try {
      // Use the same base URL as the Google Docs import
      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to upload ${file.name}: ${errorData.detail || response.statusText}`);
      }
  
      // Update progress to 100% on success
      setUploadProgress(prev => ({
        ...prev,
        [`${file.name}-${index}`]: 100,
      }));
    } catch (error) {
      console.error(error);
      setUploadProgress(prev => ({
        ...prev,
        [`${file.name}-${index}`]: 0,
      }));
    }
  };
  

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleGoogleDocsImport = async () => {
    if (!googleDocsUrl) {
      setImportError('Please enter a valid Google Docs URL');
      return;
    }

    try {
      setIsImporting(true);
      setImportError(null);
      
      // Show loading state
      setImportSuccess('Importing Google Doc, please wait...');
      
      const response = await fetch(`http://localhost:8000/api/google-docs/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: googleDocsUrl }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        // Handle API error response
        throw new Error(data.detail?.error || 'Failed to import Google Doc');
      }

      // Show success message with document details
      setImportSuccess(`✅ Successfully imported: ${data.title}\nChunks processed: ${data.chunks_imported}`);
      
      // Reset the form
      setGoogleDocsUrl('');
      
      // Close the dialog after a delay
      setTimeout(() => {
        setIsGoogleDocsOpen(false);
        // Clear success message after closing
        setTimeout(() => setImportSuccess(null), 500);
      }, 3000);
      
    } catch (error) {
      console.error('Error importing Google Doc:', error);
      setImportError(error instanceof Error ? error.message : 'Failed to import Google Doc');
      // Clear error after 5 seconds
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-2">
          <FiUpload className="h-12 w-12 text-gray-400" />
          <p className="text-lg font-medium text-gray-900">Drag and drop files here</p>
          <div className="flex flex-col space-y-3 w-full max-w-xs">
            <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-center">
              Browse Files
              <input 
                type="file" 
                className="hidden" 
                multiple 
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.md"
              />
            </label>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>
            
            <button
              onClick={() => setIsGoogleDocsOpen(true)}
              className="flex items-center justify-center space-x-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <FaGoogleDrive className="h-5 w-5 text-blue-500" />
              <span>Import from Google Docs</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Supported formats: PDF, DOC, DOCX, TXT, MD (Max 50MB)
          </p>
        </div>
      </div>
      {/* Google Docs Import Dialog */}
      <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isGoogleDocsOpen ? 'block' : 'hidden'}`}>
        <div 
          className="fixed inset-0 bg-black/30" 
          onClick={() => {
            setIsGoogleDocsOpen(false);
            setGoogleDocsUrl('');
            setImportError(null);
            setImportSuccess(null);
          }}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-md mx-auto">
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Import from Google Docs
              </h3>
              <button
                onClick={() => {
                  setIsGoogleDocsOpen(false);
                  setGoogleDocsUrl('');
                  setImportError(null);
                  setImportSuccess(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="google-docs-url" className="block text-sm font-medium text-gray-700 mb-1">
                  Google Docs URL
                </label>
                <input
                  type="text"
                  id="google-docs-url"
                  value={googleDocsUrl}
                  onChange={(e) => setGoogleDocsUrl(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {importError && (
                <div className="p-3 text-sm text-red-700 bg-red-50 rounded-md">
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md">
                  {importSuccess}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsGoogleDocsOpen(false);
                    setGoogleDocsUrl('');
                    setImportError(null);
                    setImportSuccess(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGoogleDocsImport}
                  disabled={isImporting || !googleDocsUrl}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importing...
                    </>
                  ) : (
                    <>
                      <FaGoogleDrive className="h-4 w-4" />
                      <span>Import Document</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 text-xs text-gray-500">
                <p className="flex items-center">
                  <FiExternalLink className="mr-1" />
                  Make sure the document is shared with anyone with the link
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Files to upload ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div className="flex items-center space-x-3">
                  <FiFile className="h-5 w-5 text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {uploadProgress[`${file.name}-${index}`] === 100 ? (
                    <span className="text-green-500 text-sm flex items-center">
                      <FiCheckCircle className="mr-1" /> Done
                    </span>
                  ) : uploadProgress[`${file.name}-${index}`] > 0 ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${uploadProgress[`${file.name}-${index}`]}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {uploadProgress[`${file.name}-${index}`]}%
                      </span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={Object.values(uploadProgress).some(p => p > 0 && p < 100)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <FiUpload className="h-4 w-4" />
              <span>Upload All</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
  