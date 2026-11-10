# Operations runbook

This runbook covers the GitHub Pages deployment and Firebase project `money-path-af37c`. Do not put user financial data, authentication tokens, or service-account credentials in issue comments or workflow logs.

## Deployment and failure alerts

- Production deploys are triggered by pushes to `main`. The workflow runs lint, unit tests, TypeScript/Vite build, and Firestore Emulator rules/sync tests before publishing.
- Review run status and logs in [GitHub Actions](https://github.com/BOBAH1988/Money-Path/actions). Subscribe to workflow failure notifications in GitHub **Settings → Notifications → Actions** and keep repository push notifications enabled for `main`.
- If a run fails, do not repeat-push blindly. Inspect the failed job and SHA, fix on a new commit, then confirm a successful deploy run for the new `main` SHA.
- The deploy workflow has no automatic rollback. To roll back, revert the offending commit on `main`; the resulting successful workflow redeploys the prior content.

## Firebase health, quota, and cost monitoring

Console monitoring is a project-owner action; source control and Firebase CLI cannot confirm that budgets or alert recipients are configured.

1. In [Firebase Usage and billing](https://console.firebase.google.com/project/money-path-af37c/usage), review Firestore reads, writes, deletes, storage, and Authentication activity at least weekly during beta and after unusual traffic.
2. In Google Cloud Console **Billing → Budgets & alerts**, create a project budget and configure alert recipients for early warning thresholds (for example 50%, 80%, and 100%). Budgets alert; they do not automatically cap spending.
3. In Firebase Console **Firestore → Usage**, investigate sudden read/write/delete increases. Check application release time and GitHub Actions deploy SHA before attributing a spike.
4. Ensure an owner—not only the application admin account—receives billing and project-health notifications. Never use a broad service-account key in the browser app or GitHub Actions.

## Data backup and recovery

- Signed-in users can create a JSON archive from **Import and export → Download archive**. The archive is user-controlled and includes collections and the budget plan. Store it encrypted in a location separate from the device.
- Before a risky release or bulk account action, create and verify a fresh archive. Do not treat local browser storage as a backup.
- To restore, sign into the intended account, import the archive, confirm the restore summary, and check the dashboard, assets, liabilities, income, archive, and budget plan. Keep the original file until verification is complete.
- For an account-specific sync incident: ask the user to keep the app/device data intact, export an archive if still available, inspect the app's sync error and browser console without requesting financial values, then retry after connectivity is restored. Do not clear browser storage or remove queued changes before the account owner has a verified backup.
- Firestore currently has no managed backup schedules or backup copies. A daily schedule with 7-day retention was considered, but Firebase rejected creation because Cloud Billing is disabled; the owner chose to keep billing and managed backups off. User-controlled JSON archives remain the available recovery path. If billing is enabled later, review backup charges, configure the selected retention, wait for the first backup, and complete a restore drill before relying on managed recovery.

## Incident checklist

1. Record the affected release SHA, time, affected feature, and sanitized error code/message. Never copy account data, archive JSON, tokens, or passwords into the report.
2. Check GitHub Actions, Firebase service health, Firestore usage, and Cloud Billing alerts.
3. If a release caused the issue, revert the release commit and verify the rollback deployment.
4. For suspected cross-account access, immediately disable sign-in or the affected Firebase service as needed, review the Firestore Rules release history and Authentication activity, and notify affected users through the established support channel.
5. Confirm data integrity from a user-controlled archive or approved Firestore recovery point before resuming writes.
6. Document cause, impact, recovery, and follow-up actions without including personal financial information.

## Owner setup still required

- Confirm GitHub Actions failure notifications reach a monitored inbox; the current GitHub CLI token lacks the `notifications` permission needed to inspect or change the user's subscription.
- Cloud Billing budgets and alerts are not configured. Billing is currently disabled by owner choice; do not enable paid billing without explicit approval and a selected billing account.
- Review current Firestore/Auth usage and establish baseline thresholds in Firebase/Google Cloud Console; the repository CLI cannot provide this usage baseline.
- Managed Firestore backups are off by owner choice; see the recovery section before enabling them.
- The app now publishes terms and a privacy notice in its footer and registration flow. Have Russian privacy counsel review the documents and the disclosed US Firestore region, provide any legally required operator address, and confirm the feedback email is monitored before public launch.
