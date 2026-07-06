#!/usr/bin/env python3
"""
Smart Security Validation Platform (SSVP) — sıfırdan sunucu kurulum betiği.

Amaç: `git clone` ile boş bir Ubuntu sunucusuna çekilen projeyi TEK KOMUTLA,
elle hiçbir ayar yapmadan, sorunsuz çalışır hale getirmek.

    sudo python3 install.py

Betik yalnızca standart kütüphaneyi kullanır (harici paket gerektirmez) ve
her adımı idempotent (tekrar çalıştırılabilir) yapacak şekilde yazılmıştır.

Ne yapar:
  1. Sistem paketlerini kurar/günceller (python3-venv, git, curl, ufw,
     fonts-dejavu — Türkçe PDF raporu için).
  2. MySQL kurar; `ssvp` veritabanı + `ssvp/ssvp123` kullanıcısını oluşturur.
  3. phpMyAdmin kurar (Apache üzerinde, 8081 portu).
  4. Docker kurar/yapılandırır (Open WebUI vb. için) ve uygulama kullanıcısını
     docker grubuna ekler.
  5. Ollama (yerel LLM) kurar, servisini etkinleştirir; istenirse modeli çeker.
  6. Python sanal ortamı (venv) oluşturur ve requirements.txt bağımlılıklarını
     kurar.
  7. logs/ , scans/ , data/ dizinlerini oluşturur ve izinlerini ayarlar.
  8. Uygulama kullanıcısına PAROLASIZ SUDO tanımlar (apt-get / systemctl /
     setcap / msfinstall) — Ayarlar ekranından tool ve servis yönetiminin
     çalışması için gereklidir.
  9. Tarama araçlarına raw-socket yetkisi (setcap) verir — `nmap -O` yetki
     sorununun kalıcı çözümü.
 10. UFW güvenlik duvarı kurallarını ekler (SSH/uygulama/phpMyAdmin portları).
 11. Veritabanını varsayılan verilerle seed eder (YZO + 3YM katalogları,
     scriptler kurulum konumuna yazılır, anahtarlar sıfırdan; admin/admin).
 12. systemd servisi (ssvp.service) kurar; uygulama açılışta otomatik başlar.

Pentest araçları (nmap dışı) BİLEREK kurulmaz — bunlar uygulama içindeki
"Ayarlar > Pentest Araçları" ekranından kurulur.

Seçenekler için: sudo python3 install.py --help
"""

from __future__ import annotations

import argparse
import grp
import json
import os
import pwd
import secrets
import shutil
import string
import subprocess
import sys
import time
from pathlib import Path


