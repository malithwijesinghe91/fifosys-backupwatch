# Autotask Issue & Sub-Issue Types Mapping Table

This document displays the complete live mapping of all active **Issue Types** and their corresponding **Sub-Issue Types** extracted directly from the Autotask REST API.

> [!NOTE]
> In Autotask, each subIssueType entity has a parentValue property that references the numeric alue of its parent issueType.

## Summary
- **Total Active Issue Types**: 79
- **Total Active Sub-Issue Types**: 431

## Primary BCDR & Infrastructure Issue Types

| Issue Type ID | Issue Type Name | Sub-Issue Count | Sub-Issues (ID & Name) |
|:---|:---|:---:|:---|
| 30 | **Backup** | 4 | **Warning** (ID: 289), **Failure** (ID: 290), **Other** (ID: 333), **Report** (ID: 586) |
| 24 | **Availability** | 2 | **Service Stopped** (ID: 267), **Device Offline** (ID: 268) |
| 23 | **Performance** | 4 | **CPU** (ID: 264), **Disk Usage** (ID: 265), **Memory** (ID: 266), **Other** (ID: 284) |
| 26 | **Hardware** | 5 | **Temperature** (ID: 273), **Disk** (ID: 278), **PSU** (ID: 279), **Fan** (ID: 280), **Other** (ID: 281) |
| 14 | **RMM Alert** | 23 | **Antivirus Status Monitor** (ID: 222), **Backup Monitor** (ID: 223), **Component Monitor** (ID: 224), **CPU Monitor** (ID: 225), **Disk Usage Monitor** (ID: 226), **End Client Agent** (ID: 227), **Event Log Monitor** (ID: 228), **File/Folder Size Monitor** (ID: 229), **Hardware Monitor** (ID: 230), **Online Status Monitor** (ID: 231), **Patch Monitor** (ID: 232), **Ping Monitor** (ID: 233), **Process Monitor** (ID: 234), **Security Management Monitor** (ID: 235), **Service Monitor** (ID: 236), **SNMP Monitor** (ID: 237), **Software Monitor** (ID: 238), **Temperature Sensor Monitor** (ID: 239), **Windows Performance Monitor** (ID: 240), **WMI Monitor** (ID: 241), **Printer Monitor** (ID: 242), **Memory Monitor** (ID: 243), **Ransomware Monitor** (ID: 244) |
| 11 | **Network** | 16 | **DNS** (ID: 111), **Firewall** (ID: 112), **WAP** (ID: 116), **Cabling** (ID: 184), **Configuration** (ID: 185), **Connectivity Outage** (ID: 186), **Hub** (ID: 187), **Logon Failure** (ID: 190), **Performance** (ID: 192), **Remote Access** (ID: 193), **Server** (ID: 195), **VPN** (ID: 198), **Switch** (ID: 199), **Router** (ID: 307), **WiFi** (ID: 308), **Other** (ID: 309) |
| 7 | **Server** | 10 | **DHCP** (ID: 118), **File System** (ID: 120), **Performance** (ID: 124), **Anti Virus** (ID: 214), **Hardware Fault** (ID: 217), **GPO** (ID: 318), **Operating System Fault** (ID: 319), **Windows Service** (ID: 320), **Other** (ID: 321), **Storage** (ID: 322) |
| 10 | **Laptop/Workstation** | 7 | **Performance Issue** (ID: 105), **Hardware Fault** (ID: 152), **Operating System Fault** (ID: 153), **Other** (ID: 154), **Connectivity** (ID: 304), **Windows Service** (ID: 305), **Storage** (ID: 306) |
| 50 | **Backup.** | 7 | **Restore: Other** (ID: 364), **Add Backup Protection** (ID: 365), **Other** (ID: 366), **Alter Backup Schedule** (ID: 367), **Restore: Exchange Mailbox** (ID: 439), **Restore: Sharepoint Files/Folders** (ID: 440), **Restore: Test** (ID: 454) |

---

## All Active Autotask Issue Types & Hierarchy

