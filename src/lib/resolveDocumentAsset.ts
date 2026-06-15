import { getActiveConsts } from '../api/connectorConfig';

let activeConsts: Record<string, string> | undefined;

export function setActiveDocumentConsts(consts?: Record<string, string>): void {
  activeConsts = consts;
}

export function getMergedDocumentConsts(consts?: Record<string, string>): Record<string, string> {
  return { ...(consts ?? activeConsts ?? {}), ...getActiveConsts() };
}
