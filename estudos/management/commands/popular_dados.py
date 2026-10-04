import random
from datetime import time, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from estudos.models import BlocoPlanejado, Materia, Revisao, SessaoEstudo, Topico
from estudos.services import segunda_da_semana

ESTRUTURA = {
    "Matemática": ("#e0533d", 5, {"Álgebra": ["Equações", "Polinômios"], "Geometria": ["Áreas", "Trigonometria"]}),
    "História": ("#7b5cd6", 3, {"Brasil Colônia": ["Capitanias"], "República": ["Era Vargas", "Ditadura"]}),
    "Programação": ("#1f8a5b", 6, {"Python": ["Listas", "Decoradores"], "SQL": ["Joins"]}),
    "Inglês": ("#c9a227", 2, {"Gramática": ["Present perfect"], "Vocabulário": []}),
}


class Command(BaseCommand):
    help = "Popula o banco com dados de exemplo para testar o dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--limpar", action="store_true", help="Apaga os dados antes")

    def handle(self, *args, **opcoes):
        if opcoes["limpar"]:
            Materia.objects.all().delete()

        hoje = timezone.localdate()
        agora = timezone.now()
        aleatorio = random.Random(7)  # seed fixa: resultado reproduzivel

        folhas = []
        for nome, (cor, meta, assuntos) in ESTRUTURA.items():
            materia, _ = Materia.objects.get_or_create(
                nome=nome, defaults={"cor": cor, "meta_horas_semanais": meta}
            )
            for assunto, subtopicos in assuntos.items():
                pai, _ = Topico.objects.get_or_create(materia=materia, pai=None, nome=assunto)
                folhas.append(pai)
                for sub in subtopicos:
                    filho, _ = Topico.objects.get_or_create(materia=materia, pai=pai, nome=sub)
                    folhas.append(filho)

        for topico in folhas:
            topico.status = aleatorio.choice(
                [Topico.NAO_INICIADO, Topico.ESTUDANDO, Topico.REVISADO, Topico.DOMINADO]
            )
            topico.save()

        # Sessoes espalhadas pelos ultimos 20 dias (Ingles fica de fora, para
        # aparecer no bloco "matérias paradas").
        estudaveis = [t for t in folhas if t.materia.nome != "Inglês"]
        for dias in range(0, 20):
            for _ in range(aleatorio.randint(0, 2)):
                topico = aleatorio.choice(estudaveis)
                SessaoEstudo.objects.create(
                    topico=topico,
                    inicio=agora - timedelta(days=dias, hours=aleatorio.randint(1, 10)),
                    duracao_min=aleatorio.choice([25, 40, 50, 60, 90]),
                    nota=f"Estudei {topico.nome}.",
                )

        # Revisoes: algumas atrasadas, algumas para hoje, algumas no futuro.
        for topico in aleatorio.sample(folhas, min(8, len(folhas))):
            for atraso in (-3, 0, 2):
                Revisao.objects.get_or_create(
                    topico=topico, data_prevista=hoje + timedelta(days=atraso), feita=False
                )

        # Aulas e compromissos fixos: recorrentes, sem semana.
        fixos = [
            ("aula", "Aula de Matemática", "Matemática", 0, time(19, 0), time(21, 0)),
            ("aula", "Aula de Matemática", "Matemática", 2, time(19, 0), time(21, 0)),
            ("aula", "Aula de Inglês", "Inglês", 3, time(18, 0), time(19, 30)),
            ("outro", "Academia", None, 1, time(7, 0), time(8, 0)),
            ("outro", "Academia", None, 4, time(7, 0), time(8, 0)),
        ]
        for tipo, titulo, materia_nome, dia, inicio, fim in fixos:
            BlocoPlanejado.objects.get_or_create(
                tipo=tipo,
                titulo=titulo,
                materia=Materia.objects.filter(nome=materia_nome).first(),
                semana=None,
                dia_semana=dia,
                hora_inicio=inicio,
                hora_fim=fim,
            )

        # Blocos de estudo pontuais desta semana.
        semana = segunda_da_semana(hoje)
        for dia in range(5):
            materia = aleatorio.choice(list(Materia.objects.all()))
            inicio = 20 + aleatorio.randint(0, 1)
            BlocoPlanejado.objects.get_or_create(
                tipo=BlocoPlanejado.ESTUDO,
                materia=materia,
                semana=semana,
                dia_semana=dia,
                hora_inicio=time(inicio, 0),
                hora_fim=time(inicio + 1, 30),
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Pronto: {Materia.objects.count()} matérias, {Topico.objects.count()} tópicos, "
                f"{SessaoEstudo.objects.count()} sessões, {Revisao.objects.count()} revisões, "
                f"{BlocoPlanejado.objects.filter(semana__isnull=True).count()} blocos fixos, "
                f"{BlocoPlanejado.objects.filter(semana__isnull=False).count()} blocos da semana."
            )
        )
