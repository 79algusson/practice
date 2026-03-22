import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ApiKeyContextValue {
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

const SESSION_KEY = 'gemini_api_key';

const ApiKeyContext = createContext<ApiKeyContextValue | null>(null);

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState<string>(
    () => sessionStorage.getItem(SESSION_KEY) ?? '',
  );

  function setApiKey(key: string) {
    sessionStorage.setItem(SESSION_KEY, key);
    setApiKeyState(key);
  }

  function clearApiKey() {
    sessionStorage.removeItem(SESSION_KEY);
    setApiKeyState('');
  }

  return (
    <ApiKeyContext.Provider value={{ apiKey, setApiKey, clearApiKey }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey(): ApiKeyContextValue {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used inside ApiKeyProvider');
  return ctx;
}

export async function generateGeminiImage(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `API 오류: ${response.status}`);
  }

  const data = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }>;
  };

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData != null);

  if (!imagePart?.inlineData) {
    throw new Error('이미지를 찾을 수 없습니다. 다시 시도해주세요.');
  }

  const { mimeType, data: b64 } = imagePart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}
