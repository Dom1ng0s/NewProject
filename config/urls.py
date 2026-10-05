from django.conf import settings
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [path("", include("estudos.urls"))]

# O Django nao serve MEDIA sozinho, e o WhiteNoise cuida so dos estaticos.
# Os anexos sao poucos e de uso proprio, entao servir pelo proprio Django da
# conta -- se um dia virar volume, troque por um storage de verdade.
urlpatterns += [
    re_path(
        r"^%s(?P<path>.*)$" % settings.MEDIA_URL.lstrip("/"),
        serve,
        {"document_root": settings.MEDIA_ROOT},
    )
]
