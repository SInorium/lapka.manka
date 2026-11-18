package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"errors"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

//go:embed web
var web embed.FS

type panel struct {
	store       *store
	origin      string
	adminUser   [sha256.Size]byte
	adminSecret [sha256.Size]byte
}

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("man-ka: ")
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	origin := setting("MAN_KA_ORIGIN", "http://127.0.0.1:8080")
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" {
		return errors.New("MAN_KA_ORIGIN должен содержать схему и домен без пути")
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1")) {
		return errors.New("для внешнего адреса MAN_KA_ORIGIN нужен HTTPS")
	}

	password := os.Getenv("MAN_KA_ADMIN_PASSWORD")
	if dir := os.Getenv("CREDENTIALS_DIRECTORY"); dir != "" {
		data, err := os.ReadFile(filepath.Join(dir, "admin-password"))
		if err != nil {
			return err
		}
		password = strings.TrimRight(string(data), "\r\n")
	}
	if password == "" {
		return errors.New("задайте пароль администратора через MAN_KA_ADMIN_PASSWORD или systemd LoadCredential")
	}

	db, err := openStore(setting("MAN_KA_DB", "man-ka.db"))
	if err != nil {
		return err
	}
	defer db.db.Close()

	p := &panel{
		store: db, origin: origin,
		adminUser:   sha256.Sum256([]byte(setting("MAN_KA_ADMIN_USER", "admin"))),
		adminSecret: sha256.Sum256([]byte(password)),
	}
	server := &http.Server{
		Addr:              setting("MAN_KA_LISTEN", "127.0.0.1:8080"),
		Handler:           p.handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("слушаю %s, адрес панели %s", server.Addr, origin)
	return server.ListenAndServe()
}

func setting(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func (p *panel) handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /{$}", p.admin(http.HandlerFunc(index)))
	mux.HandleFunc("GET /p/{$}", index)
	assets, _ := fs.Sub(web, "web")
	for _, name := range []string{"style.css", "app.js", "icons.js"} {
		mux.Handle("GET /"+name, http.FileServerFS(assets))
	}
	mux.Handle("GET /api/accounts", p.admin(http.HandlerFunc(p.listAccounts)))
	mux.Handle("POST /api/accounts", p.admin(http.HandlerFunc(p.createAccount)))
	mux.Handle("POST /api/account/{id}", p.admin(http.HandlerFunc(p.updateAccount)))
	mux.HandleFunc("GET /api/profile/{id}", p.profile)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:")
		w.Header().Set("Cache-Control", "no-store")
		mux.ServeHTTP(w, r)
	})
}

func index(w http.ResponseWriter, _ *http.Request) {
	data, _ := web.ReadFile("web/index.html")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func (p *panel) admin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, password, ok := r.BasicAuth()
		userHash := sha256.Sum256([]byte(user))
		secretHash := sha256.Sum256([]byte(password))
		matches := subtle.ConstantTimeCompare(userHash[:], p.adminUser[:]) &
			subtle.ConstantTimeCompare(secretHash[:], p.adminSecret[:])
		if !ok || matches != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="man-ka", charset="UTF-8"`)
			fail(w, http.StatusUnauthorized, "Войдите как администратор.")
			return
		}
		if r.Method == http.MethodPost && r.Header.Get("Origin") != p.origin {
			fail(w, http.StatusForbidden, "Недопустимый источник запроса.")
			return
		}
		next.ServeHTTP(w, r)
	})
}
