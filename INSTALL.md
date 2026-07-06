# SSVP — Sıfırdan Kurulum

Boş bir Ubuntu sunucusuna projeyi çekip **tek komutla** çalışır hale getirir.

## Hızlı kurulum

```bash
git clone <REPO_URL> Smart-Security-Validation-Platform
cd Smart-Security-Validation-Platform
sudo python3 install.py
```

Bittiğinde:

- **Uygulama:** `http://SUNUCU_IP/` (port 80)
- **Giriş:** `admin` / `admin` (ilk girişte parola değişir)
- **phpMyAdmin:** `http://SUNUCU_IP:8081/phpmyadmin/`

## Kurulum neleri yapar

| # | Adım | Açıklama |
|---|------|----------|
| 1 | Sistem paketleri | `python3-venv`, `git`, `curl`, `ufw`, `fonts-dejavu` (Türkçe PDF) |
| 2 | MySQL | `ssvp` veritabanı + `ssvp/ssvp123` kullanıcısı (127.0.0.1:3306) |
| 3 | phpMyAdmin | Apache üzerinde, 8081 portu |
| 4 | Docker | Kurar, servisi açar, kullanıcıyı `docker` grubuna ekler |
| 5 | Ollama | Yerel LLM servisi + (isteğe bağlı) model indirme |
| 6 | Python venv | `venv/` + `requirements.txt` bağımlılıkları |
| 7 | Dizinler/izinler | `logs/`, `scans/`, `data/` |
| 8 | Parolasız sudo | Ayarlar'dan tool/servis yönetimi için (`apt-get`, `systemctl`, `setcap`) |
| 9 | Tarama yetkileri | `setcap` — `nmap -O`/`-sS` yetki sorununun kalıcı çözümü |
| 10 | UFW | 22 (SSH), 80, 8081 portları |
| 11 | Veritabanı seed | YZO + 3YM katalogları, scriptler kurulum konumuna, `admin/admin` |
| 12 | systemd servisi | `ssvp.service` — açılışta otomatik başlar |

> **Pentest araçları** (metasploit, nikto, sqlmap, hydra vb.) bilerek kurulmaz.
> Bunları uygulama içindeki **Ayarlar > Pentest Araçları** ekranından kurun.

## Sık kullanılan seçenekler

```bash
sudo python3 install.py --help              # tüm seçenekler
sudo python3 install.py --skip-ollama       # Ollama'yı kurma (sadece bulut LLM)
sudo python3 install.py --ollama-model ""   # Ollama'yı kur ama model indirme
sudo python3 install.py --port 8080         # uygulamayı başka porta al
sudo python3 install.py --reset-db          # veritabanını sıfırla, seed'i baştan
sudo python3 install.py --app-user deploy   # farklı çalışma kullanıcısı
sudo python3 install.py --caps-only         # sadece tarama araçlarına setcap
```

`--caps-only`: Ayarlar ekranından yeni bir tarama aracı (nmap/masscan/netdiscover)
kurduktan sonra yetkilerini yenilemek için çalıştırın.

## Servis yönetimi

```bash
sudo systemctl status ssvp
sudo systemctl restart ssvp
journalctl -u ssvp -f
```

## Notlar

- Betik **idempotent**'tir; sorunsuz şekilde tekrar çalıştırılabilir.
- Yalnızca standart Python kütüphanesini kullanır (harici bağımlılık yok).
- Ubuntu (apt tabanlı) hedeflenmiştir; `sudo` ile çalıştırılmalıdır.
