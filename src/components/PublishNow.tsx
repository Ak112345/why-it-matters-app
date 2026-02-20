/**
 * PublishNow Component
 * Manual trigger for immediate publishing of due posts
 */
'use client';

import { useState } from 'react';

export function PublishNow() {
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handlePublish = async () => {
    setPublishing(true);
    setResult(null);
    
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Publish all due posts
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data.message);
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setPublishing(false);
      
      // Clear result after 5 seconds
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handlePublish}
        disabled={publishing}
        className={`px-4 py-2 rounded font-medium transition-colors ${
          publishing
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {publishing ? 'Publishing...' : '▶ Publish Due Posts Now'}
      </button>
      
      {result && (
        <span className={`text-sm ${result.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {result}
        </span>
      )}
    </div>
  );
}
