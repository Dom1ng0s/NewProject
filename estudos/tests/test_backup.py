"""Exportar e importar o backup JSON."""

import json
from datetime import time, timedelta

from django.utils import timezone

from estudos import backup
from estudos.models import (
    Avaliacao,
    BlocoPlanejado,
    Cartao,
    Material,
    Materia,
    OcorrenciaPulada,
    RespostaRevisao,
    Revisao,
    SessaoEstudo,
    Topico,
)
from estudos.services import registrar_resposta, segunda_da_semana

from .base import CasoBase


class Exportar(CasoBase):
    def test_leva_tudo_e_identifica_o_app(self):
        assunto = self.criar_topico("Continuidade", pai=self.topico)
        self.criar_sessao(minutos=45)
        self.criar_bloco(topico=assunto)
        self.topico.iniciar_revisoes()

        dados = backup.exportar()
        self.assertEqual((dados["app"], dados["versao"]), ("estudos", backup.VERSAO))
        self.assertEqual(len(dados["materias"]), 1)
        self.assertEqual(len(dados["topicos"]), 2)
        self.assertEqual(len(dados["sessoes"]), 1)
        self.assertEqual(len(dados["blocos"]), 1)
        self.assertEqual(len(dados["revisoes"]), 1)

    def test_pai_vem_antes_do_filho(self):
        assunto = self.criar_topico("Continuidade", pai=self.topico)
        self.criar_topico("Confronto", pai=assunto)
        nomes = [t["nome"] for t in backup.exportar()["topicos"]]
        self.assertEqual(nomes.index("Limites") < nomes.index("Continuidade"), True)
        self.assertEqual(nomes.index("Continuidade") < nomes.index("Confronto"), True)

    def test_ocorrencia_pulada_viaja_junto_do_bloco(self):
        semana = segunda_da_semana()
        bloco = self.criar_bloco()
        OcorrenciaPulada.objects.create(bloco=bloco, semana=semana)
        self.assertEqual(backup.exportar()["blocos"][0]["puladas"], [semana.isoformat()])

    def test_serializa_como_json(self):
        self.criar_sessao()
        self.topico.iniciar_revisoes()
        json.dumps(backup.exportar())  # nao pode levantar

    def test_nome_do_arquivo_tem_data_e_hora(self):
        self.assertTrue(backup.nome_do_arquivo().startswith("estudos-backup-"))
        self.assertTrue(backup.nome_do_arquivo().endswith(".json"))


class IdaEVolta(CasoBase):
    def montar_tudo(self):
        assunto = self.criar_topico("Continuidade", pai=self.topico, status=Topico.DOMINADO)
        self.criar_sessao(minutos=45)
        bloco = self.criar_bloco(titulo="Aula de cálculo", tipo="aula", topico=assunto)
        OcorrenciaPulada.objects.create(bloco=bloco, semana=segunda_da_semana())
        self.criar_bloco(dia=2, inicio="19:00", fim="20:00", titulo="Academia", materia=None)
        self.topico.iniciar_revisoes()

    def limpar(self):
        OcorrenciaPulada.objects.all().delete()
        BlocoPlanejado.objects.all().delete()
        Materia.objects.all().delete()

    def test_banco_vazio_volta_igual(self):
        self.montar_tudo()
        antes = backup.exportar()
        self.limpar()
        backup.importar(antes)
        depois = backup.exportar()

        for chave in ("materias", "topicos", "sessoes", "blocos", "revisoes"):
            with self.subTest(chave=chave):
                self.assertEqual(len(depois[chave]), len(antes[chave]))

    def test_detalhes_sobrevivem(self):
        self.montar_tudo()
        antes = backup.exportar()
        self.limpar()
        backup.importar(antes)

        assunto = Topico.objects.get(nome="Continuidade")
        self.assertEqual(assunto.pai.nome, "Limites")
        self.assertEqual(assunto.status, Topico.DOMINADO)
        self.assertEqual(assunto.materia.cor, "#112233")

        aula = BlocoPlanejado.objects.get(titulo="Aula de cálculo")
        self.assertEqual(aula.tipo, "aula")
        self.assertEqual(aula.topico, assunto)
        self.assertEqual(aula.hora_inicio.strftime("%H:%M"), "08:00")
        self.assertEqual(aula.puladas.count(), 1)

        academia = BlocoPlanejado.objects.get(titulo="Academia")
        self.assertIsNone(academia.materia)

        self.assertEqual(SessaoEstudo.objects.get().duracao_min, 45)

    def test_instante_da_sessao_nao_desliza(self):
        sessao = self.criar_sessao(minutos=30)
        antes = backup.exportar()
        self.limpar()
        backup.importar(antes)
        # Precisao do backup e o segundo; comparar truncando os microssegundos.
        self.assertEqual(
            SessaoEstudo.objects.get().inicio.replace(microsecond=0),
            sessao.inicio.replace(microsecond=0),
        )

    def test_revisao_feita_continua_feita(self):
        Revisao.objects.create(
            topico=self.topico,
            data_prevista=self.hoje,
            feita=True,
            dificil=True,
            feita_em=timezone.now(),
        )
        antes = backup.exportar()
        self.limpar()
        backup.importar(antes)
        revisao = Revisao.objects.get()
        self.assertTrue(revisao.feita and revisao.dificil)
        self.assertIsNotNone(revisao.feita_em)


