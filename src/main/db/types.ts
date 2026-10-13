import type Database from 'better-sqlite3'

// Every query function takes the connection as its first argument instead of reading a
// global. That keeps them pure and lets tests pass an in-memory database.
export type DB = Database.Database
