/** HTTP contract for psrt-web-connector — see docs/07-ferramentas/psrt-web-connector-api.md */

export const DEFAULT_CONNECTOR_URL = 'http://127.0.0.1:5278';

export interface HealthResponse {
  status: string;
  version: string;
}

export interface PairRequest {
  code: string;
}

export interface PairResponse {
  token: string;
}

export interface ConnectorConfigResponse {
  base_dir: string;
  allowed_origin: string;
  port: number;
  config_path: string;
  port_restart_required: boolean;
}

export interface ConnectorConfigUpdate {
  base_dir?: string;
  allowed_origin?: string;
}

export interface AssetURIRequest {
  url: string;
}

export interface AssetURIResponse {
  uri: string;
}

export interface ParsePsrtRequest {
  text: string;
}

export interface ParsePsrtResponse {
  document: string;
}

export interface FormatDocRequest {
  docJSON: string;
}

export interface FormatDocResponse {
  text: string;
}

export interface FormatPageRequest {
  docJSON: string;
  pageName: string;
}

export interface MergePageRequest {
  fullDocJSON: string;
  pageName: string;
  psrtText: string;
}

export interface MergePageResponse {
  document: string;
}

export interface CompilePageRequest {
  docJSON: string;
  pageName: string;
}

export interface CompileSvgResponse {
  uri: string;
  usedGoTextFallback: boolean;
}

export interface CompileHtmlResponse {
  uri: string;
}

export interface AdaptEntriesRequest {
  entriesJSON: string;
  canvasW: number;
  canvasH: number;
  zoom: number;
}

export interface ApiError {
  error: string;
}

export interface LibraryProject {
  path: string;
  title: string;
  pageCount: number;
  modifiedAt: string;
}

export interface LibraryProjectsResponse {
  projects: LibraryProject[];
}
