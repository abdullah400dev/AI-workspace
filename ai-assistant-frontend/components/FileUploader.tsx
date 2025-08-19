import React, { useCallback } from 'react';

const FileUploader = ({ onFileSelect }: { onFileSelect: (file: File) => void }) => {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  }, [onFileSelect]);

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
      <input
        type="file"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
        accept=".pdf,.txt,.md"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer text-blue-600 hover:text-blue-800"
      >
        Click to upload a file or drag and drop
      </label>
      <p className="text-sm text-gray-500 mt-2">
        PDF, TXT, or MD files (max 10MB)
      </p>
    </div>
  );
};

export default FileUploader;
