import { Item } from 'src/google/interfaces';
import { Provider } from 'src/llm/interfaces';

export interface DebateHistory {
  type: HistoryType;
  model: Provider;
  response?: string;
  internetSearch?: InternetSearch;
}

export enum HistoryType {
  internetSearch = 'InternetSearch',
  textResponse = 'TextResponse',
}

export interface InternetSearch {
  searchQuery: string;
  searchResponse: Item[];
}
