import * as React from 'react';
import { IBackupWatchProps } from './IBackupWatchProps';
import { AadHttpClient, HttpClientResponse } from '@microsoft/sp-http';
import {
  IAgentResult,
  IDattoDevice,
  IExclusion,
  IEscalatableIssue,
  IBackupWatchState
} from './types/BackupWatchTypes';
import { BackupWatchStyles } from './styles/BackupWatchStyles';
import { MutingModal } from './modals/MutingModal';
import { EscalationModal } from './modals/EscalationModal';
import { AuditLogsDrawer } from './modals/AuditLogsDrawer';
import { AdminModal } from './modals/AdminModal';
import { MetricCards } from './appliance/MetricCards';
import { ExclusionsTable } from './appliance/ExclusionsTable';
import { HeaderBar } from './appliance/HeaderBar';

export {
  IAgentResult,
  IDattoDevice,
  IExclusion,
  IEscalatableIssue,
  IBackupWatchState
};

export default class BackupWatch extends React.Component<IBackupWatchProps, IBackupWatchState> {  constructor(props: IBackupWatchProps) {
    super(props);
    const isEditMode = window.location.href.indexOf('Mode=Edit') > -1;
    const isTargetPage = window.location.pathname.toLowerCase().indexOf('/sites/backupwatchportal/sitepages/home.aspx') > -1;
    const defaultFullScreen = isTargetPage && !isEditMode;

    let isDarkMode = false;
    try {
      isDarkMode = typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('backupwatch-theme') === 'dark';
    } catch (e) {
      // Ignore
    }

    this.state = {
      devices: [],
      exclusions: [],
      loading: true,
      error: null,
      cacheStatus: null,
      expandedAppliances: {},
      activeTab: 'active',
      activeFilter: null,
      isFullScreen: defaultFullScreen,
      isSettingsOpen: false,
      isMutingModalOpen: false,
      mutingDevice: null,
      mutingAgentName: null,
      mutingVolume: null,
      muteType: 'Device',
      muteReason: '',
      isPermanent: false,
      durationDays: 3,
      muteTicketNumber: '',
      mutingExclusionId: null,
      actionLoading: false,
      isEscalateModalOpen: false,
      escalateDevice: null,
      escalateIssues: [],
      selectedIssueIds: {},
      copiedTicketId: null,
      searchQuery: '',
      currentPage: 1,
      pageSize: 15,
      isDarkMode: isDarkMode,
      isAuditLogsOpen: false,
      auditLogs: [],
      auditSearchQuery: '',
      auditLoading: false,
      auditError: null,
      scanStatus: null,
      backendVersion: undefined,
      userSecurityLevel: 'Viewer', // until the backend returns the server-resolved role
      serverUserEmail: undefined,
      isAdminModalOpen: false,
      adminModalTab: 'diagnostics',
      adminDiagnostics: null,
      adminDiagnosticsLoading: false,
      adminDiagnosticsError: null,
      adminRoutingData: null,
      alertMatrix: null,
      adminRoutingLoading: false,
      adminRoutingSaving: false,
      adminRoutingSavedNotice: false,
      selectedAdminQueueId: undefined,
      selectedAdminPriorityId: 2,
      selectedAdminCategoryId: undefined,
      selectedAdminWorkTypeId: undefined,
      isEmergencyOverride: false,
      globalMaintenanceMode: null,
      blackoutDurationHours: 2,
      blackoutReason: '',
      blackoutSaving: false,
      cleanupScanning: false,
      cleanupPurging: false,
      cleanupData: null,
      selectedCleanupTickets: [],
      selectedCleanupExclusions: [],
      assetTestQuery: '',
      assetTestLoading: false,
      assetTestResult: null,
      auditExporting: false
    };
  }

  public componentDidMount(): void {
    this._fetchData();
  }

  // BW-001: the role is resolved by the backend from Entra App Roles and returned as userRole.
  // The UI only uses it to hide controls; the backend enforces every permission.
  private _toSecurityLevel = (role: unknown): IBackupWatchState['userSecurityLevel'] => {
    return role === 'Administrator' || role === 'Specialist' || role === 'Contributor' ? role : 'Viewer';
  };

