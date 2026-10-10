# BackupWatch Development Team Roles

To build the BackupWatch stateless application as defined in the blueprint, we require the following agent roles:

## 1. Project Orchestrator Agent (Orchestrator)
- **Responsibility**: Coordinates the building sequence, reviews PRs, and verifies system integrity. Ensures strict compliance with stateless design patterns.
- **Key Deliverable**: Tracks project tasks, validates dependencies, manages configuration workspace properties, and triggers release packages.

## 2. Frontend Integration Agent (Frontend Developer)
- **Responsibility**: Designs and implements the user interface.
- **Key Deliverable**: Builds the SPFx React application component inside `/spfx-client`, incorporates Tailwind CSS styling, connects to Microsoft Graph using `MSGraphClientV3`, and connects to the backend proxy via `AadHttpClient`.

## 3. Backend Serverless Agent (Backend Developer)
- **Responsibility**: Programs backend endpoints, memory cache systems, and API integrations.
- **Key Deliverable**: Implements the Azure Function endpoint inside `/stateless-backend`, handles concurrent calls to Datto and Autotask APIs, processes datasets in-memory, and maintains the 5-minute TTL cache logic.

## 4. Cloud Security & Identity Agent (Security Engineer)
- **Responsibility**: Hardens backend services and implements identity logic.
- **Key Deliverable**: Secures backend via App-Assigned Managed Identity and Key Vault integration, enforces Entra ID Security Group Role Rights check inside backend code, and decodes incoming Bearer tokens.
