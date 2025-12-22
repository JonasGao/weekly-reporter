import { writable } from 'svelte/store';

// Configuration store
export const configs = writable([]);
export const currentConfigId = writable(null);

// Input data store
export const inputData = writable({
  lastWeekPlan: '',
  lastWeekWork: '',
  nextWeekPlan: '',
  additionalNotes: ''
});

// History store
export const history = writable([]);

// UI state stores
export const showConfigModal = writable(false);
export const showHistoryModal = writable(false);
export const showHistoryDetailModal = writable(false);
export const showLoading = writable(false);
export const loadingMessage = writable('正在生成周报...');

// Message stores
export const errorMessage = writable('');
export const successMessage = writable('');

// Result store
export const reportResult = writable('');
export const showResult = writable(false);