class ImportarMesclando(CasoBase):
    def test_importar_duas_vezes_nao_duplica(self):
        self.montar = self.criar_sessao(minutos=45)
        self.criar_bloco(titulo="Aula")
        self.topico.iniciar_revisoes()
        arquivo = backup.exportar()

        resumo = backup.importar(arquivo)
        self.assertEqual(resumo["criados"]["materias"], 0)
        self.assertEqual(resumo["existentes"]["materias"], 1)
        self.assertEqual(resumo["existentes"]["sessoes"], 1)
        self.assertEqual(resumo["existentes"]["revisoes"], 1)

        self.assertEqual(Materia.objects.count(), 1)
        self.assertEqual(Topico.objects.count(), 1)
        self.assertEqual(SessaoEstudo.objects.count(), 1)
        self.assertEqual(BlocoPlanejado.objects.count(), 1)
        self.assertEqual(Revisao.objects.count(), 1)

    def test_soma_o_que_e_novo_e_preserva_o_que_existe(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [
                {"id": 1, "nome": "Cálculo", "cor": "#ffffff", "meta_horas_semanais": 99},
                {"id": 2, "nome": "Física", "cor": "#abcdef", "meta_horas_semanais": 4},
            ],
            "topicos": [{"id": 1, "materia_id": 2, "nome": "Cinemática"}],
        }
        resumo = backup.importar(arquivo)
        self.assertEqual(resumo["criados"]["materias"], 1)
        self.assertEqual(resumo["existentes"]["materias"], 1)

        self.materia.refresh_from_db()
        # Materia que ja existia nao e sobrescrita pelo arquivo.
        self.assertEqual(self.materia.cor, "#112233")
        self.assertEqual(self.materia.meta_horas_semanais, 0)
        self.assertEqual(Topico.objects.get(nome="Cinemática").materia.nome, "Física")

    def test_topico_de_mesmo_nome_em_pais_diferentes_sao_dois(self):
        assunto = self.criar_topico("Continuidade", pai=self.topico)
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "Cálculo"}],
            "topicos": [
                {"id": 1, "materia_id": 1, "nome": "Limites"},
                {"id": 2, "materia_id": 1, "pai_id": 1, "nome": "Continuidade"},
                {"id": 3, "materia_id": 1, "nome": "Continuidade"},
            ],
        }
        backup.importar(arquivo)
        self.assertEqual(Topico.objects.filter(nome="Continuidade").count(), 2)
        self.assertEqual(Topico.objects.filter(pai=assunto).count(), 0)

    def test_substituir_apaga_o_que_estava(self):
        self.criar_sessao()
        self.criar_bloco(titulo="Antigo")
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "Química"}],
        }
        resumo = backup.importar(arquivo, substituir=True)
        self.assertTrue(resumo["substituiu"])
        self.assertEqual([m.nome for m in Materia.objects.all()], ["Química"])
        self.assertEqual(SessaoEstudo.objects.count(), 0)
        self.assertEqual(BlocoPlanejado.objects.count(), 0)
        self.assertEqual(Revisao.objects.count(), 0)


