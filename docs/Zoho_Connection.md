# Connect your own Zoho CRM account

Do these steps manually. Do not send the credential values in chat or record this screen in Loom.

1. Open the [Zoho API Console](https://api-console.zoho.in/). If your CRM account is in a different region, use that region's API Console and set the matching accounts URL in `.env.zoho`.
2. Add a **Self Client**. Open its **Client Secret** tab.
3. Paste its Client ID and Client Secret into the corresponding fields in the local `.env.zoho` file.
4. In **Generate Code**, enter these scopes: `ZohoCRM.modules.leads.CREATE,ZohoCRM.modules.leads.UPDATE,ZohoCRM.modules.leads.READ`.
5. Choose a ten-minute code expiry if offered. Description: `Myntmore assignment draft-only lead sync`. Create the code and select your own CRM organization when prompted.
6. Paste the code into `ZOHO_GRANT_CODE=` in `.env.zoho` and save immediately. Tell Codex it is saved so it can exchange the short-lived code.
7. `node scripts/zoho-auth.mjs` exchanges it directly with Zoho and stores the refresh token in the main `.env`, without printing it. Restart the worker, then run the workflow again to sync existing validated drafts.

The integration only calls the Leads upsert endpoint. Email sending is absent, and the request suppresses workflows and Cadences. Use the standalone assignment CRM account, not an employer's production CRM.

Sources: [Zoho Self Client flow](https://www.zoho.com/developer/oauth/self-client/authorization-code-flow.html), [Zoho Leads upsert scopes](https://www.zoho.com/crm/developer/docs/api/v8/upsert-records.html).
