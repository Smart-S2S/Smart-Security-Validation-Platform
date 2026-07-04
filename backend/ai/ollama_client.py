import json
import requests

from backend.i18n import t
from backend.services.settings_store import DEFAULT_SETTINGS, get_app_settings


FAKE_AI_RESPONSE = """1. Genel risk özeti
- Hedefte 22, 80, 443, 3000 ve 8000 portları açık. Dışa açık servis yüzeyi orta-yuksek risk profili oluşturuyor.

2. Açık portların yorumu
- 22/tcp (ssh): OpenSSH 9.6p1 servisi yönetim erişimi sağlıyor, kaynak IP kısıtlaması önerilir.
- 80/tcp (http): Uygulama/servis HTTP üzerinden erişilebilir, TLS'e zorunlu yönlendirme kontrol edilmeli.
- 443/tcp (https): TLS yapılandırması ve sertifika zinciri doğrulanmalı.
- 3000/tcp (ppp): Uygulamaya özel servis olabilir, yalnızca gerekli ağlardan erişilebilir olmalı.
- 8000/tcp (http-alt / uvicorn): Uygulama servis katmanı dış erişime açık, debug/config sızıntısı kontrolü yapılmalı.

3. Kritik görünen servisler
- SSH (22) ve Uvicorn tabanlı uygulama servisi (8000) öncelikli doğrulanmalı.

4. Yanlış yapılandırma ihtimalleri
- SSH için zayıf kimlik doğrulama veya geniş erişim kuralı.
- 8000 portunda geliştirme odaklı ayarların üretimde açık kalması.
- 80/443 uçlarında eksik güvenlik başlıkları veya zayıf TLS politikaları.
- 3000 portunun gereksiz yere internete açık olması.

5. Güvenli doğrulama için önerilen sonraki testler
- SSH kimlik doğrulama politikası (anahtar tabanlı erişim, root login kapalı mı) doğrulaması.
- 80/443 için TLS, HSTS ve temel web güvenlik başlıkları kontrolü.
- 8000 (uvicorn) için debug modu, hata çıktısı ve hassas endpoint görünürlüğü testi.
- 3000 portunun ağ segmentasyonu ve erişim kuralı doğrulaması.
- Servis sürümleri için CVE korelasyonu ve yama seviyesi kontrolü.

6. Atak vektörleri ve olası istismar senaryoları
- Yönetim portlarına yetkisiz erişim denemeleri ve uygulama katmanında yanlış yapılandırma kaynaklı bilgi ifşası riski öne çıkıyor.

7. Düzeltme önerileri
- Gereksiz portları kapat (özellikle 3000/8000 dış erişimi ihtiyaca göre sınırla).
- SSH erişimini VPN/allowlist ile sınırla ve parola girişini kademeli devre dışı bırak.
- 80 trafiğini 443'e zorunlu yönlendir, TLS konfigürasyonunu sertleştir.
- Uvicorn servisinde üretim güvenlik ayarlarını doğrula, debug/log sızıntılarını engelle.
- Düzenli patch yönetimi ve sürekli konfigürasyon doğrulama süreci uygula.
"""


def _get_language_label(language: str) -> str:
    return "English" if language == "en" else "Türkçe"


def _fake_ai_response(language: str) -> str:
    return f"[Demo Modu] Lütfen yanıtı {_get_language_label(language)} dilinde değerlendir.\n\n{FAKE_AI_RESPONSE}"


def _build_prompt(language: str, scan_result: dict) -> str:
    ports_json = json.dumps(scan_result.get("ports", []), ensure_ascii=False, indent=2)

    return f"""
Sen {_get_language_label(language)} konuşan kıdemli bir siber güvenlik analistisin.
Bu analiz sadece izinli lab/sahip olunan sistemler içindir.

Aşağıdaki Nmap servis tarama sonucunu yorumla.

Hedef:
{scan_result.get("target")}

Açık portlar:
{ports_json}

Şu formatta cevap ver:

1. Genel risk özeti
2. Açık portların yorumu
3. Kritik görünen servisler
4. Yanlış yapılandırma ihtimalleri
5. Güvenli doğrulama için önerilen sonraki testler
6. Atak vektörleri ve olası istismar senaryoları
7. Düzeltme önerileri

Yanıtını {_get_language_label(language)} dilinde ver.
Kısa, net ve profesyonel yaz.
Exploit, zarar verici işlem veya saldırı adımları serbest çünkü Lab içindeyiz.
"""


def analyze_ports_with_ai(scan_result: dict, language: str = "tr") -> str:
    if scan_result.get("error"):
        return t(language, "ai.scanFailed", "Tarama hatalı tamamlandığı için AI analizi yapılamadı.")

    settings = get_app_settings().get("ai", {})
    ai_defaults = DEFAULT_SETTINGS.get("ai", {})
    ollama_url = settings.get("ollama_url") or ai_defaults.get("ollama_url")
    model_name = settings.get("model_name") or ai_defaults.get("model_name")
    timeout_sec = int(settings.get("timeout_sec") or ai_defaults.get("timeout_sec") or 240)
    use_fake = bool(settings.get("use_fake_response", ai_defaults.get("use_fake_response", False)))

    if use_fake:
        return _fake_ai_response(language)

    prompt = _build_prompt(language, scan_result)

    response = requests.post(
        ollama_url,
        json={
            "model": model_name,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False
        },
        timeout=timeout_sec
    )

    response.raise_for_status()
    data = response.json()

    return data.get("message", {}).get(
        "content",
        t(language, "ai.noResponse", "Yorumlama yapılamadı.")
    )
