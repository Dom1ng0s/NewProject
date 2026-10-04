"""Leitor de .ics e o import que vira bloco no planner."""

from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from estudos.ical import desdobrar, destacar, eventos_de_ics, ler_duracao, partir_linha
from estudos.models import BlocoPlanejado

from .base import CasoBase


def ics(*eventos):
    corpo = "\n".join(f"BEGIN:VEVENT\n{e}\nEND:VEVENT" for e in eventos)
    return f"BEGIN:VCALENDAR\nVERSION:2.0\n{corpo}\nEND:VCALENDAR"


class Pedacos(CasoBase):
    def test_desdobrar_junta_a_linha_quebrada(self):
        # O RFC quebra a linha longa com CRLF + espaço, e esse espaço é a marca
        # da quebra: ao juntar, ele sai junto.
        self.assertEqual(desdobrar("SUMMARY:Cálculo I\r\n I"), "SUMMARY:Cálculo II")
        self.assertEqual(desdobrar("SUMMARY:Lab\r\n\tB"), "SUMMARY:LabB")

    def test_destacar_desfaz_os_escapes(self):
        self.assertEqual(destacar("Aula\\, sala 3\\nBloco B"), "Aula, sala 3\nBloco B")

    def test_partir_linha_separa_nome_parametros_e_valor(self):
        nome, params, valor = partir_linha('DTSTART;TZID="America/Sao_Paulo":20260302T080000')
        self.assertEqual(nome, "DTSTART")
        self.assertEqual(params, {"TZID": "America/Sao_Paulo"})
        self.assertEqual(valor, "20260302T080000")

    def test_linha_sem_dois_pontos_e_descartada(self):
        self.assertIsNone(partir_linha("LIXO"))

    def test_duracao_em_horas_e_minutos(self):
        self.assertEqual(ler_duracao("PT1H30M"), 90)
        self.assertEqual(ler_duracao("PT45M"), 45)
        self.assertEqual(ler_duracao("texto"), 0)


class LerEventos(CasoBase):
    def test_evento_simples_vira_bloco_da_propria_data(self):
        # 2026-03-02 e uma segunda-feira.
        evento = eventos_de_ics(
            ics("SUMMARY:Cálculo I\nDTSTART:20260302T080000\nDTEND:20260302T100000")
        )[0]
        self.assertEqual(evento["titulo"], "Cálculo I")
        self.assertEqual(evento["dia_semana"], 0)
        self.assertEqual((evento["hora_inicio"], evento["hora_fim"]), ("08:00", "10:00"))
        self.assertFalse(evento["recorrente"])
        self.assertEqual(evento["data"], "2026-03-02")

    def test_rrule_semanal_vira_recorrente(self):
        evento = eventos_de_ics(
            ics(
                "SUMMARY:Física\nDTSTART:20260303T140000\nDTEND:20260303T160000\n"
                "RRULE:FREQ=WEEKLY"
            )
        )[0]
        self.assertTrue(evento["recorrente"])

    def test_byday_cria_um_bloco_por_dia(self):
        eventos = eventos_de_ics(
            ics(
                "SUMMARY:Álgebra\nDTSTART:20260302T080000\nDTEND:20260302T100000\n"
                "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"
            )
        )
        self.assertEqual([e["dia_semana"] for e in eventos], [0, 2, 4])

    def test_sem_dtend_assume_uma_hora(self):
        evento = eventos_de_ics(ics("SUMMARY:Monitoria\nDTSTART:20260302T190000"))[0]
        self.assertEqual(evento["hora_fim"], "20:00")

    def test_duration_no_lugar_do_dtend(self):
        evento = eventos_de_ics(
            ics("SUMMARY:Lab\nDTSTART:20260302T080000\nDURATION:PT1H30M")
        )[0]
        self.assertEqual(evento["hora_fim"], "09:30")

    def test_horario_em_utc_vai_para_o_fuso_do_app(self):
        # America/Sao_Paulo e UTC-3: 12:00Z e 09:00 aqui.
        evento = eventos_de_ics(
            ics("SUMMARY:Reunião\nDTSTART:20260302T120000Z\nDTEND:20260302T130000Z")
        )[0]
        self.assertEqual((evento["hora_inicio"], evento["hora_fim"]), ("09:00", "10:00"))

    def test_evento_de_dia_inteiro_e_ignorado(self):
        evento = eventos_de_ics(
            ics("SUMMARY:Feriado\nDTSTART;VALUE=DATE:20260302")
        )[0]
        self.assertEqual(evento["ignorado"], "evento de dia inteiro, sem horário")

    def test_evento_que_atravessa_a_meia_noite_e_ignorado(self):
        evento = eventos_de_ics(
            ics("SUMMARY:Plantão\nDTSTART:20260302T230000\nDTEND:20260303T010000")
        )[0]
        self.assertEqual(evento["ignorado"], "evento atravessa a meia-noite")

    def test_evento_sem_data_e_ignorado(self):
        self.assertEqual(eventos_de_ics(ics("SUMMARY:Solto"))[0]["ignorado"], "sem data de início")

    def test_repeticao_encerrada_e_ignorada(self):
        passado = (timezone.localdate() - timedelta(days=30)).strftime("%Y%m%d")
        evento = eventos_de_ics(
            ics(
                "SUMMARY:Aula antiga\nDTSTART:20260302T080000\nDTEND:20260302T100000\n"
                f"RRULE:FREQ=WEEKLY;UNTIL={passado}T000000Z"
            )
        )[0]
        self.assertEqual(evento["ignorado"], "repetição já terminou")

    def test_repeticao_que_ainda_vale_nao_e_ignorada(self):
        futuro = (timezone.localdate() + timedelta(days=30)).strftime("%Y%m%d")
        evento = eventos_de_ics(
            ics(
                "SUMMARY:Aula atual\nDTSTART:20260302T080000\nDTEND:20260302T100000\n"
                f"RRULE:FREQ=WEEKLY;UNTIL={futuro}T000000Z"
            )
        )[0]
        self.assertEqual(evento["ignorado"], "")

    def test_evento_sem_summary_recebe_titulo_padrao(self):
        evento = eventos_de_ics(ics("DTSTART:20260302T080000"))[0]
        self.assertEqual(evento["titulo"], "Sem título")

    def test_limite_corta_a_lista(self):
        evento = "SUMMARY:X\nDTSTART:20260302T080000\nDTEND:20260302T090000"
        self.assertEqual(len(eventos_de_ics(ics(*([evento] * 10)), limite=3)), 3)

    def test_arquivo_vazio_nao_quebra(self):
        self.assertEqual(eventos_de_ics(""), [])


