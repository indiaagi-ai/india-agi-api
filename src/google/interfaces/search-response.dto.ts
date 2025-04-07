export interface SearchResponse {
  items: Item[];
}

export interface Item {
  link: string;
  title: string;
  snippet: string;
  pagemap?: PageMap;
  content?: string;
}

export interface PageMap {
  metatags: MetaTag[];
}

export interface MetaTag {
  'og:title': string;
  'twitter:description': string;
}
