package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

var loginPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{1,39}$`)

const day = 24 * time.Hour

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func fail(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("ошибка хранилища: %v", err)
	fail(w, http.StatusInternalServerError, "Не удалось выполнить операцию. Попробуйте ещё раз.")
}

func readJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	body := http.MaxBytesReader(w, r.Body, 4096)
	defer body.Close()
	decoder := json.NewDecoder(body)
	if err := decoder.Decode(dst); err != nil || decoder.Decode(new(any)) != io.EOF {
		fail(w, http.StatusBadRequest, "Проверьте формат запроса.")
		return false
	}
	return true
}

func (p *panel) listAccounts(w http.ResponseWriter, r *http.Request) {
	accounts, err := p.store.list(r.Context())
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, accounts)
}

func (p *panel) createAccount(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string `json:"name"`
		Login    string `json:"login"`
		Platform string `json:"platform"`
		Days     int    `json:"days"`
	}
	if !readJSON(w, r, &input) {
		return
	}
	name := strings.TrimSpace(input.Name)
	if name == "" || utf8.RuneCountInString(name) > 60 || !loginPattern.MatchString(input.Login) {
		fail(w, http.StatusBadRequest, "Проверьте имя и логин.")
		return
	}
	switch input.Platform {
	case "Android", "iOS", "Windows", "macOS":
	default:
		fail(w, http.StatusBadRequest, "Выберите платформу.")
		return
	}
	switch input.Days {
	case 0, 30, 90, 365:
	default:
		fail(w, http.StatusBadRequest, "Выберите срок доступа.")
		return
	}

	var secret [32]byte
	if _, err := rand.Read(secret[:]); err != nil {
		internalError(w, err)
		return
	}
	now := time.Now()
	a := account{
		ID: input.Login, Login: input.Login, Name: name, Platform: input.Platform,
		Created: now.UnixMilli(), Token: hex.EncodeToString(secret[:]),
	}
	if input.Days > 0 {
		deadline := now.Add(time.Duration(input.Days) * day).UnixMilli()
		a.Until = &deadline
	}
	created, err := p.store.create(r.Context(), a)
	if err != nil {
		internalError(w, err)
		return
	}
	if !created {
		fail(w, http.StatusConflict, "Этот логин уже занят.")
		return
	}
	writeJSON(w, http.StatusCreated, a)
}

func (p *panel) updateAccount(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !loginPattern.MatchString(id) {
		fail(w, http.StatusNotFound, "Учётная запись не найдена.")
		return
	}
	var input struct {
		Action string `json:"action"`
	}
	if !readJSON(w, r, &input) {
		return
	}
	switch input.Action {
	case "share", "extend", "revoke":
	default:
		fail(w, http.StatusBadRequest, "Операция недоступна.")
		return
	}
	a, err := p.store.change(r.Context(), id, input.Action, time.Now().UnixMilli(), (30 * day).Milliseconds())
	switch {
	case errors.Is(err, sql.ErrNoRows):
		fail(w, http.StatusNotFound, "Учётная запись не найдена.")
	case errors.Is(err, errIneligible):
		fail(w, http.StatusConflict, "Операция недоступна для этой учётной записи.")
	case err != nil:
		internalError(w, err)
	default:
		writeJSON(w, http.StatusOK, a)
	}
}

func (p *panel) profile(w http.ResponseWriter, r *http.Request) {
	id, token := r.PathValue("id"), r.Header.Get("X-Profile-Token")
	if !loginPattern.MatchString(id) || len(token) != 64 {
		fail(w, http.StatusNotFound, "Ссылка недействительна.")
		return
	}
	a, err := p.store.get(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		fail(w, http.StatusNotFound, "Ссылка недействительна.")
		return
	}
	if err != nil {
		internalError(w, err)
		return
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(a.Token)) != 1 {
		fail(w, http.StatusNotFound, "Ссылка недействительна.")
		return
	}
	if a.Revoked || (a.Until != nil && *a.Until <= time.Now().UnixMilli()) {
		fail(w, http.StatusGone, "Доступ к профилю завершён.")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"name": a.Name, "login": a.Login, "platform": a.Platform, "until": a.Until})
}