class ArquivoRuim(CasoBase):
    def importar(self, arquivo, **extra):
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo, **extra)
        return str(contexto.exception)

    def base(self, **extra):
        return {"app": "estudos", "versao": backup.VERSAO, **extra}

    def test_arquivo_de_outro_app(self):
        self.assertIn("não é um backup", self.importar({"app": "outro", "versao": 1}))

    def test_versao_desconhecida(self):
        self.assertIn("versão", self.importar({"app": "estudos", "versao": 99}))

    def test_nao_e_objeto(self):
        self.assertIn("não é um backup", self.importar([1, 2, 3]))

    def test_secao_que_nao_e_lista(self):
        self.assertIn("lista", self.importar(self.base(materias={"nome": "X"})))

    def test_materia_sem_nome(self):
        self.assertIn("nome", self.importar(self.base(materias=[{"id": 1}])))

    def test_topico_aponta_para_materia_que_nao_existe_no_arquivo(self):
        arquivo = self.base(topicos=[{"id": 1, "materia_id": 7, "nome": "X"}])
        self.assertIn("não está no arquivo", self.importar(arquivo))

    def test_arvore_nao_passa_de_tres_niveis(self):
        arquivo = self.base(
            materias=[{"id": 1, "nome": "M"}],
            topicos=[
                {"id": 1, "materia_id": 1, "nome": "N1"},
                {"id": 2, "materia_id": 1, "pai_id": 1, "nome": "N2"},
                {"id": 3, "materia_id": 1, "pai_id": 2, "nome": "N3"},
                {"id": 4, "materia_id": 1, "pai_id": 3, "nome": "N4"},
            ],
        )
        self.assertIn("três níveis", self.importar(arquivo))

    def test_status_desconhecido(self):
        arquivo = self.base(
            materias=[{"id": 1, "nome": "M"}],
            topicos=[{"id": 1, "materia_id": 1, "nome": "X", "status": "inventado"}],
        )
        self.assertIn("desconhecido", self.importar(arquivo))

    def test_data_invalida(self):
        arquivo = self.base(
            materias=[{"id": 1, "nome": "M"}],
            topicos=[{"id": 1, "materia_id": 1, "nome": "X"}],
            revisoes=[{"topico_id": 1, "data_prevista": "32/13/2026"}],
        )
        self.assertIn("data", self.importar(arquivo))

    def test_bloco_com_fim_antes_do_inicio(self):
        arquivo = self.base(
            blocos=[{"dia_semana": 0, "hora_inicio": "10:00", "hora_fim": "08:00"}]
        )
        self.assertIn("fim é antes", self.importar(arquivo))

    def test_dia_da_semana_fora_da_faixa(self):
        arquivo = self.base(
            blocos=[{"dia_semana": 9, "hora_inicio": "08:00", "hora_fim": "09:00"}]
        )
        self.assertIn("faixa", self.importar(arquivo))

    def test_duracao_de_sessao_que_nao_e_numero(self):
        arquivo = self.base(
            materias=[{"id": 1, "nome": "M"}],
            topicos=[{"id": 1, "materia_id": 1, "nome": "X"}],
            sessoes=[{"topico_id": 1, "inicio": "2026-03-02T08:00:00", "duracao_min": "muito"}],
        )
        self.assertIn("inteiro", self.importar(arquivo))

    def test_arquivo_ruim_nao_grava_nada_pela_metade(self):
        arquivo = self.base(
            materias=[{"id": 1, "nome": "Química"}, {"id": 2, "nome": ""}]
        )
        self.importar(arquivo)
        self.assertFalse(Materia.objects.filter(nome="Química").exists())

    def test_substituir_com_arquivo_ruim_nao_apaga_o_banco(self):
        self.criar_sessao()
        arquivo = self.base(materias=[{"id": 1, "nome": ""}])
        self.importar(arquivo, substituir=True)
        self.assertEqual(Materia.objects.count(), 1)
        self.assertEqual(SessaoEstudo.objects.count(), 1)


