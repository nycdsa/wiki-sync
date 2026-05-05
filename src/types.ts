export type PullOptions = {
  useCase: string;
  out: string;
  host: string;
  token?: string;
  dokuwikiRoot?: string;
  wikiConfRoot?: string;
  apiUser: string;
  enableApiTemp: boolean;
  verbose: boolean;
};

export type ExtractionResult = {
  source: "jsonrpc" | "raw";
  pageId: string;
  data: unknown;
};

export type NormalizedOutput = {
  sourceUrl: string;
  pageId: string;
  extractedVia: "jsonrpc" | "raw";
  extractedAt: string;
  payload: unknown;
};

export type WorkingGroupPrimaryCta = {
  url: string;
  label: string;
};

export type WorkingGroupSecondaryCta = {
  url: string;
  label: string;
};

export type WorkingGroupCard = {
  pageId: string;
  name: string;
  description: string;
  status: string;
  email: string;
  website: string;
  linktree: string;
  instagram: string;
  imageUrl: string | null;
  primaryCta: WorkingGroupPrimaryCta | null;
  secondaryCtas: WorkingGroupSecondaryCta[];
};

export type WorkingGroupsResponse = {
  version: number;
  fetchedAt: string;
  groups: WorkingGroupCard[];
};
