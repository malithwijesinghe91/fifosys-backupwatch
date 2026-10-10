import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  BaseClientSideWebPart,
  IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-webpart-base';

import BackupWatch from './components/BackupWatch';
import { IBackupWatchProps } from './components/IBackupWatchProps';

export interface IBackupWatchWebPartProps {
  description: string;
  backendApiUrl: string;
  backendApiResourceId: string;
}

export default class BackupWatchWebPart extends BaseClientSideWebPart<IBackupWatchWebPartProps> {
  public render(): void {
    const element: React.ReactElement<IBackupWatchProps> = React.createElement(
      BackupWatch,
      {
        description: this.properties.description,
        isDarkTheme: this.context.sdks.microsoftTeams ? true : false,
        environmentMessage: this._getEnvironmentMessage(),
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        userDisplayName: this.context.pageContext.user.displayName,
        aadHttpClientFactory: this.context.aadHttpClientFactory,
        backendApiUrl: this.properties.backendApiUrl || 'http://localhost:7071/api/backupWatchTrigger',
        backendApiResourceId: this.properties.backendApiResourceId || 'api://backupwatch-api',
        msGraphClientFactory: this.context.msGraphClientFactory,
        version: this.context.manifest.version
      }
    );

    ReactDom.render(element, this.domElement);
  }

  private _getEnvironmentMessage(): string {
    if (!!this.context.sdks.microsoftTeams) {
      return "Running in Microsoft Teams";
    }
    return "Running in SharePoint Online";
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: "BackupWatch Configuration Settings"
          },
          groups: [
            {
              groupName: "API Mapping",
              groupFields: [
                PropertyPaneTextField('description', {
                  label: "Description",
                  value: "Datto BCDR Real-Time Monitor"
                }),
                PropertyPaneTextField('backendApiUrl', {
                  label: "Azure Function Endpoint URL",
                  value: "http://localhost:7071/api/backupWatchTrigger"
                }),
                PropertyPaneTextField('backendApiResourceId', {
                  label: "Azure Function App ID URI (Resource ID)",
                  value: "api://backupwatch-api"
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
