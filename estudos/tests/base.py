"""Atalhos usados pelos testes."""

from datetime import time, timedelta

from django.test import TestCase
from django.utils import timezone

from estudos.models import BlocoPlanejado, Configuracao, Materia, SessaoEstudo, Topico


class CasoBase(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        self.materia = Materia.objects.create(nome="Cálculo", cor="#112233")
        self.topico = Topico.objects.create(materia=self.materia, nome="Limites")

    def criar_topico(self, nome, pai=None, materia=None, **extra):
        return Topico.objects.create(
            materia=materia or self.materia, pai=pai, nome=nome, **extra
        )

    def criar_sessao(self, dias_atras=0, minutos=60, topico=None):
        return SessaoEstudo.objects.create(
            topico=topico or self.topico,
            inicio=timezone.now() - timedelta(days=dias_atras),
            duracao_min=minutos,
        )

    def criar_bloco(self, dia=0, inicio="08:00", fim="10:00", semana=None, **extra):
        extra.setdefault("materia", self.materia)
        return BlocoPlanejado.objects.create(
            dia_semana=dia,
            hora_inicio=time.fromisoformat(inicio),
            hora_fim=time.fromisoformat(fim),
            semana=semana,
            **extra,
        )

    def configurar(self, **campos):
        """Muda os ajustes do app, que agora moram no banco e nao em settings."""
        config = Configuracao.atual()
        for nome, valor in campos.items():
            setattr(config, nome, valor)
        config.save()
        return config

    @property
    def config(self):
        return Configuracao.atual()

    def post(self, url, dados=None):
        return self.client.post(url, dados or {}, content_type="application/json")
