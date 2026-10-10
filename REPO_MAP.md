# Repository Architecture Map
<!-- Automatically generated via Tree-Sitter & PageRank across 26 source files -->

spfx-client/src/webparts/backupWatch/BackupWatchWebPart.ts:
│  class IBackupWatchWebPartProps
│  class BackupWatchWebPart
│  def render
│  def _getEnvironmentMessage
│  def onDispose
│  def dataVersion
│  def getPropertyPaneConfiguration

spfx-client/src/webparts/backupWatch/components/BackupWatch.tsx:
│  class BackupWatch
│  def constructor
│  def componentDidMount
│  def _resolveUserSecurityRole
│  def _toggleTheme
│  def _isBackupOverdue
│  def _renderLastSeen
│  def _getEscalationIssues
│  def _openEscalateModal
│  def _escalateSelectedIssues
│  def _escalateSingleIssue
│  def runEscalate
│  def _copyTicketBrief
│  def _getExclusionsUrl
│  def _getAuditLogsUrl
│  def _fetchAuditLogs
│  def _openAuditLogs
│  def _getAdminActionUrl
│  def _getAdminDiagnosticsUrl
│  def _getAdminRoutingUrl
│  def _openAdminModal
│  def _fetchAdminMaintenance
│  def _saveAdminMaintenance
│  def handler
│  def _fetchAdminCleanup
│  def _purgeAdminCleanup
│  def _runAssetTest
│  def _exportAuditLogsToCsv
│  def _fetchAdminDiagnostics
│  def _fetchAdminRouting
│  def _saveAdminRouting
│  def _updateAlertMatrixItem
│  def _isLocalDev
│  def _fetchData
│  def _normalizeVolumeName
│  def _buildVolumeTargetKey
│  def _findVolumeExclusion
│  def _findAgentExclusion
│  def _addExclusion
│  def _removeExclusion
│  def _openSilenceApplianceModal
│  def _openSilenceAgentModal
│  def _openVolumeModal
│  def _toggleExpand
│  def _formatStorage
│  def _getVolumeExclusionReason
│  def render

spfx-client/src/webparts/backupWatch/components/IBackupWatchProps.ts:
│  class IBackupWatchProps

spfx-client/src/webparts/backupWatch/components/appliance/ExclusionsTable.tsx:
│  class IExclusionsTableProps
│  def ExclusionsTable

spfx-client/src/webparts/backupWatch/components/appliance/HeaderBar.tsx:
│  class IHeaderBarProps
│  def HeaderBar

spfx-client/src/webparts/backupWatch/components/appliance/MetricCards.tsx:
│  class IMetricCardData
│  class IMetricCardsProps
│  def MetricCards

spfx-client/src/webparts/backupWatch/components/modals/AdminModal.tsx:
│  class IAdminModalProps
│  def AdminModal

spfx-client/src/webparts/backupWatch/components/modals/AuditLogsDrawer.tsx:
│  class IAuditLogsDrawerProps
│  def AuditLogsDrawer

spfx-client/src/webparts/backupWatch/components/modals/EscalationModal.tsx:
│  class IEscalationModalProps
│  def EscalationModal

spfx-client/src/webparts/backupWatch/components/modals/MutingModal.tsx:
│  class IMutingModalProps
│  def MutingModal

spfx-client/src/webparts/backupWatch/components/styles/BackupWatchStyles.tsx:
│  def BackupWatchStyles

spfx-client/src/webparts/backupWatch/components/types/BackupWatchTypes.ts:
│  class IAgentResult
│  class IDattoDevice
│  class IExclusion
│  class IEscalatableIssue
│  class IBackupWatchState

stateless-backend/adminDiagnostics/index.ts:
│  def httpTrigger

stateless-backend/adminRouting/index.ts:
│  def httpTrigger

stateless-backend/auditLogs/index.ts:
│  def httpTrigger

stateless-backend/backupWatchTimerTrigger/index.ts:
│  def timerTrigger
│  def formatUkTime

stateless-backend/backupWatchTrigger/index.ts:
│  def getDattoCacheStats
│  class IExclusionEntity
│  class ITrackedTicketEntity
│  class IAgentResult
│  def formatLastBackup
│  def mapAutoTaskStatus
│  def isApplianceActive
│  def handleAutoHeal
│  def applyExclusionsToDevices
│  def runPipeline
│  def httpTrigger

stateless-backend/escalateTrigger/index.ts:
│  class ITrackedTicketEntity
│  def computeRelativeTime
│  def formatTicketDescription
│  def httpTrigger

stateless-backend/exclusions/index.ts:
│  def httpTrigger

stateless-backend/shared/auth.ts:
│  class UserRole
│  class IUserSecurityContext
│  def parseClientPrincipal
│  def getUserSecurityContext

stateless-backend/shared/autotask.ts:
│  class IAutoTaskConfig
│  def getAutoTaskConfig
│  def getAutoTaskBaseUrl
│  def getAutoTaskZoneNumber
│  def getAutoTaskTicketUrl
│  def getAutoTaskHeaders
│  class IConfigurationItem
│  def lookupDeviceInAutoTask
│  def lookupConfigurationItemInAutoTask
│  def sortCandidates
│  def lookupCompanyInAutoTask
│  class IAutoTaskTicket
│  def queryTicketsInAutoTask
│  def queryTicketByNumber
│  def queryOpenTicketByTitle
│  def getSingleTicketFromAutoTask
│  class IPicklistValue
│  class IEntityFieldsCache
│  def getTicketEntityFields
│  def getTicketFieldPicklistValues
│  def getTicketStatusPicklistValues
│  def updateTicketStatusInAutoTask
│  def lookupContractInAutoTask
│  def createTicketInAutoTask
│  def createTicketNoteInAutoTask
│  def createComplianceTicket

stateless-backend/shared/configService.ts:
│  class IAutotaskRoutingConfig
│  def getAutotaskRoutingConfig
│  def saveAutotaskRoutingConfig
│  class IGlobalMaintenanceConfig
│  def getGlobalMaintenanceMode
│  def setGlobalMaintenanceMode
│  class IAlertRoutingConfig
│  def getAlertRoutingMatrix
│  def saveAlertRoutingMatrix

stateless-backend/shared/tableService.ts:
│  def getTableClient

stateless-backend/shared/volumeUtils.ts:
│  class IExclusionEntityLike
│  def normalizeVolumeName
│  def buildVolumeTargetKey
│  def isDeviceSilenced
│  def isDeviceMuted
│  def isAgentSilenced
│  def isVolumeExcluded
