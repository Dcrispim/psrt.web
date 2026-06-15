import type { PsrtDocument } from '../types/document';

let serialize: (doc: PsrtDocument) => string = (doc) => JSON.stringify(doc);

export function registerEditorApiJsonSerializer(fn: (doc: PsrtDocument) => string): void {
  serialize = fn;
}

export function editorApiJson(doc: PsrtDocument): string {
  return serialize(doc);
}
