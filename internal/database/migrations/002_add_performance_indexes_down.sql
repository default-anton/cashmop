-- Remove performance indexes (reverse of 002_add_performance_indexes.sql)
DROP INDEX IF EXISTS idx_transactions_owner_id;
DROP INDEX IF EXISTS idx_transactions_account_id;
