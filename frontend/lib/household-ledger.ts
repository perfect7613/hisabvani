'use client';

import { useSyncExternalStore } from 'react';

export type LedgerSource = 'voice' | 'bill';

export type LedgerTransaction = {
  id: string;
  date: string;
  amount: number;
  category: string;
  vendor: string;
  description: string;
  source: LedgerSource;
  transcript?: string;
  extractedText?: string;
  createdAt: string;
};

export type LedgerConversation = {
  id: string;
  question: string;
  answer: string;
  languageCode: string;
  model: string;
  createdAt: string;
};

export type HouseholdLedger = {
  version: 1;
  transactions: LedgerTransaction[];
  conversations: LedgerConversation[];
};

const STORAGE_KEY = 'hisabvani.household-ledger.v1';
const CHANGE_EVENT = 'hisabvani:ledger-change';
const EMPTY_LEDGER: HouseholdLedger = {
  version: 1,
  transactions: [],
  conversations: [],
};
let cachedRaw: string | null | undefined;
let cachedLedger: HouseholdLedger = EMPTY_LEDGER;

function isLedger(value: unknown): value is HouseholdLedger {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HouseholdLedger>;
  return candidate.version === 1
    && Array.isArray(candidate.transactions)
    && Array.isArray(candidate.conversations);
}

export function readHouseholdLedger(): HouseholdLedger {
  if (typeof window === 'undefined') return EMPTY_LEDGER;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === cachedRaw) return cachedLedger;
    cachedRaw = stored;
    if (!stored) {
      cachedLedger = EMPTY_LEDGER;
      return cachedLedger;
    }
    const parsed = JSON.parse(stored) as unknown;
    cachedLedger = isLedger(parsed) ? parsed : EMPTY_LEDGER;
    return cachedLedger;
  } catch {
    cachedLedger = EMPTY_LEDGER;
    return EMPTY_LEDGER;
  }
}

function writeHouseholdLedger(ledger: HouseholdLedger) {
  cachedLedger = ledger;
  cachedRaw = JSON.stringify(ledger);
  window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function useHouseholdLedger() {
  return useSyncExternalStore(subscribe, readHouseholdLedger, () => EMPTY_LEDGER);
}

export function addLedgerTransaction(transaction: LedgerTransaction) {
  const ledger = readHouseholdLedger();
  writeHouseholdLedger({
    ...ledger,
    transactions: [
      transaction,
      ...ledger.transactions.filter((item) => item.id !== transaction.id),
    ].slice(0, 100),
  });
}

export function addLedgerConversation(conversation: LedgerConversation) {
  const ledger = readHouseholdLedger();
  writeHouseholdLedger({
    ...ledger,
    conversations: [
      conversation,
      ...ledger.conversations.filter((item) => item.id !== conversation.id),
    ].slice(0, 50),
  });
}

export function clearHouseholdLedger() {
  if (typeof window === 'undefined') return;
  writeHouseholdLedger(EMPTY_LEDGER);
}

export function seedDemoHouseholdLedger() {
  const demoLedger: HouseholdLedger = {
    version: 1,
    transactions: [
      {
        id: 'demo-rent',
        date: '2026-06-02',
        amount: 18000,
        category: 'rent',
        vendor: 'Home',
        description: 'Monthly apartment rent',
        source: 'voice',
        transcript: 'Is mahine ka rent atharah hazaar diya',
        createdAt: '2026-06-02T09:30:00.000Z',
      },
      {
        id: 'demo-school',
        date: '2026-06-04',
        amount: 15000,
        category: 'education',
        vendor: 'Sunrise Public School',
        description: 'School fees for the new term',
        source: 'bill',
        extractedText: 'SCHOOL FEE RECEIPT · Total ₹15,000',
        createdAt: '2026-06-04T11:15:00.000Z',
      },
      {
        id: 'demo-groceries',
        date: '2026-06-07',
        amount: 4850,
        category: 'groceries',
        vendor: 'Local market',
        description: 'Weekly groceries and vegetables',
        source: 'bill',
        createdAt: '2026-06-07T18:20:00.000Z',
      },
      {
        id: 'demo-medical',
        date: '2026-06-09',
        amount: 3000,
        category: 'medical',
        vendor: 'Family clinic',
        description: 'Clinic consultation and medicines',
        source: 'voice',
        transcript: 'Doctor aur medicines pe teen hazaar hue',
        createdAt: '2026-06-09T13:05:00.000Z',
      },
      {
        id: 'demo-transport',
        date: '2026-06-11',
        amount: 2000,
        category: 'transport',
        vendor: '',
        description: 'Petrol and local travel',
        source: 'voice',
        transcript: 'Petrol aur auto mila ke do hazaar',
        createdAt: '2026-06-11T19:10:00.000Z',
      },
    ],
    conversations: [
      {
        id: 'demo-ask',
        question: 'Pichle mahine se kharcha kyun badha aur ₹5,000 kaise bacha sakte hain?',
        answer: 'Selected records show rent and education are the largest fixed costs. Review flexible grocery and transport spending weekly, and set aside ₹1,250 each week.',
        languageCode: 'hi-IN',
        model: 'sarvam-105b',
        createdAt: '2026-06-12T08:00:00.000Z',
      },
    ],
  };
  writeHouseholdLedger(demoLedger);
}

export function createLocalRecordId(prefix: 'voice' | 'bill' | 'ask') {
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${suffix}`;
}
