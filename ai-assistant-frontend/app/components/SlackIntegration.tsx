'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function SlackIntegration() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  useEffect(() => {
    checkSlackConnection();
  }, []);

  const checkSlackConnection = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/slack/status');
      const data = await response.json();
      setIsConnected(data.connected);
    } catch (error) {
      console.error('Error checking Slack connection:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const response = await fetch('http://localhost:8000/api/slack/connect');
      const data = await response.json();
      
      if (data.auth_url) {
        // Open the Slack OAuth URL in a new window
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        window.open(
          data.auth_url,
          'slack-auth',
          `width=${width},height=${height},top=${top},left=${left}`
        );
        
        // Poll for connection status after a short delay
        setTimeout(checkSlackConnection, 3000);
      }
    } catch (error) {
      console.error('Error connecting Slack:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Icons.spinner className="h-4 w-4 animate-spin" />
        <span>Checking Slack connection...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icons.slack className="h-5 w-5 text-purple-500" />
          <span className="font-medium">Slack Integration</span>
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <div className="flex items-center text-sm text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2"></span>
              Connected
            </div>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              variant="outline"
              className="flex items-center space-x-2"
            >
              {isConnecting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.slack className="h-4 w-4" />
              )}
              <span>{isConnecting ? 'Connecting...' : 'Connect Slack'}</span>
            </Button>
          )}
        </div>
      </div>
      
      {isConnected && (
        <div className="mt-2 text-sm text-gray-400">
          <p>Documents shared in Slack will be automatically saved to your knowledge base.</p>
        </div>
      )}
    </div>
  );
}
