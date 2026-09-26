'use client';

import React from 'react';

export function VideoStudio() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          AI Video Studio
        </h1>
        <p className="mt-4 text-gray-400">Your AI-powered video creation platform</p>
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-sm text-gray-300">
            🎬 Ready to create amazing videos with AI
          </p>
        </div>
      </div>
    </div>
  );
}