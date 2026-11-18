package main

import (
	"context"
	"database/sql"
	"errors"

	_ "modernc.org/sqlite"
)

type account struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Login    string `json:"login"`
	Platform string `json:"platform"`
	Created  int64  `json:"created"`
	Until    *int64 `json:"until"`
	Revoked  bool   `json:"revoked"`
	Token    string `json:"token"`
}

type store struct {
	db *sql.DB
}

func openStore(path string) (*store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// Одна SQLite-сессия последовательно применяет локальные записи.
	db.SetMaxOpenConns(1)
	_, err = db.Exec(`
		PRAGMA busy_timeout = 5000;
		CREATE TABLE IF NOT EXISTS accounts (
			login TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			platform TEXT NOT NULL,
			created INTEGER NOT NULL,
			until INTEGER,
			revoked INTEGER NOT NULL DEFAULT 0,
			token TEXT NOT NULL UNIQUE
		) STRICT;`)
	if err != nil {
		_ = db.Close()
		return nil, err
	}
	return &store{db: db}, nil
}

const fields = "login, name, platform, created, until, revoked, token"

type scanner interface {
	Scan(dest ...any) error
}

func scanAccount(row scanner) (account, error) {
	var a account
	err := row.Scan(&a.Login, &a.Name, &a.Platform, &a.Created, &a.Until, &a.Revoked, &a.Token)
	a.ID = a.Login
	return a, err
}

func (s *store) list(ctx context.Context) ([]account, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT "+fields+" FROM accounts ORDER BY created DESC, login")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := make([]account, 0)
	for rows.Next() {
		a, err := scanAccount(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, a)
	}
	return accounts, rows.Err()
}

func (s *store) create(ctx context.Context, a account) (bool, error) {
	result, err := s.db.ExecContext(ctx, `
		INSERT INTO accounts (login, name, platform, created, until, token)
		VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(login) DO NOTHING`,
		a.Login, a.Name, a.Platform, a.Created, a.Until, a.Token)
	if err != nil {
		return false, err
	}
	n, err := result.RowsAffected()
	return n == 1, err
}

func (s *store) get(ctx context.Context, login string) (account, error) {
	return scanAccount(s.db.QueryRowContext(ctx, "SELECT "+fields+" FROM accounts WHERE login = ?", login))
}

var errIneligible = errors.New("операция недоступна для этой учётной записи")

func (s *store) change(ctx context.Context, login, action string, now, extension int64) (account, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return account{}, err
	}
	defer tx.Rollback()

	a, err := scanAccount(tx.QueryRowContext(ctx, "SELECT "+fields+" FROM accounts WHERE login = ?", login))
	if err != nil {
		return account{}, err
	}

	switch action {
	case "revoke":
		a.Revoked = true
	case "extend":
		if a.Revoked || a.Until == nil {
			return account{}, errIneligible
		}
		deadline := max(*a.Until, now) + extension
		a.Until = &deadline
	case "share":
		if a.Revoked || (a.Until != nil && *a.Until <= now) {
			return account{}, errIneligible
		}
	}
	_, err = tx.ExecContext(ctx, "UPDATE accounts SET until = ?, revoked = ? WHERE login = ?", a.Until, a.Revoked, login)
	if err != nil {
		return account{}, err
	}
	return a, tx.Commit()
}
