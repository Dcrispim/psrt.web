export const LOGGER_STORAGE_KEY = 'logger/history';

export type LoggerHistory = Record<string, Record<string, object>>;

export function getLoggerHistory(): LoggerHistory {
  try {
    const historyRaw = localStorage.getItem(LOGGER_STORAGE_KEY) ?? '{}';
    return JSON.parse(historyRaw) as LoggerHistory;
  } catch {
    return {};
  }
}

export function clearLoggerHistory(): void {
  localStorage.removeItem(LOGGER_STORAGE_KEY);
}

export const logger = (local: string, err: object) => {
  try {
    const history = getLoggerHistory();

    if (!history[local]) {
      history[local] = {};
    }
    history[local][Date.now().toString()] = err;

    localStorage.setItem(LOGGER_STORAGE_KEY, JSON.stringify(history));
  } catch {
    return;
  }
};