def generate_password(length: int = 18) -> str:
    """Readable but strong password (no ambiguous chars, guaranteed mixed set)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    specials = "!@%_-+="
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length - 2))
        pw += secrets.choice(specials) + secrets.choice(string.digits)
        if any(c.islower() for c in pw) and any(c.isupper() for c in pw) and any(c.isdigit() for c in pw):
            return pw


# --------------------------------------------------------------------------- #
# Terminal çıktısı yardımcıları
# --------------------------------------------------------------------------- #
class C:
    B = "\033[1m"
    G = "\033[32m"
    Y = "\033[33m"
    R = "\033[31m"
    C = "\033[36m"
    X = "\033[0m"


def _supports_color() -> bool:
    return sys.stdout.isatty() and os.environ.get("TERM") not in (None, "dumb")


if not _supports_color():
    for _attr in ("B", "G", "Y", "R", "C", "X"):
        setattr(C, _attr, "")

_STEP = 0


def step(title: str) -> None:
    global _STEP
    _STEP += 1
    print(f"\n{C.B}{C.C}==[{_STEP:02d}]== {title}{C.X}")


def ok(msg: str) -> None:
    print(f"  {C.G}✔{C.X} {msg}")


def info(msg: str) -> None:
    print(f"  {C.C}·{C.X} {msg}")


def warn(msg: str) -> None:
    print(f"  {C.Y}!{C.X} {msg}")


def fail(msg: str) -> None:
    print(f"  {C.R}✗{C.X} {msg}", file=sys.stderr)


def die(msg: str, code: int = 1):
    fail(msg)
    sys.exit(code)


# --------------------------------------------------------------------------- #
# Komut çalıştırma yardımcıları
# --------------------------------------------------------------------------- #
def run(
    argv,
    *,
    check: bool = True,
    capture: bool = False,
    env: dict | None = None,
    input_text: str | None = None,
    timeout: int | None = None,
    cwd: str | None = None,
    quiet: bool = False,
):
    """Bir komutu çalıştırır. check=True ise başarısız olunca istisna atar."""
    if not quiet:
        info("$ " + " ".join(str(a) for a in argv))
    full_env = os.environ.copy()
    if env:
        full_env.update(env)
    try:
        result = subprocess.run(
            [str(a) for a in argv],
            check=check,
            capture_output=capture,
            text=True,
            env=full_env,
            input=input_text,
            timeout=timeout,
            cwd=cwd,
        )
    except subprocess.CalledProcessError as exc:
        if capture and exc.stderr:
            fail(exc.stderr.strip()[:800])
        raise
    return result


def run_ok(argv, **kw) -> bool:
    """Çalıştırır, başarısızlığı istisna değil False olarak döndürür."""
    kw.setdefault("check", False)
    kw.setdefault("capture", True)
    res = run(argv, **kw)
    return res.returncode == 0


def as_user(app_user: str, argv, **kw):
    """Bir komutu uygulama kullanıcısı (root değil) olarak çalıştırır.

    sudo ortamı sıfırladığı (env_reset) için, verilen env değişkenlerini
    çocuğa `env KEY=VALUE` token'larıyla açıkça iletir.
    """
    child_env = kw.pop("env", None)
    prefix = ["sudo", "-u", app_user, "-H"]
    if child_env:
        prefix += ["env", *[f"{k}={v}" for k, v in child_env.items()]]
    return run([*prefix, *argv], **kw)


def have(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def apt_install(packages: list[str], env: dict) -> None:
    missing = [p for p in packages if not _dpkg_installed(p)]
    if not missing:
        ok("Paketler zaten kurulu: " + ", ".join(packages))
        return
    run(
        ["apt-get", "install", "-y", "-o", "Dpkg::Options::=--force-confdef",
         "-o", "Dpkg::Options::=--force-confold", *missing],
        env=env,
    )
    ok("Kuruldu: " + ", ".join(missing))


def _dpkg_installed(pkg: str) -> bool:
    res = run(["dpkg-query", "-W", "-f=${Status}", pkg], check=False, capture=True, quiet=True)
    return res.returncode == 0 and "install ok installed" in (res.stdout or "")


# --------------------------------------------------------------------------- #
# Ortam tespiti
# --------------------------------------------------------------------------- #
def detect_app_user(explicit: str | None, app_dir: Path) -> str:
    if explicit:
        return explicit
    sudo_user = os.environ.get("SUDO_USER")
    if sudo_user and sudo_user != "root":
        return sudo_user
    # install.py sahibine göre tahmin et
    try:
        owner = pwd.getpwuid(app_dir.stat().st_uid).pw_name
        if owner != "root":
            return owner
    except Exception:
        pass
    return "ubuntu"


def user_exists(name: str) -> bool:
    try:
        pwd.getpwnam(name)
        return True
    except KeyError:
        return False


# --------------------------------------------------------------------------- #
# Kurulum adımları
# --------------------------------------------------------------------------- #
def ensure_root() -> None:
    if os.geteuid() != 0:
        die("Bu betik root yetkisiyle çalışmalı. Şöyle çalıştırın:\n    sudo python3 install.py")


def step_system_packages(env: dict) -> None:
    step("Sistem paketleri güncelleniyor ve temel bağımlılıklar kuruluyor")
    run(["apt-get", "update"], env=env)
    apt_install(
        [
            "ca-certificates", "curl", "wget", "git", "gnupg", "lsb-release",
            "ufw", "unzip", "software-properties-common",
            "python3", "python3-venv", "python3-pip", "python3-dev",
            "build-essential", "libcap2-bin",
            "fonts-dejavu-core",  # Türkçe PDF raporu (xhtml2pdf @font-face)
        ],
        env,
    )


def step_mysql(env: dict, args) -> None:
    step("MySQL kuruluyor ve yapılandırılıyor")
    apt_install(["mysql-server"], env)
    run(["systemctl", "enable", "--now", "mysql"], check=False)

    db, usr, pwd_ = args.mysql_database, args.mysql_user, args.mysql_password
    sql = f"""