class ImportarPelaApi(CasoBase):
    def enviar(self, texto, **extra):
        arquivo = SimpleUploadedFile("agenda.ics", texto.encode("utf-8"), "text/calendar")
        return self.client.post(
            "/api/planner/importar-ical/", {"arquivo": arquivo, **extra}
        )

    def test_conferir_nao_grava(self):
        resposta = self.enviar(
            ics("SUMMARY:Cálculo I\nDTSTART:20260302T080000\nDTEND:20260302T100000"),
            preview="1",
        )
        self.assertEqual(resposta.status_code, 200)
        self.assertTrue(resposta.json()["resumo"]["preview"])
        self.assertEqual(BlocoPlanejado.objects.count(), 0)

    def test_importar_grava_o_bloco(self):
        resposta = self.enviar(
            ics(
                "SUMMARY:Física\nDTSTART:20260303T140000\nDTEND:20260303T160000\n"
                "RRULE:FREQ=WEEKLY"
            ),
            tipo="aula",
        )
        self.assertEqual(resposta.json()["resumo"]["criados"], 1)
        bloco = BlocoPlanejado.objects.get()
        self.assertEqual(bloco.titulo, "Física")
        self.assertEqual(bloco.tipo, "aula")
        self.assertTrue(bloco.recorrente)

    def test_reimportar_o_mesmo_arquivo_nao_duplica(self):
        texto = ics(
            "SUMMARY:Física\nDTSTART:20260303T140000\nDTEND:20260303T160000\nRRULE:FREQ=WEEKLY"
        )
        self.enviar(texto)
        resposta = self.enviar(texto)
        self.assertEqual(resposta.json()["resumo"]["criados"], 0)
        self.assertEqual(resposta.json()["resumo"]["existentes"], 1)
        self.assertEqual(BlocoPlanejado.objects.count(), 1)

    def test_materia_detectada_pelo_titulo_do_evento(self):
        self.enviar(
            ics("SUMMARY:Cálculo - turma B\nDTSTART:20260302T080000\nDTEND:20260302T100000")
        )
        self.assertEqual(BlocoPlanejado.objects.get().materia, self.materia)

    def test_materia_fixada_no_seletor_vence_a_deteccao(self):
        outra = type(self.materia).objects.create(nome="Física")
        self.enviar(
            ics("SUMMARY:Cálculo - turma B\nDTSTART:20260302T080000\nDTEND:20260302T100000"),
            materia_id=str(outra.id),
        )
        self.assertEqual(BlocoPlanejado.objects.get().materia, outra)

    def test_evento_ignorado_nao_vira_bloco(self):
        resposta = self.enviar(ics("SUMMARY:Feriado\nDTSTART;VALUE=DATE:20260302"))
        self.assertEqual(resposta.json()["resumo"]["ignorados"], 1)
        self.assertEqual(BlocoPlanejado.objects.count(), 0)

    def test_sem_arquivo_responde_erro(self):
        resposta = self.client.post("/api/planner/importar-ical/", {})
        self.assertEqual(resposta.status_code, 400)
