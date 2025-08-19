import { useState, useEffect } from 'react';
import { FaGoogle, FaSlack, FaEnvelope, FaCheck, FaCalendarAlt, FaTasks } from 'react-icons/fa';

const checkSlackConnection = async () => {
  try {
    const response = await fetch('/api/slack/status');
    const data = await response.json();
    return data.connected || false;
  } catch (error) {
    console.error('Error checking Slack connection:', error);
    return false;
  }
};

export default function ConnectApps() {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSlackConnected, setIsSlackConnected] = useState(false);
  const [emails, setEmails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const connected = await checkSlackConnection();
      setIsSlackConnected(connected);
    };
    checkConnection();
  }, []);

  const handleConnectSlack = async () => {
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
        
        const authWindow = window.open(
          data.auth_url,
          'slack-auth',
          `width=${width},height=${height},top=${top},left=${left}`
        );
        
        // Poll for connection status after a short delay
        const checkConnection = setInterval(async () => {
          if (authWindow?.closed) {
            clearInterval(checkConnection);
            const connected = await checkSlackConnection();
            setIsSlackConnected(connected);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error connecting Slack:', error);
      setError('Failed to connect to Slack. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const apps = [
    { 
      name: 'Google Drive', 
      icon: <FaGoogle />,
      onClick: () => {},
      isConnected: false,
      isConnecting: false
    },
    { 
      name: 'Slack', 
      icon: <FaSlack />,
      onClick: handleConnectSlack,
      isConnected: isSlackConnected,
      isConnecting: isConnecting
    },
    { 
      name: 'Gmail', 
      icon: <FaEnvelope />,
      isConnected: false,
      isConnecting: false,
      onClick: async () => {
        try {
          setIsLoading(true);
          setError(null);
          const response = await fetch('http://localhost:8000/api/search/emails?query=&limit=100&days=0');
          if (!response.ok) {
            throw new Error('Failed to fetch emails');
          }
          const data = await response.json();
          setEmails(data.emails || []);
          console.log('Fetched emails:', data.emails);
          alert(`Successfully fetched ${data.count} emails`);
        } catch (err) {
          console.error('Error fetching emails:', err);
          setError('Failed to fetch emails. Please try again.');
          alert('Failed to fetch emails. Please check console for details.');
        } finally {
          setIsLoading(false);
        }
      }
    },
    { 
      name: 'ClickUp', 
      icon: <FaTasks />,
      onClick: () => {},
      isConnected: false,
      isConnecting: false
    },
    { 
      name: 'Calendar', 
      icon: <FaCalendarAlt />,
      onClick: () => {},
      isConnected: false,
      isConnecting: false
    },
  ];

  return (
    <div className="max-w-4xl mx-auto text-center py-12">
      <h2 className="text-2xl font-semibold mb-4 dark:text-white text-black">Connect Your Tools</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {apps.map((app, index) => (
          <div 
            key={index} 
            className={`flex items-center p-4 border rounded-lg ${!app.isConnected ? 'hover:bg-gray-800 cursor-pointer' : ''} ${app.isConnecting ? 'opacity-70' : ''}`} 
            onClick={!app.isConnected ? app.onClick : undefined}
          >
            <div className={`p-2 rounded-full ${app.isConnected ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
              {app.isConnected ? <FaCheck /> : app.icon}
            </div>
            {/* <div>
              <div className="flex items-center">
                <h3 className="font-medium">{app.name}</h3>
                {app.isConnected && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Connected</span>}
                {app.isConnecting && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Connecting...</span>}
              </div>
              <p className="text-sm text-gray-500">
                {app.isConnected ? 'Connected successfully' : 'Click to connect'}
              </p>
            </div> */}
          </div>
        ))}
      </div>
    </div>
  );
}
