# Step-by-Step Deployment Guide: BackupWatch

This guide provides detailed instructions on how to publish the backend Azure Function and deploy the SPFx web part to your SharePoint Online environment.

---

## Part 1: Deploying the Azure Function Backend

We will compile the TypeScript code and deploy it directly to the Flex Consumption Azure Function App you provisioned.

### Prerequisites
* **Azure CLI** installed ([Download Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli)).
* **Azure Functions Core Tools** installed (you already have this locally).

### Deployment Steps
1. Open PowerShell and log in to your Azure account:
   ```powershell
   az login
   ```
   *This will open a browser window for authentication. Log in with the account containing your target Azure Subscription.*

2. Set your active Azure Subscription (if you have multiple):
   ```powershell
   az account set --subscription "<Your-Subscription-Name-or-ID>"
   ```

3. Navigate to the `stateless-backend` directory:
   ```powershell
   cd stateless-backend
   ```

4. Build/compile the TypeScript code:
   ```powershell
   npm run build
   ```
   *This generates the production-ready JavaScript code in the `/dist` directory.*

5. Publish the Function App to Azure using the Core Tools (run step 4 `npm run build` first):
   ```powershell
   npm run build
   func azure functionapp publish backupwatch-api --build local
   ```
   *`--build local` is required: `.funcignore` excludes the TypeScript sources and `tsconfig.json`, so a remote build cannot compile the app. Remote build is not supported for this repo.*
   *(Replace `backupwatch-api` with the exact name of your live Function App if it differs).*

6. **Verify the Deployment**:
   Once the command completes, it will output the live HTTP trigger URL. It should look like:
   `https://backupwatch-api.azurewebsites.net/api/backupWatchTrigger`

> **Note on Versioning (v1.22.5+)**:
> The dashboard header shows the web part (UI) version; the footer shows `UI v… · Engine v…` (backend `appVersion`).
> **Separate versions (decision D-03, final 2026-10-12):** backend and web part each have their own version. Run `npm run release -- backend|web|both patch|minor|major` from the repo root (never edit versions by hand), then deploy only what changed: a backend-only release needs Step 5 only – **no** `.sppkg` rebuild or upload. See `CLAUDE.md` §2.

---

## Part 2: Packaging the SPFx Web Part

The `/spfx-client` directory in this workspace is a source-only package containing the React component and Web Part files. A ready-to-deploy scaffold container exists at `c:\Projects\BackupWatchScaffold`.

Follow one of the two options below to package the solution into a `.sppkg` file.

### Option A: Merge into an Existing SPFx Project (Recommended)
If you already have a functional SharePoint Framework project:

1. **Copy the Web Part files**:
   Copy the directory:
   `c:\AG\FifoDash\spfx-client\src\webparts\backupWatch`
   And paste it into the `src/webparts/` folder of your existing SPFx project.

2. **Verify Dependencies**:
   Ensure that the target project has `@microsoft/sp-http` and typical React dependencies installed. If needed, run:
   ```powershell
   npm install react@17.0.2 react-dom@17.0.2 --save
   ```

3. **Package using Gulp**:
   Open a terminal in your existing project folder and run the build commands.
   *Tip: If `gulp` is not installed globally on your machine, prefix the commands with `npx` to use the project's local Gulp instance.*
   ```powershell
   npx gulp clean
   npx gulp bundle --ship
   npx gulp package-solution --ship
   ```

---

### Option B: Scaffold a New SPFx Project for Packaging
If you do not have an existing SPFx project, you must scaffold a container project to build the package:

1. **Prepare the workspace directory**:
   Ensure you are in the parent directory:
   ```powershell
   cd c:\AG
   ```

2. **Generate the SPFx solution non-interactively**:
   Run the generator using `npx -y` with all the scaffolding parameters pre-defined:
   ```powershell
   npx -y --package yo --package @microsoft/generator-sharepoint yo @microsoft/sharepoint --solution-name "BackupWatchScaffold" --component-name "BackupWatch" --component-type "webpart" --framework "react" --environment "spo" --skip-install --skip-feature-deployment
   ```
   *This command installs the Yeoman runtime and SharePoint generator on-demand and scaffolds the project directly into the `c:\AG\BackupWatchScaffold` folder without prompting for inputs.*

3. **Navigate to the generated project**:
   ```powershell
   cd BackupWatchScaffold
   ```

3. **Replace the scaffolded Web Part files with our source files**:
   * Delete the folder `src/webparts/backupWatch` that the generator just created.
   * Copy the folder `c:\AG\FifoDash\spfx-client\src\webparts\backupWatch` and paste it into your new `src/webparts/` folder.

4. **Verify package dependencies**:
   Run `npm install` inside `c:\AG\BackupWatchScaffold` to download the packages.

5. **Package the solution**:
   ```powershell
   npx gulp clean
   npx gulp bundle --ship
   npx gulp package-solution --ship
   ```
   *The deployable package will be created at `c:\AG\BackupWatchScaffold\sharepoint\solution\backupwatch-client.sppkg`.*

---

---

## Part 3: Deploying to SharePoint & Approving API Access

### 1. Upload to the SharePoint App Catalog
1. Go to your **SharePoint Admin Center** > **Active sites** > open your **App Catalog** site (or navigate to your tenant-wide App Catalog).
2. Upload the generated `.sppkg` file to the **Apps for SharePoint** list.
3. In the dialog box that appears, select **Enable this app and add it to all sites** (or specify sites), and click **Enable App**.

