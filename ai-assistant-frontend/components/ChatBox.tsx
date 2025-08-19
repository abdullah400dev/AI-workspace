import React from 'react';

const ChatBox = () => {
  return (
    <div className="flex-1 p-4 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        {/* Chat messages will be rendered here */}
        <div className="text-center text-gray-500 mt-8">
          Start a conversation with your AI assistant
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