class PelaApi(CasoBase):
    def test_exportar_baixa_um_json_com_nome(self):
        resposta = self.client.get("/api/backup/exportar/")
        self.assertEqual(resposta.status_code, 200)
        self.assertIn("attachment", resposta["Content-Disposition"])
        self.assertIn("estudos-backup-", resposta["Content-Disposition"])
        self.assertEqual(resposta.json()["app"], "estudos")

    def test_conferir_conta_sem_gravar(self):
        arquivo = json.dumps(
            {
                "app": "estudos",
                "versao": backup.VERSAO,
                "materias": [{"id": 1, "nome": "Física"}],
            }
        )
        resposta = self.post("/api/backup/importar/", {"backup": arquivo, "preview": 1})
        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["resumo"]["materias"], 1)
        self.assertEqual(Materia.objects.count(), 1)  # so a do setUp

    def test_importar_grava(self):
        arquivo = json.dumps(
            {
                "app": "estudos",
                "versao": backup.VERSAO,
                "materias": [{"id": 1, "nome": "Física"}],
            }
        )
        resposta = self.post("/api/backup/importar/", {"backup": arquivo})
        self.assertEqual(resposta.json()["resumo"]["criados"]["materias"], 1)
        self.assertTrue(Materia.objects.filter(nome="Física").exists())

    def test_substituir_pela_api(self):
        arquivo = json.dumps(
            {
                "app": "estudos",
                "versao": backup.VERSAO,
                "materias": [{"id": 1, "nome": "Física"}],
            }
        )
        self.post("/api/backup/importar/", {"backup": arquivo, "substituir": True})
        self.assertEqual([m.nome for m in Materia.objects.all()], ["Física"])

    def test_json_quebrado_responde_400(self):
        resposta = self.post("/api/backup/importar/", {"backup": "{nao é json"})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("JSON", resposta.json()["erro"])

    def test_sem_backup_responde_400(self):
        resposta = self.post("/api/backup/importar/", {})
        self.assertEqual(resposta.status_code, 400)

    def test_erro_de_validacao_vira_400_com_a_mensagem(self):
        arquivo = json.dumps({"app": "estudos", "versao": 99})
        resposta = self.post("/api/backup/importar/", {"backup": arquivo})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("versão", resposta.json()["erro"])

    def test_exportar_nao_aceita_post(self):
        self.assertEqual(self.client.post("/api/backup/exportar/").status_code, 405)

    def test_importar_nao_aceita_get(self):
        self.assertEqual(self.client.get("/api/backup/importar/").status_code, 405)

    def test_backup_grande_demais_e_recusado(self):
        gigante = "x" * (backup.LIMITE_BYTES + 1)
        resposta = self.post("/api/backup/importar/", {"backup": gigante})
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("grande", resposta.json()["erro"])


class ResumirArquivo(CasoBase):
    def test_conta_cada_secao(self):
        self.criar_sessao()
        self.topico.iniciar_revisoes()
        resumo = backup.resumir(backup.exportar())
        self.assertEqual(resumo["materias"], 1)
        self.assertEqual(resumo["topicos"], 1)
        self.assertEqual(resumo["sessoes"], 1)
        self.assertEqual(resumo["revisoes"], 1)
        self.assertTrue(resumo["gerado_em"])

    def test_secao_ausente_conta_zero(self):
        resumo = backup.resumir({"app": "estudos", "versao": backup.VERSAO})
        self.assertEqual(resumo["blocos"], 0)

    def test_arquivo_de_outro_app_e_recusado(self):
        with self.assertRaises(ValueError):
            backup.resumir({"app": "outro"})


class SemanaDoBackup(CasoBase):
    def test_bloco_pontual_mantem_a_semana(self):
        semana = segunda_da_semana() + timedelta(days=7)
        self.criar_bloco(titulo="Revisão de prova", semana=semana)
        arquivo = backup.exportar()
        BlocoPlanejado.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(BlocoPlanejado.objects.get().semana, semana)

    def test_bloco_recorrente_continua_sem_semana(self):
        self.criar_bloco(titulo="Aula fixa")
        arquivo = backup.exportar()
        BlocoPlanejado.objects.all().delete()
        backup.importar(arquivo)
        self.assertTrue(BlocoPlanejado.objects.get().recorrente)


