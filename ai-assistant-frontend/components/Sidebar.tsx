'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { navigation } from '../config/navigation';
import { ThemeContext } from '../app/layout';
import { useContext } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the SlackIntegration component to avoid SSR issues
const SlackIntegration = dynamic<{}>(
  () => import('./SlackIntegration').then(mod => mod.default),
  { 
    ssr: false, 
    loading: () => <div className="text-sm text-gray-500 dark:text-gray-400">Loading Slack integration...</div>
  }
);

const Sidebar = () => {
  const pathname = usePathname();
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const router = useRouter();

  return (
    <div className={`w-64 h-screen p-4 flex flex-col border-r ${
      isDark ? 'bg-gray-900 border-gray-800' : 'bg-gray-50 border-gray-200'
    }`}>
      <h1
      onClick={() => router.push('/dashboard')}
      className={`text-2xl font-bold mb-8 px-2 cursor-pointer ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}
    >
      AI Assistant
    </h1>
      <nav className="flex-1">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                    isActive
                      ? isDark 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-gray-100 text-gray-900'
                      : isDark
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="truncate">{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        
        {/* Slack Integration */}
        {/* <div className="mt-8 pt-4 border-t border-gray-700">
          <div className="px-2 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Integrations
          </div>
          <div className="px-2">
            <SlackIntegration />
          </div>
        </div> */}
      </nav>
    </div>
  );
};

export default Sidebar;
