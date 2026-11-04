"""Actualiza data/cricheroes.json y data/facebook.json.

Lo corre GitHub Actions (.github/workflows/actualizar-datos.yml). Variables de entorno:
  CRICHEROES_API_KEY  clave del sitio "your-web" de Cricket Argentina en CricHeroes (obligatoria)
  FB_PAGE_ID          id de la página de Facebook (opcional)
  FB_PAGE_TOKEN       token de página de larga duración (opcional)
"""
import hashlib
import html
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
IMG = os.path.join(DATA, "img")
API = "https://cricheroes.in/api/your-web/"
SITE = "https://www.cricketargentina.com"


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def api(path):
    headers = {
        "api-key": os.environ["CRICHEROES_API_KEY"],
        "app-name": "argentina",
        "app-id": "166",
        "device-type": "your-web",
        "app-version": "0.1.0",
        "app-version-code": "100",
        "udid": uuid.uuid4().hex,
        "Origin": SITE,
        "Referer": SITE + "/",
        "Accept": "application/json",
    }
    body = json.loads(fetch(API + path, headers))
    if not body.get("status"):
        raise RuntimeError(f"{path}: {body.get('error')}")
    return body.get("data") or []


def local_image(url, width, prefix):
    """Descarga, achica y guarda la imagen como WebP. Devuelve la ruta relativa al sitio."""
    if not url or url.endswith("/default/user_profile.png"):
        return ""
    name = f"{prefix}-{hashlib.sha1(url.encode()).hexdigest()[:12]}.webp"
    path = os.path.join(IMG, name)
    if not os.path.exists(path):
        try:
            im = Image.open(io.BytesIO(fetch(url)))
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            if im.width > width:
                im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            im.save(path, "WEBP", quality=75, method=6)
        except Exception as e:  # noqa: BLE001
            print(f"  aviso: no se pudo bajar {url}: {e}")
            return url
    return f"data/img/{name}"


def plain(text, limit=180):
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"


def slug(title):
    return urllib.parse.quote(re.sub(r"[^\w]+", "-", title.strip()).strip("-"))


def match(m):
    return {
        "id": m["match_id"],
        "start": m["match_start_time"],
        "status": m["status"],
        "competition": m["tournament_name"],
        "round": m.get("tournament_round_name") or "",
        "ground": m.get("ground_name") or "",
        "overs": m.get("overs"),
        "a": {"name": m["team_a"], "logo": local_image(m.get("team_a_logo"), 160, "team"), "score": m.get("team_a_summary") or ""},
        "b": {"name": m["team_b"], "logo": local_image(m.get("team_b_logo"), 160, "team"), "score": m.get("team_b_summary") or ""},
        "winner": m.get("winning_team") or "",
        "winBy": m.get("win_by") or "",
        "result": m.get("match_result") or "",
        "url": f"{SITE}/match/{m['match_id']}",
    }


def leader(rows, key, label):
    if not rows:
        return None
    p = rows[0]
    return {
        "label": label,
        "value": str(p.get(key)),
        "name": p["name"],
        "team": p.get("team_name") or "",
        "photo": local_image(p.get("profile_photo"), 600, "player"),
    }


def cricheroes():
    upcoming = [m for m in api("match/get-matches/1,2,3/-1/-1?isFromHomeScreen=1&teamId=-1") if m["status"] != "past"]
    results = api("match/get-matches/3/-1/-1?isFromHomeScreen=1&teamId=-1")
    news = api("news/get-news-data/-1")[:3]
    albums = api("photo-album/list/166")
    albums.sort(key=lambda a: a["album_date"], reverse=True)
    tournaments = api("tournament/get-tournament-lists/-1")
    main = next((t for t in tournaments if t["status"] == "live"), tournaments[0] if tournaments else None)
    tid = os.environ.get("LEADERS_TOURNAMENT_ID") or (main and main["tournament_id"])
    tname = next((t["tournament_name"] for t in tournaments if str(t["tournament_id"]) == str(tid)), "")
    q = f"associationid=-1&pagesize=1&tournamentid={tid}"
    leaders = [
        leader(api(f"tournament/get-batting-leaderboard-homepage?{q}"), "total_runs", "Carreras"),
        leader(api(f"tournament/get-batting-leaderboard-homepage?{q}&filter=HSR"), "strike_rate", "Strike rate"),
        leader(api(f"tournament/get-bowling-leaderboard-homepage?{q}"), "total_wickets", "Wickets"),
        leader(api(f"tournament/get-bowling-leaderboard-homepage?{q}&filter=MBECO"), "economy", "Economía"),
    ]
    return {
        "upcoming": [match(m) for m in upcoming[:12]],
        "results": [match(m) for m in results[:6]],
        "news": [
            {
                "title": n["news_title"].strip(),
                "category": n.get("category_name") or "",
                "date": n["news_date"],
                "excerpt": plain(n.get("description")),
                "image": local_image(n.get("media"), 1600, "news"),
                "url": f"{SITE}/news/{n['association_news_id']}/{slug(n['news_title'])}",
            }
            for n in news
        ],
        "albums": [
            {
                "title": a["title"],
                "date": a["album_date"],
                "count": a.get("medias_count") or 0,
                "image": local_image(a.get("media"), 1200, "album"),
                "url": f"{SITE}/media/albums",
            }
            for a in albums[:4]
        ],
        "leaders": {"tournament": tname, "items": [x for x in leaders if x]},
    }


def facebook():
    page, token = os.environ.get("FB_PAGE_ID"), os.environ.get("FB_PAGE_TOKEN")
    if not (page and token):
        return None
    q = urllib.parse.urlencode({"fields": "message,created_time,permalink_url,full_picture", "limit": 6, "access_token": token})
    posts = json.loads(fetch(f"https://graph.facebook.com/v21.0/{page}/posts?{q}")).get("data", [])
    return {
        "posts": [
            {
                "text": plain(p.get("message"), 220),
                "date": p["created_time"],
                "url": p.get("permalink_url") or "",
                "image": local_image(p.get("full_picture"), 900, "fb"),
            }
            for p in posts
            if p.get("message") or p.get("full_picture")
        ]
    }


def save(name, payload):
    path = os.path.join(DATA, name)
    old = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
        old.pop("updated", None)
    if old == payload:
        print(f"{name}: sin cambios")
        return
    payload = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), **payload}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"{name}: actualizado")


def main():
    os.makedirs(IMG, exist_ok=True)
    ok = True
    try:
        save("cricheroes.json", cricheroes())
    except Exception as e:  # noqa: BLE001
        ok = False
        print(f"CricHeroes falló: {e}")
    try:
        fb = facebook()
        if fb is None:
            print("Facebook: sin FB_PAGE_ID / FB_PAGE_TOKEN, se omite")
        else:
            save("facebook.json", fb)
    except Exception as e:  # noqa: BLE001
        print(f"Facebook falló: {e}")
    used = set()
    for name in ("cricheroes.json", "facebook.json"):
        path = os.path.join(DATA, name)
        if os.path.exists(path):
            used.update(re.findall(r"data/img/[\w.-]+", open(path, encoding="utf-8").read()))
    for f in os.listdir(IMG):
        if f"data/img/{f}" not in used:
            os.remove(os.path.join(IMG, f))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