class AvaliacoesNoBackup(CasoBase):
    def criar_avaliacao(self, **extra):
        avaliacao = Avaliacao.objects.create(
            materia=self.materia,
            titulo=extra.pop("titulo", "P1"),
            data=self.hoje + timedelta(days=extra.pop("dias", 5)),
            **extra,
        )
        return avaliacao

    def test_vai_e_volta_com_conteudo_e_nota(self):
        outro = self.criar_topico("Derivadas")
        avaliacao = self.criar_avaliacao(tipo="trabalho", peso=3, nota=8.5, concluida=True)
        avaliacao.topicos.set([self.topico, outro])

        arquivo = backup.exportar()
        self.assertEqual(len(arquivo["avaliacoes"]), 1)
        Materia.objects.all().delete()
        backup.importar(arquivo)

        volta = Avaliacao.objects.get()
        self.assertEqual(volta.titulo, "P1")
        self.assertEqual(volta.tipo, "trabalho")
        self.assertEqual((volta.peso, volta.nota), (3, 8.5))
        self.assertTrue(volta.concluida)
        self.assertEqual(
            sorted(t.nome for t in volta.topicos.all()), ["Derivadas", "Limites"]
        )

    def test_hora_opcional_sobrevive(self):
        self.criar_avaliacao(hora=time(14, 30))
        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(Avaliacao.objects.get().hora.strftime("%H:%M"), "14:30")

    def test_reimportar_nao_duplica(self):
        self.criar_avaliacao()
        resumo = backup.importar(backup.exportar())
        self.assertEqual(resumo["criados"]["avaliacoes"], 0)
        self.assertEqual(resumo["existentes"]["avaliacoes"], 1)
        self.assertEqual(Avaliacao.objects.count(), 1)

    def test_mesma_prova_em_data_diferente_e_outra_avaliacao(self):
        self.criar_avaliacao(dias=5)
        arquivo = backup.exportar()
        arquivo["avaliacoes"][0]["data"] = (self.hoje + timedelta(days=9)).isoformat()
        backup.importar(arquivo)
        self.assertEqual(Avaliacao.objects.count(), 2)

    def test_backup_da_versao_antiga_ainda_e_lido(self):
        # A versao 1 e de antes das avaliacoes: o arquivo nao tem a secao.
        arquivo = {
            "app": "estudos",
            "versao": 1,
            "materias": [{"id": 1, "nome": "Física"}],
        }
        backup.importar(arquivo)
        self.assertTrue(Materia.objects.filter(nome="Física").exists())

    def test_nota_que_nao_e_numero_e_recusada(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "avaliacoes": [
                {"materia_id": 1, "titulo": "P1", "data": "2026-03-02", "nota": "oito"}
            ],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("número", str(contexto.exception))

    def test_conteudo_apontando_para_topico_fora_do_arquivo_e_recusado(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "avaliacoes": [
                {
                    "materia_id": 1,
                    "titulo": "P1",
                    "data": "2026-03-02",
                    "topico_ids": [42],
                }
            ],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("não está no arquivo", str(contexto.exception))

    def test_resumir_conta_as_avaliacoes(self):
        self.criar_avaliacao()
        self.assertEqual(backup.resumir(backup.exportar())["avaliacoes"], 1)


class CartoesNoBackup(CasoBase):
    def test_vao_e_voltam_com_o_topico(self):
        Cartao.objects.create(topico=self.topico, frente="O que é limite?", verso="Tendência", ordem=1)
        Cartao.objects.create(topico=self.topico, frente="Para que serve?", verso="Derivada", ordem=2)

        arquivo = backup.exportar()
        self.assertEqual(len(arquivo["cartoes"]), 2)
        Materia.objects.all().delete()
        backup.importar(arquivo)

        cartoes = list(Cartao.objects.all())
        self.assertEqual([c.frente for c in cartoes], ["O que é limite?", "Para que serve?"])
        self.assertEqual(cartoes[0].verso, "Tendência")
        self.assertEqual(cartoes[0].topico.nome, "Limites")

    def test_reimportar_nao_duplica(self):
        Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        resumo = backup.importar(backup.exportar())
        self.assertEqual(resumo["criados"]["cartoes"], 0)
        self.assertEqual(resumo["existentes"]["cartoes"], 1)
        self.assertEqual(Cartao.objects.count(), 1)

    def test_cartao_sem_resposta_e_recusado(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "T"}],
            "cartoes": [{"topico_id": 1, "frente": "P", "verso": ""}],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("verso", str(contexto.exception))

    def test_resumir_conta_os_cartoes(self):
        Cartao.objects.create(topico=self.topico, frente="P", verso="R")
        self.assertEqual(backup.resumir(backup.exportar())["cartoes"], 1)


class EstadoDoSM2NoBackup(CasoBase):
    def test_facilidade_e_intervalo_sobrevivem(self):
        for _ in range(3):
            self.topico.responder(5)
        esperado = (self.topico.facilidade, self.topico.intervalo_dias, self.topico.acertos_seguidos)

        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)

        volta = Topico.objects.get()
        self.assertEqual(
            (volta.facilidade, volta.intervalo_dias, volta.acertos_seguidos), esperado
        )

    def test_a_nota_dada_na_revisao_sobrevive(self):
        self.topico.responder(4)
        Revisao.objects.filter(feita=False).update(feita=True, qualidade=4)

        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(Revisao.objects.get().qualidade, 4)

    def test_backup_antigo_sem_o_estado_usa_os_padroes(self):
        arquivo = {
            "app": "estudos",
            "versao": 2,
            "materias": [{"id": 1, "nome": "Física"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "Cinemática"}],
        }
        backup.importar(arquivo)
        topico = Topico.objects.get(nome="Cinemática")
        self.assertEqual((topico.facilidade, topico.intervalo_dias), (2.5, 0))

    def test_nota_fora_da_faixa_no_arquivo_e_recusada(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "T"}],
            "revisoes": [{"topico_id": 1, "data_prevista": "2026-03-02", "qualidade": 9}],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("faixa", str(contexto.exception))


