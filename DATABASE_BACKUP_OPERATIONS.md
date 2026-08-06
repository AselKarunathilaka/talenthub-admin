# TalentHub Full Database Backup Operations

This runbook protects the complete MongoDB `intern-attendance` database, including
logbooks, attendance, intern profiles, users, leave requests, face profiles,
reservations, application settings, collection metadata, and index definitions.

The implementation is archive-first: it creates a compressed BSON archive, computes
a SHA-256 checksum, and copies the archive into a timestamped database on a separate
MongoDB Atlas cluster. It never writes to the production database.

## 1. Prerequisites

1. Install the MongoDB Database Tools (`mongodump` and `mongorestore`) on the
   backup runner.
2. Create a dedicated read-only Atlas user for the production source database.
3. Create a separate Atlas project/cluster and a dedicated backup writer.
4. Add the backup runner's fixed IP address to both Atlas projects.
5. Copy the variables from `backend/.env.backup.example` into the protected
   production secret store. Do not commit real connection strings.

Using a different cluster is required by default. To avoid a developer or leaked
application credential deleting both copies, the application itself must not receive
the backup-cluster credential.

## 2. Validate configuration

From the backend directory:

```bash
npm run backup:db:check
npm run backup:db:dry-run
```

These commands validate environment values and MongoDB Database Tools without
creating a backup or changing either database.

## 3. Create a full backup

```bash
npm run backup:db
```

The command performs these steps:

1. Dumps every collection in `intern-attendance` into a compressed archive.
2. Writes the archive through a `.partial` path so an interrupted dump is never
   mistaken for a completed backup.
3. Computes a SHA-256 checksum and writes a metadata record.
4. When `MONGO_BACKUP_TARGET_URI` is configured, imports the full archive into a
   new timestamped database such as `talenthub_backup_20260803_020000`.
5. Confirms the restored database contains collections and records their counts.
6. Removes only locally managed backup files older than the configured retention.

Local artifacts are stored under `backend/backups/` by default and are ignored by Git.
Copy archives to encrypted object storage for an additional independent backup copy.

## 4. Super Admin management and daily schedule

The Super Admin portal includes **Database Backups** at
`/admin/database-backups`. Only a user whose persisted role is `super_admin` can
access the page or its API. It provides storage status, the five managed snapshots,
a manual **Backup now** action, and operation progress. Restore actions are not
available in this rollout and require a later team-approved implementation.

When `MONGO_BACKUP_TARGET_URI` is configured and
`MONGO_BACKUP_SCHEDULER_ENABLED=true`, the backend schedules a full backup every
day at **12:00 PM Asia/Colombo**. The latest five completed local archives and the
latest five timestamped databases on the separate cluster are retained. Older
managed snapshots are deleted only after a new snapshot has been created and
verified.

The scheduler runs in the long-lived Node backend process. For horizontally scaled
or serverless deployments, disable it in application instances and use one external
scheduled runner to avoid duplicate jobs:

```cron
CRON_TZ=Asia/Colombo
0 12 * * * cd /srv/talenthub/backend && /usr/bin/npm run backup:db >> /var/log/talenthub-backup.log 2>&1
```

Use absolute paths that match the production host. Configure monitoring to alert if
the job exits non-zero or no successful metadata file appears for 26 hours.

Set `MONGO_BACKUP_SCHEDULER_ENABLED=false` when using the external schedule.

## 5. Recovery scope

Recovery is deliberately excluded from the first rollout. The team must document,
review, approve, and test the recovery runbook before any restore API or portal
control is introduced. Until then, backup snapshots are read-only recovery assets
managed by authorized Atlas operators.

## 6. Retention and backup testing

- Keep at least 30 daily local archives.
- Keep 12 weekly and 12 monthly archives in encrypted object storage or Atlas backup.
- Plan a team-reviewed restore drill before enabling application-based recovery.
- Keep backup credentials separate from developer accounts.
- Enable Atlas Cloud Backup and point-in-time recovery when the cluster tier supports it.

## 7. Destructive cleanup protection

Backend startup now reads `AUTO_CLEANUP_INACTIVE_INTERNS`. The safe default is false.
Only an authorized operator should temporarily enable cleanup after reviewing a dry-run
or reconciliation report and confirming a recent verified backup exists.
