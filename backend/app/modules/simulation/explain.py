"""Optional LLM layer: rewrites the template explanation in plain Spanish (or English) without adding facts.

Grounding: the model only receives the template text and the facts computed by the simulator; every number in its
answer must already be in them, otherwise the template is returned. No key, a network error or a failed check all
return the template, so the page never depends on the LLM.
"""
import json
import re
import urllib.error
import urllib.request

from app.core.config import settings

_CACHE: dict[str, dict] = {}
_NUM = re.compile(r"\d[\d.,]*")
_MODEL: dict[str, str] = {}
_API = "https://generativelanguage.googleapis.com/v1beta"


def _headers() -> dict:
    return {"Content-Type": "application/json", "x-goog-api-key": settings.gemini_api_key}


CANDIDATES = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"]


ROUTES = ("ai_studio", "vertex_express")   # the key format ("AQ." / "AIza") does not tell which service issued it


def _call(route: str, model: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    if route == "ai_studio":
        req = urllib.request.Request(f"{_API}/models/{model}:generateContent", data=data, method="POST", headers=_headers())
    else:
        url = f"https://aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent?key={settings.gemini_api_key}"
        req = urllib.request.Request(url, data=data, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.load(res)


def _generate(body: dict) -> tuple[dict, str]:
    """Try each service and known model names; remember the first combination that works."""
    if "route" in _MODEL:
        return _call(_MODEL["route"], _MODEL["name"], body), _MODEL["name"]
    last = None
    for route in ROUTES:
        for name in dict.fromkeys([settings.gemini_model, *CANDIDATES]):
            try:
                data = _call(route, name, body)
                _MODEL.update(route=route, name=name)
                return data, name
            except urllib.error.HTTPError as err:
                last = err
                if err.code in (401, 400):   # bad key for this service: try the next service
                    break
                if err.code == 403:          # disabled API or billing: try the next service
                    break
                if err.code not in (404, 503):   # 404 retired name, 503 overloaded: try the next name
                    raise
    raise last


PROMPT = """Eres un asistente para agricultores de la pampa de Majes (Arequipa, Perú).
Reescribe la explicación en español sencillo, en 3 o 4 frases cortas, como le hablarías a un agricultor.
Reglas estrictas:
- Usa SOLO la información de la explicación y de los datos. No agregues cifras, cultivos, causas ni consejos nuevos.
- Copia las cifras tal como aparecen.
- Mantén lo que no sabemos (datos faltantes).
- No uses listas ni títulos, solo texto.

Explicación: {template}
Datos del modelo (JSON): {facts}"""

PROMPT_EN = """You are an assistant for farmers of the Majes pampa (Arequipa, Peru).
Rewrite the explanation in plain English, in 3 or 4 short sentences, as you would talk to a farmer.
Strict rules:
- Use ONLY the information in the explanation and in the data. Do not add new figures, crops, causes or advice.
- Copy the figures exactly as they appear.
- Keep what we do not know (missing data).
- Do not use lists or headings, only text.
- Write crop names as they appear in the explanation (the data uses Spanish names).

Explanation: {template}
Model data (JSON): {facts}"""

REASONS = {
    "es": {"no_key": "sin clave de API configurada", "unfinished": "la IA no terminó la respuesta ({detail})",
           "no_answer": "el servicio de IA no respondió ({detail})",
           "extra": "la IA agregó cifras que no están en los datos: {extra}",
           "ok": "reescrito por {model} a partir de los datos del modelo"},
    "en": {"no_key": "no API key configured", "unfinished": "the AI did not finish its answer ({detail})",
           "no_answer": "the AI service did not answer ({detail})",
           "extra": "the AI added figures that are not in the data: {extra}",
           "ok": "rewritten by {model} from the model's data"},
}


def _numbers(text: str) -> set[str]:
    text = re.sub(r"(\d)[\s\u00a0\u202f](?=\d{3}\b)", r"\1", text)   # "9 371" -> "9371"
    return {re.sub(r"[.,]", "", n).lstrip("0") or "0" for n in _NUM.findall(text)}


def rewrite(template: str, facts: dict, lang: str = "es") -> dict:
    why = REASONS.get(lang, REASONS["es"])
    if not settings.gemini_api_key:
        return {"text": template, "source": "plantilla", "reason": why["no_key"]}
    key = lang + "|" + template + json.dumps(facts, sort_keys=True, ensure_ascii=False)
    if key in _CACHE:
        return _CACHE[key]
    prompt = PROMPT_EN if lang == "en" else PROMPT
    body = {"contents": [{"parts": [{"text": prompt.format(template=template, facts=json.dumps(facts, ensure_ascii=False))}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 4096}}
    try:
        data, model = _generate(body)
        cand = data["candidates"][0]
        text = "".join(p.get("text", "") for p in cand["content"]["parts"] if not p.get("thought")).strip()
        if cand.get("finishReason") not in (None, "STOP"):
            return {"text": template, "source": "plantilla", "reason": why["unfinished"].format(detail=cand.get('finishReason'))}
    except (urllib.error.URLError, KeyError, IndexError, TimeoutError, ValueError) as err:
        _MODEL.clear()
        detail = getattr(err, "code", None) or type(err).__name__
        if isinstance(err, urllib.error.HTTPError):
            try:
                detail = f"{err.code}: {json.load(err).get('error', {}).get('message', '')[:160]}"
            except ValueError:
                pass
        return {"text": template, "source": "plantilla", "reason": why["no_answer"].format(detail=detail)}
    allowed = _numbers(template) | _numbers(json.dumps(facts, ensure_ascii=False))
    extra = _numbers(text) - allowed
    if not text or extra:
        return {"text": template, "source": "plantilla", "reason": why["extra"].format(extra=sorted(extra)[:3])}
    out = {"text": text, "source": "gemini", "reason": why["ok"].format(model=model)}
    _CACHE[key] = out
    return out
