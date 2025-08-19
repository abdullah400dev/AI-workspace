'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { FiMoon, FiSun } from 'react-icons/fi';
import '../styles/globals.css';
import Sidebar from '../components/Sidebar';

const ThemeToggle = () => {
  const { theme, toggleTheme } = React.useContext(ThemeContext);
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 p-3 rounded-full bg-background shadow-lg z-50
                 text-foreground hover:bg-accent hover:text-accent-foreground
                 transition-all duration-300 hover:scale-110"
      aria-label="Toggle dark mode"
    >
      {isDark ? <FiSun size={20} /> : <FiMoon size={20} />}
    </button>
  );
};

// Create a ThemeProvider context
const ThemeProvider = ({ children, defaultTheme = 'light' }: { children: React.ReactNode, defaultTheme?: 'light' | 'dark' }) => {
  const [theme, setTheme] = useState(defaultTheme);

  useEffect(() => {
    // Check for saved theme preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Create a ThemeContext
export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className="min-h-full bg-background text-foreground transition-colors duration-200">
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden bg-background">
            {/* Sidebar */}
            <Sidebar />
            
            {/* Main content */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-background text-foreground">
              <div className="min-h-full bg-background">
                {children}
              </div>
            </main>
            
            <ThemeToggle />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}