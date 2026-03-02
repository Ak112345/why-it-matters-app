"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useState } from "react";

export default function AuthTestPage() {
  const { data: session, status } = useSession();
  const [copied, setCopied] = useState(false);

  const refreshToken = (session as any)?.refreshToken;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "loading") {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">YouTube OAuth Setup</h1>
      
      {session ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 p-4 rounded">
            <p className="font-semibold">✅ Signed in as:</p>
            <p className="text-sm">{session.user?.email}</p>
            <p className="text-sm">{session.user?.name}</p>
          </div>

          {refreshToken && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="font-semibold mb-2">🔑 YouTube Refresh Token:</p>
              <p className="text-xs mb-2 text-gray-600">Copy this to your .env.local as YOUTUBE_REFRESH_TOKEN</p>
              <div className="bg-white p-3 rounded border border-gray-300 font-mono text-xs break-all mb-2">
                {refreshToken}
              </div>
              <button
                onClick={() => copyToClipboard(refreshToken)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                {copied ? "✓ Copied!" : "Copy Token"}
              </button>
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                <p className="font-semibold">Next steps:</p>
                <ol className="list-decimal ml-4 mt-1 space-y-1">
                  <li>Copy the token above</li>
                  <li>Open .env.local</li>
                  <li>Update: YOUTUBE_REFRESH_TOKEN="TOKEN_HERE"</li>
                  <li>Restart your dev server</li>
                  <li>Test publishing to YouTube</li>
                </ol>
              </div>
            </div>
          )}

          {!refreshToken && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
              <p className="font-semibold">⚠️ No refresh token found</p>
              <p className="text-sm mt-1">Sign out and sign in again to generate a fresh token</p>
            </div>
          )}
          
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 p-4 rounded">
            <p className="font-semibold mb-2">📝 Instructions:</p>
            <ol className="list-decimal ml-4 space-y-1 text-sm">
              <li>Click "Sign in with Google" below</li>
              <li>Choose your YouTube account</li>
              <li>Grant permissions for YouTube upload</li>
              <li>Copy the refresh token that appears</li>
              <li>Add it to your .env.local file</li>
            </ol>
          </div>
          
          <button
            onClick={() => signIn("google")}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Sign in with Google (YouTube)
          </button>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded">
        <h2 className="font-semibold mb-2">Session Data:</h2>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}
