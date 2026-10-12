/**
 * Autotask API Mocks
 * Provides controlled mock responses for Autotask endpoints.
 */
import axios from 'axios';

export interface MockAutotaskTicket {
  id: number;
  ticketNumber: string;
  title: string;
  status: number;
  statusType?: number;
  accountID?: number;
  queueID?: number;
  priority?: number;
  category?: string;
  subIssueType?: string;
  issueType?: string;
  createdDate?: string;
  lastActivityDate?: string;
}

export interface MockAutotaskNote {
  id: number;
  ticketId: number;
  title: string;
  description: string;
  createdDate: string;
  createdByResourceID: number;
  isInternal?: boolean;
}

export interface MockAutotaskResponse<T> {
  items: T[];
  pageDetails: {
    count: number;
  };
}

const defaultTickets: MockAutotaskTicket[] = [
  { id: 1001, ticketNumber: 'T20260907.0001', title: 'Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - D', status: 5 },
  { id: 1002, ticketNumber: 'T20260907.0002', title: 'Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - E', status: 1 },
  { id: 1003, ticketNumber: 'T20260907.0003', title: 'Volume Exclusion Detected - FIF-DATTO-01 - DC-01 - D', status: 1 },
];

const defaultNotes: MockAutotaskNote[] = [];

let tickets = [...defaultTickets];
let notes = [...defaultNotes];
let nextTicketId = 2000;
let nextNoteId = 500;

export function resetAutotaskMocks() {
  tickets = [...defaultTickets];
  notes = [...defaultNotes];
  nextTicketId = 2000;
  nextNoteId = 500;
}

export function setMockTickets(newTickets: MockAutotaskTicket[]) {
  tickets = newTickets;
}

export function setMockNotes(newNotes: MockAutotaskNote[]) {
  notes = newNotes;
}

export function getMockTickets(): MockAutotaskTicket[] {
  return [...tickets];
}

export function getMockNotes(): MockAutotaskNote[] {
  return [...notes];
}

export function createAutotaskMock(baseURL?: string) {
  const mock = {
    get: async (url: string, config?: any) => {
      const params = config?.params || {};

      // Query tickets by ticket number
      if (url.includes('/Tickets/query') || url.includes('/Tickets') && params['$filter']?.includes('TicketNumber')) {
        const ticketNum = params['$filter']?.match(/TicketNumber eq '([^']+)'/)?.[1];
        if (ticketNum) {
          const found = tickets.find(t => t.ticketNumber === ticketNum);
          return { data: { items: found ? [found] : [], pageDetails: { count: found ? 1 : 0 } } };
        }
        return { data: { items: tickets, pageDetails: { count: tickets.length } } };
      }

      // Query tickets by ID
      if (url.includes('/Tickets/') && !url.includes('/Notes') && !url.includes('/query')) {
        const idMatch = url.match(/\/Tickets\/(\d+)/);
        if (idMatch) {
          const id = parseInt(idMatch[1]);
          const found = tickets.find(t => t.id === id);
          if (found) return { data: found };
          throw { response: { status: 404 } };
        }
      }

      // Query notes for a ticket
      if (url.includes('/Tickets/') && url.includes('/Notes')) {
        const idMatch = url.match(/\/Tickets\/(\d+)\/Notes/);
        if (idMatch) {
          const ticketId = parseInt(idMatch[1]);
          const ticketNotes = notes.filter(n => n.ticketId === ticketId);
          return { data: { items: ticketNotes, pageDetails: { count: ticketNotes.length } } };
        }
      }

      // Query ticket metadata (fields, picklists) - for BW-004 gateway
      if (url.includes('/Tickets/fields') || url.includes('/EntityFields')) {
        return {
          data: {
            items: [
              { name: 'status', picklist: { id: 1, values: [{ value: 1, label: 'New' }, { value: 5, label: 'Completed' }, { value: 6, label: 'Cancelled' }] } },
              { name: 'priority', picklist: { id: 2, values: [{ value: 1, label: 'Critical' }, { value: 2, label: 'High' }] } },
              { name: 'queueID', picklist: { id: 3, values: [{ value: 1, label: 'Tier 1' }, { value: 2, label: 'Tier 2' }] } },
            ],
            pageDetails: { count: 3 }
          }
        };
      }

      // Default: return empty
      return { data: { items: [], pageDetails: { count: 0 } } };
    },

    post: async (url: string, data?: any) => {
      // Create ticket
      if (url.includes('/Tickets') && !url.includes('/Notes')) {
        const newTicket: MockAutotaskTicket = {
          id: ++nextTicketId,
          ticketNumber: `T2026${String(nextTicketId).padStart(4, '0')}.0001`,
          title: data.title || 'Created by Test',
          status: 1,
          queueID: data.queueID || 1,
          priority: data.priority || 2,
          category: data.category || 'Service Request',
          subIssueType: data.subIssueType || 'Backup',
          issueType: data.issueType || 'Monitoring',
          createdDate: new Date().toISOString(),
        };
        tickets.push(newTicket);
        return { data: newTicket };
      }

      // Create note
      if (url.includes('/Notes')) {
        const ticketIdMatch = url.match(/\/Tickets\/(\d+)\/Notes/);
        if (ticketIdMatch) {
          const ticketId = parseInt(ticketIdMatch[1]);
          const newNote: MockAutotaskNote = {
            id: ++nextNoteId,
            ticketId,
            title: data.title || 'Note',
            description: data.description || '',
            createdDate: new Date().toISOString(),
            createdByResourceID: 1,
          };
          notes.push(newNote);
          return { data: newNote };
        }
      }

      throw new Error(`Mock POST not implemented for ${url}`);
    },

    patch: async (url: string, data?: any) => {
      // Update ticket (e.g., status change)
      if (url.includes('/Tickets/') && !url.includes('/Notes')) {
        const idMatch = url.match(/\/Tickets\/(\d+)/);
        if (idMatch) {
          const id = parseInt(idMatch[1]);
          const idx = tickets.findIndex(t => t.id === id);
          if (idx >= 0) {
            tickets[idx] = { ...tickets[idx], ...data };
            return { data: tickets[idx] };
          }
          throw { response: { status: 404 } };
        }
      }
      throw new Error(`Mock PATCH not implemented for ${url}`);
    },
  };

  return mock;
}

/**
 * Routes a jest-mocked axios (from `jest.mock('axios')` in the test file) to this in-memory mock.
 * Production modules import axios directly, so this is the only way to intercept their calls.
 */
export function installAutotaskMock(mockedAxios: jest.Mocked<typeof axios>, baseURL?: string) {
  const mock = createAutotaskMock(baseURL) as any;
  for (const method of ['get', 'post', 'patch'] as const) {
    if (mock[method]) (mockedAxios[method] as jest.Mock).mockImplementation(mock[method]);
  }
  return mock;
}
