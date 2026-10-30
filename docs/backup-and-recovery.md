# DropVerse backup and recovery

## What the scheduled backup contains

The daily GitHub Actions workflow creates an encrypted archive containing:

- PostgreSQL schema and data for `public`, `dv`, and `ossol_memory`.
- Supabase CLI migration history (`supabase_migrations.schema_migrations`).
- Supabase Auth user and identity rows (`auth.users`, `auth.identities`) so user UUIDs and password hashes can be preserved, plus the custom `auth.users` trigger definition.
- Storage bucket settings and the actual objects from every bucket.

Active sessions and refresh tokens are intentionally not exported; users must sign in again after a recovery. Vercel environment variables, provider secrets, and deployment configuration are not part of the archive and must be retained separately in a secure password manager.

The repository is public. The workflow uploads only an **age-encrypted** archive; it never uploads the plaintext tarball. The decryption private key must remain offline and must never be committed or added to GitHub.

## One-time GitHub setup

1. Install age locally and generate a key pair:

   ```bash
   age-keygen -o dropverse-backup-key.txt
   ```

2. Copy only the public recipient (the line beginning with `age1...`) into the repository variable:
   - GitHub repository → Settings → Secrets and variables → Actions → Variables
   - Name: `BACKUP_AGE_RECIPIENT`
   - Value: the `age1...` recipient

3. Add these repository Actions secrets:
   - `SUPABASE_DB_URL`: PostgreSQL connection string for this Supabase project. Prefer the Session Pooler connection string and URL-encode special characters in the password.
   - `SUPABASE_URL`: project URL, e.g. `https://<project-ref>.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase secret/service-role key.

4. For independent outage notifications from GitHub Actions, also add:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_ADMIN_CHAT_ID`

5. Keep `dropverse-backup-key.txt` in an offline password manager or encrypted offline storage. Do not upload it to GitHub.

## Running and checking backups

- The workflow runs daily at 02:17 UTC.
- You can run it immediately from GitHub → Actions → **DropVerse encrypted daily backup** → Run workflow.
- Confirm the run succeeds and that the artifact contains `dropverse-backup.tar.gz.age` and its SHA-256 file.
- Retention in GitHub Actions is 30 days. For longer retention, periodically copy the encrypted artifact to a separate private/off-site location.
- Before relying on the process, download one artifact and verify that it decrypts with your private age key.

## Recovery into a new Supabase project

This runbook assumes a **new, empty Supabase project**. Do not run the data import against a live production database without a separate recovery plan and a verified pre-restore backup.

1. Download the encrypted artifact and verify its checksum:

   ```bash
   sha256sum -c dropverse-backup.tar.gz.age.sha256
   age -d -i dropverse-backup-key.txt -o dropverse-backup.tar.gz dropverse-backup.tar.gz.age
   tar -xzf dropverse-backup.tar.gz
   ```

2. Before restoring schema, connect to the new project's database as the database owner and remove broad default table grants for future objects:

   ```sql
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     REVOKE ALL ON TABLES FROM anon, authenticated;
   ```

3. Restore the application schema, then Auth users/identities, then application data. The Auth export disables triggers during import so the new project's user-created trigger does not create duplicate profile rows; the application data dump restores those rows.

   ```bash
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/database/schema.sql
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/auth/auth-data.sql
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/auth/auth-users-triggers.sql
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/database/data.sql
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/database/migration-history-schema.sql
   psql "$RESTORE_DB_URL" -v ON_ERROR_STOP=1 -f backup/database/migration-history-data.sql
   ```

4. Restore Storage buckets and objects using the new project's URL and service-role key:

   ```bash
   SUPABASE_URL="https://<new-project-ref>.supabase.co" \
   SUPABASE_SERVICE_ROLE_KEY="<new-project-secret-key>" \
   BACKUP_ROOT=backup \
   node scripts/restore-supabase-storage.mjs
   ```

5. Recreate Vercel environment variables from the secure password manager, deploy the application, and verify login, RLS, payments, samples, project files, and Admin APIs before directing traffic to the restored project.

## Important limitations

- The archive includes Auth users and identities but not active sessions or refresh tokens. All users will need to sign in again.
- Storage files are downloaded through the Storage API; verify the first backup's object count against the Storage dashboard.
- GitHub Actions is an off-site logical backup, not Supabase Point-in-Time Recovery. It does not provide continuous recovery to an arbitrary second.
- Keep the age private key separately. Without it, the encrypted backup cannot be restored.
