"""Plano de ataque: o conteúdo da prova distribuído nos buracos da semana."""

from datetime import timedelta

from estudos.models import Avaliacao, BlocoPlanejado
from estudos.services import (
    BLOCO_DO_PLANO_MIN,
    HORA_FINAL_DO_PLANO,
    HORA_INICIAL_DO_PLANO,
    MAXIMO_POR_DIA_MIN,
    gravar_plano,
    plano_de_ataque,
    vagas_do_dia,
)

from .base import CasoBase


class CasoComProva(CasoBase):
    def prova(self, dias=7, topicos=None, titulo="P1"):
        avaliacao = Avaliacao.objects.create(
            materia=self.materia, titulo=titulo, data=self.hoje + timedelta(days=dias)
        )
        avaliacao.topicos.set(topicos if topicos is not None else [self.topico])
        return avaliacao


class VagasDoDia(CasoComProva):
    def test_dia_vazio_e_um_buraco_so(self):
        vagas = vagas_do_dia(self.hoje, [])
        self.assertEqual(vagas, [(HORA_INICIAL_DO_PLANO * 60, HORA_FINAL_DO_PLANO * 60)])

    def test_a_aula_parte_o_dia_em_dois(self):
        bloco = self.criar_bloco(dia=self.hoje.weekday(), inicio="10:00", fim="12:00")
        vagas = vagas_do_dia(self.hoje, [bloco.json(semana=None)])
        self.assertEqual(vagas, [(8 * 60, 10 * 60), (12 * 60, 22 * 60)])

    def test_buraco_curto_demais_nao_vale(self):
        cheio = [
            self.criar_bloco(dia=self.hoje.weekday(), inicio="08:00", fim="10:00").json(),
            self.criar_bloco(dia=self.hoje.weekday(), inicio="10:15", fim="22:00").json(),
        ]
        self.assertEqual(vagas_do_dia(self.hoje, cheio), [])

    def test_bloco_pulado_libera_o_horario(self):
        bloco = self.criar_bloco(dia=self.hoje.weekday(), inicio="10:00", fim="12:00")
        item = bloco.json(semana=None, pulado=True)
        self.assertEqual(vagas_do_dia(self.hoje, [item])[0], (8 * 60, 22 * 60))

    def test_bloco_de_outro_dia_nao_atrapalha(self):
        bloco = self.criar_bloco(
            dia=(self.hoje.weekday() + 1) % 7, inicio="10:00", fim="12:00"
        )
        self.assertEqual(len(vagas_do_dia(self.hoje, [bloco.json()])), 1)


class MontarOPlano(CasoComProva):
    def test_sem_conteudo_marcado_o_plano_recusa(self):
        avaliacao = self.prova(topicos=[])
        with self.assertRaises(ValueError) as contexto:
            plano_de_ataque(avaliacao)
        self.assertIn("conteúdo", str(contexto.exception))

    def test_prova_de_hoje_nao_tem_o_que_planejar(self):
        with self.assertRaises(ValueError):
            plano_de_ataque(self.prova(dias=0))

    def test_prova_que_passou_nao_tem_o_que_planejar(self):
        with self.assertRaises(ValueError):
            plano_de_ataque(self.prova(dias=-3))

    def test_o_plano_para_na_vespera(self):
        plano = plano_de_ataque(self.prova(dias=3))
        datas = {b["data"] for b in plano["blocos"]}
        self.assertEqual(plano["dias"], 3)
        self.assertNotIn((self.hoje + timedelta(days=3)).isoformat(), datas)

    def test_respeita_o_teto_do_dia(self):
        plano = plano_de_ataque(self.prova(dias=2))
        por_dia = {}
        for bloco in plano["blocos"]:
            por_dia[bloco["data"]] = por_dia.get(bloco["data"], 0) + bloco["minutos"]
        self.assertTrue(all(m <= MAXIMO_POR_DIA_MIN for m in por_dia.values()))

    def test_nao_marca_por_cima_do_que_ja_esta_na_grade(self):
        self.criar_bloco(dia=self.hoje.weekday(), inicio="08:00", fim="22:00")
        plano = plano_de_ataque(self.prova(dias=2))
        hoje = [b for b in plano["blocos"] if b["data"] == self.hoje.isoformat()]
        self.assertEqual(hoje, [])

    def test_os_blocos_tem_o_tamanho_padrao(self):
        plano = plano_de_ataque(self.prova(dias=2))
        self.assertTrue(all(b["minutos"] == BLOCO_DO_PLANO_MIN for b in plano["blocos"]))

    def test_reveza_entre_os_topicos_que_caem(self):
        outro = self.criar_topico("Derivadas")
        plano = plano_de_ataque(self.prova(dias=3, topicos=[self.topico, outro]))
        nomes = {b["topico"] for b in plano["blocos"]}
        self.assertEqual(nomes, {"Limites", "Derivadas"})

    def test_o_que_erra_mais_vem_primeiro(self):
        from .test_frageis import CasoComLog

        esquecido = self.criar_topico("Integrais")
        for _ in range(3):
            CasoComLog.responder(self, esquecido, 0)

        plano = plano_de_ataque(self.prova(dias=5, topicos=[self.topico, esquecido]))
        self.assertEqual(plano["blocos"][0]["topico"], "Integrais")

    def test_diz_o_que_nao_coube(self):
        demais = [self.criar_topico(f"Tópico {i}") for i in range(12)]
        self.criar_bloco(dia=self.hoje.weekday(), inicio="08:00", fim="20:30")
        plano = plano_de_ataque(self.prova(dias=1, topicos=demais))
        self.assertTrue(plano["de_fora"])
        self.assertEqual(len(plano["blocos"]) + len(plano["de_fora"]), len(demais))

    def test_plano_que_cobre_tudo_nao_deixa_ninguem_de_fora(self):
        plano = plano_de_ataque(self.prova(dias=4, topicos=[self.topico]))
        self.assertEqual(plano["de_fora"], [])