### 2. Approve API Access in SharePoint Admin
Because the SPFx client uses Entra ID Single Sign-On (SSO) to query the Azure Function, SharePoint must be granted permission to request tokens for your backend API registration:

1. Open the **SharePoint Admin Center** (`https://<tenant>-admin.sharepoint.com`).
2. In the left-hand navigation, expand **Advanced** and click **API access**.
3. Under the **Pending approvals** section, you should see a request from `backupwatch-client` requesting access to your app registration (e.g. `BackupWatch-Backend-API` or your custom resource ID).
4. Select the request and click **Approve**.

---

## Part 4: Adding and Configuring the Web Part

This section provides detailed step-by-step instructions to add the Web Part to a modern SharePoint page, configure its settings, handle user consent, and troubleshoot common runtime issues.

### 1. Add the Web Part to a SharePoint Page
1. Navigate to the SharePoint site and the page where you want to add the dashboard.
2. In the top-right corner of the page, click **Edit** to put the page in edit mode.
3. Choose or configure the correct Section Layout:
   * **Recommendation**: Because this dashboard contains a wide table displaying Datto BCDR telemetry, a **One Column** or a **Full-Width Section** is highly recommended to prevent horizontal scrolling and UI compression.
   * To change section layout, hover over the left side of the section container, click the **Edit section** (pencil) icon, and choose **One column**.
4. Hover over the section area, click the circled **`+`** icon (Add a new web part).
5. Search for `BackupWatch` in the search box, and click on the **BackupWatch** web part to insert it.

### 2. Configure Web Part Properties
1. Click inside the **BackupWatch** web part container.
2. In the toolbox on the left of the web part, click the **Edit web part** (pencil) icon. This opens the configuration panel on the right side of the screen.
3. Configure the following properties:
   * **Description**: Enter a user-friendly name (e.g., `Datto BCDR Real-Time Monitor`).
   * **Azure Function Endpoint URL**: 
     * **Production**: Set to your live Azure Function API endpoint. 
       * **How to find it**:
         1. In the [Azure Portal](https://portal.azure.com), navigate to your **Function App** (e.g. `backupwatch-api`).
         2. On the **Overview** page, look at the **Default domain** in the top right (it looks like `backupwatch-api.azurewebsites.net`).
         3. Your API endpoint is `https://` + the default domain + `/api/backupWatchTrigger`. (e.g. `https://backupwatch-api.azurewebsites.net/api/backupWatchTrigger`).
         4. *Alternatively*: Click **Functions** under the *Functions* section on the left menu, click **backupWatchTrigger**, and click **Get Function URL** at the top of the page.
     * **Local Testing**: Set to `http://localhost:7071/api/backupWatchTrigger`.
   * **Azure Function App ID URI (Resource ID)**:
     * Set this to the App ID URI of the Entra ID App registration you configured in Step 1 (e.g., `api://backupwatch-api` or `api://<client-id>`).
     * *Note: This must match the Application ID URI shown in your App registration under the "Expose an API" tab exactly.*
4. Close the property pane once the values are entered (it saves automatically).

### 3. Publish the Page
1. Click **Publish** (or **Republish**) at the top right of the SharePoint page.
2. The page will refresh and the web part will start loading.

### 4. First-Time Authentication & Consent Flow
1. When users visit the page for the first time, SharePoint Online may display a prompt asking for permission to access the **BackupWatch-Backend-API** on their behalf.
2. If prompted, the user must click **Accept** or **Consent**.
3. Once consented, the web part will silently obtain access tokens from Microsoft Entra ID via Single Sign-On (SSO) on subsequent visits.

### 5. Troubleshooting Common Runtime Errors
If the web part fails to display data, check the browser console (`F12`) and cross-reference the error message with the table below:

| Error Symptom | Potential Cause | How to Fix |
| :--- | :--- | :--- |
| **"SSO Identity initialization failed"** | SharePoint API permissions are not approved, or the App ID URI is incorrect. | 1. Ensure the pending API access request is approved in **SharePoint Admin > API access**.<br>2. Ensure the **Resource ID** in the property pane matches your Entra ID App ID URI exactly. |
| **"Failed to query authenticated Azure Function endpoints" (401 Unauthorized)** | Entra ID authentication (Easy Auth) is misconfigured on the Azure Function App. | 1. Go to the Azure Function App > **Authentication**.<br>2. Ensure the Microsoft Identity provider is configured with the correct Client ID and Issuer URL.<br>3. Check that the *Client application requirement* is set to **Allow requests from any application**. |
| **"Fetch Error: Failed to fetch" (CORS Issue)** | The SharePoint domain is blocked by the Azure Function's CORS policy. | 1. Go to the Azure Function App > **CORS**.<br>2. Ensure your exact SharePoint Tenant URL (e.g. `https://mycompany.sharepoint.com`) is added to the allowed origins list.<br>3. Ensure **Enable Access-Control-Allow-Credentials** is checked.<br>4. Delete the wildcard `*` if it exists. |
| **"AADSTS500011: The resource principal was not found..."** | The App ID URI (Resource ID) is wrong, or is in the wrong Entra tenant. | 1. Confirm your App ID URI in Entra ID > **App registrations** > **Expose an API**.<br>2. Ensure the value in the web part properties matches it exactly (including the `api://` prefix). |
