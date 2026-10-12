/**
 * Datto API Mocks
 * Provides controlled mock responses for Datto BCDR endpoints.
 */
import axios from 'axios';

export interface MockDattoDevice {
  id: string;
  name: string;
  serialNumber: string;
  clientCompanyName: string;
  isActive: boolean;
  isCancelled?: boolean;
  assets?: MockDattoAsset[];
}

export interface MockDattoAsset {
  id: string;
  name: string;
  hostname: string;
  isArchived: boolean;
  isActive: boolean;
  protectedVolumeNames?: string[];
  unprotectedVolumeNames?: string[];
}

export interface MockDattoAppliance {
  id: string;
  name: string;
  serialNumber: string;
  isActive: boolean;
  isCancelled?: boolean;
  devices: MockDattoDevice[];
}

const defaultDevices: MockDattoDevice[] = [
  {
    id: 'dev-1',
    name: 'FIF-DATTO-01',
    serialNumber: 'SN-DATTO-001',
    clientCompanyName: 'Fifosys Ltd',
    isActive: true,
    assets: [
      {
        id: 'asset-1',
        name: 'DC-01',
        hostname: 'DC-01.fifosys.local',
        isArchived: false,
        isActive: true,
        unprotectedVolumeNames: ['D:\\'],
        protectedVolumeNames: ['C:\\', 'E:\\'],
      },
    ],
  },
  {
    id: 'dev-2',
    name: 'FIF-DATTO-ACTIVE',
    serialNumber: 'SN-DATTO-002',
    clientCompanyName: 'Fifosys Ltd',
    isActive: true,
    assets: [
      {
        id: 'asset-2',
        name: 'SQL-DECOMMISSIONED',
        hostname: 'sql-old.fifosys.local',
        isArchived: false,
        isActive: true,
        unprotectedVolumeNames: [],
        protectedVolumeNames: ['C:\\'],
      },
      {
        id: 'asset-3',
        name: 'DC-01',
        hostname: 'DC-01.fifosys.local',
        isArchived: false,
        isActive: true,
        unprotectedVolumeNames: ['E:\\'],
        protectedVolumeNames: ['C:\\', 'D:\\'],
      },
    ],
  },
  {
    id: 'dev-3',
    name: 'FIF-DATTO-BLACKOUT',
    serialNumber: 'SN-DATTO-003',
    clientCompanyName: 'Fifosys Ltd',
    isActive: true,
    assets: [
      {
        id: 'asset-4',
        name: 'DC-01',
        hostname: 'DC-01.fifosys.local',
        isArchived: false,
        isActive: true,
        unprotectedVolumeNames: ['C:\\', 'D:\\'],
        protectedVolumeNames: [],
      },
    ],
  },
  // Cancelled appliance for testing "Cancelled Appliances" tab
  {
    id: 'dev-4',
    name: 'FIF-DATTO-CANCELLED',
    serialNumber: 'SN-DATTO-004',
    clientCompanyName: 'Fifosys Ltd',
    isActive: false,
    isCancelled: true,
    assets: [
      {
        id: 'asset-5',
        name: 'DC-01',
        hostname: 'DC-01.fifosys.local',
        isArchived: true,
        isActive: false,
        unprotectedVolumeNames: [],
        protectedVolumeNames: [],
      },
    ],
  },
];

let devices = [...defaultDevices];

export function resetDattoMocks() {
  devices = [...defaultDevices];
}

export function setMockDevices(newDevices: MockDattoDevice[]) {
  devices = newDevices;
}

export function getMockDevices(): MockDattoDevice[] {
  return [...devices];
}

export function createDattoMock(baseURL?: string) {
  const mock = {
    get: async (url: string, config?: any) => {
      // List devices
      if (url === '/device' || url.endsWith('/device')) {
        return { data: devices };
      }

      // Get specific device
      if (url.includes('/device/') && !url.includes('/asset')) {
        const serialMatch = url.match(/\/device\/([^/?]+)/);
        if (serialMatch) {
          const serial = serialMatch[1];
          const found = devices.find(d => d.serialNumber === serial || d.id === serial);
          if (found) return { data: found };
          throw { response: { status: 404 } };
        }
      }

      // Get assets for a device
      if (url.includes('/device/') && url.includes('/asset')) {
        const serialMatch = url.match(/\/device\/([^/?]+)\/asset/);
        if (serialMatch) {
          const serial = serialMatch[1];
          const device = devices.find(d => d.serialNumber === serial || d.id === serial);
          if (device) return { data: device.assets || [] };
          throw { response: { status: 404 } };
        }
      }

      // Get specific asset
      if (url.includes('/asset/') && !url.includes('/device')) {
        const idMatch = url.match(/\/asset\/([^/?]+)/);
        if (idMatch) {
          const id = idMatch[1];
          for (const device of devices) {
            const asset = device.assets?.find(a => a.id === id);
            if (asset) return { data: asset };
          }
          throw { response: { status: 404 } };
        }
      }

      return { data: [] };
    },

    post: async (url: string, data?: any) => {
      throw new Error(`Mock POST not implemented for ${url}`);
    },
  };

  return mock;
}

/**
 * Routes a jest-mocked axios (from `jest.mock('axios')` in the test file) to this in-memory mock.
 * Production modules import axios directly, so this is the only way to intercept their calls.
 */
export function installDattoMock(mockedAxios: jest.Mocked<typeof axios>, baseURL?: string) {
  const mock = createDattoMock(baseURL) as any;
  for (const method of ['get', 'post', 'patch'] as const) {
    if (mock[method]) (mockedAxios[method] as jest.Mock).mockImplementation(mock[method]);
  }
  return mock;
}