class GravarNoPlanner(CasoComProva):
    def test_grava_os_blocos_no_planner(self):
        avaliacao = self.prova(dias=2)
        plano = plano_de_ataque(avaliacao)
        resumo = gravar_plano(avaliacao, plano)
        self.assertEqual(resumo["criados"], len(plano["blocos"]))
        self.assertEqual(BlocoPlanejado.objects.count(), len(plano["blocos"]))

    def test_o_bloco_gravado_leva_topico_materia_e_a_prova_na_descricao(self):
        avaliacao = self.prova(dias=2)
        gravar_plano(avaliacao, plano_de_ataque(avaliacao))
        bloco = BlocoPlanejado.objects.first()
        self.assertEqual(bloco.topico, self.topico)
        self.assertEqual(bloco.materia, self.materia)
        self.assertEqual(bloco.tipo, BlocoPlanejado.ESTUDO)
        self.assertIn("P1", bloco.descricao)

    def test_gravar_duas_vezes_nao_duplica(self):
        avaliacao = self.prova(dias=2)
        plano = plano_de_ataque(avaliacao)
        gravar_plano(avaliacao, plano)
        resumo = gravar_plano(avaliacao, plano)
        self.assertEqual(resumo["criados"], 0)
        self.assertEqual(resumo["existentes"], len(plano["blocos"]))

    def test_o_bloco_gravado_vale_so_naquela_semana(self):
        avaliacao = self.prova(dias=2)
        gravar_plano(avaliacao, plano_de_ataque(avaliacao))
        self.assertFalse(BlocoPlanejado.objects.first().recorrente)

    def test_o_plano_enxerga_o_que_ele_mesmo_gravou(self):
        """Gravar e montar de novo não pode empilhar estudo por cima de estudo."""
        avaliacao = self.prova(dias=3)
        gravar_plano(avaliacao, plano_de_ataque(avaliacao))
        self.assertEqual(plano_de_ataque(avaliacao)["blocos"], [])


class PelaApi(CasoComProva):
    def test_preview_nao_grava(self):
        avaliacao = self.prova(dias=3)
        dados = self.post(f"/api/avaliacoes/{avaliacao.id}/plano/", {"preview": 1}).json()
        self.assertTrue(dados["plano"]["blocos"])
        self.assertIsNone(dados["gravado"])
        self.assertEqual(BlocoPlanejado.objects.count(), 0)

    def test_gravar_cria_os_blocos(self):
        avaliacao = self.prova(dias=3)
        dados = self.post(f"/api/avaliacoes/{avaliacao.id}/plano/").json()
        self.assertEqual(dados["gravado"]["criados"], BlocoPlanejado.objects.count())

    def test_sem_conteudo_a_api_explica(self):
        avaliacao = self.prova(dias=3, topicos=[])
        resposta = self.post(f"/api/avaliacoes/{avaliacao.id}/plano/")
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("conteúdo", resposta.json()["erro"])

    def test_get_nao_grava_nada(self):
        avaliacao = self.prova(dias=3)
        self.assertEqual(
            self.client.get(f"/api/avaliacoes/{avaliacao.id}/plano/").status_code, 405
        )
        self.assertEqual(BlocoPlanejado.objects.count(), 0)

    def test_avaliacao_inexistente_da_404(self):
        self.assertEqual(self.post("/api/avaliacoes/9999/plano/").status_code, 404)
