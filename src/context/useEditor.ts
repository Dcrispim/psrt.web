import { useContext } from 'react';
import { EditorContext, type EditorContextValue } from './EditorContext';
import { logger } from '../api/logger';

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    logger('editor', {
      error: 'useEditor must be used within EditorProvider',
    });
    throw new Error('useEditor must be used within EditorProvider');
  }
  return ctx;
}
