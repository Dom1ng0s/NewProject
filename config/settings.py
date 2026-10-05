from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "django-insecure-uso-local-apenas"
DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "estudos",
]

MIDDLEWARE = [
    "django.middleware.common.CommonMiddleware",
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

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]

# Arquivos que voce anexa a um topico (PDF, imagem). Ficam fora do git.
MEDIA_URL = "arquivos/"
MEDIA_ROOT = BASE_DIR / "arquivos"
# Teto do upload; acima disso o Django recusa antes de gravar.
MATERIAL_MAXIMO_BYTES = 25 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Regras do app
# Os ajustes de estudo (intervalos, metas, pomodoro) ficam no banco, em
# estudos.models.Configuracao, e mudam pela tela /configuracoes/.

# Teto do arquivo anexado a um topico. Nao e preferencia: e guarda do disco.
MATERIAL_MAXIMO_BYTES = 25 * 1024 * 1024
