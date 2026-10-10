import { AadHttpClientFactory } from '@microsoft/sp-http';

export interface IBackupWatchProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  aadHttpClientFactory: AadHttpClientFactory;
  backendApiUrl: string;
  backendApiResourceId: string;
  msGraphClientFactory?: any;
  version: string;
}
