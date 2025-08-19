interface ActivityMetadata {
  [key: string]: any;
}

/**
 * Logs user activity to the backend
 * @param page - The page or activity being performed (e.g., 'Chat', 'Document', 'Email')
 * @param metadata - Additional context about the activity
 */
export async function logActivity(page: string, metadata: ActivityMetadata = {}) {
  try {
    const activity = {
      page,
      timestamp: new Date().toISOString(),
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      metadata
    };

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Activity] ${page}`, activity);
    }

    const response = await fetch("http://localhost:8000/api/activity", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(activity),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      console.error(`Failed to log activity (${response.status}):`, error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export default logActivity;