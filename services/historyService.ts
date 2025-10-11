import type { HistoryEntry } from '../types';

const HISTORY_STORAGE_KEY = 'exportAdvisorHistory';

export const loadHistory = (): HistoryEntry[] => {
  try {
    const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (storedHistory) {
      return JSON.parse(storedHistory);
    }
  } catch (error) {
    console.error("Failed to load history from localStorage:", error);
  }
  return [];
};

export const saveHistory = (history: HistoryEntry[]): void => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save history to localStorage:", error);
  }
};

export const clearHistory = (): void => {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear history from localStorage:", error);
  }
};