CREATE DATABASE IF NOT EXISTS `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '{usr}'@'localhost' IDENTIFIED BY '{pwd_}';
CREATE USER IF NOT EXISTS '{usr}'@'127.0.0.1' IDENTIFIED BY '{pwd_}';
CREATE USER IF NOT EXISTS '{usr}'@'%' IDENTIFIED BY '{pwd_}';
ALTER USER '{usr}'@'localhost' IDENTIFIED BY '{pwd_}';
ALTER USER '{usr}'@'127.0.0.1' IDENTIFIED BY '{pwd_}';
ALTER USER '{usr}'@'%' IDENTIFIED BY '{pwd_}';
GRANT ALL PRIVILEGES ON `{db}`.* TO '{usr}'@'localhost';
GRANT ALL PRIVILEGES ON `{db}`.* TO '{usr}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `{db}`.* TO '{usr}'@'%';
FLUSH PRIVILEGES;
""".strip()

    # Yeni kurulan MySQL'de root, auth_socket ile parolasız erişilir (biz root'uz).
    res = run(["mysql", "--protocol=socket"], input_text=sql, check=False, capture=True, quiet=True)
    if res.returncode != 0:
        # Root'a parola atanmışsa bunu bir kez env'den deneyelim.
        root_pw = os.environ.get("MYSQL_ROOT_PASSWORD", "")
        res2 = run(["mysql", "-u", "root", f"-p{root_pw}"], input_text=sql, check=False, capture=True, quiet=True)
        if res2.returncode != 0:
            fail(res.stderr.strip()[:400] if res.stderr else "")
            die("MySQL yapılandırılamadı. root parolası varsa MYSQL_ROOT_PASSWORD ile tekrar deneyin.")
    ok(f"Veritabanı '{db}' + kullanıcı '{usr}' hazır (host: 127.0.0.1:3306)")

    if args.mysql_remote:
        cnf = Path("/etc/mysql/mysql.conf.d/mysqld.cnf")
        if cnf.exists():
            text = cnf.read_text()
            if "bind-address" in text:
                import re
                text = re.sub(r"(?m)^bind-address\s*=.*$", "bind-address = 0.0.0.0", text)
            else:
                text += "\nbind-address = 0.0.0.0\n"
            cnf.write_text(text)
            run(["systemctl", "restart", "mysql"], check=False)
            warn("MySQL 0.0.0.0'a açıldı (uzak erişim). Güvenlik grubu/UFW'de 3306'yı yalnızca kendi IP'nize açın.")


def step_phpmyadmin(env: dict, args) -> None:
    if args.skip_phpmyadmin:
        info("phpMyAdmin atlandı (--skip-phpmyadmin)")
        return
    step(f"phpMyAdmin + Apache kuruluyor (port {args.phpmyadmin_port})")
    # Debconf'u önceden cevapla (interaktif soru çıkmasın).
    preseed = (
        "phpmyadmin phpmyadmin/dbconfig-install boolean false\n"
        "phpmyadmin phpmyadmin/reconfigure-webserver multiselect apache2\n"
    )
    run(["debconf-set-selections"], input_text=preseed, check=False, quiet=True)
    apt_install(["apache2", "libapache2-mod-php", "php", "php-mysql", "phpmyadmin"], env)
    run(["systemctl", "enable", "--now", "apache2"], check=False)

    # Apache'yi phpMyAdmin portuna al (uygulama 80'i kullanıyor).
    ports_conf = Path("/etc/apache2/ports.conf")
    if ports_conf.exists():
        import re
        text = ports_conf.read_text()
        if re.search(r"(?m)^Listen ", text):
            text = re.sub(r"(?m)^Listen .*$", f"Listen {args.phpmyadmin_port}", text)
        else:
            text += f"\nListen {args.phpmyadmin_port}\n"
        ports_conf.write_text(text)
    site_conf = Path("/etc/apache2/sites-available/000-default.conf")
    if site_conf.exists():
        import re
        text = site_conf.read_text()
        text = re.sub(r"<VirtualHost \*:\d+>", f"<VirtualHost *:{args.phpmyadmin_port}>", text)
        site_conf.write_text(text)

    run(["a2enconf", "phpmyadmin"], check=False, quiet=True)
    run(["systemctl", "restart", "apache2"], check=False)
    ok(f"phpMyAdmin: http://SUNUCU_IP:{args.phpmyadmin_port}/phpmyadmin/")


def step_docker(env: dict, app_user: str, args) -> None:
    if args.skip_docker:
        info("Docker atlandı (--skip-docker)")
        return
    step("Docker kuruluyor ve yapılandırılıyor")
    if have("docker"):
        ok("Docker zaten kurulu")
    else:
        # Ubuntu deposundaki docker.io basit ve yeterli.
        apt_install(["docker.io"], env)
    run(["systemctl", "enable", "--now", "docker"], check=False)
    # Uygulama kullanıcısını docker grubuna ekle (sudo'suz docker için).
    try:
        grp.getgrnam("docker")
        if app_user not in grp.getgrnam("docker").gr_mem:
            run(["usermod", "-aG", "docker", app_user], check=False)
            ok(f"'{app_user}' docker grubuna eklendi (yeni oturumda etkin olur)")
    except KeyError:
        warn("docker grubu bulunamadı")


def step_openwebui(args) -> None:
    """Open WebUI docker konteynerini bir kez oluşturur.

    Uygulamanın 'Ayarlar > Servisler' ekranındaki başlat/durdur, konteyneri
    yalnızca `docker start/stop open-webui` ile yönetir; konteyneri KURMAZ.
    Bu yüzden konteyner önceden var olmalı — yoksa 'No such container' hatası
    alınır. Burada idempotent şekilde (varsa dokunma) oluşturuyoruz.
    """
    if args.skip_docker or args.skip_openwebui:
        info("Open WebUI atlandı")
        return
    if not have("docker"):
        warn("docker bulunamadı, Open WebUI atlandı")
        return
    step(f"Open WebUI docker konteyneri hazırlanıyor (port {args.openwebui_port})")
    # Zaten varsa (çalışıyor veya durmuş) yeniden oluşturma.
    exists = run(
        ["docker", "inspect", "-f", "{{.Name}}", "open-webui"],
        check=False, capture=True, quiet=True,
    ).returncode == 0
    if exists:
        ok("open-webui konteyneri zaten mevcut — Ayarlar'dan başlat/durdur çalışır")
        return
    info("Open WebUI imajı indiriliyor ve konteyner oluşturuluyor (büyük olabilir)...")
    res = run(
        [
            "docker", "run", "-d",
            "--name", "open-webui",
            "--restart", "unless-stopped",
            "-p", f"{args.openwebui_port}:8080",
            # Host üzerindeki Ollama'ya (systemd, 11434) konteynerden erişim:
            "--add-host=host.docker.internal:host-gateway",
            "-e", "OLLAMA_BASE_URL=http://host.docker.internal:11434",
            "-v", "open-webui:/app/backend/data",
            "ghcr.io/open-webui/open-webui:main",
        ],
        check=False, capture=True,
    )
    if res.returncode == 0:
        ok(f"open-webui oluşturuldu ve başlatıldı: http://SUNUCU_IP:{args.openwebui_port}/")
    else:
        warn("Open WebUI oluşturulamadı (internet/imaj gerektirir): " + (res.stderr or "").strip()[:200])
        info("Sonra elle: docker run -d --name open-webui --restart unless-stopped "
             f"-p {args.openwebui_port}:8080 --add-host=host.docker.internal:host-gateway "
             "-e OLLAMA_BASE_URL=http://host.docker.internal:11434 "
             "-v open-webui:/app/backend/data ghcr.io/open-webui/open-webui:main")


def step_ollama(app_user: str, args) -> None:
    if args.skip_ollama:
        info("Ollama atlandı (--skip-ollama)")
        return
    step("Ollama (yerel LLM) kuruluyor")
    if have("ollama"):
        ok("Ollama zaten kurulu")
    else:
        # Resmi kurulum betiği systemd servisini de kurar.
        res = run(["bash", "-c", "curl -fsSL https://ollama.com/install.sh | sh"], check=False)
        if res.returncode != 0:
            warn("Ollama kurulumu başarısız oldu (internet gerektirir). Yapay zekâ özellikleri bulut sağlayıcıyla kullanılabilir.")
            return
    run(["systemctl", "enable", "--now", "ollama"], check=False)
    if args.ollama_model:
        info(f"Model indiriliyor (büyük olabilir, sabırlı olun): {args.ollama_model}")
        res = run(["ollama", "pull", args.ollama_model], check=False, timeout=3600)
        if res.returncode == 0:
            ok(f"Model hazır: {args.ollama_model}")
        else:
            warn(f"Model indirilemedi: {args.ollama_model}. Sonra 'ollama pull {args.ollama_model}' ile çekebilirsiniz.")
    else:
        info("Model indirme atlandı (--ollama-model ile belirtebilirsiniz).")


def step_venv(app_user: str, app_dir: Path) -> Path:
    step("Python sanal ortamı (venv) oluşturuluyor ve bağımlılıklar kuruluyor")
    venv_dir = app_dir / "venv"
    venv_py = venv_dir / "bin" / "python"
    if not venv_py.exists():
        as_user(app_user, ["python3", "-m", "venv", str(venv_dir)])
        ok(f"venv oluşturuldu: {venv_dir}")
    else:
        ok("venv zaten mevcut")
    as_user(app_user, [str(venv_py), "-m", "pip", "install", "--upgrade", "pip", "wheel", "setuptools"], check=False)
    req = app_dir / "requirements.txt"
    as_user(app_user, [str(venv_py), "-m", "pip", "install", "-r", str(req)])
    ok("Python bağımlılıkları kuruldu")
    return venv_py


def step_directories(app_user: str, app_dir: Path) -> None:
    step("Çalışma dizinleri ve izinler ayarlanıyor")
    try:
        uid = pwd.getpwnam(app_user).pw_uid
        gid = pwd.getpwnam(app_user).pw_gid
    except KeyError:
        die(f"Kullanıcı bulunamadı: {app_user}")
    for sub in ("logs", "scans", "data", "data/ai_operations", "data/step_item_scripts"):
        d = app_dir / sub
        d.mkdir(parents=True, exist_ok=True)
        os.chown(d, uid, gid)
    # data/ ağacının tümünü uygulama kullanıcısına devret (script yazımı için).
    run(["chown", "-R", f"{app_user}:{app_user}", str(app_dir / "data")], check=False, quiet=True)
    ok("logs/ , scans/ , data/ hazır ve uygulama kullanıcısına ait")


def step_sudoers(app_user: str) -> None:
    step("Parolasız sudo yetkileri tanımlanıyor (tool + servis yönetimi için)")
    setcap_paths = [p for p in ("/usr/sbin/setcap", "/sbin/setcap", "/usr/bin/setcap") if Path(p).exists()]
    apt_get = shutil.which("apt-get") or "/usr/bin/apt-get"
    apt_bin = shutil.which("apt") or "/usr/bin/apt"
    systemctl = shutil.which("systemctl") or "/usr/bin/systemctl"
    bash_bin = shutil.which("bash") or "/usr/bin/bash"
    lines = [
        "# SSVP — uygulamanın Ayarlar ekranından araç/servis yönetimi yapabilmesi için",
        "# parolasız sudo. Uygulama kodu yalnızca aşağıdaki komutları 'sudo -n' ile çağırır.",
        f"{app_user} ALL=(root) NOPASSWD: {apt_get} *",
        f"{app_user} ALL=(root) NOPASSWD: {apt_bin} *",
        f"{app_user} ALL=(root) NOPASSWD: {systemctl} *",
        f"{app_user} ALL=(root) NOPASSWD: {bash_bin} /tmp/ssvp_msfinstall.sh",
    ]
    for p in setcap_paths:
        lines.append(f"{app_user} ALL=(root) NOPASSWD: {p} *")
    content = "\n".join(lines) + "\n"

    target = Path("/etc/sudoers.d/ssvp")
    tmp = Path("/etc/sudoers.d/.ssvp.tmp")
    tmp.write_text(content)
    os.chmod(tmp, 0o440)
    # visudo ile doğrula, sonra yerine koy (bozuk sudoers = kilitlenme riski).
    if run_ok(["visudo", "-cf", str(tmp)]):
        os.replace(tmp, target)
        os.chmod(target, 0o440)
        ok(f"/etc/sudoers.d/ssvp yazıldı ({app_user}: apt-get, systemctl, setcap, msfinstall)")
    else:
        tmp.unlink(missing_ok=True)
        warn("sudoers doğrulaması başarısız — parolasız sudo atlandı. Tool kurulumu elle yapılabilir.")


def step_scan_caps() -> None:
    step("Tarama araçlarına raw-socket yetkisi veriliyor (nmap -O yetki sorunu çözümü)")
    grants = {
        "nmap": "cap_net_raw,cap_net_admin,cap_net_bind_service+eip",
        "masscan": "cap_net_raw,cap_net_admin+eip",
        "netdiscover": "cap_net_raw,cap_net_admin+eip",
    }
    any_found = False
    for name, cap in grants.items():
        path = shutil.which(name)
        if not path:
            info(f"{name}: kurulu değil, atlandı (Ayarlar'dan kurunca tekrar çalıştırılır)")
            continue
        any_found = True
        real = str(Path(path).resolve())
        if run_ok(["setcap", cap, real]):
            res = run(["getcap", real], check=False, capture=True, quiet=True)
            ok((res.stdout or "").strip() or f"{name}: yetki verildi")
        else:
            warn(f"{name}: setcap başarısız ({real})")
    if not any_found:
        info("Tarama araçları henüz kurulu değil; kurulduktan sonra bu izinler Ayarlar üzerinden yenilenmeli.")


def step_firewall(args) -> None:
    if args.skip_ufw:
        info("UFW atlandı (--skip-ufw)")
        return
    step("Güvenlik duvarı (UFW) kuralları ekleniyor")
    if not have("ufw"):
        warn("ufw bulunamadı, atlandı")
        return
    # SSH'ı KESİNLİKLE aç ki uzaktan erişim kopmasın.
    ports = ["22/tcp", f"{args.port}/tcp", f"{args.phpmyadmin_port}/tcp"]
    if not (args.skip_docker or args.skip_openwebui):
        ports.append(f"{args.openwebui_port}/tcp")
    for port in ports:
        run(["ufw", "allow", port], check=False, quiet=True)
    if args.mysql_remote:
        run(["ufw", "allow", "3306/tcp"], check=False, quiet=True)
    ok(f"Portlara izin verildi: {', '.join(ports)}")
    info("UFW otomatik etkinleştirilmedi. İsterseniz: sudo ufw enable  (SSH zaten açık)")


def step_db_config_file(app_user: str, app_dir: Path, args) -> Path:
    """DB kimlik bilgilerini dosyaya yazar (uygulama artık buradan okur).

    Bu sayede parola çalışma anında Ayarlar > Veritabanı sekmesinden döndürülüp
    kalıcı olabilir. Dosya 0600 ve uygulama kullanıcısına aittir.
    """
    step("Veritabanı kimlik dosyası yazılıyor (data/db_config.json, 0600)")
    cfg_path = app_dir / "data" / "db_config.json"
    payload = {
        "host": args.mysql_host,
        "port": int(args.mysql_port),
        "user": args.mysql_user,
        "password": args.mysql_password,
        "database": args.mysql_database,
    }
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    os.chmod(cfg_path, 0o600)
    try:
        uid = pwd.getpwnam(app_user).pw_uid
        gid = pwd.getpwnam(app_user).pw_gid
        os.chown(cfg_path, uid, gid)
    except KeyError:
        pass
    ok(f"{cfg_path} yazıldı (parola buradan yönetilir, Ayarlar'dan değiştirilebilir)")
    return cfg_path


def step_seed_database(app_user: str, app_dir: Path, venv_py: Path, args) -> None:
    step("Veritabanı varsayılan verilerle dolduruluyor (YZO + 3YM katalogları)")
    db_env = {
        "MYSQL_HOST": args.mysql_host,
        "MYSQL_PORT": str(args.mysql_port),
        "MYSQL_USER": args.mysql_user,
        "MYSQL_PASSWORD": args.mysql_password,
        "MYSQL_DATABASE": args.mysql_database,
        "SSVP_DB_CONFIG": str(app_dir / "data" / "db_config.json"),
        "SSVP_ADMIN_USER": args.admin_username,
        "SSVP_ADMIN_PASSWORD": args.admin_password,
        "SSVP_DISABLE_DEFAULT_ADMIN": "0" if args.keep_default_admin else "1",
    }

    if args.reset_db:
        warn("--reset-db: mevcut veritabanı SIFIRLANIYOR (anahtarlar 0'dan başlar)")
        drop = f"DROP DATABASE IF EXISTS `{args.mysql_database}`; CREATE DATABASE `{args.mysql_database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        run(["mysql", "--protocol=socket"], input_text=drop, check=False, quiet=True)

    # main.on_startup() tüm seed mantığını içerir: şema + YZO/3YM katalogları +
    # scriptlerin bu kurulum konumuna yazılması. Ardından proje-özel yetkili yeni
    # yönetici oluşturulur ve varsayılan admin/admin devre dışı bırakılır.
    seed_snippet = (
        "import os\n"
        "import main\n"
        "main.on_startup()\n"
        "from backend.services.manual_catalog_store import count_manual_items\n"
        "from backend.services.auth_store import provision_admin_user, set_active_by_username\n"
        "res = provision_admin_user(os.environ['SSVP_ADMIN_USER'], os.environ['SSVP_ADMIN_PASSWORD'])\n"
        "print('ADMIN_%s user=%s' % ('CREATED' if res.get('created') else 'EXISTS', res.get('username')))\n"
        "if os.environ.get('SSVP_DISABLE_DEFAULT_ADMIN') == '1':\n"
        "    changed = set_active_by_username('admin', False)\n"
        "    print('DEFAULT_ADMIN_%s' % ('DISABLED' if changed else 'ABSENT'))\n"
        "print('SEED_OK manual_items=%d' % count_manual_items())\n"
    )
    res = as_user(
        app_user,
        [str(venv_py), "-c", seed_snippet],
        env=db_env,
        check=False,
        capture=True,
        cwd=str(app_dir),
        quiet=True,
    )
    info("Seed betiği uygulama kullanıcısı olarak çalıştırıldı (main.on_startup)")
    out = (res.stdout or "") + (res.stderr or "")
    if res.returncode != 0 or "SEED_OK" not in out:
        print(out.strip()[:1500])
        die("Veritabanı seed işlemi başarısız oldu. Yukarıdaki hatayı inceleyin.")
    for line in out.splitlines():
        if "SEED_OK" in line:
            ok("Seed tamamlandı — " + line.replace("SEED_OK ", ""))
        elif line.startswith("ADMIN_CREATED"):
            ok(f"Uygulama yöneticisi oluşturuldu: {args.admin_username} (tam yetki, pentest + tool kurulumu)")
        elif line.startswith("ADMIN_EXISTS"):
            warn(f"'{args.admin_username}' zaten mevcut — parolası değiştirilmedi.")
            args._admin_existed = True
        elif line.startswith("DEFAULT_ADMIN_DISABLED"):
            ok("Varsayılan admin/admin hesabı devre dışı bırakıldı.")
        elif line.startswith("DEFAULT_ADMIN_ABSENT"):
            info("Varsayılan admin hesabı bulunamadı (zaten yok).")
    info("YZO ve 3YM katalogları, scriptler ve parametreler kurulum konumuna yazıldı.")


def step_systemd_service(app_user: str, app_dir: Path, venv_py: Path, args) -> None:
    if args.no_service:
        info("systemd servisi atlandı (--no-service). run.sh ile elle çalıştırabilirsiniz.")
        return
    step(f"systemd servisi kuruluyor (ssvp.service, port {args.port})")
    exec_start = f"{venv_py} -m uvicorn main:app --host 0.0.0.0 --port {args.port}"
    unit = f"""[Unit]
Description=Smart Security Validation Platform (SSVP)
After=network-online.target mysql.service
Wants=network-online.target

[Service]
Type=simple
User={app_user}
Group={app_user}
WorkingDirectory={app_dir}
# DB parolası kasıtlı olarak burada tutulmaz; kimlik dosyasından okunur, böylece
# Ayarlar > Veritabanı sekmesinden döndürülen parola servisi düzenlemeden geçerli
# olur (dosya > env önceliği).
Environment=SSVP_DB_CONFIG={app_dir}/data/db_config.json
Environment=MYSQL_HOST={args.mysql_host}
Environment=MYSQL_PORT={args.mysql_port}
Environment=MYSQL_USER={args.mysql_user}
Environment=MYSQL_DATABASE={args.mysql_database}
ExecStart={exec_start}
Restart=on-failure
RestartSec=5
# 80 gibi ayrıcalıklı porta root olmadan bağlanabilmek için:
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
"""
    unit_path = Path("/etc/systemd/system/ssvp.service")
    unit_path.write_text(unit)
    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", "ssvp.service"], check=False)
    run(["systemctl", "restart", "ssvp.service"], check=False)
    ok("ssvp.service etkinleştirildi ve başlatıldı (açılışta otomatik başlar)")

    # Kısa bir sağlık kontrolü
    time.sleep(4)
    state = run(["systemctl", "is-active", "ssvp.service"], check=False, capture=True, quiet=True)
    st = (state.stdout or "").strip()
    if st == "active":
        ok("Servis çalışıyor (active)")
    else:
        warn(f"Servis durumu: {st}. Log: journalctl -u ssvp.service -n 50 --no-pager")


def print_summary(app_user: str, app_dir: Path, args) -> None:
    ip = "SUNUCU_IP"
    res = run(["bash", "-c", "hostname -I 2>/dev/null | awk '{print $1}'"], check=False, capture=True, quiet=True)
    if res.stdout and res.stdout.strip():
        ip = res.stdout.strip()

    if getattr(args, "_admin_existed", False):
        login_line = (
            f"{C.B}Giriş:{C.X}        {args.admin_username} / (mevcut parola korundu — bu hesap zaten vardı)"
        )
    elif getattr(args, "_admin_generated", False):
        login_line = (
            f"{C.B}Giriş:{C.X}        {C.Y}{args.admin_username}{C.X} / {C.Y}{args.admin_password}{C.X}\n"
            f"  {C.R}>>> Bu parolayı şimdi kaydedin; tekrar gösterilmeyecek. <<<{C.X}"
        )
    else:
        login_line = f"{C.B}Giriş:{C.X}        {args.admin_username} / (kurulumda verdiğiniz parola)"

    default_admin_note = (
        "Varsayılan admin/admin devre dışı." if not args.keep_default_admin
        else "Varsayılan admin/admin AÇIK (--keep-default-admin)."
    )
    print(f"""
{C.B}{C.G}══════════════════════════════════════════════════════════════════{C.X}
{C.B}{C.G}  SSVP KURULUMU TAMAMLANDI{C.X}
{C.B}{C.G}══════════════════════════════════════════════════════════════════{C.X}

  {C.B}Uygulama:{C.X}     http://{ip}:{args.port}/
  {login_line}
  {C.C}·{C.X} {default_admin_note}
  {C.B}phpMyAdmin:{C.X}   http://{ip}:{args.phpmyadmin_port}/phpmyadmin/
  {C.B}MySQL:{C.X}        {args.mysql_host}:{args.mysql_port}  db={args.mysql_database} user={args.mysql_user}
                Parolayı Ayarlar > Veritabanı ve Yedekleme'den değiştirebilirsiniz.
  {C.B}Kullanıcı:{C.X}    {app_user}   |   Dizin: {app_dir}

  {C.B}Servis komutları:{C.X}
    sudo systemctl status ssvp
    sudo systemctl restart ssvp
    journalctl -u ssvp -f

  {C.B}Yapay zekâ:{C.X}   {'Ollama kuruldu' if not args.skip_ollama else 'Ollama atlandı'} — model: {args.ollama_model or '(indirilmedi)'}
                Bulut LLM'yi Ayarlar > Yapay Zekâ'dan da tanımlayabilirsiniz.

  {C.B}Pentest araçları:{C.X} Ayarlar > Pentest Araçları ekranından kurulur.
                Kurduktan sonra tarama izinleri için:
                sudo python3 install.py --caps-only

{C.B}{C.G}══════════════════════════════════════════════════════════════════{C.X}
""")


# --------------------------------------------------------------------------- #
# Argümanlar & main
# --------------------------------------------------------------------------- #
def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="SSVP sıfırdan sunucu kurulum betiği.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--app-user", default=None, help="Uygulamayı çalıştıracak kullanıcı (varsayılan: SUDO_USER)")
    p.add_argument("--port", type=int, default=80, help="Uygulama portu")
    p.add_argument("--phpmyadmin-port", type=int, default=8081, help="phpMyAdmin/Apache portu")
    p.add_argument("--mysql-host", default="127.0.0.1")
    p.add_argument("--mysql-port", type=int, default=3306)
    p.add_argument("--mysql-user", dest="mysql_user", default="ssvp")
    p.add_argument("--mysql-password", dest="mysql_password", default="ssvp123")
    p.add_argument("--mysql-database", dest="mysql_database", default="ssvp")
    p.add_argument("--mysql-remote", action="store_true", help="MySQL'i 0.0.0.0'a aç (uzak erişim)")
    p.add_argument("--admin-username", default="ssvpadmin", help="Oluşturulacak uygulama yöneticisi kullanıcı adı")
    p.add_argument("--admin-password", default="", help="Yönetici parolası ('' = güçlü parola otomatik üretilir)")
    p.add_argument("--keep-default-admin", action="store_true", help="Varsayılan admin/admin hesabını devre dışı bırakma")
    p.add_argument("--ollama-model", default="freehuntx/qwen3-coder:8b", help="Kurulumda indirilecek model ('' = indirme)")
    p.add_argument("--reset-db", action="store_true", help="Veritabanını sıfırla (anahtarlar 0'dan başlar)")
    p.add_argument("--openwebui-port", type=int, default=3000, help="Open WebUI portu")
    p.add_argument("--skip-phpmyadmin", action="store_true")
    p.add_argument("--skip-docker", action="store_true")
    p.add_argument("--skip-openwebui", action="store_true", help="Open WebUI konteynerini oluşturma")
    p.add_argument("--skip-ollama", action="store_true")
    p.add_argument("--skip-ufw", action="store_true")
    p.add_argument("--no-service", action="store_true", help="systemd servisi kurma (run.sh ile çalıştır)")
    p.add_argument("--caps-only", action="store_true", help="Yalnızca tarama araçlarına setcap uygula ve çık")
    return p.parse_args(argv)


