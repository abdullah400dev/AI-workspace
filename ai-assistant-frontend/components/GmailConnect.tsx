'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Loader2, Mail, Check, X, RefreshCw } from 'lucide-react';

type GmailAccount = {
  email: string;
  is_active: boolean;
  scopes: string[];
};

interface GmailConnectProps {
  onClose: () => void;
}

export default function GmailConnect({ onClose }: GmailConnectProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get the current URL for OAuth redirect
  const getRedirectUri = () => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      const redirectUri = `${protocol}//${host}/dashboard`; // Redirect to dashboard after auth
      return encodeURIComponent(redirectUri);
    }
    return '';
  };

  // Fetch connected Gmail accounts
  const fetchConnectedAccounts = async () => {
    try {
      const response = await fetch('/api/emails/accounts');
      if (!response.ok) {
        throw new Error('Failed to fetch connected accounts');
      }
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Error fetching connected accounts:', err);
      setError('Failed to load connected accounts');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Handle Gmail connection
  const handleConnectGmail = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get the auth URL from the backend
      const redirectUri = getRedirectUri();
      const response = await fetch(`/api/emails/auth/url?redirect_uri=${redirectUri}`);
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      
      const { auth_url } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = auth_url;
      
    } catch (err) {
      console.error('Error initiating Gmail connection:', err);
      setError('Failed to connect to Gmail. Please try again.');
      setIsConnecting(false);
    }
  };

  // Handle account disconnection
  const handleDisconnect = async (email: string) => {
    if (window.confirm(`Are you sure you want to disconnect ${email}?`)) {
      try {
        const response = await fetch(`/api/emails/accounts/${encodeURIComponent(email)}/disconnect`, {
          method: 'POST',
        });
        
        if (!response.ok) {
          throw new Error('Failed to disconnect account');
        }
        
        // Refresh the accounts list
        await fetchConnectedAccounts();
        
      } catch (err) {
        console.error('Error disconnecting account:', err);
        setError('Failed to disconnect account');
      }
    }
  };

  // Handle refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConnectedAccounts();
  };

  // Initial load
  useEffect(() => {
    fetchConnectedAccounts();
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      const exchangeCode = async () => {
        try {
          const redirectUri = getRedirectUri();
          const response = await fetch(
            `/api/emails/auth/callback?code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`
          );
          
          if (!response.ok) {
            throw new Error('Authentication failed');
          }
          
          // Remove the code from URL
          window.history.replaceState({}, document.title, '/dashboard');
          
          // Refresh the accounts list
          await fetchConnectedAccounts();
          
        } catch (err) {
          console.error('Error during OAuth callback:', err);
          setError('Failed to complete authentication. Please try again.');
        }
      };
      
      exchangeCode();
    }
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Mail className="h-6 w-6 text-red-500" />
            <CardTitle>Gmail Integration</CardTitle>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="text-red-500 text-center py-4">{error}</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-600 mb-4">No Gmail accounts connected yet.</p>
            <Button 
              onClick={handleConnectGmail}
              disabled={isConnecting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="font-medium">Connected Accounts</h3>
            <div className="space-y-2">
              {accounts.map((account) => (
                <div 
                  key={account.email}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${account.is_active ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {account.is_active ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <X className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{account.email}</p>
                      <p className="text-sm text-gray-500">
                        {account.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDisconnect(account.email)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    Disconnect
                  </Button>
                </div>
              ))}
            </div>
            <div className="pt-4">
              <Button 
                onClick={handleConnectGmail}
                disabled={isConnecting}
                variant="outline"
                className="w-full"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Add Another Account
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="bg-gray-50 px-6 py-4 border-t">
        <p className="text-sm text-gray-500">
          Connecting your Gmail account allows you to search and analyze your emails.
          We only request read access to your emails and never modify them.
        </p>
      </CardFooter>
    </Card>
  );
}