class NotasEMaterialNoBackup(CasoBase):
    def test_notas_do_topico_vao_e_voltam(self):
        self.topico.notas = "o limite é a tendência, não o valor"
        self.topico.save()
        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(Topico.objects.get().notas, "o limite é a tendência, não o valor")

    def test_link_vai_e_volta(self):
        Material.objects.create(
            topico=self.topico, titulo="Apostila", url="https://x.com/a.pdf", nota="cap. 2"
        )
        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        material = Material.objects.get()
        self.assertEqual((material.titulo, material.nota), ("Apostila", "cap. 2"))
        self.assertEqual(material.url, "https://x.com/a.pdf")

    def test_arquivo_anexado_fica_de_fora(self):
        # O PDF mora em MEDIA_ROOT; copiar a pasta "arquivos/" e que e o backup dele.
        Material.objects.create(topico=self.topico, titulo="Resumo", arquivo="materiais/x.pdf")
        self.assertEqual(backup.exportar()["materiais"], [])

    def test_reimportar_nao_duplica(self):
        Material.objects.create(topico=self.topico, titulo="A", url="https://x.com/a")
        resumo = backup.importar(backup.exportar())
        self.assertEqual(resumo["criados"]["materiais"], 0)
        self.assertEqual(resumo["existentes"]["materiais"], 1)

    def test_link_invalido_no_arquivo_e_recusado(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "T"}],
            "materiais": [{"topico_id": 1, "titulo": "X", "url": "x.com"}],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("http", str(contexto.exception))

    def test_backup_da_versao_3_ainda_e_lido(self):
        arquivo = {
            "app": "estudos",
            "versao": 3,
            "materias": [{"id": 1, "nome": "Física"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "Ondas"}],
        }
        backup.importar(arquivo)
        self.assertEqual(Topico.objects.get(nome="Ondas").notas, "")


