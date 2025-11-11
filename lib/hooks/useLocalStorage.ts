export function useLocalStorage() {
  const saveVideoIdToLocalStorage = (videoId: string, prompt: string) => {
    try {
      const savedIds = JSON.parse(localStorage.getItem('sora_video_ids') || '[]');
      const newEntry = {
        video_id: videoId,
        prompt: prompt,
        saved_at: Date.now(),
      };
      savedIds.unshift(newEntry);
      localStorage.setItem('sora_video_ids', JSON.stringify(savedIds));
    } catch (error) {
      console.error('Failed to save video ID to localStorage:', error);
    }
  };

  const getVideoIdsFromLocalStorage = (): Array<{ video_id: string; prompt: string; saved_at: number }> => {
    try {
      return JSON.parse(localStorage.getItem('sora_video_ids') || '[]');
    } catch (error) {
      console.error('Failed to get video IDs from localStorage:', error);
      return [];
    }
  };

  return {
    saveVideoIdToLocalStorage,
    getVideoIdsFromLocalStorage,
  };
}


