import 'openai';

declare module 'openai' {
  export interface OpenAI {
    videos: {
      create(params: {
        model: string;
        prompt: string;
      }): Promise<VideoResponse>;
      
      createAndPoll(params: {
        model: string;
        prompt: string;
      }): Promise<VideoResponse>;
      
      retrieve(videoId: string): Promise<VideoResponse>;
      
      downloadContent(videoId: string): Promise<Response>;
    };
  }

  export interface VideoResponse {
    id: string;
    object: string;
    created_at: number;
    status: 'queued' | 'in_progress' | 'completed' | 'failed';
    model: string;
    progress?: number;
    seconds?: string;
    size?: string;
  }
}

