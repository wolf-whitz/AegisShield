export interface ModerationResult {
  flagged: boolean;
  categories: {
    sexual: boolean;
    hate: boolean;
    harassment: boolean;
    selfHarm: boolean;
    sexualMinors: boolean;
    hateThreatening: boolean;
    violenceGraphic: boolean;
    selfHarmIntent: boolean;
    selfHarmInstructions: boolean;
    harassmentThreatening: boolean;
    violence: boolean;
  };
  categoryScores: {
    sexual: number;
    hate: number;
    harassment: number;
    selfHarm: number;
    sexualMinors: number;
    hateThreatening: number;
    violenceGraphic: number;
    selfHarmIntent: number;
    selfHarmInstructions: number;
    harassmentThreatening: number;
    violence: number;
  };
}

export interface QueuedMessage {
  id: string;
  userId: string;
  username: string;
  content: string;
  channelId: string;
  guildId: string;
  timestamp: number;
  messageId: string;
}

export interface BatchModerationResult {
  messageId: string;
  userId: string;
  result: ModerationResult;
  actionTaken: 'none' | 'deleted' | 'warned' | 'timeout';
}

export interface SwearWordCache {
  word: string;
  severity: 'low' | 'medium' | 'high';
  addedAt: number;
}