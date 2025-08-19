'use client';

import { useEffect, useState, useRef } from 'react';
import { RefreshCw, MessageSquare, FileText, Mail, Activity, AlertCircle, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Slider from 'react-slick';
import Link from 'next/link';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';

interface Activity {
  id: string;
  type: string;
  page: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export default function ActivityTimeline() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Add limit parameter to fetch only the last 5 activities
      const res = await fetch("http://localhost:8000/api/activity?limit=5");
      if (!res.ok) {
        throw new Error(`Failed to fetch activities: ${res.statusText}`);
      }
      const data = await res.json();
      // The backend should return the most recent activities first
      setActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const getActivityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'document':
      case 'documentpageview':
        return <FileText className="w-4 h-4 text-green-500" />;
      case 'email':
      case 'emailinboxview':
        return <Mail className="w-4 h-4 text-purple-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatActivityMessage = (activity: Activity) => {
    const { type, page } = activity;
    
    switch (type.toLowerCase()) {
      case 'chat':
        return 'Chat session';
      case 'documentpageview':
        return 'Viewed documents';
      case 'emailinboxview':
        return 'Checked emails';
      default:
        // Convert page name to readable format (e.g., 'documentPageView' -> 'Document Page View')
        return page
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
    }
  };

  // Map activity types to their respective routes
  const getActivityRoute = (activity: Activity) => {
    switch (activity.type?.toLowerCase()) {
      case 'chat':
        return '/chats';
      case 'document':
      case 'documentpageview':
        return '/documents';
      case 'email':
      case 'emailinboxview':
        return '/emails';
      default:
        return '/';
    }
  };
  
  // Get button text based on activity type
  const getButtonText = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'chat':
        return 'Open Chat';
      case 'document':
      case 'documentpageview':
        return 'View Documents';
      case 'email':
      case 'emailinboxview':
        return 'Check Emails';
      default:
        return 'View';
    }
  };

  // Slider settings
  const sliderRef = useRef<Slider>(null);
  
  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 1,
        }
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        }
      }
    ]
  };

  return (
    <div className="max-w-10xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>Last {activities.length} activities</span>
            <button
              onClick={fetchActivities}
              disabled={isLoading}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Refresh activities"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sliderRef.current?.slickPrev()}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Previous slide"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => sliderRef.current?.slickNext()}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Next slide"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No recent activities found
        </div>
      ) : (
        <div className="relative">
          <Slider ref={sliderRef} {...settings} className="pb-10">
            {activities.map((activity) => (
              <div key={activity.id} className="px-2 outline-none">
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all h-full">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      {getActivityIcon(activity.type || activity.page)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {formatActivityMessage(activity)}
                      </p>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                      <Link 
                        href={getActivityRoute(activity)}
                        className="mt-2 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      >
                        {getButtonText(activity.type)}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
          <style jsx global>{`
            .slick-dots {
              bottom: -10px;
            }
            .slick-dots li button:before {
              font-size: 10px;
              color: #9CA3AF;
              opacity: 0.5;
            }
            .slick-dots li.slick-active button:before {
              color: #3B82F6;
              opacity: 1;
            }
            .slick-prev:before, .slick-next:before {
              color: #6B7280;
            }
            .slick-track {
              display: flex;
              gap: 16px;
              margin-left: 0;
              margin-right: 0;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
