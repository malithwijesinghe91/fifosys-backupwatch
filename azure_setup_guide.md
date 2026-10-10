# Detailed Azure & Entra ID Provisioning Guide

This guide walks you through setting up the necessary Azure resources and Entra ID (Azure AD) configurations required for the **BackupWatch** dashboard. 

---

## Step 1: Create the Microsoft Entra ID App Registration
This step creates the identity for your backend Azure Function, enabling Single Sign-On (SSO) and ensuring only users inside your M365 Tenant can access it.

1.  Log in to the [Microsoft Entra Admin Center](https://entra.microsoft.com/) or the [Azure Portal](https://portal.azure.com/).
2.  Navigate to **Microsoft Entra ID** (or **Azure Active Directory**).
3.  On the left menu, click **App registrations** > **New registration**.
4.  Configure the registration:
    *   **Name:** `BackupWatch-Backend-API` (or similar).
    *   **Supported account types:** Select **Accounts in this organizational directory only (Single tenant)**.
    *   **Redirect URI:** Leave blank for now (we will update this once the Function App is created).
5.  Click **Register**.
6.  **Important:** Copy the following values from the **Overview** tab; we will need them later:
    *   **Application (client) ID**
    *   **Directory (tenant) ID** (This is your unique M365 Tenant ID).

---

## Step 2: Expose the API Scope (For SPFx Frontend Access)
To allow your SharePoint Framework (SPFx) web part to query the Azure Function securely, you must expose an API scope.

1.  Inside your new App Registration, click **Expose an API** in the left menu.
2.  Next to **Application ID URI**, click **Add** (or **Set**). 
    *   It will suggest a default URI like `api://<client-id>`. Click **Save**.
3.  Under **Scopes defined by this API**, click **Add a scope**.
4.  Configure the scope:
    *   **Scope name:** `user_impersonation`
    *   **Who can consent?:** Admins and users
    *   **Admin consent display name:** `Access BackupWatch API`
    *   **Admin consent description:** `Allows the BackupWatch SPFx Web Part to retrieve aggregated Datto BCDR data on behalf of the user.`
    *   **State:** Enabled
5.  Click **Add scope**.

---

## Step 3: Create the Azure Function App
Now we will create the hosting environment for your Node.js backend.

1.  Log in to the [Azure Portal](https://portal.azure.com/).
2.  Click **Create a resource** and search for **Function App**. Click **Create**.
3.  **Select a hosting option (First Screen):** 
    *   Select the **Flex Consumption** option (the first card on the left).
    *   *Why this plan?* It is Microsoft's recommended serverless option. It runs on **Linux**, has fast event-driven scaling, solves the core quota issue, and has a pay-as-you-go pricing structure.
    *   Click **Select** (or proceed with the wizard).
4.  Configure the **Basics** tab:
    *   **Subscription:** Select your active Azure subscription.
    *   **Resource Group:** Click **Create new** (e.g., `rg-backupwatch`) or select an existing one.
    *   **Function App name:** Enter a globally unique name (e.g., `backupwatch-api`). This forms your backend URL: `https://<your-app-name>.azurewebsites.net`.
    *   **Runtime stack:** Select **Node.js**.
    *   **Version:** Select **20 LTS** (or **18 LTS**).
    *   **Region:** Select your nearest/preferred geographic region (e.g., `UK South`).
5.  Configure the **Storage** tab:
    *   **Storage account:** Accept the default auto-suggested new storage account (e.g., `backupwatchstorage`). *This Storage Account will also host our Azure Table Storage for exclusions.*
6.  You can skip or leave defaults for **Networking**, **Monitoring**, **Deployment**, **Authentication**, and **Tags** tabs.
7.  Click **Review + create**, verify details, and then click **Create**. Wait for the resource deployment to complete.

---

## Step 4: Configure App Service Authentication (Easy Auth)
This locks down the Azure Function so that it automatically rejects any request that doesn't contain a valid Microsoft login token from your tenant.

1.  Navigate to your newly created **Function App** in the Azure Portal.
2.  On the left menu, scroll down to the **Settings** section and click **Authentication**.
3.  Click **Add identity provider**.
4.  Configure the identity provider:
    *   **Identity provider:** Select **Microsoft**.
    *   **App registration type:** Select **Provide the details of an existing app registration** (since we created it in Step 1).
    *   **App ID (client ID):** Paste the **Application (client) ID** you copied in Step 1.
    *   **Issuer URL:** Enter `https://login.microsoftonline.com/<your-tenant-id>/v2.0` (replace `<your-tenant-id>` with the Directory/Tenant ID from Step 1).
    *   **Client application requirement:** Select **Allow requests from any application (Not recommended)**. 
        *   *Why?* The SPFx client app runs in the user's browser under the SharePoint client context, not the Function App's own registration context. If you restrict it to "this application itself", the SPFx Web Part will be blocked from calling the API.
    *   **Tenant requirement:** Select **Allow requests only from the issuer tenant** (which is automatically set to your tenant).
    *   **Restrict access:** Select **Require authentication**.
    *   **Unauthenticated requests:** Select **HTTP 401 Unauthorized: recommended for APIs**.
        *   *Why?* Since the SPFx frontend calls the Azure Function programmatically via JavaScript (AJAX), we want a clean HTTP 401 response if authentication fails. If you choose "HTTP 302 Found redirect", the browser will attempt to redirect the AJAX request to Microsoft's login page, which will cause a CORS error in the console.
5.  Click **Add** (or **Save**).

---

## Step 5: Configure Application Settings & CORS
We need to provide the Datto API keys, tell the app which Tenant ID to validate, and allow the SharePoint site to communicate with the Function.

### A. Add Environment Variables (App Settings)
1.  In your **Function App**, click **Environment variables** (under **Settings** on the left menu).
2.  Under the **App settings** tab, click **Add**.
3.  Add the following key-value pairs:
    *   **Key:** `DATTO_CREDS`
        *   **Value:** `PublicKey:SecretKey` (Replace with your actual Datto API credentials).
    *   **Key:** `ALLOWED_TENANT_ID`
        *   **Value:** Paste your **Directory (tenant) ID** from Step 1.
4.  Click **Apply** at the bottom, then click **Save** at the top of the settings page to apply the restart.

### B. Configure CORS (Cross-Origin Resource Sharing)
1.  On the left menu of the Function App, scroll to the **API** section and click **CORS**.
2.  Under **Allowed Origins**, check **Enable Access-Control-Allow-Credentials**.
3.  Add your SharePoint Online Tenant URL (e.g. `https://<yourcompany>.sharepoint.com`).
4.  **Important:** Delete the wildcard entry (`*`) if it exists in the list (Azure will reject authenticated requests if `*` is present).
5.  Click **Save**.

---

## Step 6: Create the Table Storage "Exclusions" Table
This is the database table where our volume exclusions will be stored.

1.  In the Azure Portal, navigate to the **Storage account** that was created alongside your Function App (Step 3, point 4).
2.  On the left menu under **Data storage**, click **Tables**.
3.  Click **+ Table** at the top.
4.  Enter the Table name: `Exclusions` (Must match the name in our code exactly).
5.  Click **OK**.
