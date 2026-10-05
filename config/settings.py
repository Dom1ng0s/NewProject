"""Configuracao do projeto.

Rodando local nao precisa de nada: os padroes abaixo ja servem (DEBUG ligado,
SQLite no proprio diretorio, estaticos lidos da pasta static/).

Em producao tudo que muda vem de variavel de ambiente -- veja DEPLOY.md para a
lista. O minimo e SECRET_KEY, DEBUG=0 e ALLOWED_HOSTS.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def ligado(nome, padrao):
    """Variavel de ambiente lida como booleano."""
    return os.environ.get(nome, padrao).strip().lower() in {"1", "true", "sim", "on"}


def lista(nome, padrao=""):
    """Variavel de ambiente lida como lista separada por virgula."""
    bruto = os.environ.get(nome, padrao)
    return [item.strip() for item in bruto.split(",") if item.strip()]


# Sem SECRET_KEY no ambiente a chave e a de uso local. Em producao defina a
# variavel: e ela que assina os cookies assinados e os tokens de formulario.
SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-uso-local-apenas")
DEBUG = ligado("DEBUG", "1")

# Local vale qualquer host (o celular entra pelo IP da rede). Publicado, vale
# so o dominio que voce listar -- e o Django recusa o resto.
ALLOWED_HOSTS = lista("ALLOWED_HOSTS", "*" if DEBUG else "")

# Dominio https do app, para o Django aceitar POST vindo dele.
CSRF_TRUSTED_ORIGINS = lista("CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "estudos",
]

MIDDLEWARE = [
    # Https, HSTS e afins. So aperta de verdade com DEBUG desligado (abaixo).
    "django.middleware.security.SecurityMiddleware",
    # Serve os estaticos sem depender de nginx: e o que faz o CSS e o JS
    # chegarem com DEBUG=0, onde o Django nao serve mais nada sozinho.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.middleware.common.CommonMiddleware",
    # Nega que o app seja aberto dentro de um iframe de outro site.
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # A pagina nunca fica em cache: era ela que carregava o ?v= antigo dos
    # estaticos e devolvia um CSS velho com cara de bug.
    "estudos.middleware.html_sem_cache",
    # Quem esta usando: resolve o perfil do cookie e deixa as consultas
    # filtradas por ele. Sem perfil escolhido, toda tela desvia para /perfis/.
    "estudos.middleware.perfil_atual",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        # O numero de revisoes pendentes vai no <title> de toda tela.
        "OPTIONS": {"context_processors": ["estudos.contexto.pendentes"]},
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite por padrao. Com DATABASE_URL definida (Postgres do provedor) usa ela:
# no disco efemero da nuvem o SQLite se perde a cada deploy.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(os.environ.get("SQLITE_PATH", BASE_DIR / "db.sqlite3")),
    }
}
if os.environ.get("DATABASE_URL"):
    import dj_database_url

    DATABASES["default"] = dj_database_url.config(conn_max_age=600)

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
# Destino do collectstatic, que o deploy roda antes de subir.
STATIC_ROOT = BASE_DIR / "estaticos-coletados"

# Comprime na coleta e serve .gz/.br quando o navegador aceita. Sem hash no
# nome do arquivo: a versao do estatico ja vem do ?v= da tag {% estatico %}.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}

# Arquivos que voce anexa a um topico (PDF, imagem). Ficam fora do git.
# Na nuvem aponte MEDIA_ROOT para um disco persistente, ou os anexos somem
# no proximo deploy junto com o resto do sistema de arquivos.
MEDIA_URL = "arquivos/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "arquivos"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

if not DEBUG:
    # O provedor termina o TLS e repassa http; sem isso o Django acha que a
    # conexao e insegura e entra em laco de redirecionamento.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = ligado("SECURE_SSL_REDIRECT", "1")
    # O service worker so registra em https, e e ele que faz o app funcionar
    # offline depois de instalado na tela inicial.
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", 60 * 60 * 24 * 30))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# Regras do app
# Os ajustes de estudo (intervalos, metas, pomodoro) ficam no banco, em
# estudos.models.Configuracao, e mudam pela tela /configuracoes/.

# Teto do arquivo anexado a um topico. Nao e preferencia: e guarda do disco.
MATERIAL_MAXIMO_BYTES = 25 * 1024 * 1024
