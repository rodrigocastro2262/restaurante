import { useState, useEffect } from 'react';

export function useSSE(url: string, onUpdate: () => void) {
  useEffect(() => {
    const eventSource = new EventSource(url);
    
    eventSource.onmessage = (event) => {
      if (event.data === 'update') {
        onUpdate();
      }
    };

    return () => {
      eventSource.close();
    };
  }, [url, onUpdate]);
}