| Issue ID | Issue Type | Sub-Issues Count | Associated Sub-Issues |
|:---|:---|:---:|:---|
| 6 | **Service** | 5 | Billing (127)<br>Consulting (128)<br>Development (129)<br>Spec Quote (130)<br>Training (131) |
| 7 | **Server** | 10 | DHCP (118)<br>File System (120)<br>Performance (124)<br>Anti Virus (214)<br>Hardware Fault (217)<br>GPO (318)<br>Operating System Fault (319)<br>Windows Service (320)<br>Other (321)<br>Storage (322) |
| 10 | **Laptop/Workstation** | 7 | Performance Issue (105)<br>Hardware Fault (152)<br>Operating System Fault (153)<br>Other (154)<br>Connectivity (304)<br>Windows Service (305)<br>Storage (306) |
| 11 | **Network** | 16 | DNS (111)<br>Firewall (112)<br>WAP (116)<br>Cabling (184)<br>Configuration (185)<br>Connectivity Outage (186)<br>Hub (187)<br>Logon Failure (190)<br>Performance (192)<br>Remote Access (193)<br>Server (195)<br>VPN (198)<br>Switch (199)<br>Router (307)<br>WiFi (308)<br>Other (309) |
| 14 | **RMM Alert** | 23 | Antivirus Status Monitor (222)<br>Backup Monitor (223)<br>Component Monitor (224)<br>CPU Monitor (225)<br>Disk Usage Monitor (226)<br>End Client Agent (227)<br>Event Log Monitor (228)<br>File/Folder Size Monitor (229)<br>Hardware Monitor (230)<br>Online Status Monitor (231)<br>Patch Monitor (232)<br>Ping Monitor (233)<br>Process Monitor (234)<br>Security Management Monitor (235)<br>Service Monitor (236)<br>SNMP Monitor (237)<br>Software Monitor (238)<br>Temperature Sensor Monitor (239)<br>Windows Performance Monitor (240)<br>WMI Monitor (241)<br>Printer Monitor (242)<br>Memory Monitor (243)<br>Ransomware Monitor (244) |
| 17 | **Pre-Sale** | 1 | SE Request (221) |
| 20 | **Application: Standard** | 17 | MS Word (250)<br>MS Excel (251)<br>MS Powerpoint (252)<br>Other (253)<br>MS Teams (254)<br>MS Outlook (255)<br>Browser: Chrome (256)<br>Browser: Edge (257)<br>Adobe Reader/Acrobat (258)<br>Database: SQL Server (314)<br>Database: Other (315)<br>Browser: Other (316)<br>Zoom (339)<br>Sage (340)<br>MS OneDrive (355)<br>Co-Pilot (597)<br>Exclaimer (611) |
| 21 | **Application: Client Specific** | 30 | Windows Designer (WD) (259)<br>JTS (260)<br>Other (261)<br>Heyex (262)<br>Actintime (323)<br>Bloomberg (324)<br>CCH (325)<br>Darwin (326)<br>Excelicare (327)<br>Filefinder (328)<br>Foxit (329)<br>Heidelberg (330)<br>Logikal (331)<br>Opera (332)<br>Todyl (455)<br>Teramind (456)<br>File Maker (457)<br>Zetadocs (577)<br>ShareFile (582)<br>Cloud Drive Mapper (583)<br>NetExtender VPN (584)<br>Dynamics NAV (585)<br>NetFrieght (587)<br>Keeper (589)<br>OpSuite (590)<br>Qube (591)<br>Evolution M (592)<br>NAV (593)<br>Barclays Gemalto (595)<br>FileZilla (596) |
| 22 | **Security** | 27 | Other Antivirus (263)<br>Ransomware (269)<br>Other (285)<br>DNS Filtering (287)<br>SentinelOne (288)<br>Dark Web Monitoring (311)<br>SSL Certificate (313)<br>MFA (317)<br>Email Filtering (341)<br>Barracuda: * Alert Not Listed Below (342)<br>Barracuda: Email Forwarding Rule Created Or Modifi (343)<br>Other Breach (344)<br>Barracuda: Exchange Transport Rule Modification (345)<br>Barracuda: Office 365 Impossible Travel (346)<br>Barracuda: Office 365 Suspicious New Inbox Rule Cr (347)<br>Barracuda: Office 365 Brute Force Login Attempt (348)<br>Barracuda: OneDrive File Malware Upload (349)<br>Barracuda: Sharepoint Volume File Deletion (350)<br>Barracuda: Suspicious O365 Login Suspicious Countr (351)<br>Barracuda: User Added To Global Admin (352)<br>Barracuda: Weekly Sensor Connectivity Loss Or Offi (353)<br>Barracuda: Transport Rule Enabled (354)<br>SEAT (360)<br>Barracuda: New Threat Not Mitigated (458)<br>Capture Client (618)<br>Barracuda: Office 365 Anomalous Login (619)<br>Barracuda: New Threat Mitigated (621) |
| 23 | **Performance** | 4 | CPU (264)<br>Disk Usage (265)<br>Memory (266)<br>Other (284) |
| 24 | **Availability** | 2 | Service Stopped (267)<br>Device Offline (268) |
| 26 | **Hardware** | 5 | Temperature (273)<br>Disk (278)<br>PSU (279)<br>Fan (280)<br>Other (281) |
| 27 | **Patching** | 3 | Failure (274)<br>Other (282)<br>Reboot Required (283) |
| 28 | **Printer/Scanner** | 3 | Other (275)<br>Networking (310)<br>Hardware Fault (312) |
| 29 | **Server Role** | 3 | DNS (276)<br>DHCP (277)<br>Other (286) |
| 30 | **Backup** | 4 | Warning (289)<br>Failure (290)<br>Other (333)<br>Report (586) |
| 32 | **Billing** | 2 | Query (291)<br>Monthly Review (292) |
| 33 | **Client Meeting** | 0 | *None* |
| 34 | **Complaint** | 5 | From PSM (613)<br>From Escalation To SD Team (614)<br>CrewHu Feedback (615)<br>From Escalation To CEO (616)<br>From Escalation To AM Team (617) |
| 35 | **Contract Change** | 4 | Post Service Review (293)<br>Post Project (294)<br>Renewal / Contract Discussion (295)<br>Client Request (296) |
| 36 | **Partner Success Meeting** | 0 | *None* |
| 37 | **Pre-Sales** | 0 | *None* |
| 38 | **Reporting** | 2 | Internal (297)<br>For Client (298) |
| 39 | **Research** | 4 | Product (299)<br>Internal (300)<br>Sector (301)<br>For Client (302) |
| 40 | **Service Termination** | 0 | *None* |
| 41 | **Other** | 1 | Other (303) |
| 42 | **Office 365** | 4 | Outage (334)<br>Other (335)<br>Exchange (361)<br>Password Reset (598) |
| 43 | **Telephony** | 3 | 3CX (336)<br>Teams (337)<br>Other (338) |
| 44 | **Sharepoint** | 4 | Sync Issues (356)<br>Other (357)<br>Missing Files/Folders (358)<br>Access (359) |
| 45 | **Active Directory** | 2 | Error (362)<br>Other (363) |
| 46 | **Normal Change** | 0 | *None* |
| 48 | **Emergency Change** | 0 | *None* |
| 49 | **Retrospective Change** | 0 | *None* |
| 50 | **Backup.** | 7 | Restore: Other (364)<br>Add Backup Protection (365)<br>Other (366)<br>Alter Backup Schedule (367)<br>Restore: Exchange Mailbox (439)<br>Restore: Sharepoint Files/Folders (440)<br>Restore: Test (454) |
| 51 | **Mobile Device** | 4 | Can't Access Email (368)<br>Can't Connect (369)<br>Other (370)<br>MFA Issues (415) |
| 52 | **Active Directory.** | 9 | New User Account (371)<br>Delete User Account (372)<br>Disable User Account (373)<br>Update User Account (374)<br>Amend Security Groups (375)<br>Password Reset (376)<br>Unlock User Account (377)<br>Other (378)<br>Amend Permissions (379) |
| 53 | **Application: Standard.** | 11 | Install Application (380)<br>Upgrade Application (381)<br>Remove Application (382)<br>Assign License(s) (383)<br>Update User Settings (384)<br>Update Application Settings (385)<br>Disable User Account (386)<br>Password Reset (387)<br>Other (388)<br>Add/Modify Permissions (389)<br>Exclaimer (612) |
| 54 | **Laptop/Workstation.** | 7 | Build Device (390)<br>Repair Device (391)<br>Decommission Device (392)<br>Windows update (393)<br>Other (394)<br>Request For New/Replacement Device (395)<br>Windows upgrade (594) |
| 55 | **Network.** | 12 | Configure VPN (396)<br>Create, Modify Or Delete A DNS record (397)<br>Create, Modify Or Delete A Network SWhare (398)<br>Create, Modify Or Delete A Network Share (399)<br>Add Or Modify A Firewall Rule (400)<br>Decommission Device (401)<br>Install/Configure Device (402)<br>Update Software Or Firmware (403)<br>Install/Update VPN Client Software (404)<br>Install/Update VPN Server Software (405)<br>Other (406)<br>New Wireless SSID (407) |
| 56 | **Mobile Device.** | 6 | Remote Data Wipe (408)<br>Register In Intune (409)<br>Install/Configure Device (410)<br>Decommission Device (411)<br>Setup MFA (412)<br>Other (413) |
| 57 | **How To.** | 1 | How To (414) |
| 58 | **Office 365.** | 3 | Licensing (416)<br>Other (417)<br>Password Reset (599) |
| 59 | **Printer/Scanner.** | 3 | Install Printer (418)<br>Connect Printer To Network (419)<br>Other (420) |
| 60 | **Site Visit.** | 2 | Scheduled (421)<br>Other (422) |
| 61 | **Security.** | 5 | New SSL Certificate (423)<br>Device Scan (424)<br>Add Protection (425)<br>Other (426)<br>Conditional Access (576) |
| 62 | **Server.** | 3 | New/Change GPO (427)<br>New/Change Storage (428)<br>Other (429) |
| 63 | **Sharepoint.** | 3 | Permissions (430)<br>New Folder(s) (431)<br>Other (432) |
| 64 | **Telephony.** | 4 | New User (433)<br>New Handset (434)<br>Other (435)<br>Call Forward (436) |
| 65 | **Joiner.** | 1 | Joiner (437) |
| 66 | **Leaver.** | 1 | Leaver (438) |
| 67 | **Email.** | 7 | Release/Whitelist (441)<br>Blacklist (442)<br>Other (443)<br>New Mailbox (444)<br>Out Of Office Message (445)<br>Forwarding Rule (446)<br>Mailbox Permissions/Access (447) |
| 68 | **Renewal** | 3 | SSL Certificate (448)<br>Apply Software License (449)<br>Other (450) |
| 69 | **Device Build** | 3 | Procure & Build (451)<br>Build Only (452)<br>Other (453) |
| 71 | **Standard Change (Pre-approved)** | 0 | *None* |
| 73 | **Apps Opera 3 VFP** | 17 | Activations (459)<br>Bespoke (460)<br>Report Writing (461)<br>Report Modifications (462)<br>Performance Issues (463)<br>Crashes / Errors / Hangs (464)<br>Information Request (465)<br>Training (466)<br>Upgrades (467)<br>New User (468)<br>Email (469)<br>Scheduler (470)<br>Document Manager (471)<br>Data Fix (472)<br>Backup / Restore (473)<br>Pre-Sale / Demo (474)<br>Enhancement (492) |
| 74 | **Apps Opera 3 SQL SE** | 17 | Activations (475)<br>Bespoke (476)<br>Report Writing (477)<br>Report Modifications (478)<br>Performance Issues (479)<br>Crashes / Errors / Hangs (480)<br>Information Request (481)<br>Training (482)<br>Upgrades (483)<br>New User (484)<br>Email (485)<br>Scheduler (486)<br>Document Manager (487)<br>Data Fix (488)<br>Backup / Restore (489)<br>Pre-Sale / Demo (490)<br>Enhancement (491) |
| 75 | **Apps Capital Gold** | 16 | Activations (493)<br>Bespoke (494)<br>Report Modifications (495)<br>Performance Issues (496)<br>Crashes / Errors / Hangs (497)<br>Information Request (498)<br>Report Writing (499)<br>Training (500)<br>Upgrades (501)<br>New User (502)<br>Email (503)<br>Scheduler (504)<br>Document Manager (505)<br>Data Fix (506)<br>Backup / Restore (507)<br>Pre-Sale Demo (508) |
| 76 | **Apps XRL** | 17 | Activations (509)<br>Bespoke (510)<br>Report Writing (511)<br>Report Modifications (512)<br>Performance Issues (513)<br>Crashes / Errors / Hangs (514)<br>Information Request (515)<br>Training (516)<br>Upgrades (517)<br>New User (518)<br>Email (519)<br>Scheduler (520)<br>Document Manager (521)<br>Data Fix (522)<br>Backup / Restore (523)<br>Pre-Sale / Demo (524)<br>Enhancemanet (525) |
| 77 | **Apps CIS** | 17 | Activations (526)<br>Bespoke (527)<br>Report Writing (528)<br>Report Modifications (529)<br>Performance Issues (530)<br>Crashes / Error / Hangs (531)<br>Information Request (532)<br>Training (533)<br>Upgrades (534)<br>New User (535)<br>Email (536)<br>Scheduler (537)<br>Document Manager (538)<br>Data Fix (539)<br>Backup / Restore (540)<br>Pre-Sale / Demo (541)<br>Enhancement (542) |
| 78 | **Apps PBC** | 17 | Activations (543)<br>Bespoke (544)<br>Report Writing (545)<br>Report Modifications (546)<br>Performance Issues (547)<br>Crashes / Errors / Hangs (548)<br>Information Request (549)<br>Training (550)<br>New User (551)<br>Email (552)<br>Scheduler (553)<br>Document Manager (554)<br>Data Fix (555)<br>Backup / Restore (556)<br>Pre-Sale / Demp (557)<br>Pre-Sale / Demo (558)<br>Enhancement (559) |
| 79 | **Apps Partner Platform** | 2 | PP Batches (560)<br>PP Support (561) |
| 80 | **Apps PORS** | 2 | PORS Support (562)<br>PORS Errors (563) |
| 81 | **Apps Spam** | 1 | Junk Mail (564) |
| 82 | **Risk Letter** | 4 | Sent (565)<br>Signed (566)<br>Risk Mitigated (567)<br>No Longer Required (568) |
| 83 | **Internal Finance** | 5 | Customer Invoice Query (569)<br>Overdue Account (570)<br>Inhouse Renewals (571)<br>Supplier Invoice Query (572)<br>Improvements (573) |
| 84 | **Apps Other** | 1 | Apps Other (574) |
| 85 | **Hardware** | 0 | *None* |
| 86 | **Software** | 0 | *None* |
| 87 | **Fifosys Toolsets** | 4 | Client Portal (578)<br>Datto RMM (579)<br>ITGlue (580)<br>Other (581) |
| 88 | **New Product/Feature** | 1 | Other (588) |
| 89 | **Windows 10 to 11 Upgrades** | 1 | Windows 10 to 11 Upgrades (601) |
| 90 | **Windows 10 Extended Support** | 1 | Windows 10 Extended Support (600) |
| 91 | **Device Upgrade** | 1 | Device Upgrade (604) |
| 92 | **New Device** | 1 | New Device (603) |
| 93 | **Device Retirement** | 1 | Device Retirement (605) |
| 94 | **Scoping** | 1 | Scoping (602) |
| 95 | **Windows 11 25H2 Update** | 5 | Disk Space (606)<br>DattoRMM Icon Missing (607)<br>Failed - Unknown (608)<br>TPM Failure (609)<br>Guidance (610) |
| 96 | **Laptop/Desktop** | 1 | Decommission Device (620) |
| 97 | **AI** | 11 | Claude (622)<br>Chat GPT (623)<br>CoPilot (624)<br>FireFlies (625)<br>MetaView (626)<br>Remarkable (627)<br>Perplexity AI (628)<br>Vena (629)<br>Perlon AI (630)<br>Granola (631)<br>Other (632) |
