'use client';

import { useState } from 'react';
import { FiSearch, FiFilter, FiCalendar, FiUser, FiClock, FiMessageSquare, FiFile,FiUpload, FiMail, FiExternalLink } from 'react-icons/fi';

const people = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
const sources = ['Slack', 'Email', 'Google Drive', 'Uploads'];
const resultTypes = ['Messages', 'Documents', 'Meetings', 'Tasks'];

const searchResults = [
  {
    id: 1,
    title: 'Q3 Budget Discussion',
    preview: 'Alice mentioned that we need to allocate more budget for marketing in Q3 to support the new product launch.',
    source: 'Slack',
    type: 'message',
    date: '2025-07-20',
    author: 'Alice',
    relevance: 0.95,
    url: '#'
  },
  {
    id: 2,
    title: 'Q3 Budget Planning.docx',
    preview: 'The attached document contains the preliminary budget planning for Q3 2025, including marketing allocations and projected ROI.',
    source: 'Google Drive',
    type: 'document',
    date: '2025-07-18',
    author: 'Bob',
    relevance: 0.87,
    url: '#'
  },
  {
    id: 3,
    title: 'Weekly Team Sync - July 15',
    preview: 'In today\'s meeting, we discussed the Q3 budget priorities and marketing strategy. Alice will follow up with the marketing team.',
    source: 'Google Meet',
    type: 'meeting',
    date: '2025-07-15',
    author: 'Charlie',
    relevance: 0.82,
    url: '#'
  }
];

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    people: [] as string[],
    sources: [] as string[],
    types: [] as string[],
  });

  const toggleFilter = (type: 'people' | 'sources' | 'types', value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value)
        ? prev[type].filter(item => item !== value)
        : [...prev[type], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      people: [],
      sources: [],
      types: [],
    });
  };

  const activeFilterCount = [
    filters.dateFrom || filters.dateTo,
    ...filters.people,
    ...filters.sources,
    ...filters.types,
  ].filter(Boolean).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Semantic Search</h1>
        <p className="text-gray-600">Search across all your connected apps and documents using natural language</p>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="E.g., What did Alice say about the Q3 budget?"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm ${activeFilterCount > 0 ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          <FiFilter className="h-4 w-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900">Filters</h3>
            <button 
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear all
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* People */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">People</label>
              <div className="flex flex-wrap gap-2">
                {people.map(person => (
                  <button
                    key={person}
                    onClick={() => toggleFilter('people', person)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      filters.people.includes(person)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    <FiUser className="mr-1 h-3 w-3" />
                    {person}
                  </button>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sources</label>
              <div className="flex flex-wrap gap-2">
                {sources.map(source => (
                  <button
                    key={source}
                    onClick={() => toggleFilter('sources', source)}
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      filters.sources.includes(source)
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {source === 'Slack' && <FiMessageSquare className="mr-1 h-3 w-3" />}
                    {source === 'Email' && <FiMail className="mr-1 h-3 w-3" />}
                    {source === 'Google Drive' && <FiFile className="mr-1 h-3 w-3" />}
                    {source === 'Uploads' && <FiUpload className="mr-1 h-3 w-3" />}
                    {source}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="space-y-4">
        {searchResults.map((result) => (
          <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">{result.title}</h3>
                <p className="text-gray-600 mb-3">{result.preview}</p>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span className="inline-flex items-center">
                    <FiUser className="mr-1 h-4 w-4" />
                    {result.author}
                  </span>
                  <span className="inline-flex items-center">
                    {result.type === 'message' && <FiMessageSquare className="mr-1 h-4 w-4" />}
                    {result.type === 'document' && <FiFile className="mr-1 h-4 w-4" />}
                    {result.type === 'meeting' && <FiCalendar className="mr-1 h-4 w-4" />}
                    {result.source}
                  </span>
                  <span className="inline-flex items-center">
                    <FiClock className="mr-1 h-4 w-4" />
                    {new Date(result.date).toLocaleDateString()}
                  </span>
                  <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {Math.round(result.relevance * 100)}% match
                  </span>
                </div>
              </div>
              <a 
                href={result.url} 
                className="text-blue-600 hover:text-blue-800 p-1 -m-1"
                onClick={(e) => {
                  e.preventDefault();
                  // Handle view action
                }}
              >
                <FiExternalLink className="h-5 w-5" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {searchResults.length === 0 && (
        <div className="text-center py-12">
          <FiSearch className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
}
  