  private _toggleTheme = (): void => {
    this.setState(prevState => {
      const nextDark = !prevState.isDarkMode;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('backupwatch-theme', nextDark ? 'dark' : 'light');
        }
      } catch (e) {
        // Ignore
      }
      return { isDarkMode: nextDark };
    });
  }

  private _isBackupOverdue = (lastBackupStatus: any): boolean => {
    if (!lastBackupStatus || !lastBackupStatus.time) return false;
    const timeVal = lastBackupStatus.time;
    let epochSeconds = 0;
    if (typeof timeVal === 'number') {
      epochSeconds = timeVal;
    } else if (typeof timeVal === 'string') {
      const parsed = Date.parse(timeVal);
      if (isNaN(parsed)) return false;
      epochSeconds = Math.floor(parsed / 1000);
    } else {
      return false;
    }
    const ageSeconds = Math.floor(Date.now() / 1000) - epochSeconds;
    return ageSeconds > 24 * 3600;
  }

  private _renderLastSeen(lastCheckin: any): React.ReactNode {
    if (!lastCheckin) {
      return <span style={{ color: '#475569' }}>—</span>;
    }

    let epochSeconds = 0;
    if (typeof lastCheckin === 'number') {
      epochSeconds = lastCheckin;
    } else if (typeof lastCheckin === 'string') {
      const parsed = Date.parse(lastCheckin);
      if (isNaN(parsed)) return <span style={{ color: '#475569' }}>—</span>;
      epochSeconds = Math.floor(parsed / 1000);
    } else {
      return <span style={{ color: '#475569' }}>—</span>;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = nowSeconds - epochSeconds;
    const diffMinutes = Math.floor(diffSeconds / 60);

    let text = '';
    let color = '';

    if (diffMinutes < 0) {
      text = "Just now";
      color = "#10b981";
    } else if (diffMinutes < 60) {
      text = `${diffMinutes}m ago`;
      color = diffMinutes < 30 ? "#10b981" : "#f59e0b";
    } else {
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      text = `${hours}h ${mins}m ago`;
      color = hours < 2 ? "#f59e0b" : "#ef4444";
    }

    const absoluteTime = new Date(epochSeconds * 1000).toLocaleString();

    return (
      <span 
        title={absoluteTime} 
        style={{ color: color, fontWeight: 600, fontSize: '0.82rem' }}
      >
        {text}
      </span>
    );
  }

  private _getEscalationIssues(device: IDattoDevice): IEscalatableIssue[] {
    const issues: IEscalatableIssue[] = [];

    // 1. Storage Warning (>85%)
    const isDeviceMuted = (device as any).isSilenced || this.state.exclusions.some(e => e.type === 'Device' && (e.target || '').toLowerCase() === device.deviceName.toLowerCase());
    if (device.storageUsedPercent > 85 && !device.storageTicketReference && !isDeviceMuted) {
      issues.push({
        id: "storage",
        type: 'Appliance',
        targetName: device.deviceName,
        issueType: 'Storage',
        description: `Appliance storage capacity is critical. Used: ${device.usedStorageGB} GB / Total: ${device.totalStorageGB} GB (${device.storageUsedPercent}%).`,
        lastSeenMessage: `Storage usage is at ${device.storageUsedPercent}%.`
      });
    }

    // 2. Agent Level Issues
    if (device.agents) {
      for (const agent of device.agents) {
        if (agent.isArchived) continue;

        // Paused agents
        if (agent.isPaused) {
          const exclusionNote = this._getVolumeExclusionReason(device.deviceName, agent.name, "", "");
          const alreadyEscalated = (agent as any).statusTicketReference;
          if (!exclusionNote && !alreadyEscalated) {
            issues.push({
              id: `agent:${agent.name}:paused`,
              type: 'Agent',
              targetName: agent.name,
              issueType: 'Paused',
              description: `Agent backup is paused on the appliance.`,
              lastSeenMessage: `Backup agent status is Paused.`
            });
          }
        }

        // Failed backup
        if (agent.lastBackupStatus && !agent.lastBackupStatus.success && !(agent as any).backupTicketReference) {
          issues.push({
            id: `agent:${agent.name}:backup`,
            type: 'Agent',
            targetName: agent.name,
            issueType: 'Backup',
            description: `Latest local backup failed. Error message: ${agent.lastBackupStatus.errorMessage || 'No error message specified.'}`,
            lastSeenMessage: agent.lastBackupStatus.errorMessage || 'Local backup failed.'
          });
        }

        // Failed screenshot
        if (agent.screenshotVerification && !agent.screenshotVerification.success && !(agent as any).screenshotTicketReference) {
          issues.push({
            id: `agent:${agent.name}:screenshot`,
            type: 'Agent',
            targetName: agent.name,
            issueType: 'Screenshot',
            description: `Screenshot verification failed.`,
            lastSeenMessage: `Screenshot verification failed.`
          });
        }
      }
    }

    return issues;
  }

  private _openEscalateModal = (device: IDattoDevice): void => {
    const issues = this._getEscalationIssues(device);
    if (issues.length === 0) {
      alert("No escalatable failures found for this appliance (all issues are either healthy, muted/excluded, or already escalated).");
      return;
    }

    const selectedIssueIds: { [key: string]: boolean } = {};
    for (const issue of issues) {
      selectedIssueIds[issue.id] = true;
    }

    this.setState({
      isEscalateModalOpen: true,
      escalateDevice: device,
      escalateIssues: issues,
      selectedIssueIds
    });
  }

  private _escalateSelectedIssues = (): void => {
    const { escalateDevice, escalateIssues, selectedIssueIds } = this.state;
    if (!escalateDevice) return;

    const selectedIssues = escalateIssues.filter(issue => selectedIssueIds[issue.id]);
    if (selectedIssues.length === 0) {
      alert("Please select at least one issue to escalate.");
      return;
    }

    this.setState({ actionLoading: true });

    const isLocal = this._isLocalDev();
    const escalateUrl = this.props.backendApiUrl.substring(0, this.props.backendApiUrl.lastIndexOf('/')) + '/escalate';
    const reqHeaders = {
      'Content-Type': 'application/json'
    };

    const promises = selectedIssues.map(issue => {
      const agent = issue.type === 'Agent' 
        ? ((escalateDevice.agents as any) && (escalateDevice.agents as any).find((a: any) => a.name === issue.targetName)) 
        : undefined;

      const payload = {
        companyName: escalateDevice.companyName || "Unknown Company",
        deviceName: escalateDevice.deviceName,
        serialNumber: escalateDevice.serialNumber,
        issueType: issue.issueType,
        agentName: issue.type === 'Agent' ? issue.targetName : undefined,
        description: issue.description,
        lastSeenMessage: issue.lastSeenMessage,
        
        // Enriched fields for v1.6 descriptions
        errorMessage: agent 
          ? (issue.issueType === 'Backup' ? agent.lastBackupStatus?.errorMessage : undefined) 
          : undefined,
        screenshotUrl: agent ? agent.screenshotVerification?.image : undefined,
        lastBackupTime: agent ? String(agent.lastBackupStatus?.time || "") : undefined,
        screenshotTime: agent ? String(agent.screenshotVerification?.time || "") : undefined,
        usedStorageGB: escalateDevice.usedStorageGB,
        totalStorageGB: escalateDevice.totalStorageGB,
        storageUsedPercent: escalateDevice.storageUsedPercent,
        lastCheckin: escalateDevice.lastCheckin,
        model: escalateDevice.model
      };

      if (isLocal) {
        return fetch(escalateUrl, {
          method: 'POST',
          headers: reqHeaders,
          body: JSON.stringify(payload)
        }).then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw new Error(errData.error || `Escalation returned status ${res.status}`);
            });
          }
          return res.json();
        });
      } else {
        return this.props.aadHttpClientFactory
          .getClient(this.props.backendApiResourceId)
          .then(client => {
            return client.fetch(escalateUrl, AadHttpClient.configurations.v1, {
              method: 'POST',
              headers: reqHeaders,
              body: JSON.stringify(payload)
            }).then(res => {
              if (res.status >= 400) {
                return res.json().then(errData => {
                  throw new Error(errData.error || `Escalation returned status ${res.status}`);
                });
              }
              return res.json();
            });
          });
      }
    });

    Promise.all(promises)
      .then(() => {
        this.setState({ isEscalateModalOpen: false, actionLoading: false });
        this._fetchData();
      })
      .catch(err => {
        alert("Failed to escalate some issues: " + err.message);
        this.setState({ actionLoading: false });
        this._fetchData();
      });
  }

  private _escalateSingleIssue = (device: IDattoDevice, agentName: string, issueType: 'Backup' | 'Screenshot', description: string, lastSeenMessage: string): void => {
    if (!confirm(`Are you sure you want to escalate this ${issueType} issue for agent ${agentName}?`)) return;

    this.setState({ actionLoading: true });

    const isLocal = this._isLocalDev();
    const escalateUrl = this.props.backendApiUrl.substring(0, this.props.backendApiUrl.lastIndexOf('/')) + '/escalate';
    const reqHeaders = {
      'Content-Type': 'application/json'
    };

    const agent = device.agents && (device.agents as any).find((a: any) => a.name === agentName);
    const payload = {
      companyName: device.companyName || "Unknown Company",
      deviceName: device.deviceName,
      serialNumber: device.serialNumber,
      issueType: issueType,
      agentName: agentName,
      description: description,
      lastSeenMessage: lastSeenMessage,
      
      // Enriched fields for v1.6 descriptions
      errorMessage: agent 
        ? (issueType === 'Backup' ? agent.lastBackupStatus?.errorMessage : undefined) 
        : undefined,
      screenshotUrl: agent ? agent.screenshotVerification?.image : undefined,
      lastBackupTime: agent ? String(agent.lastBackupStatus?.time || "") : undefined,
      screenshotTime: agent ? String(agent.screenshotVerification?.time || "") : undefined,
      usedStorageGB: device.usedStorageGB,
      totalStorageGB: device.totalStorageGB,
      storageUsedPercent: device.storageUsedPercent,
      lastCheckin: device.lastCheckin,
      model: device.model
    };

    const runEscalate = (client?: any) => {
      const fetchPromise = client 
        ? client.fetch(escalateUrl, AadHttpClient.configurations.v1, { method: 'POST', headers: reqHeaders, body: JSON.stringify(payload) })
        : fetch(escalateUrl, { method: 'POST', headers: reqHeaders, body: JSON.stringify(payload) });

      return fetchPromise
        .then((res: any) => {
          if (res.status >= 400 || (res.ok === false)) {
            return res.json().then((errData: any) => {
              throw new Error(errData.error || ("HTTP error " + (res.status || "")));
            });
          }
          return res.json();
        })
        .then(() => {
          this.setState({ actionLoading: false });
          this._fetchData();
        })
        .catch((err: any) => {
          alert(`Failed to escalate: ` + err.message);
          this.setState({ actionLoading: false });
        });
    };

    if (isLocal) {
      runEscalate();
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => runEscalate(client))
        .catch((authErr: any) => {
          alert(`Authentication failed: ` + authErr.message);
          this.setState({ actionLoading: false });
        });
    }
  }

  private _copyTicketBrief = (clientName: string, deviceName: string, agentName: string | undefined, alertTypeName: string, ticketId: string, event: React.MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    
    const brief = agentName 
      ? `${clientName} - ${deviceName} / ${agentName}: ${alertTypeName}. Ticket #${ticketId}`
      : `${clientName} - ${deviceName}: ${alertTypeName}. Ticket #${ticketId}`;
      
    navigator.clipboard.writeText(brief)
      .then(() => {
        this.setState({ copiedTicketId: ticketId });
        setTimeout(() => {
          this.setState({ copiedTicketId: null });
        }, 1500);
      })
      .catch(err => {
        console.error("Failed to copy ticket brief:", err);
      });
  }

  // Derive exclusions URL from backendApiUrl
  private _getExclusionsUrl(): string {
    const url = this.props.backendApiUrl;
    const lastSlash = url.lastIndexOf('/');
    if (lastSlash > -1) {
      return url.substring(0, lastSlash) + '/exclusions';
    }
    return url.charAt(url.length - 1) === '/' ? url + 'exclusions' : url + '/exclusions';
  }

  // Derive audit logs URL from backendApiUrl
  private _getAuditLogsUrl(): string {
    const url = this.props.backendApiUrl;
    const lastSlash = url.lastIndexOf('/');
    if (lastSlash > -1) {
      return url.substring(0, lastSlash) + '/auditlogs';
    }
    return url.charAt(url.length - 1) === '/' ? url + 'auditlogs' : url + '/auditlogs';
  }

  private _fetchAuditLogs = (): void => {
    this.setState({ auditLoading: true, auditError: null });
    const isLocal = this._isLocalDev();
    const auditLogsUrl = this._getAuditLogsUrl();

    if (isLocal) {
      fetch(auditLogsUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Audit Logs API returned status ${res.status}`);
          return res.json();
        })
        .then(auditLogs => {
          this.setState({
            auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
            auditLoading: false,
            auditError: null
          });
        })
        .catch(err => {
          console.error("Failed to fetch audit logs:", err);
          this.setState({ auditLoading: false, auditError: err.message || 'Failed to load audit logs.' });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => {
          return client.fetch(auditLogsUrl, AadHttpClient.configurations.v1, {
            method: 'GET'
          });
        })
        .then(res => {
          if (res.status >= 400) throw new Error(`Audit Logs API returned status ${res.status}`);
          return res.json();
        })
        .then(auditLogs => {
          this.setState({
            auditLogs: Array.isArray(auditLogs) ? auditLogs : [],
            auditLoading: false,
            auditError: null
          });
        })
        .catch(err => {
          console.error("Failed to fetch audit logs:", err);
          this.setState({ auditLoading: false, auditError: err.message || 'Failed to load audit logs.' });
        });
    }
  };

  private _openAuditLogs = (): void => {
    this.setState({ isAuditLogsOpen: true });
    this._fetchAuditLogs();
  };

  private _getAdminActionUrl(action: string): string {
    const url = this.props.backendApiUrl || '';
    return url.indexOf('?') > -1 ? `${url}&action=${encodeURIComponent(action)}` : `${url}?action=${encodeURIComponent(action)}`;
  }

  private _getAdminDiagnosticsUrl(): string {
    return this._getAdminActionUrl('adminDiagnostics');
  }

  private _getAdminRoutingUrl(): string {
    return this._getAdminActionUrl('adminRouting');
  }

  private _openAdminModal = (tab?: 'diagnostics' | 'routing' | 'blackout' | 'cleanup' | 'assetTester'): void => {
    const targetTab = tab || 'diagnostics';
    this.setState({
      isAdminModalOpen: true,
      adminModalTab: targetTab,
      adminRoutingSavedNotice: false
    });
    if (targetTab === 'diagnostics') {
      this._fetchAdminDiagnostics();
    } else if (targetTab === 'routing') {
      this._fetchAdminRouting();
    } else if (targetTab === 'blackout') {
      this._fetchAdminMaintenance();
    } else if (targetTab === 'cleanup') {
      this._fetchAdminCleanup();
    }
  }

  private _fetchAdminMaintenance = (): void => {
    const isLocal = this._isLocalDev();
    const url = this._getAdminActionUrl('adminMaintenance');

    if (isLocal) {
      fetch(url)
        .then(res => res.json())
        .then(data => this.setState({ globalMaintenanceMode: data }))
        .catch(() => {});
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => client.fetch(url, AadHttpClient.configurations.v1, {
          method: 'GET'
        }))
        .then(res => res.json())
        .then(data => this.setState({ globalMaintenanceMode: data }))
        .catch(() => {});
    }
  }

  private _saveAdminMaintenance = (isActive: boolean): void => {
    this.setState({ blackoutSaving: true });
    const isLocal = this._isLocalDev();
    const url = this._getAdminActionUrl('adminMaintenance');

    const payload = {
      isActive,
      durationHours: this.state.blackoutDurationHours,
      reason: this.state.blackoutReason || 'Planned Maintenance Window'
    };

    const handler = (res: any) => {
      this.setState({ blackoutSaving: false });
      if (res && res.success) {
        this.setState({ globalMaintenanceMode: res.maintenance });
        alert(isActive ? 'Global Alert Blackout successfully activated.' : 'Global Alert Blackout deactivated.');
      } else {
        alert('Failed to update maintenance mode.');
      }
    };

    if (isLocal) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Error: ' + err.message);
          this.setState({ blackoutSaving: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => client.fetch(url, AadHttpClient.configurations.v1, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }))
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Error: ' + err.message);
          this.setState({ blackoutSaving: false });
        });
    }
  }

  private _fetchAdminCleanup = (): void => {
    this.setState({ cleanupScanning: true, cleanupData: null, selectedCleanupTickets: [], selectedCleanupExclusions: [] });
    const isLocal = this._isLocalDev();
    const url = this._getAdminActionUrl('adminCleanup');

    const handler = (data: any) => {
      this.setState({
        cleanupScanning: false,
        cleanupData: data,
        selectedCleanupTickets: (data.orphanTickets || []).map((t: any) => ({ partitionKey: t.partitionKey, rowKey: t.rowKey })),
        selectedCleanupExclusions: (data.orphanExclusions || []).map((e: any) => ({ partitionKey: e.partitionKey, rowKey: e.rowKey }))
      });
    };

    if (isLocal) {
      fetch(url)
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Cleanup scan failed: ' + err.message);
          this.setState({ cleanupScanning: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => client.fetch(url, AadHttpClient.configurations.v1, {
          method: 'GET'
        }))
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Cleanup scan failed: ' + err.message);
          this.setState({ cleanupScanning: false });
        });
    }
  }

  private _purgeAdminCleanup = (): void => {
    const { selectedCleanupTickets, selectedCleanupExclusions } = this.state;
    const total = selectedCleanupTickets.length + selectedCleanupExclusions.length;
    if (total === 0) {
      alert('No items selected for purge.');
      return;
    }
    if (!confirm(`Are you sure you want to permanently purge ${total} stale orphan records from Table Storage? This cannot be undone.`)) {
      return;
    }

    this.setState({ cleanupPurging: true });
    const isLocal = this._isLocalDev();
    const url = this._getAdminActionUrl('adminCleanup');

    const payload = {
      tickets: selectedCleanupTickets,
      exclusions: selectedCleanupExclusions
    };

    const handler = (res: any) => {
      this.setState({ cleanupPurging: false });
      if (res && res.success) {
        alert(`Cleanup complete: ${res.purgedTickets} tickets and ${res.purgedExclusions} exclusions purged.`);
        this._fetchAdminCleanup();
      } else {
        alert('Purge failed.');
      }
    };

    if (isLocal) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Purge error: ' + err.message);
          this.setState({ cleanupPurging: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => client.fetch(url, AadHttpClient.configurations.v1, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }))
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Purge error: ' + err.message);
          this.setState({ cleanupPurging: false });
        });
    }
  }

  private _runAssetTest = (): void => {
    const query = (this.state.assetTestQuery || '').trim();
    if (!query) {
      alert('Please enter an appliance serial number or server hostname.');
      return;
    }

    this.setState({ assetTestLoading: true, assetTestResult: null });
    const isLocal = this._isLocalDev();
    const url = this._getAdminActionUrl('adminTestAsset');

    const payload = { query };

    const handler = (data: any) => {
      this.setState({ assetTestLoading: false, assetTestResult: data });
    };

    if (isLocal) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Asset test failed: ' + err.message);
          this.setState({ assetTestLoading: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => client.fetch(url, AadHttpClient.configurations.v1, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }))
        .then(res => res.json())
        .then(handler)
        .catch(err => {
          alert('Asset test failed: ' + err.message);
          this.setState({ assetTestLoading: false });
        });
    }
  }

  private _exportAuditLogsToCsv = (): void => {
    const { auditLogs } = this.state;
    if (!auditLogs || auditLogs.length === 0) {
      alert('No audit logs available to export.');
      return;
    }

    const headers = ['Timestamp (UTC)', 'User Email', 'Action', 'Target', 'Details'];
    const rows = auditLogs.map(log => {
      const time = log.createdTime ? new Date(log.createdTime).toISOString() : '';
      const email = `"${(log.userEmail || '').replace(/"/g, '""')}"`;
      const action = `"${(log.action || '').replace(/"/g, '""')}"`;
      const target = `"${(log.target || '').replace(/"/g, '""')}"`;
      const details = `"${(log.details || '').replace(/"/g, '""')}"`;
      return [time, email, action, target, details].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `BackupWatch_Audit_Trail_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private _fetchAdminDiagnostics = (): void => {
    this.setState({ adminDiagnosticsLoading: true, adminDiagnosticsError: null });
    const isLocal = this._isLocalDev();
    const url = this._getAdminDiagnosticsUrl();

    if (isLocal) {
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`Diagnostics endpoint returned status ${res.status}`);
          return res.json();
        })
        .then(data => {
          this.setState({ adminDiagnostics: data, adminDiagnosticsLoading: false, adminDiagnosticsError: null });
        })
        .catch(err => {
          this.setState({ adminDiagnosticsLoading: false, adminDiagnosticsError: err.message || 'Failed to load diagnostics.' });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => {
          return client.fetch(url, AadHttpClient.configurations.v1, {
            method: 'GET'
          });
        })
        .then(res => {
          if (res.status >= 400) throw new Error(`Diagnostics returned status ${res.status}`);
          return res.json();
        })
        .then(data => {
          this.setState({ adminDiagnostics: data, adminDiagnosticsLoading: false, adminDiagnosticsError: null });
        })
        .catch(err => {
          this.setState({ adminDiagnosticsLoading: false, adminDiagnosticsError: err.message || 'Failed to load diagnostics.' });
        });
    }
  }

  private _fetchAdminRouting = (): void => {
    this.setState({ adminRoutingLoading: true, adminRoutingSavedNotice: false });
    const isLocal = this._isLocalDev();
    const url = this._getAdminRoutingUrl();

    if (isLocal) {
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`Routing endpoint returned status ${res.status}`);
          return res.json();
        })
        .then(data => {
          this.setState({
            adminRoutingData: data,
            alertMatrix: data.alertMatrix || null,
            adminRoutingLoading: false,
            selectedAdminQueueId: data.currentRouting?.queueId,
            selectedAdminPriorityId: data.currentRouting?.priorityId || 2,
            selectedAdminCategoryId: data.currentRouting?.categoryId,
            selectedAdminWorkTypeId: data.currentRouting?.workTypeId
          });
        })
        .catch(err => {
          console.error("Failed to fetch routing data:", err);
          this.setState({ adminRoutingLoading: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => {
          return client.fetch(url, AadHttpClient.configurations.v1, {
            method: 'GET'
          });
        })
        .then(res => {
          if (res.status >= 400) throw new Error(`Routing API returned status ${res.status}`);
          return res.json();
        })
        .then(data => {
          this.setState({
            adminRoutingData: data,
            alertMatrix: data.alertMatrix || null,
            adminRoutingLoading: false,
            selectedAdminQueueId: data.currentRouting?.queueId,
            selectedAdminPriorityId: data.currentRouting?.priorityId || 2,
            selectedAdminCategoryId: data.currentRouting?.categoryId,
            selectedAdminWorkTypeId: data.currentRouting?.workTypeId
          });
        })
        .catch(err => {
          console.error("Failed to fetch routing data:", err);
          this.setState({ adminRoutingLoading: false });
        });
    }
  }

  private _saveAdminRouting = (): void => {
    const { selectedAdminQueueId, selectedAdminPriorityId, selectedAdminCategoryId, selectedAdminWorkTypeId, adminRoutingData, alertMatrix } = this.state;
    this.setState({ adminRoutingSaving: true, adminRoutingSavedNotice: false });
    const isLocal = this._isLocalDev();
    const url = this._getAdminRoutingUrl();

    let queueName = '';
    if (adminRoutingData && adminRoutingData.options && adminRoutingData.options.queues) {
      const matched = adminRoutingData.options.queues.find((q: any) => q.value === selectedAdminQueueId);
      if (matched) queueName = matched.label;
    }

    const payload = {
      queueId: selectedAdminQueueId,
      queueName: queueName,
      priorityId: selectedAdminPriorityId,
      categoryId: selectedAdminCategoryId,
      workTypeId: selectedAdminWorkTypeId,
      alertMatrix: alertMatrix || undefined
    };

    if (isLocal) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) throw new Error(`Save routing failed with status ${res.status}`);
          return res.json();
        })
        .then(() => {
          this.setState({ adminRoutingSaving: false, adminRoutingSavedNotice: true });
        })
        .catch(err => {
          alert('Failed to save routing: ' + err.message);
          this.setState({ adminRoutingSaving: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then(client => {
          return client.fetch(url, AadHttpClient.configurations.v1, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        })
        .then(res => {
          if (res.status >= 400) throw new Error(`Save routing failed with status ${res.status}`);
          return res.json();
        })
        .then(() => {
          this.setState({ adminRoutingSaving: false, adminRoutingSavedNotice: true });
        })
        .catch(err => {
          alert('Failed to save routing: ' + err.message);
          this.setState({ adminRoutingSaving: false });
        });
    }
  }

  private _updateAlertMatrixItem = (alertKey: string, field: string, value: any, additionalUpdates?: Record<string, any>): void => {
    this.setState(prevState => {
      const current = { ...(prevState.alertMatrix || {}) };
      if (!current[alertKey]) {
        current[alertKey] = {};
      }
      current[alertKey] = {
        ...current[alertKey],
        [field]: value,
        ...(additionalUpdates || {})
      };
      return { alertMatrix: current };
    });
  }

  private _isLocalDev(): boolean {
    const url = this.props.backendApiUrl;
    return url.indexOf('localhost') > -1 || url.indexOf('127.0.0.1') > -1;
  }

  private _fetchData = (): void => {
    this.setState({ loading: true, error: null });

    const isLocal = this._isLocalDev();
    const devicesUrl = this.props.backendApiUrl;
    const exclusionsUrl = this._getExclusionsUrl();

    if (isLocal) {
      // Local development: bypass AadHttpClient
      Promise.all([
        fetch(devicesUrl).then(res => {
          const cacheHeader = res.headers.get('X-Cache-Status');
          this.setState({ cacheStatus: cacheHeader });
          return res.json();
        }),
        fetch(exclusionsUrl).then(res => {
          if (!res.ok) {
            throw new Error(`Exclusions API returned status ${res.status}`);
          }
          return res.json();
        })
      ])
        .then(([resData, exclusions]) => {
          const devicesList = Array.isArray(resData) ? resData : (resData.devices || []);
          const scanStatus = Array.isArray(resData) ? null : (resData.scanStatus || null);
          const maintenanceMode = Array.isArray(resData) ? null : (resData.maintenanceMode || null);
          const backendVersion = Array.isArray(resData) ? undefined : resData.appVersion;
          this.setState({
            userSecurityLevel: this._toSecurityLevel(Array.isArray(resData) ? undefined : resData.userRole),
            serverUserEmail: Array.isArray(resData) ? undefined : resData.userEmail,
            devices: devicesList,
            scanStatus: scanStatus,
            globalMaintenanceMode: maintenanceMode,
            backendVersion: backendVersion || this.state.backendVersion,
            exclusions: Array.isArray(exclusions) ? exclusions : [],
            loading: false
          });
        })
        .catch(err => {
          this.setState({
            error: err.message || 'Failed to fetch data from local emulator API.',
            loading: false
          });
        });
    } else {
      // Production: authenticate via AadHttpClient
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then((client: AadHttpClient): void => {
          Promise.all([
            client.get(devicesUrl, AadHttpClient.configurations.v1).then((res: HttpClientResponse) => {
              const cacheHeader = res.headers.get('X-Cache-Status');
              this.setState({ cacheStatus: cacheHeader });
              return res.json();
            }),
            client.get(exclusionsUrl, AadHttpClient.configurations.v1).then((res: HttpClientResponse) => {
              if (res.status >= 400) {
                throw new Error(`Exclusions API returned status ${res.status}`);
              }
              return res.json();
            })
          ])
            .then(([resData, exclusions]) => {
              const devicesList = Array.isArray(resData) ? resData : (resData.devices || []);
              const scanStatus = Array.isArray(resData) ? null : (resData.scanStatus || null);
              const maintenanceMode = Array.isArray(resData) ? null : (resData.maintenanceMode || null);
              const backendVersion = Array.isArray(resData) ? undefined : resData.appVersion;
              this.setState({
                userSecurityLevel: this._toSecurityLevel(Array.isArray(resData) ? undefined : resData.userRole),
                serverUserEmail: Array.isArray(resData) ? undefined : resData.userEmail,
                devices: devicesList,
                scanStatus: scanStatus,
                globalMaintenanceMode: maintenanceMode,
                backendVersion: backendVersion || this.state.backendVersion,
                exclusions: Array.isArray(exclusions) ? exclusions : [],
                loading: false
              });
            })
            .catch(err => {
              this.setState({
                error: err.message || 'Failed to query authenticated Azure Function endpoints.',
                loading: false
              });
            });
        })
        .catch(err => {
          this.setState({
            error: err.message || 'SSO Identity initialization failed.',
            loading: false
          });
        });
    }
  }

  private _normalizeVolumeName = (volumeName: string): string => {
    if (!volumeName) return "";
    let clean = volumeName.trim().replace(/\\/g, "/");
    clean = clean.replace(/\/+$/, "");
    if (/^[a-zA-Z]:$/.test(clean)) {
      clean = clean.charAt(0);
    }
    return clean.toUpperCase();
  }

  private _buildVolumeTargetKey = (deviceName: string, agentName: string, volumeName: string): string => {
    const dev = (deviceName || "").trim().toLowerCase();
    const agt = (agentName || "").trim().toLowerCase();
    const vol = this._normalizeVolumeName(volumeName).toLowerCase();
    return `${dev}:${agt}:${vol}`;
  }

  private _findVolumeExclusion = (deviceName: string, agentName: string, volumeName: string): IExclusion | null => {
    const targetKey = this._buildVolumeTargetKey(deviceName, agentName, volumeName);
    const matches = this.state.exclusions.filter(e => {
      if (e.type !== 'Volume' || !e.target) return false;
      const parts = e.target.split(':');
      if (parts.length >= 3) {
        return this._buildVolumeTargetKey(parts[0], parts[1], parts.slice(2).join(':')) === targetKey;
      }
      return (e.target || '').toLowerCase().replace(/\\/g, '/').replace(/\/+$/, '') === targetKey;
    });
    return matches.length > 0 ? matches[0] : null;
  }

  private _findAgentExclusion = (deviceName: string, agentName: string): IExclusion | null => {
    const targetKey = `${(deviceName || '').trim().toLowerCase()}:${(agentName || '').trim().toLowerCase()}`;
    const matches = this.state.exclusions.filter(e => {
      if (e.type !== 'Agent' || !e.target) return false;
      return e.target.trim().toLowerCase() === targetKey;
    });
    return matches.length > 0 ? matches[0] : null;
  }

  private _addExclusion = (): void => {
    const { muteType, mutingDevice, mutingAgentName, mutingVolume, muteReason, isPermanent, durationDays, muteTicketNumber, userSecurityLevel } = this.state;
    const isEmergency = this.state.isEmergencyOverride && userSecurityLevel === 'Administrator';
    if (!mutingDevice) return;
    if (isPermanent && (!muteReason || !muteReason.trim())) return;
    if (!isEmergency && (!muteTicketNumber || !muteTicketNumber.trim())) return;

    this.setState({ actionLoading: true });
    
    let target = mutingDevice.deviceName;
    let resolvedTicketNumber = isEmergency ? "[OVERRIDE: EMERGENCY OUTAGE]" : (muteTicketNumber ? muteTicketNumber.trim() : undefined);
    if (muteType === 'Volume' && mutingVolume) {
      const parts = mutingVolume.id.split(':');
      const agt = parts[0] || '';
      const vol = this._normalizeVolumeName(parts.slice(1).join(':'));
      target = `${mutingDevice.deviceName}:${agt}:${vol}`;

      if (!resolvedTicketNumber && !isEmergency) {
        const existingExcl = this._findVolumeExclusion(mutingDevice.deviceName, agt, vol);
        if (existingExcl && existingExcl.ticketNumber) {
          resolvedTicketNumber = existingExcl.ticketNumber.trim();
        }
      }
    } else if (muteType === 'Agent' && mutingAgentName) {
      target = `${mutingDevice.deviceName}:${mutingAgentName}`;
      if (!resolvedTicketNumber && !isEmergency) {
        const existingExcl = this._findAgentExclusion(mutingDevice.deviceName, mutingAgentName);
        if (existingExcl && existingExcl.ticketNumber) {
          resolvedTicketNumber = existingExcl.ticketNumber.trim();
        }
      }
    } else if (muteType === 'Device') {
      if (!resolvedTicketNumber && !isEmergency) {
        const devTarget = mutingDevice.deviceName.toLowerCase();
        const filteredDev = this.state.exclusions.filter(function (e: IExclusion) { return e.type === 'Device' && (e.target || '').toLowerCase() === devTarget; });
        const existingExcl = filteredDev.length > 0 ? filteredDev[0] : null;
        if (existingExcl && existingExcl.ticketNumber) {
          resolvedTicketNumber = existingExcl.ticketNumber.trim();
        }
      }
    }

    const payload = {
      type: muteType,
      target: target,
      reason: (muteReason && muteReason.trim()) ? muteReason.trim() : (isPermanent ? "" : "None provided (Temporary exclusion)"),
      isPermanent: isPermanent,
      durationDays: durationDays,
      ticketNumber: resolvedTicketNumber,
      isEmergencyOverride: isEmergency
    };

    const isLocal = this._isLocalDev();
    const exclusionsBaseUrl = this._getExclusionsUrl();
    const exclusionsUrl = exclusionsBaseUrl;
    const reqHeaders = {
      'Content-Type': 'application/json'
    };

    if (isLocal) {
      fetch(exclusionsUrl, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(payload)
      })
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw new Error(errData.error || `Server responded with status ${res.status}`);
            });
          }
          return res.json();
        })
        .then(() => {
          this.setState({ isMutingModalOpen: false, muteReason: '', actionLoading: false });
          this._fetchData(); // reload
        })
        .catch(err => {
          alert('Failed to save exclusion: ' + err.message);
          this.setState({ actionLoading: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then((client: AadHttpClient) => {
          client.fetch(exclusionsUrl, AadHttpClient.configurations.v1, {
            method: 'POST',
            headers: reqHeaders,
            body: JSON.stringify(payload)
          })
            .then(res => {
              if (res.status >= 400) {
                return res.json().then(errData => {
                  throw new Error(errData.error || `Server responded with status ${res.status}`);
                });
              }
              return res.json();
            })
            .then(() => {
              this.setState({ isMutingModalOpen: false, muteReason: '', actionLoading: false });
              this._fetchData();
            })
            .catch(err => {
              alert('Failed to save exclusion: ' + err.message);
              this.setState({ actionLoading: false });
            });
        })
        .catch(authErr => {
          alert('Authentication failed: ' + authErr.message);
          this.setState({ actionLoading: false });
        });
    }
  }

  private _removeExclusion = (id: string): void => {
    if (!confirm('Are you sure you want to remove this alert exclusion?')) return;

    this.setState({ actionLoading: true });
    const isLocal = this._isLocalDev();
    const exclusionsUrl = this._getExclusionsUrl() + `?id=${encodeURIComponent(id)}`;
    const reqHeaders = {};

    if (isLocal) {
      fetch(exclusionsUrl, { method: 'DELETE', headers: reqHeaders })
        .then(res => {
          if (!res.ok) {
            return res.json().then(errData => {
              throw new Error(errData.error || `Server responded with status ${res.status}`);
            });
          }
          return res.json();
        })
        .then(() => {
          this.setState({ actionLoading: false });
          this._fetchData();
        })
        .catch(err => {
          alert('Failed to remove exclusion: ' + err.message);
          this.setState({ actionLoading: false });
        });
    } else {
      this.props.aadHttpClientFactory
        .getClient(this.props.backendApiResourceId)
        .then((client: AadHttpClient) => {
          client.fetch(exclusionsUrl, AadHttpClient.configurations.v1, {
            method: 'DELETE',
            headers: reqHeaders
          })
            .then(res => {
              if (res.status >= 400) {
                return res.json().then(errData => {
                  throw new Error(errData.error || `Server responded with status ${res.status}`);
                });
              }
              return res.json();
            })
            .then(() => {
              this.setState({ actionLoading: false });
              this._fetchData();
            })
            .catch(err => {
              alert('Failed to remove exclusion: ' + err.message);
              this.setState({ actionLoading: false });
            });
        })
        .catch(authErr => {
          alert('Authentication failed: ' + authErr.message);
          this.setState({ actionLoading: false });
        });
    }
  }

  // DISCRETE 1: Open Silence Appliance Modal
  private _openSilenceApplianceModal = (device: IDattoDevice): void => {
    const target = device.deviceName.toLowerCase();
    const filtered = this.state.exclusions.filter(e => e.type === 'Device' && e.target.toLowerCase() === target);
    const excl = filtered.length > 0 ? filtered[0] : null;

    this.setState({
      isMutingModalOpen: true,
      mutingDevice: device,
      mutingAgentName: null,
      mutingVolume: null,
      muteType: 'Device',
      muteReason: excl ? excl.reason : '',
      isPermanent: excl && excl.isPermanent !== undefined ? Boolean(excl.isPermanent) : true,
      durationDays: 3,
      muteTicketNumber: excl?.ticketNumber || '',
      mutingExclusionId: excl ? excl.id : null
    });
  }

  // DISCRETE 2: Open Silence Agent Modal
  private _openSilenceAgentModal = (device: IDattoDevice, agentName: string): void => {
    const excl = this._findAgentExclusion(device.deviceName, agentName);

    this.setState({
      isMutingModalOpen: true,
      mutingDevice: device,
      mutingAgentName: agentName,
      mutingVolume: null,
      muteType: 'Agent',
      muteReason: excl ? excl.reason : '',
      isPermanent: excl && excl.isPermanent !== undefined ? Boolean(excl.isPermanent) : true,
      durationDays: 3,
      muteTicketNumber: excl?.ticketNumber || '',
      mutingExclusionId: excl ? excl.id : null
    });
  }

  // DISCRETE 3: Open Volume Exclusion Note Modal
  private _openVolumeModal = (device: IDattoDevice, volumeName: string, agentName: string): void => {
    const excl = this._findVolumeExclusion(device.deviceName, agentName, volumeName);

    this.setState({
      isMutingModalOpen: true,
      mutingDevice: device,
      mutingAgentName: agentName,
      mutingVolume: { id: `${agentName}:${volumeName}`, name: `${agentName} - ${volumeName}` },
      muteType: 'Volume',
      muteReason: excl ? excl.reason : '',
      isPermanent: excl && excl.isPermanent !== undefined ? Boolean(excl.isPermanent) : false,
      durationDays: 3,
      muteTicketNumber: excl?.ticketNumber || '',
      mutingExclusionId: excl ? excl.id : null
    });
  }



  private _toggleExpand = (deviceName: string): void => {
    this.setState(prevState => {
      const expandedAppliances = { ...prevState.expandedAppliances };
      expandedAppliances[deviceName] = !expandedAppliances[deviceName];
      return { expandedAppliances };
    });
  }

  private _formatStorage = (gb: number): string => {
    if (gb >= 1024) {
      return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
  }

  /**
   * Look up the custom exclusion reason for a volume from the live (un-cached)
   * exclusions list. Falls back to defaultReason if no custom note exists.
   */
  private _getVolumeExclusionReason = (deviceName: string, agentName: string, volName: string, defaultReason: string): string => {
    const matched = this._findVolumeExclusion(deviceName, agentName, volName);
    return matched ? matched.reason : defaultReason;
  }

  public render(): React.ReactElement<IBackupWatchProps> {
    const { loading, error, devices, cacheStatus, exclusions, isSettingsOpen, isMutingModalOpen, mutingDevice, muteType, muteReason, actionLoading, activeTab, activeFilter, isFullScreen, isEscalateModalOpen, escalateDevice, escalateIssues, selectedIssueIds, isDarkMode, isAuditLogsOpen, auditLogs, auditSearchQuery, auditLoading, auditError, userSecurityLevel } = this.state;
    const { userDisplayName } = this.props;

    // Filter devices based on Active vs Cancelled tab
    const tabDevices = devices.filter(d => activeTab === 'active' ? (d.isActive !== false) : (d.isActive === false));

    // Aggregations for the 7 top metrics cards based on current tab's devices
    const totalAppliances = tabDevices.length;
    const screenshotFailuresCount = tabDevices.filter(d => d.agents && d.agents.some(a => !a.isArchived && a.screenshotVerification && !a.screenshotVerification.success)).length;
    const storageCriticalCount = tabDevices.filter(d => d.storageUsedPercent > 85).length;
    const volumeExclusionsCount = tabDevices.reduce((sum, d) => sum + (d.applianceExclusionsCount || 0), 0);
    
    // Offline Appliances: Appliance is offline or any active agent has status Offline (or device status is offline)
    const offlineDevicesCount = tabDevices.filter(d => 
      (d as any).status === 'offline' || 
      (d as any).isOffline || 
      (d.agents && d.agents.some(a => a.status === 'Archived' ? false : (a as any).status === 'Offline'))
    ).length;

    // Local Backup Failures: count of active agents with failed last backups
    const localBackupFailuresCount = tabDevices.filter(d => 
      d.agents && d.agents.some(a => !a.isArchived && a.lastBackupStatus && !a.lastBackupStatus.success)
    ).length;

    // Offsite Sync Issues: count of appliances with offsite sync errors
    const offsiteSyncIssuesCount = tabDevices.filter(d => 
      (d as any).offsiteSyncFailed || 
      (d as any).offsiteStatus === 'Error' || 
      (d as any).offsiteSyncStatus === 'Critical' || 
      (d as any).offsiteSyncStatus === 'Warning' ||
      (d.backupStatus === 'Failed' && d.agents && !d.agents.some(a => a.lastBackupStatus && !a.lastBackupStatus.success))
    ).length;

    // Overdue Backups: count of active agents with no successful backups in the last 24h
    const overdueBackupsCount = tabDevices.reduce((sum, d) => {
      if (!d.agents) return sum;
      const count = d.agents.filter(a => !a.isArchived && this._isBackupOverdue(a.lastBackupStatus)).length;
      return sum + count;
    }, 0);

    // Apply active metric filter to devices list before rendering
    let filteredDevices = [...tabDevices];
    if (activeFilter) {
      if (activeFilter === 'Screenshot Failures') {
        filteredDevices = filteredDevices.filter(d => d.agents && d.agents.some(a => !a.isArchived && a.screenshotVerification && !a.screenshotVerification.success));
      } else if (activeFilter === 'Storage Critical (>85%)') {
        filteredDevices = filteredDevices.filter(d => d.storageUsedPercent > 85);
      } else if (activeFilter === 'Volume Exclusions') {
        filteredDevices = filteredDevices.filter(d => d.applianceExclusionsCount > 0);
      } else if (activeFilter === 'Offline Appliances') {
        filteredDevices = filteredDevices.filter(d => (d as any).status === 'offline' || (d as any).isOffline || (d.agents && d.agents.some(a => a.status === 'Archived' ? false : (a as any).status === 'Offline')));
      } else if (activeFilter === 'Local Backup Failures') {
        filteredDevices = filteredDevices.filter(d => d.agents && d.agents.some(a => !a.isArchived && a.lastBackupStatus && !a.lastBackupStatus.success));
      } else if (activeFilter === 'Offsite Sync Issues') {
        filteredDevices = filteredDevices.filter(d => (d as any).offsiteSyncFailed || (d as any).offsiteStatus === 'Error' || (d as any).offsiteSyncStatus === 'Critical' || (d as any).offsiteSyncStatus === 'Warning' || (d.backupStatus === 'Failed' && d.agents && !d.agents.some(a => a.lastBackupStatus && !a.lastBackupStatus.success)));
      } else if (activeFilter === 'Overdue Backups (>24h)') {
        filteredDevices = filteredDevices.filter(d => d.agents && d.agents.some(a => !a.isArchived && this._isBackupOverdue(a.lastBackupStatus)));
      }
    }

    // Apply search query filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase().trim();
      filteredDevices = filteredDevices.filter(d => 
        d.deviceName.toLowerCase().indexOf(query) > -1 || 
        (d.companyName && d.companyName.toLowerCase().indexOf(query) > -1) || 
        d.model.toLowerCase().indexOf(query) > -1 ||
        d.serialNumber.toLowerCase().indexOf(query) > -1
      );
    }

    // Pagination calculations
    const totalItems = filteredDevices.length;
    const totalPages = Math.ceil(totalItems / this.state.pageSize);
    const currentPage = Math.min(this.state.currentPage, totalPages || 1);
    const startIndex = (currentPage - 1) * this.state.pageSize;
    const paginatedDevices = filteredDevices.slice(startIndex, startIndex + this.state.pageSize);

    // Root styles which conditionally toggle Full Screen Focus Mode
    const rootStyle: React.CSSProperties = isFullScreen ? {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 99999,
      overflowY: 'auto',
      background: 'var(--bg-app)',
      color: 'var(--text-main)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem 1.5rem',
      boxSizing: 'border-box',
      transition: 'background var(--transition-speed), color var(--transition-speed)'
    } : {
      background: 'var(--bg-app)',
      color: 'var(--text-main)',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      padding: '2rem 1.5rem',
      borderRadius: '8px',
      position: 'relative',
      boxSizing: 'border-box',
      transition: 'background var(--transition-speed), color var(--transition-speed)'
    };

    return (
      <div className="backup-watch-root" data-theme={isDarkMode ? 'dark' : 'light'} style={rootStyle}>
        <BackupWatchStyles />

        {/* Global Maintenance Blackout Active Banner */}
        {this.state.globalMaintenanceMode && this.state.globalMaintenanceMode.isActive && (
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '10px',
            padding: '0.85rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🚨</span>
              <div>
                <strong style={{ color: '#ef4444', fontSize: '0.92rem' }}>
                  GLOBAL MAINTENANCE BLACKOUT ACTIVE
                </strong>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.15rem' }}>
                  Automated Autotask compliance ticket generation is silenced across all appliances.
                  {this.state.globalMaintenanceMode.expiresAt && (
                    <span> Auto-resumes: <strong>{new Date(this.state.globalMaintenanceMode.expiresAt).toLocaleString()}</strong></span>
                  )}
                  {this.state.globalMaintenanceMode.reason && (
                    <span> — <em>"{this.state.globalMaintenanceMode.reason}"</em></span>
                  )}
                </div>
              </div>
            </div>
            {userSecurityLevel === 'Administrator' && (
              <button
                onClick={() => this._openAdminModal('blackout')}
                className="bw-btn"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                ⚙️ Manage Blackout
              </button>
            )}
          </div>
        )}

        {/* Header (Next-Gen Gradient Hero Card) */}
        <HeaderBar
          version={this.state.backendVersion || this.props.version}
          isSettingsOpen={isSettingsOpen}
          userSecurityLevel={userSecurityLevel}
          isDarkMode={isDarkMode}
          isFullScreen={isFullScreen}
          userDisplayName={userDisplayName}
          userEmail={this.state.serverUserEmail}
          onToggleSettings={(open) => this.setState({ isSettingsOpen: open })}
          onOpenAuditLogs={this._openAuditLogs}
          onOpenAdminModal={this._openAdminModal}
          onToggleTheme={this._toggleTheme}
          onToggleFullScreen={() => this.setState({ isFullScreen: !isFullScreen })}
        />

        {/* Cache status info box (Force refresh restricted to Specialist/Admin) */}
        {cacheStatus && !isSettingsOpen && (
          <div className="bw-status-bar">
            <span>In-Memory Cache Status: <strong>{cacheStatus}</strong></span>
            {(userSecurityLevel === 'Specialist' || userSecurityLevel === 'Administrator') && (
              <button onClick={this._fetchData} className="bw-btn-refresh">
                Force Refresh
              </button>
            )}
          </div>
        )}

        {/* EXCLUSIONS SETTINGS VIEW */}
        {isSettingsOpen ? (
          <ExclusionsTable
            exclusions={exclusions}
            userSecurityLevel={userSecurityLevel}
            actionLoading={actionLoading}
            onRemoveExclusion={this._removeExclusion}
          />
        ) : (
          /* DASHBOARD VIEW */
          <div className="bw-main-card">
            {/* Active vs Cancelled Tabs */}
            <div className="bw-controls-row">
              <div className="bw-tabs-group">
                <button
                  onClick={() => this.setState({ activeTab: 'active', currentPage: 1 })}
                  className={`bw-tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                >
                  Active Appliances
                </button>
                <button
                  onClick={() => this.setState({ activeTab: 'cancelled', currentPage: 1 })}
                  className={`bw-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
                >
                  Cancelled Appliances
                </button>
              </div>

              {/* Search Bar */}
              <div className="bw-search-wrapper">
                <input
                  type="text"
                  placeholder="Search appliance, client, model..."
                  value={this.state.searchQuery}
                  onChange={(e) => this.setState({ searchQuery: e.target.value, currentPage: 1 })}
                  className="bw-search-input"
                />
                <span className="search-icon">🔍</span>
                {this.state.searchQuery && (
                  <button
                    onClick={() => this.setState({ searchQuery: '', currentPage: 1 })}
                    style={{
                      position: 'absolute',
                      right: '0.8rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 8-Card Metrics Grid */}
            <MetricCards
              loading={loading}
              activeFilter={activeFilter}
              isDarkMode={isDarkMode}
              totalAppliances={totalAppliances}
              screenshotFailuresCount={screenshotFailuresCount}
              storageCriticalCount={storageCriticalCount}
              volumeExclusionsCount={volumeExclusionsCount}
              offlineDevicesCount={offlineDevicesCount}
              localBackupFailuresCount={localBackupFailuresCount}
              offsiteSyncIssuesCount={offsiteSyncIssuesCount}
              overdueBackupsCount={overdueBackupsCount}
              onFilterToggle={(filterTitle) => this.setState({ activeFilter: filterTitle, currentPage: 1 })}
            />

            {/* Content Area */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                Loading live Datto BCDR appliance streams...
              </div>
            ) : error ? (
              <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', color: 'var(--color-danger)', padding: '1rem', borderRadius: '6px' }}>
                <strong>Fetch Error:</strong> {error}
              </div>
            ) : (
              <>
                <div className="bw-table-container">
                  <table className="bw-table">
                    <thead>
                      <tr>
                        <th className="bw-chevron-col"></th>
                        <th className="bw-col-name">Appliance Name</th>
                        <th className="bw-col-model">Model / Serial</th>
                        <th className="bw-col-storage">Local Storage</th>
                        <th className="bw-col-lastseen">Last Seen</th>
                        <th className="bw-col-status">Backup Status</th>
                        <th className="bw-col-exclusions">Exclusions</th>
                        <th className="bw-col-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDevices.map((device, idx) => {
                        const isExpanded = !!this.state.expandedAppliances[device.deviceName];
                        return (
                          <React.Fragment key={idx}>
                            <tr 
                              onClick={() => this._toggleExpand(device.deviceName)}
                              className={`bw-appliance-row ${isExpanded ? 'expanded' : ''}`}
                            >
                              {/* Chevron */}
                              <td className="bw-chevron-col">
                                <span className="bw-chevron-indicator">▶</span>
                              </td>
                              {/* Name & Mute note */}
                              <td className="bw-col-name">
                                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{device.deviceName}</div>
                                {device.companyName && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                    {device.companyName}
                                  </div>
                                )}
                                {device.exclusionReason && (
                                  <div style={{ fontSize: '0.73rem', color: 'var(--color-purple)', fontWeight: 400, marginTop: '0.15rem' }}>
                                    Reason: {device.exclusionReason}
                                  </div>
                                )}
                              </td>
                              {/* Model & Serial */}
                              <td className="bw-col-model" style={{ color: 'var(--text-muted)' }}>
                                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{device.model}</div>
                                <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                                  {device.serialNumber}
                                </div>
                              </td>
                              {/* Local Storage progress bar */}
                              <td className="bw-col-storage">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <div className="bw-progress-bar-track">
                                    <div className={`bw-progress-bar-fill ${device.storageUsedPercent >= 90 ? 'danger' : (device.storageUsedPercent >= 70 ? 'warning' : 'success')}`}
                                      style={{ width: `${device.storageUsedPercent}%` }}
                                    />
                                  </div>
                                  <span className="storage-label-text">
                                    {this._formatStorage(device.usedStorageGB)} / {this._formatStorage(device.totalStorageGB)} ({device.storageUsedPercent}%)
                                  </span>
                                </div>
                              </td>
                              {/* Last Seen Heartbeat */}
                              <td className="bw-col-lastseen">
                                {this._renderLastSeen(device.lastCheckin)}
                              </td>
                              {/* Backup status pills */}
                              <td className="bw-col-status">
                                {(() => {
                                  const tags: { text: string; type: 'success' | 'danger' | 'warning' | 'purple' }[] = [];
                                  const isOffline = (device as any).status === 'offline' || (device as any).isOffline || (device.agents && device.agents.some((a: any) => !a.isArchived && a.status === 'Offline'));
                                  const hasBackupFail = device.agents && device.agents.some(a => !a.isArchived && a.lastBackupStatus && !a.lastBackupStatus.success);
                                  const hasScreenshotFail = (device.backupStatus === 'Failed') || (device.agents && device.agents.some(a => !a.isArchived && a.screenshotVerification && !a.screenshotVerification.success));
                                  const hasStorageWarning = device.storageUsedPercent > 85;

                                  if (isOffline) tags.push({ text: 'Offline', type: 'danger' });
                                  if (device.backupStatus === 'Muted') tags.push({ text: 'Muted (Excl)', type: 'purple' });
                                  if (hasBackupFail) tags.push({ text: 'Backup Fail', type: 'danger' });
                                  if (hasScreenshotFail) tags.push({ text: 'Screenshot Fail', type: 'danger' });
                                  if (hasStorageWarning) tags.push({ text: 'Storage Warning', type: 'warning' });

                                  if (tags.length === 0) {
                                    tags.push({ text: 'Healthy', type: 'success' });
                                  }

                                  return (
                                    <div style={{ display: 'flex', flexDirection: tags.length > 2 ? 'column' : 'row', gap: '0.35rem', alignItems: 'flex-start' }}>
                                      {tags.map((tag, tagIdx) => (
                                        <span key={tagIdx} className={`bw-badge-pill ${tag.type}`}>
                                          {tag.text}
                                        </span>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* Exclusions */}
                              <td className="bw-col-exclusions">
                                {device.applianceExclusionsCount > 0 ? (
                                  <span style={{ color: 'var(--color-purple)', fontWeight: 700, fontSize: '0.85rem' }}>
                                    {device.applianceExclusionsCount} excluded
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                                )}
                              </td>
                              {/* Actions */}
                              <td className="bw-col-actions">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'stretch' }} onClick={(e) => e.stopPropagation()}>
                                  {device.storageTicketReference && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <a 
                                        href={(device.storageTicketReference as any).ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${(device.storageTicketReference as any).ticketId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Open AutoTask Ticket"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                          color: 'var(--color-success)',
                                          border: '1px solid rgba(16, 185, 129, 0.25)',
                                          borderRadius: '4px',
                                          padding: '0.3rem 0.7rem',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          flexGrow: 1
                                        }}
                                      >
                                        🎫 Storage Ticket #{(device.storageTicketReference as any).ticketNumber || (device.storageTicketReference as any).ticketId} ({(device.storageTicketReference as any).status})
                                      </a>
                                      <button
                                        onClick={(e) => this._copyTicketBrief(
                                          device.companyName || "Unknown Company",
                                          device.deviceName,
                                          undefined,
                                          "Storage Critical",
                                          (device.storageTicketReference as any).ticketNumber || (device.storageTicketReference as any).ticketId,
                                          e
                                        )}
                                        title="Copy Ticket Brief"
                                        style={{
                                          background: 'var(--bg-panel)',
                                          border: '1px solid var(--border-element)',
                                          borderRadius: '4px',
                                          color: 'var(--text-muted)',
                                          padding: '0.3rem 0.5rem',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        {this.state.copiedTicketId === (device.storageTicketReference as any).ticketId ? '📋 Copied!' : '📋'}
                                      </button>
                                    </div>
                                  )}
                                  {(device as any).offlineTicketReference && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <a 
                                        href={(device as any).offlineTicketReference.ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${(device as any).offlineTicketReference.ticketId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Open AutoTask Ticket"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                          color: 'var(--color-success)',
                                          border: '1px solid rgba(16, 185, 129, 0.25)',
                                          borderRadius: '4px',
                                          padding: '0.3rem 0.7rem',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          flexGrow: 1
                                        }}
                                      >
                                        🎫 Offline Ticket #{(device as any).offlineTicketReference.ticketNumber || (device as any).offlineTicketReference.ticketId} ({(device as any).offlineTicketReference.status})
                                      </a>
                                      <button
                                        onClick={(e) => this._copyTicketBrief(
                                          device.companyName || "Unknown Company",
                                          device.deviceName,
                                          undefined,
                                          "Appliance Offline",
                                          (device as any).offlineTicketReference.ticketNumber || (device as any).offlineTicketReference.ticketId,
                                          e
                                        )}
                                        title="Copy Ticket Brief"
                                        style={{
                                          background: 'var(--bg-panel)',
                                          border: '1px solid var(--border-element)',
                                          borderRadius: '4px',
                                          color: 'var(--text-muted)',
                                          padding: '0.3rem 0.5rem',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        {this.state.copiedTicketId === (device as any).offlineTicketReference.ticketId ? '📋 Copied!' : '📋'}
                                      </button>
                                    </div>
                                  )}
                                  {(device as any).offsitesyncTicketReference && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <a 
                                        href={(device as any).offsitesyncTicketReference.ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${(device as any).offsitesyncTicketReference.ticketId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Open AutoTask Ticket"
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                          color: 'var(--color-success)',
                                          border: '1px solid rgba(16, 185, 129, 0.25)',
                                          borderRadius: '4px',
                                          padding: '0.3rem 0.7rem',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          textDecoration: 'none',
                                          cursor: 'pointer',
                                          flexGrow: 1
                                        }}
                                      >
                                        🎫 Sync Ticket #{(device as any).offsitesyncTicketReference.ticketNumber || (device as any).offsitesyncTicketReference.ticketId} ({(device as any).offsitesyncTicketReference.status})
                                      </a>
                                      <button
                                        onClick={(e) => this._copyTicketBrief(
                                          device.companyName || "Unknown Company",
                                          device.deviceName,
                                          undefined,
                                          "Offsite Sync Issue",
                                          (device as any).offsitesyncTicketReference.ticketNumber || (device as any).offsitesyncTicketReference.ticketId,
                                          e
                                        )}
                                        title="Copy Ticket Brief"
                                        style={{
                                          background: 'var(--bg-panel)',
                                          border: '1px solid var(--border-element)',
                                          borderRadius: '4px',
                                          color: 'var(--text-muted)',
                                          padding: '0.3rem 0.5rem',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          transition: 'all 0.15s'
                                        }}
                                      >
                                        {this.state.copiedTicketId === (device as any).offsitesyncTicketReference.ticketId ? '📋 Copied!' : '📋'}
                                      </button>
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {userSecurityLevel !== 'Viewer' && !device.storageTicketReference && !(device as any).offlineTicketReference && !(device as any).offsitesyncTicketReference && (
                                      <button
                                        disabled={!this._getEscalationIssues(device).length}
                                        className="bw-btn"
                                        style={{
                                          backgroundColor: this._getEscalationIssues(device).length ? 'var(--color-primary)' : 'transparent',
                                          color: this._getEscalationIssues(device).length ? '#ffffff' : 'var(--text-muted)',
                                          border: this._getEscalationIssues(device).length ? 'none' : '1px solid var(--border-element)',
                                          padding: '0.4rem 0.8rem',
                                          borderRadius: '6px',
                                          fontSize: '0.75rem',
                                          cursor: this._getEscalationIssues(device).length ? 'pointer' : 'not-allowed',
                                          opacity: this._getEscalationIssues(device).length ? 1 : 0.5,
                                          width: '100%',
                                          justifyContent: 'center'
                                        }}
                                        onClick={() => this._openEscalateModal(device)}
                                      >
                                        Escalate
                                      </button>
                                    )}
                                    {userSecurityLevel !== 'Viewer' && (!exclusions.some(e => e.type === 'Device' && e.target.toLowerCase() === device.deviceName.toLowerCase()) ? (
                                      <button
                                        onClick={() => this._openSilenceApplianceModal(device)}
                                        className="bw-btn"
                                        style={{
                                          backgroundColor: 'transparent',
                                          color: 'var(--color-purple)',
                                          border: '1px solid rgba(139, 92, 246, 0.5)',
                                          padding: '0.4rem 0.8rem',
                                          borderRadius: '6px',
                                          fontSize: '0.75rem',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        🔇 Silence Appliance
                                      </button>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          const filtered = exclusions.filter(e => e.type === 'Device' && e.target.toLowerCase() === device.deviceName.toLowerCase());
                                          const excl = filtered.length > 0 ? filtered[0] : null;
                                          if (excl) {
                                            this._removeExclusion(excl.id);
                                          }
                                        }}
                                        className="bw-btn"
                                        style={{
                                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                          color: 'var(--color-success)',
                                          border: '1px solid rgba(16, 185, 129, 0.3)',
                                          padding: '0.4rem 0.8rem',
                                          borderRadius: '6px',
                                          fontSize: '0.75rem',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        🔊 Unsilence Appliance
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Agents Panel Row */}
                            {isExpanded && (
                              <tr style={{ borderBottom: '2px solid var(--color-primary)' }}>
                                <td colSpan={8} style={{ padding: 0 }}>
                                  <div className="bw-agents-panel">
                                    <div className="bw-agents-panel-title">
                                      Protected Agents — {device.deviceName}
                                    </div>
                                    
                                    {(() => {
                                      let displayAgents = device.agents || [];
                                      if (activeFilter) {
                                        if (activeFilter === 'Screenshot Failures') {
                                          displayAgents = displayAgents.filter(a => !a.isArchived && a.screenshotVerification && !a.screenshotVerification.success);
                                        } else if (activeFilter === 'Volume Exclusions') {
                                          displayAgents = displayAgents.filter(a => !a.isArchived && a.excludedVolumesCount > 0);
                                        } else if (activeFilter === 'Offline Appliances') {
                                          const isAppOffline = (device as any).status === 'offline' || (device as any).isOffline;
                                          if (!isAppOffline) {
                                            displayAgents = displayAgents.filter(a => !a.isArchived && (a.status as string) === 'Offline');
                                          }
                                        } else if (activeFilter === 'Local Backup Failures') {
                                          displayAgents = displayAgents.filter(a => !a.isArchived && a.lastBackupStatus && !a.lastBackupStatus.success);
                                        }
                                      }

                                      if (displayAgents.length === 0) {
                                        return (
                                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                            {activeFilter ? `No protected agents matching filter "${activeFilter}" on this appliance.` : 'No protected agents found on this appliance.'}
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="bw-agents-cards-grid">
                                          {displayAgents.map((agent, aIdx) => {
                                            const hasExclusions = agent.excludedVolumesCount > 0;
                                            return (
                                              <div 
                                                key={aIdx} 
                                                className="bw-agent-card"
                                                style={{
                                                  backgroundColor: 'var(--bg-glass)',
                                                  border: `1px solid ${agent.status === 'Silenced' ? 'var(--color-purple)' : (hasExclusions ? 'var(--color-warning)' : 'var(--border-glass)')}`,
                                                  borderRadius: '12px',
                                                  padding: '1.1rem',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  justifyContent: 'space-between',
                                                  boxShadow: 'var(--shadow-sm)',
                                                  transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                  e.currentTarget.style.borderColor = agent.status === 'Silenced' ? 'var(--color-purple)' : (hasExclusions ? 'var(--color-warning)' : 'rgba(255, 107, 0, 0.25)');
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.transform = 'none';
                                                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                                  e.currentTarget.style.borderColor = agent.status === 'Silenced' ? 'var(--color-purple)' : (hasExclusions ? 'var(--color-warning)' : 'var(--border-glass)');
                                                }}
                                              >
                                                <div>
                                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: (agent.isArchived || agent.status === 'Silenced') ? 'var(--text-muted)' : 'var(--text-main)', textDecoration: agent.isArchived ? 'line-through' : 'none' }}>
                                                      {agent.name}
                                                    </span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                      {agent.status === 'Silenced' ? (
                                                        <span className="bw-badge-pill purple" style={{ fontWeight: 800 }}>
                                                          🔇 Silenced Agent
                                                        </span>
                                                      ) : (
                                                        <span className={`bw-badge-pill ${agent.isArchived ? 'muted' : (agent.isPaused || agent.excludedVolumesCount > 0 ? 'warning' : 'success')}`}>
                                                          {agent.isArchived ? 'Archived' : (agent.isPaused ? (agent.excludedVolumesCount > 0 ? `${agent.excludedVolumesCount} excl.` : 'Paused') : (agent.excludedVolumesCount > 0 ? `${agent.excludedVolumesCount} excl.` : '✓ All vol.'))}
                                                        </span>
                                                      )}
                                                      {!agent.isArchived && userSecurityLevel !== 'Viewer' && (
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            this._openSilenceAgentModal(device, agent.name);
                                                          }}
                                                          title={agent.status === 'Silenced' ? "Edit / Remove Agent Silence" : "Silence this Server/Agent"}
                                                          style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            color: agent.status === 'Silenced' ? 'var(--color-purple)' : 'var(--text-muted)'
                                                          }}
                                                        >
                                                          🔇
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.8rem', lineHeight: 1.3 }}>
                                                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                      {agent.osName || 'Unknown OS'}
                                                    </div>
                                                    <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                      Last snap: {agent.lastSnapshot || 'N/A'} {agent.isPaused && '(Paused)'}
                                                    </div>
                                                  </div>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.8rem' }}>
                                                  {/* Protected Volumes */}
                                                  {(() => {
                                                    const uniqueProtectedVolumes: string[] = [];
                                                    (agent.protectedVolumeNames || []).forEach((v: string) => {
                                                      const norm = this._normalizeVolumeName(v);
                                                      if (norm && uniqueProtectedVolumes.indexOf(norm) === -1) {
                                                        uniqueProtectedVolumes.push(norm);
                                                      }
                                                    });
                                                    return uniqueProtectedVolumes.map((volName: string, vIdx: number) => {
                                                      const matchedExcl = this._findVolumeExclusion(device.deviceName, agent.name, volName);
                                                      const isVolExcl = Boolean(matchedExcl);
                                                      const displayReason = matchedExcl ? matchedExcl.reason : this._getVolumeExclusionReason(device.deviceName, agent.name, volName, '');
                                                      const ticketNumber = matchedExcl?.ticketNumber;
                                                      const ticketUrl = matchedExcl?.ticketUrl;

                                                      // Visual theme: Amber if pre-excluded, green if standard included
                                                      const dotColor = isVolExcl ? '#f59e0b' : 'var(--color-success)';
                                                      const badgeColor = isVolExcl ? '#f59e0b' : 'var(--color-success)';
                                                      const badgeText = isVolExcl ? 'Pre-Excluded (Planned)' : 'Included';

                                                      return (
                                                        <div key={`p-${vIdx}`}>
                                                          <div className={`bw-volume-row ${isVolExcl ? 'excluded' : ''}`} style={isVolExcl ? { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.04)' } : undefined}>
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                                                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: dotColor }} />
                                                              {volName}
                                                            </span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                              <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', color: badgeColor }}>
                                                                {badgeText}
                                                              </span>
                                                              {!agent.isArchived && userSecurityLevel !== 'Viewer' && (
                                                                <button 
                                                                  title={isVolExcl ? "Edit Maintenance / Exclusion Note" : "Pre-Exclude Volume (Maintenance Mode)"}
                                                                  onClick={() => this._openVolumeModal(device, volName, agent.name)}
                                                                  style={{ background: 'none', border: 'none', color: isVolExcl ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', padding: '0.15rem' }}
                                                                >
                                                                  ✏️
                                                                </button>
                                                              )}
                                                            </div>
                                                          </div>
                                                          {(displayReason || ticketNumber) ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                              {displayReason && (
                                                                <div className="bw-vol-note-msg" style={{ fontSize: '0.68rem', color: isVolExcl ? '#d97706' : 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem', paddingLeft: '0.9rem', wordBreak: 'break-all' }}>
                                                                  "{displayReason}"
                                                                </div>
                                                              )}
                                                              {ticketNumber && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem', paddingLeft: '0.9rem' }}>
                                                                  <a
                                                                    href={ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${ticketNumber}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                      color: 'var(--color-success)',
                                                                      fontSize: '0.7rem',
                                                                      fontWeight: 600,
                                                                      textDecoration: 'none',
                                                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                                                      padding: '0.1rem 0.4rem',
                                                                      borderRadius: '3px',
                                                                      display: 'inline-flex',
                                                                      alignItems: 'center',
                                                                      gap: '0.25rem'
                                                                    }}
                                                                  >
                                                                    🎫 Ticket #{ticketNumber}
                                                                  </a>
                                                                </div>
                                                              )}
                                                            </div>
                                                          ) : null}
                                                        </div>
                                                      );
                                                    });
                                                  })()}

                                                  {/* Unprotected (Natively Excluded) Volumes */}
                                                  {(() => {
                                                    const uniqueUnprotectedVolumes: string[] = [];
                                                    (agent.unprotectedVolumeNames || []).forEach((v: string) => {
                                                      const norm = this._normalizeVolumeName(v);
                                                      if (norm && uniqueUnprotectedVolumes.indexOf(norm) === -1) {
                                                        uniqueUnprotectedVolumes.push(norm);
                                                      }
                                                    });
                                                    return uniqueUnprotectedVolumes.map((volName: string, uIdx: number) => {
                                                      const filteredExcl = agent.excludedVolumes.filter(ev => this._normalizeVolumeName(ev.name) === volName);
                                                      const excl = filteredExcl.length > 0 ? filteredExcl[0] : null;
                                                      const reason = this._getVolumeExclusionReason(device.deviceName, agent.name, volName, "");
                                                      const matchedExcl = this._findVolumeExclusion(device.deviceName, agent.name, volName);
                                                      const ticketNumber = matchedExcl?.ticketNumber;
                                                      const ticketUrl = matchedExcl?.ticketUrl;
                                                    return (
                                                      <div key={`u-${uIdx}`}>
                                                        <div className="bw-volume-row excluded">
                                                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-danger)' }} />
                                                            {volName}
                                                          </span>
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                            <span style={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-danger)' }}>
                                                              Excluded (Datto BCDR)
                                                            </span>
                                                            {!agent.isArchived && userSecurityLevel !== 'Viewer' && (
                                                              <button 
                                                                title={excl ? "Edit Note" : "Add Note"}
                                                                onClick={() => this._openVolumeModal(device, volName, agent.name)}
                                                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', padding: '0.15rem' }}
                                                              >
                                                                ✏️
                                                              </button>
                                                            )}
                                                          </div>
                                                        </div>
                                                         {(reason || ticketNumber) ? (
                                                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                                             {reason && (
                                                          <div className="bw-vol-note-msg" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem', paddingLeft: '0.9rem', wordBreak: 'break-all' }}>
                                                            "{reason}"
                                                          </div>
                                                        )}
                                                        {ticketNumber && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.1rem', paddingLeft: '0.9rem' }}>
                                                                  <a
                                                                    href={ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${ticketNumber}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{
                                                                      color: 'var(--color-success)',
                                                                      fontSize: '0.7rem',
                                                                      fontWeight: 600,
                                                                      textDecoration: 'none',
                                                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                      backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                                                      padding: '0.1rem 0.4rem',
                                                                      borderRadius: '3px',
                                                                      display: 'inline-flex',
                                                                      alignItems: 'center',
                                                                      gap: '0.25rem'
                                                                    }}
                                                                  >
                                                                    🎫 Ticket #{ticketNumber}
                                                                  </a>
                                                                </div>
                                                              )}
                                                              </div>
                                                        ) : null}
                                                      </div>
                                                    );
                                                  });
                                                })()}
                                                  {agent.isArchived && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.2rem', paddingLeft: '0.9rem', opacity: 0.8 }}>
                                                      Archived agent exclusions ignored
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Diagnostic & screenshot logs */}
                                                {(agent.lastBackupStatus || agent.screenshotVerification || (agent as any).backupTicketReference || (agent as any).screenshotTicketReference) && (
                                                  <div style={{ borderTop: '1px solid var(--border-element)', paddingTop: '0.6rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    {agent.lastBackupStatus && (
                                                      <div>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                          Last Backup
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', width: '100%', flexWrap: 'wrap' }}>
                                                          <span className={`bw-badge-pill ${agent.lastBackupStatus?.success ? 'success' : 'danger'}`}>
                                                            {agent.lastBackupStatus?.success ? 'Success' : 'Failed'}
                                                          </span>
                                                          {this._isBackupOverdue(agent.lastBackupStatus) && (
                                                            <span className="bw-badge-pill warning">
                                                              Overdue (&gt;24h)
                                                            </span>
                                                          )}
                                                          {agent.lastBackupStatus?.time && (
                                                            <strong>{typeof agent.lastBackupStatus.time === 'number' ? new Date(agent.lastBackupStatus.time * 1000).toLocaleString() : agent.lastBackupStatus.time}</strong>
                                                          )}
                                                          
                                                          {!agent.isArchived && agent.lastBackupStatus && !agent.lastBackupStatus.success && (
                                                            (agent as any).backupTicketReference ? (
                                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto' }}>
                                                                <a
                                                                  href={(agent as any).backupTicketReference.ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${(agent as any).backupTicketReference.ticketId}`}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  style={{
                                                                    color: 'var(--color-success)',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    textDecoration: 'none',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                                                    padding: '0.1rem 0.4rem',
                                                                    borderRadius: '3px'
                                                                  }}
                                                                >
                                                                  🎫 Ticket #{(agent as any).backupTicketReference.ticketNumber || (agent as any).backupTicketReference.ticketId}
                                                                </a>
                                                                <button
                                                                  onClick={(e) => this._copyTicketBrief(
                                                                    device.companyName || "Unknown Company",
                                                                    device.deviceName,
                                                                    agent.name,
                                                                    "Backup Failure",
                                                                    (agent as any).backupTicketReference.ticketNumber || (agent as any).backupTicketReference.ticketId,
                                                                    e
                                                                  )}
                                                                  title="Copy Ticket Brief"
                                                                  style={{
                                                                    background: 'var(--bg-panel)',
                                                                    border: '1px solid var(--border-element)',
                                                                    borderRadius: '3px',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '0.15rem 0.35rem',
                                                                    fontSize: '0.7rem',
                                                                    cursor: 'pointer'
                                                                  }}
                                                                >
                                                                  {this.state.copiedTicketId === (agent as any).backupTicketReference.ticketId ? '📋 Copied!' : '📋'}
                                                                </button>
                                                              </div>
                                                            ) : (
                                                              <button
                                                                onClick={() => this._escalateSingleIssue(device, agent.name, 'Backup', `Backup failed for agent ${agent.name} on ${device.deviceName}. Error: ${agent.lastBackupStatus?.errorMessage || 'Unknown Error'}`, agent.lastBackupStatus?.errorMessage || 'Backup failed.')}
                                                                style={{
                                                                  backgroundColor: 'var(--color-primary)',
                                                                  color: '#ffffff',
                                                                  border: 'none',
                                                                  padding: '0.15rem 0.4rem',
                                                                  borderRadius: '3px',
                                                                  fontSize: '0.68rem',
                                                                  fontWeight: 600,
                                                                  cursor: 'pointer',
                                                                  marginLeft: 'auto'
                                                                }}
                                                              >
                                                                ⚡ Escalate
                                                              </button>
                                                            )
                                                          )}
                                                        </div>
                                                        {agent.lastBackupStatus?.errorMessage && (
                                                          <div className="bw-vol-note-msg" style={{ color: 'var(--color-danger)', fontSize: '0.72rem', marginTop: '0.25rem', lineHeight: 1.3 }}>
                                                            {agent.lastBackupStatus.errorMessage}
                                                          </div>
                                                        )}
                                                      </div>
                                                    )}
                                                    {agent.screenshotVerification && (
                                                      <div style={{ borderTop: '1px solid var(--border-element)', paddingTop: '0.6rem', marginTop: '0.6rem' }}>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                                          Screenshot Verification
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', width: '100%' }}>
                                                          <span className={`bw-badge-pill ${agent.screenshotVerification.success ? 'success' : 'danger'}`}>
                                                            {agent.screenshotVerification.success ? 'Verified' : 'Failed'}
                                                          </span>
                                                          {agent.screenshotVerification.time && (
                                                            <strong>{typeof agent.screenshotVerification.time === 'number' ? new Date(agent.screenshotVerification.time * 1000).toLocaleString() : agent.screenshotVerification.time}</strong>
                                                          )}
                                                          
                                                          {!agent.isArchived && !agent.screenshotVerification.success && (
                                                            (agent as any).screenshotTicketReference ? (
                                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto' }}>
                                                                <a
                                                                  href={(agent as any).screenshotTicketReference.ticketUrl || `https://ww16.autotask.net/Mvc/ServiceDesk/TicketDetail.mvc/Index?ticketId=${(agent as any).screenshotTicketReference.ticketId}`}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  style={{
                                                                    color: 'var(--color-success)',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    textDecoration: 'none',
                                                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                                                                    padding: '0.1rem 0.4rem',
                                                                    borderRadius: '3px'
                                                                  }}
                                                                >
                                                                  🎫 Ticket #{(agent as any).screenshotTicketReference.ticketNumber || (agent as any).screenshotTicketReference.ticketId}
                                                                </a>
                                                                <button
                                                                  onClick={(e) => this._copyTicketBrief(
                                                                    device.companyName || "Unknown Company",
                                                                    device.deviceName,
                                                                    agent.name,
                                                                    "Screenshot Failure",
                                                                    (agent as any).screenshotTicketReference.ticketNumber || (agent as any).screenshotTicketReference.ticketId,
                                                                    e
                                                                  )}
                                                                  title="Copy Ticket Brief"
                                                                  style={{
                                                                    background: 'var(--bg-panel)',
                                                                    border: '1px solid var(--border-element)',
                                                                    borderRadius: '3px',
                                                                    color: 'var(--text-muted)',
                                                                    padding: '0.15rem 0.35rem',
                                                                    fontSize: '0.7rem',
                                                                    cursor: 'pointer'
                                                                  }}
                                                                >
                                                                  {this.state.copiedTicketId === (agent as any).screenshotTicketReference.ticketId ? '📋 Copied!' : '📋'}
                                                                </button>
                                                              </div>
                                                            ) : (
                                                              <button
                                                                onClick={() => this._escalateSingleIssue(device, agent.name, 'Screenshot', `Screenshot verification failed for agent ${agent.name} on ${device.deviceName}.`, 'Screenshot verification failed.')}
                                                                style={{
                                                                  backgroundColor: 'var(--color-primary)',
                                                                  color: '#ffffff',
                                                                  border: 'none',
                                                                  padding: '0.15rem 0.4rem',
                                                                  borderRadius: '3px',
                                                                  fontSize: '0.68rem',
                                                                  fontWeight: 600,
                                                                  cursor: 'pointer',
                                                                  marginLeft: 'auto'
                                                                }}
                                                              >
                                                                ⚡ Escalate
                                                              </button>
                                                            )
                                                          )}

                                                          {agent.screenshotVerification.image && (
                                                            <a
                                                              href={agent.screenshotVerification.image}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              data-interactable="true"
                                                              style={{
                                                                color: 'var(--color-primary)',
                                                                textDecoration: 'none',
                                                                fontWeight: 600,
                                                                marginLeft: agent.screenshotVerification.success ? 'auto' : '0.5rem',
                                                                fontSize: '0.72rem',
                                                                cursor: 'pointer'
                                                              }}
                                                              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                            >
                                                              View Screenshot ↗
                                                            </a>
                                                          )}
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-element)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)'
                  }}>
                    <div>
                      Showing <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{startIndex + 1}</span> to{' '}
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{Math.min(startIndex + this.state.pageSize, totalItems)}</span> of{' '}
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{totalItems}</span> appliances
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <button
                        onClick={() => this.setState({ currentPage: Math.max(1, currentPage - 1) })}
                        disabled={currentPage === 1}
                        className="bw-btn"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Previous
                      </button>
                      
                      {(() => {
                        const pages: React.ReactNode[] = [];
                        const maxPageButtons = 5;
                        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
                        let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
                        
                        if (endPage - startPage + 1 < maxPageButtons) {
                          startPage = Math.max(1, endPage - maxPageButtons + 1);
                        }
                        
                        for (let p = startPage; p <= endPage; p++) {
                          const isCurrent = p === currentPage;
                          pages.push(
                            <button
                              key={p}
                              onClick={() => this.setState({ currentPage: p })}
                              className="bw-btn"
                              style={{
                                backgroundColor: isCurrent ? 'var(--color-primary)' : 'var(--bg-glass)',
                                color: isCurrent ? '#ffffff' : 'var(--text-main)',
                                border: isCurrent ? '1px solid var(--color-primary)' : '1px solid var(--border-element)',
                                width: '2rem',
                                height: '2rem',
                                padding: 0,
                                justifyContent: 'center'
                              }}
                            >
                              {p}
                            </button>
                          );
                        }
                        return pages;
                      })()}

                      <button
                        onClick={() => this.setState({ currentPage: Math.min(totalPages, currentPage + 1) })}
                        disabled={currentPage === totalPages}
                        className="bw-btn"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 3-TIER SILENCE & EXCLUSION MODAL */}
        <MutingModal
          isOpen={isMutingModalOpen}
          mutingDevice={mutingDevice}
          mutingAgentName={this.state.mutingAgentName}
          mutingVolume={this.state.mutingVolume}
          muteType={muteType}
          muteReason={muteReason}
          isPermanent={this.state.isPermanent}
          durationDays={this.state.durationDays}
          muteTicketNumber={this.state.muteTicketNumber}
          mutingExclusionId={this.state.mutingExclusionId}
          actionLoading={actionLoading}
          userSecurityLevel={userSecurityLevel}
          isEmergencyOverride={this.state.isEmergencyOverride}
          onClose={() => this.setState({ isMutingModalOpen: false })}
          onReasonChange={(reason) => this.setState({ muteReason: reason })}
          onIsPermanentChange={(isPermanent) => this.setState({ isPermanent })}
          onDurationDaysChange={(days) => this.setState({ durationDays: days })}
          onEmergencyOverrideChange={(isEmergencyOverride) => {
            this.setState({
              isEmergencyOverride,
              muteTicketNumber: isEmergencyOverride ? '[OVERRIDE: EMERGENCY OUTAGE]' : ''
            });
          }}
          onTicketNumberChange={(muteTicketNumber) => this.setState({ muteTicketNumber })}
          onRemoveExclusion={(exclusionId) => {
            this._removeExclusion(exclusionId);
            this.setState({ isMutingModalOpen: false });
          }}
          onConfirmSilence={this._addExclusion}
        />

        {/* ESCALATION BULK CHECKLIST MODAL */}
        <EscalationModal
          isOpen={isEscalateModalOpen}
          escalateDevice={escalateDevice}
          escalateIssues={escalateIssues}
          selectedIssueIds={selectedIssueIds}
          actionLoading={actionLoading}
          onClose={() => this.setState({ isEscalateModalOpen: false })}
          onToggleIssue={(issueId, checked) => {
            this.setState(prevState => {
              const ids = { ...prevState.selectedIssueIds };
              ids[issueId] = checked;
              return { selectedIssueIds: ids };
            });
          }}
          onConfirmEscalate={this._escalateSelectedIssues}
        />

        {/* AUDIT LOGS DRAWER */}
        <AuditLogsDrawer
          isOpen={isAuditLogsOpen}
          auditLogs={auditLogs}
          auditSearchQuery={auditSearchQuery}
          auditLoading={auditLoading}
          auditError={auditError}
          onClose={() => this.setState({ isAuditLogsOpen: false })}
          onSearchChange={(query) => this.setState({ auditSearchQuery: query })}
          onExportCsv={this._exportAuditLogsToCsv}
        />

        {/* ADMINISTRATOR CONSOLE MODAL */}
        <AdminModal
          isOpen={this.state.isAdminModalOpen}
          userSecurityLevel={userSecurityLevel}
          adminModalTab={this.state.adminModalTab}
          adminDiagnostics={this.state.adminDiagnostics}
          adminDiagnosticsLoading={this.state.adminDiagnosticsLoading}
          adminDiagnosticsError={this.state.adminDiagnosticsError}
          adminRoutingData={this.state.adminRoutingData}
          alertMatrix={this.state.alertMatrix}
          adminRoutingLoading={this.state.adminRoutingLoading}
          adminRoutingSaving={this.state.adminRoutingSaving}
          adminRoutingSavedNotice={this.state.adminRoutingSavedNotice}
          selectedAdminQueueId={this.state.selectedAdminQueueId}
          selectedAdminPriorityId={this.state.selectedAdminPriorityId}
          selectedAdminCategoryId={this.state.selectedAdminCategoryId}
          selectedAdminWorkTypeId={this.state.selectedAdminWorkTypeId}
          globalMaintenanceMode={this.state.globalMaintenanceMode}
          blackoutDurationHours={this.state.blackoutDurationHours}
          blackoutReason={this.state.blackoutReason}
          blackoutSaving={this.state.blackoutSaving}
          cleanupScanning={this.state.cleanupScanning}
          cleanupPurging={this.state.cleanupPurging}
          cleanupData={this.state.cleanupData}
          selectedCleanupTickets={this.state.selectedCleanupTickets}
          selectedCleanupExclusions={this.state.selectedCleanupExclusions}
          assetTestQuery={this.state.assetTestQuery}
          assetTestLoading={this.state.assetTestLoading}
          assetTestResult={this.state.assetTestResult}
          onClose={() => this.setState({ isAdminModalOpen: false })}
          onTabChange={(adminModalTab) => this.setState({ adminModalTab })}
          onFetchDiagnostics={this._fetchAdminDiagnostics}
          onFetchRouting={this._fetchAdminRouting}
          onSaveRouting={this._saveAdminRouting}
          onUpdateAlertMatrixItem={this._updateAlertMatrixItem}
          onQueueChange={(selectedAdminQueueId) => this.setState({ selectedAdminQueueId })}
          onPriorityChange={(selectedAdminPriorityId) => this.setState({ selectedAdminPriorityId })}
          onCategoryChange={(selectedAdminCategoryId) => this.setState({ selectedAdminCategoryId })}
          onWorkTypeChange={(selectedAdminWorkTypeId) => this.setState({ selectedAdminWorkTypeId })}
          onFetchMaintenance={this._fetchAdminMaintenance}
          onSaveMaintenance={this._saveAdminMaintenance}
          onBlackoutDurationChange={(blackoutDurationHours) => this.setState({ blackoutDurationHours })}
          onBlackoutReasonChange={(blackoutReason) => this.setState({ blackoutReason })}
          onFetchCleanup={this._fetchAdminCleanup}
          onPurgeCleanup={this._purgeAdminCleanup}
          onAssetTestQueryChange={(assetTestQuery) => this.setState({ assetTestQuery })}
          onRunAssetTest={this._runAssetTest}
        />

        {/* Footer */}
        <div style={{
          marginTop: '3.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-element)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.78rem',
          fontWeight: 500
        }}>
          <span>© 2026 Fifosys. All rights reserved.</span>
          {this.state.scanStatus && (
            <span className="footer-scan-status" style={{ display: 'flex', gap: '1rem', opacity: 0.85 }}>
              <span>Last Scan: <strong>{this.state.scanStatus.lastScan}</strong></span>
              <span>Next Scan: <strong>{this.state.scanStatus.nextScan}</strong></span>
            </span>
          )}
          <span className="footer-powered">
            <span className="pulse-dot" style={{ backgroundColor: 'var(--color-success)' }} />
            Powered by BackupWatch BCDR Engine v{this.state.backendVersion || this.props.version}
          </span>
        </div>
      </div>
    );
  }
}
