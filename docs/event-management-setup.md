# Event management deployment setup

## Vercel Blob (private screenshot storage)

1. In the HMDL Vercel project, create a Blob store and choose **Private** access.
2. Connect the store to the HMDL project for the Production and Preview environments you intend to use.
3. Confirm Vercel provides `BLOB_READ_WRITE_TOKEN` to the application runtime.
4. Event screenshots are stored in Blob; Railway PostgreSQL stores only event/image metadata.
5. Uploads are sent one screenshot at a time. The current server upload limit is 4 MB per screenshot to stay below the Vercel Function request-body limit.

## Discord attendance bot

Use the existing HMDL Discord application; OAuth login settings and callback URLs remain unchanged.

1. In Discord Developer Portal, open the HMDL application and create/enable its Bot user.
2. Add the bot to each guild server where attendance messages are required. It needs permission to view the configured channel and send messages.
3. In the application's **Interactions Endpoint URL**, set the production endpoint to:
   `https://<your-hmdl-domain>/api/discord/interactions`
4. Add these server-side environment variables to Vercel:
   - `DISCORD_BOT_TOKEN`: the bot token (never expose it to the browser).
   - `DISCORD_PUBLIC_KEY`: the application's public key from General Information.
5. In HMDL, open Guild Settings → Discord Notifications and enter the target event channel's Discord ID.
6. Deploy after setting the environment variables, then test by creating a future event.

The bot posts an attendance message with Available, Unavailable and AFK / Busy buttons. Responses are accepted until 30 minutes before the event. The hourly event-management cron sends the 48-hour reminder and generates recurring RO3 event instances.

## Cron schedule

The event-management cron currently runs hourly. Vercel Hobby deployments only support daily cron frequency; the hourly schedule therefore requires a Vercel plan that supports sub-daily cron jobs. Do not change it to daily if exact 48-hour reminders are required.
