import { Item } from 'src/google/interfaces';
import { Provider } from 'src/llm/interfaces';

export interface DebateHistory {
  type: HistoryType;
  model: Provider;
  response?: string;
  internetSearch?: InternetSearch;
  roundNumber?: number;
}

export enum HistoryType {
  internetSearch = 'InternetSearch',
  textResponse = 'TextResponse',
  roundUpdate = 'RoundUpdate',
  providerUpdate = 'ProviderUpdate',
}

export interface InternetSearch {
  searchQuery: string;
  searchResponse: Item[];
}
