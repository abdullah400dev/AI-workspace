
"use client";
import { FiSearch, FiUpload, FiClock, FiMessageSquare, FiCalendar, FiMail, FiPlus, FiFileText, FiExternalLink } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchDocuments } from '../services/documentService';
import ConnectApps from './ConnectApps';
import UploadArea from './UploadArea';
import ActivityTimeline from './ActivityTimeline';
import GmailConnect from './GmailConnect';

import { Document } from '../services/documentService';

const Dashboard = () => {
  const [showGmailConnect, setShowGmailConnect] = useState(false);
  const [recentDocuments, setRecentDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [connectedApps, setConnectedApps] = useState([
    { name: 'Slack', icon: <FiMessageSquare className="text-purple-600" />, connected: true },
    { 
      name: 'Gmail', 
      icon: <FiMail className="text-red-500" />, 
      connected: true,
      onConnect: () => setShowGmailConnect(true)
    },
    { name: 'Google Calendar', icon: <FiCalendar className="text-blue-500" />, connected: false },
  ]);

  const recentActivity = [
    { id: 1, type: 'meeting', title: 'Team Sync', date: '2025-07-20', participants: 5 },
    { id: 2, type: 'document', title: 'Q3 Roadmap.pdf', date: '2025-07-19', size: '2.4 MB' },
    { id: 3, type: 'message', title: 'Project Update Discussion', date: '2025-07-18', source: 'Slack' },
  ];

  useEffect(() => {
    const fetchRecentDocuments = async () => {
      try {
        const docs = await fetchDocuments(3);
        console.log('Dashboard - Fetched documents:', docs);
        setRecentDocuments(docs);
      } catch (error) {
        console.error('Error fetching recent documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentDocuments();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-white">Team Workspace</h1>
        {/* <div className="flex space-x-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <FiUpload className="inline mr-2" />
            Upload
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Connect Apps
          </button>
        </div> */}
      </div>

      {/* Search Bar */}
      {/* <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Search across all your team's knowledge..."
        />
      </div> */}

      {/* Connected Apps */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-white">Connected Apps</h2>
          {/* <button 
            className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            onClick={() => setShowGmailConnect(true)}
          >
            <FiPlus className="h-4 w-4 mr-1" />
            Add Account
          </button> */}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {connectedApps.map((app, index) => (
            <div 
              key={index} 
              className="bg-gray-800 w-[15vw] p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={app.onConnect}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {app.icon}
                  </div>
                  <span className="font-medium text-white">{app.name}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${app.connected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                  {app.connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
              {!app.connected && (
                <button 
                  className="mt-3 w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    app.onConnect?.();
                  }}
                >
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Gmail Connect Modal */}
      {showGmailConnect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <GmailConnect onClose={() => setShowGmailConnect(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Quick Upload */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-white mb-4">Quick Upload</h2>
        <UploadArea />
      </div>

      {/* Activity Timeline */}
      <div className="mb-8">
        <ActivityTimeline />
      </div>

      {/* Recent Documents */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Documents</h2>
          <Link href="/documents" className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
            View all
          </Link>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 animate-pulse h-32">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : recentDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recentDocuments.map((doc) => {
              const fileExt = doc.metadata?.source?.split('.').pop()?.toUpperCase() || 'FILE';
              const fileSize = formatFileSize(doc.size_bytes || 0);
              const lastModified = formatDate(doc.last_modified || new Date().toISOString());
              
              return (
                <div key={doc.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mr-3">
                        <FiFileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1" title={doc.name}>
                          {doc.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{fileExt} • {fileSize}</p>
                      </div>
                    </div>
                    <Link 
                      href={`/documents?highlight=${encodeURIComponent(doc.name || '')}`}
                      onClick={() => console.log('Dashboard - Navigating to document with name:', doc.name)}
                      className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="View document"
                    >
                      <FiExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2 mt-2">
                    <span>{lastModified}</span>
                    <Link 
                      href={`/documents?highlight=${encodeURIComponent(doc.name || '')}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs font-medium flex items-center"
                    >
                      View document
                      <FiExternalLink className="ml-1 w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 text-center">
            <FiFileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">No documents uploaded yet</p>
            <Link 
              href="/documents" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium mt-2"
            >
              Upload your first document
              <FiExternalLink className="ml-1 w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

    
    </div>
  );
};

export default Dashboard;
