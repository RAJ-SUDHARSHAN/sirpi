# Database Migrations

**Main Schema:** `../schema.sql` - Use this for fresh database setup

## Future Migrations

Place incremental migrations here:
- Use sequential numbering: `001_`, `002_`, etc.
- Make migrations idempotent
- Test in development first
- Include rollback instructions in comments

## Example

```sql
-- Migration: 001_add_feature.sql
-- Forward
ALTER TABLE projects ADD COLUMN IF NOT EXISTS new_field TEXT;

-- Rollback (manual):
-- ALTER TABLE projects DROP COLUMN IF EXISTS new_field;
```
