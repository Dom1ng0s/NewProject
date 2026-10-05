"""O app como ícone na tela inicial, e o número pendente na aba.

Revisar é atividade de fila de ônibus, mas nada puxava para lá: o app só
existia quando alguém lembrava de digitar o endereço. O manifesto dá o ícone, o
service worker dá o offline, e o título dá o lembrete mais barato que existe.
"""

import json

from datetime import timedelta

from django.conf import settings
from django.urls import reverse

from estudos.models import Revisao

from .base import CasoBase


class ServiceWorker(CasoBase):
    def test_e_servido_da_raiz(self):
        """Fora da raiz ele cuidaria só de /static/, que é o que menos precisa."""
        self.assertEqual(reverse("service-worker"), "/sw.js")

    def test_responde_como_javascript(self):
        resposta = self.client.get("/sw.js")
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("javascript", resposta["Content-Type"])

    def test_pode_controlar_o_app_inteiro(self):
        self.assertEqual(self.client.get("/sw.js")["Service-Worker-Allowed"], "/")

    def test_ele_mesmo_nunca_fica_em_cache(self):
        # Um service worker velho e eterno, e nao ha como depurar isso aqui.
        self.assertEqual(self.client.get("/sw.js")["Cache-Control"], "no-store")

    def test_a_api_fica_de_fora_do_cache(self):
        corpo = self.client.get("/sw.js").content.decode()
        self.assertIn("'/api/'", corpo)

    def test_estatico_sem_versao_vem_da_rede(self):
        """Cache-primeiro em `/static/` só vale para URL versionada.

        Os `@import` de `estilo.css` pedem `componentes.css` e companhia sempre
        no mesmo endereço, sem `?v=`. Guardados cache-primeiro, eles sobrevivem
        à própria edição: o `?v=` da folha de entrada muda, o navegador baixa a
        folha nova, e ela importa a versão velha das partes -- CSS antigo com
        cara de bug, que é o que o `?v=` existe para evitar.
        """
        corpo = self.client.get("/sw.js").content.decode()
        self.assertIn("searchParams.has('v')", corpo)

    def test_o_lembrete_do_worker_sai_do_servidor(self):
        """O worker não repete regra: ele entrega o texto que a API deu."""
        corpo = self.client.get("/sw.js").content.decode()
        self.assertIn("'/api/lembrete/'", corpo)
        self.assertIn("periodicsync", corpo)


class Manifesto(CasoBase):
    @property
    def manifesto(self):
        caminho = settings.STATICFILES_DIRS[0] / "manifest.json"
        return json.loads(caminho.read_text(encoding="utf-8"))

    def test_abre_direto_no_trabalho(self):
        """O atalho do celular não cai num dashboard: cai estudando."""
        self.assertEqual(self.manifesto["start_url"], "/agora/")
        self.assertEqual(self.manifesto["scope"], "/")

    def test_os_icones_existem_no_disco(self):
        for icone in self.manifesto["icons"]:
            caminho = settings.BASE_DIR / icone["src"].lstrip("/")
            self.assertTrue(caminho.exists(), icone["src"])

    def test_tem_um_icone_mascarado_para_o_android(self):
        usos = [i.get("purpose") for i in self.manifesto["icons"]]
        self.assertIn("maskable", usos)

    def test_a_pagina_aponta_para_o_manifesto_e_para_o_icone(self):
        html = self.client.get("/").content.decode()
        self.assertIn('rel="manifest"', html)
        self.assertIn("apple-touch-icon", html)
        self.assertIn("/sw.js", html)


class PendentesNoTitulo(CasoBase):
    def test_sem_fila_o_titulo_fica_limpo(self):
        html = self.client.get("/").content.decode()
        self.assertIn("<title>Dashboard · Estudos</title>", html)

    def test_a_fila_aparece_entre_parenteses(self):
        for i in range(3):
            Revisao.objects.create(
                topico=self.criar_topico(f"T{i}"), data_prevista=self.hoje
            )
        html = self.client.get("/").content.decode()
        self.assertIn("<title>(3) Dashboard · Estudos</title>", html)

    def test_conta_a_atrasada_junto(self):
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje - timedelta(days=4)
        )
        self.assertIn("<title>(1) ", self.client.get("/").content.decode())

    def test_a_de_amanha_nao_cobra_hoje(self):
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje + timedelta(days=1)
        )
        self.assertIn("<title>Dashboard · ", self.client.get("/").content.decode())

    def test_a_revisao_feita_sai_da_conta(self):
        Revisao.objects.create(
            topico=self.topico, data_prevista=self.hoje, feita=True
        )
        self.assertIn("<title>Dashboard · ", self.client.get("/").content.decode())

    def test_vale_em_todas_as_telas(self):
        Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        for url in ("/", "/materias/", "/planner/", "/historico/", "/configuracoes/"):
            with self.subTest(url=url):
                self.assertIn("<title>(1) ", self.client.get(url).content.decode())