def main() -> None:
    args = parse_args()
    ensure_root()

    app_dir = Path(__file__).resolve().parent
    app_user = detect_app_user(args.app_user, app_dir)

    # Yalnızca setcap yenileme kısayolu (Ayarlar'dan tool kurulunca kullanışlı)
    if args.caps_only:
        step_scan_caps()
        return

    if not user_exists(app_user):
        die(f"Uygulama kullanıcısı bulunamadı: '{app_user}'. --app-user ile belirtin.")
    if not (app_dir / "main.py").exists() or not (app_dir / "requirements.txt").exists():
        die(f"Proje kökü doğrulanamadı ({app_dir}). install.py'yi projenin kök dizininde çalıştırın.")

    # Yönetici parolası: verilmediyse güçlü bir tane üret (özet ekranında gösterilir).
    args._admin_generated = not bool(args.admin_password)
    args._admin_existed = False
    if not args.admin_password:
        args.admin_password = generate_password()

    print(f"{C.B}SSVP kurulumu başlıyor{C.X}")
    info(f"Proje dizini : {app_dir}")
    info(f"Uygulama kul.: {app_user}")
    info(f"Uygulama portu: {args.port}  |  phpMyAdmin: {args.phpmyadmin_port}")
    info(f"Uygulama yöneticisi: {args.admin_username}")

    apt_env = {"DEBIAN_FRONTEND": "noninteractive"}

    step_system_packages(apt_env)
    step_mysql(apt_env, args)
    step_phpmyadmin(apt_env, args)
    step_docker(apt_env, app_user, args)
    step_openwebui(args)
    step_ollama(app_user, args)
    venv_py = step_venv(app_user, app_dir)
    step_directories(app_user, app_dir)
    step_db_config_file(app_user, app_dir, args)
    step_sudoers(app_user)
    step_scan_caps()
    step_firewall(args)
    step_seed_database(app_user, app_dir, venv_py, args)
    step_systemd_service(app_user, app_dir, venv_py, args)

    print_summary(app_user, app_dir, args)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        die("\nKurulum iptal edildi.", 130)
    except subprocess.CalledProcessError as exc:
        die(f"Komut başarısız (çıkış {exc.returncode}): {' '.join(str(a) for a in exc.cmd)}")