class InterrupcoesNoBackup(CasoBase):
    def test_vao_e_voltam(self):
        sessao = self.criar_sessao(minutos=50)
        sessao.interrupcoes = 4
        sessao.save()

        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 4)

    def test_backup_da_versao_4_vira_zero(self):
        arquivo = {
            "app": "estudos",
            "versao": 4,
            "materias": [{"id": 1, "nome": "Física"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "Ondas"}],
            "sessoes": [
                {"topico_id": 1, "inicio": "2026-03-02T08:00:00", "duracao_min": 30}
            ],
        }
        backup.importar(arquivo)
        self.assertEqual(SessaoEstudo.objects.get().interrupcoes, 0)

    def test_valor_fora_da_faixa_e_recusado(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "T"}],
            "sessoes": [
                {
                    "topico_id": 1,
                    "inicio": "2026-03-02T08:00:00",
                    "duracao_min": 30,
                    "interrupcoes": 5000,
                }
            ],
        }
        with self.assertRaises(ValueError) as contexto:
            backup.importar(arquivo)
        self.assertIn("faixa", str(contexto.exception))


class RespostasNoBackup(CasoBase):
    """O log de respostas é a única parte do banco que não se recalcula."""

    def responder(self, qualidade=4):
        revisao = Revisao.objects.create(topico=self.topico, data_prevista=self.hoje)
        registrar_resposta(revisao, qualidade)

    def test_vao_e_voltam(self):
        self.responder(5)
        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)

        log = RespostaRevisao.objects.get()
        self.assertEqual(log.qualidade, 5)
        self.assertEqual(log.facilidade_antes, 2.5)
        self.assertEqual(log.data_prevista, self.hoje)

    def test_reimportar_o_mesmo_arquivo_nao_duplica(self):
        self.responder()
        arquivo = backup.exportar()
        backup.importar(arquivo)
        self.assertEqual(RespostaRevisao.objects.count(), 1)
        self.assertEqual(backup.importar(arquivo)["existentes"]["respostas"], 1)

    def test_duas_respostas_do_mesmo_topico_sobrevivem(self):
        self.responder(2)
        Revisao.objects.filter(feita=False).delete()
        self.responder(5)
        # O reconhecimento de repetida e pelo segundo da resposta; no teste as
        # duas caem no mesmo segundo, o que na pratica nao acontece (ninguem le
        # um cartao em menos de um segundo).
        primeira = RespostaRevisao.objects.earliest("id")
        primeira.respondida_em -= timedelta(minutes=5)
        primeira.save(update_fields=["respondida_em"])

        arquivo = backup.exportar()
        Materia.objects.all().delete()
        backup.importar(arquivo)
        self.assertEqual(RespostaRevisao.objects.count(), 2)

    def test_backup_da_versao_6_importa_sem_o_log(self):
        arquivo = {
            "app": "estudos",
            "versao": 6,
            "materias": [{"id": 1, "nome": "Física"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "Ondas"}],
        }
        resumo = backup.importar(arquivo)
        self.assertEqual(RespostaRevisao.objects.count(), 0)
        self.assertEqual(resumo["criados"]["respostas"], 0)

    def test_nota_fora_da_escala_e_recusada(self):
        arquivo = {
            "app": "estudos",
            "versao": backup.VERSAO,
            "materias": [{"id": 1, "nome": "M"}],
            "topicos": [{"id": 1, "materia_id": 1, "nome": "T"}],
            "respostas": [
                {
                    "topico_id": 1,
                    "qualidade": 9,
                    "respondida_em": "2026-03-02T08:00:00",
                    "data_prevista": "2026-03-02",
                    "status_antes": "estudando",
                    "facilidade_antes": 2.5,
                    "intervalo_antes": 1,
                    "acertos_antes": 0,
                    "facilidade_depois": 2.6,
                    "intervalo_depois": 6,
                }
            ],
        }
        with self.assertRaises(ValueError):
            backup.importar(arquivo)

    def test_o_resumo_conta_as_respostas(self):
        self.responder()
        self.assertEqual(backup.resumir(backup.exportar())["respostas"], 1)
