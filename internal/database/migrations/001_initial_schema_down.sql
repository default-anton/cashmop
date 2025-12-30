-- Drop all tables (reverse of 001_initial_schema.sql)
DROP INDEX IF EXISTS idx_transactions_category_id;
DROP INDEX IF EXISTS idx_transactions_date;
DROP TABLE IF EXISTS categorization_rules;
DROP TABLE IF EXISTS column_mappings;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS accounts;
