import { NextResponse } from 'next/server';

// This is a temporary in-memory store for demo purposes
// In production, you should use a database to store the connection status
let isConnected = false;

export async function GET() {
  // In a real app, you would check the actual connection status from your backend
  return NextResponse.json({ connected: isConnected });
}

export async function POST() {
  // This would be called when initiating the OAuth flow
  const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
  
  try {
    const response = await fetch(`${backendUrl}/api/slack/connect`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to connect to Slack');
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error connecting to Slack:', error);
    return NextResponse.json(
      { error: 'Failed to connect to Slack' },
      { status: 500 }
    );
  }
}
