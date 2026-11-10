# Importa a classe Counter do módulo collections para contar ocorrências de elementos facilmente
from collections import Counter
# Importa o módulo datetime para manipulação de datas e horários
from datetime import datetime

# Importa o framework Flask e ferramentas essenciais para criar APIs JSON e lidar com requisições HTTP
from flask import Flask, jsonify, request
# Importa o CORS para permitir que o front-end (JavaScript) acesse esta API sem bloqueios de segurança
from flask_cors import CORS

# Inicializa a aplicação Flask usando o nome do arquivo atual
app = Flask(__name__)
# Aplica o CORS na aplicação para liberar requisições de diferentes origens/portas
CORS(app)

# Dicionário em memória que simula um banco de dados para armazenar as vagas e seus estados
vagas_db = {
    "vaga-01": {
        "id": "vaga-01",
        "local": "Bloco A - Vaga 01",
        "status": 0,  # 0 = Livre, 1 = Ocupado
        "distancia_cm": None,  # Distância medida pelo sensor (inicialmente vazia)
        "ultima_atualizacao": datetime.now().isoformat()  # Data e hora atual no formato ISO
    }
}

# Lista vazia que armazenará o histórico de mudanças de ocupação para relatórios e análises
historico_ocupacao = []


# Rota 1: Verifica se a API está online e funcionando (Health Check)
@app.route('/api/v1/health', methods=['GET'])
def health_check():
    # Retorna um JSON informando o status "ok" e a data/hora atual, com código HTTP 200 (Sucesso)
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()}), 200


# Rota 2: Lista a situação atual de todas as vagas cadastradas
@app.route('/api/v1/spots', methods=['GET'])
def listar_vagas():
    # Retorna uma lista com os valores de todas as vagas armazenadas no dicionário 'vagas_db'
    return jsonify(list(vagas_db.values())), 200


# Rota 2.1: Consulta os detalhes de uma vaga específica com base no seu ID passado na URL
@app.route('/api/v1/spots/<spot_id>', methods=['GET'])
def obter_vaga(spot_id):
    # Busca a vaga no dicionário pelo ID fornecido
    vaga = vagas_db.get(spot_id)
    # Se a vaga não existir, retorna um erro 404 (Não encontrado)
    if not vaga:
        return jsonify({"erro": "Vaga não encontrada"}), 404
    # Se encontrar, retorna os dados da vaga com status HTTP 200
    return jsonify(vaga), 200


# Endpoint duplo para receber leituras do ESP32 (sensor de vaga)
# - /api/v1/iot/readings -> rota oficial do escopo do projeto
# - /api/estacionamento  -> rota alternativa já utilizada pelo código legado do ESP32
@app.route('/api/v1/iot/readings', methods=['POST'])
@app.route('/api/estacionamento', methods=['POST'])
def receber_leitura():
    # Extrai os dados enviados em formato JSON na requisição (silencia erros se o JSON for inválido)
    dados = request.get_json(silent=True)
    # Se não houver dados ou o JSON for inválido, retorna erro HTTP 400 (Requisição inválida)
    if not dados:
        return jsonify({"erro": "Envie um JSON válido"}), 400

    # O ESP32 pode enviar "ocupado" (booleano ou número) ou "status"
    valor = dados.get('ocupado', dados.get('status'))
    # Converte booleano (True/False) para inteiro (1/0)
    if isinstance(valor, bool):
        status = int(valor)
    # Aceita diretamente se for 0 ou 1
    elif valor in (0, 1):
        status = valor
    else:
        # Retorna erro se o formato do status enviado for incorreto
        return jsonify({"erro": "Informe 'ocupado' como true/false ou 0/1"}), 400

    # Lê a distância em centímetros enviada pelo sensor ultrassônico HC-SR04 (opcional)
    distancia = dados.get('distancia')
    if distancia is not None:
        try:
            # Tenta converter o valor da distância para número decimal (float)
            distancia = float(distancia)
        except (TypeError, ValueError):
            # Se falhar na conversão, retorna erro HTTP 400
            return jsonify({"erro": "'distancia' deve ser numérica"}), 400
        
        # Validação: leituras menores ou iguais a 0 indicam falha no eco do sensor (inconsistentes)
        if distancia <= 0:
            return jsonify({"erro": "Leitura inconsistente (distância <= 0), ignorada"}), 422

    # Define o ID da vaga e o local padrão caso não venham preenchidos no JSON
    spot_id = dados.get('spot_id', 'vaga-01')
    local = dados.get('local', 'Bloco A - Vaga 01')
    timestamp_atual = datetime.now().isoformat()

    # Guarda o status anterior da vaga para comparar se houve mudança depois
    status_anterior = vagas_db.get(spot_id, {}).get('status')

    # Atualiza ou cria o registro da vaga no banco de dados em memória
    vagas_db[spot_id] = {
        "id": spot_id,
        "local": local,
        "status": status,
        "distancia_cm": distancia,
        "ultima_atualizacao": timestamp_atual
    }

    # Registra no histórico somente se o status atual for diferente do status anterior
    if status != status_anterior:
        historico_ocupacao.append({
            "spot_id": spot_id,
            "status": status,
            "distancia_cm": distancia,
            "timestamp": timestamp_atual
        })

    # Retorna mensagem de sucesso com código HTTP 200
    return jsonify({"mensagem": "Leitura recebida com sucesso!"}), 200


# Rota 3: Retorna um resumo estatístico da ocupação atual para uso no Dashboard
@app.route('/api/v1/dashboard/occupancy', methods=['GET'])
def dashboard_occupancy():
    total = len(vagas_db)  # Conta o total de vagas cadastradas
    ocupadas = sum(1 for v in vagas_db.values() if v['status'] == 1)  # Conta quantas estão ocupadas (status 1)
    livres = total - ocupadas  # Calcula as vagas livres
    # Calcula o percentual de ocupação (evitando divisão por zero)
    percentual = (ocupadas / total * 100) if total > 0 else 0

    # Retorna os dados resumidos em formato JSON
    return jsonify({
        "total_spots": total,
        "occupied_spots": ocupadas,
        "free_spots": livres,
        "occupancy_percentage": round(percentual, 2)
    }), 200


# Rota 4: Fornece dados formatados para totens ou painéis físicos de entrada do estacionamento
@app.route('/api/v1/panel/availability', methods=['GET'])
def panel_availability():
    total = len(vagas_db)
    livres = sum(1 for v in vagas_db.values() if v['status'] == 0)  # Conta quantas estão livres (status 0)
    ocupadas = total - livres

    # Retorna informações detalhadas para o painel, incluindo mensagens de texto e cores (Verde ou Vermelho)
    return jsonify({
        "total_spots": total,
        "total_free": livres,
        "total_occupied": ocupadas,
        "message": "Vagas disponíveis" if livres > 0 else "Estacionamento Lotado",
        "status_code": "GREEN" if livres > 0 else "RED"
    }), 200


# Rota 5: Consulta o histórico de eventos de ocupação armazenados
@app.route('/api/v1/history/occupancy', methods=['GET'])
def history_occupancy():
    # Retorna apenas os últimos 50 registros do histórico para evitar sobrecarga de dados
    return jsonify(historico_ocupacao[-50:]), 200


# Rota 6: Analisa os períodos de maior pico de ocupação com base no histórico
@app.route('/api/v1/history/analysis', methods=['GET'])
def history_analysis():
    # Conta quantas vezes uma vaga passou a ficar OCUPADA (status == 1) em cada hora do dia (0 a 23)
    contagem = Counter(
        datetime.fromisoformat(e['timestamp']).hour
        for e in historico_ocupacao
        if e['status'] == 1
    )

    # Cria uma lista iterando pelas 24 horas do dia para facilitar a construção de gráficos (como Chart.js)
    por_hora = [{"hour": h, "occupancy_events": contagem.get(h, 0)} for h in range(24)]

    # Descobre qual foi a hora com maior pico de eventos registrados
    pico = contagem.most_common(1)
    hora_pico = pico[0][0] if pico else None

    # Retorna o relatório completo de análise estatística
    return jsonify({
        "analysis_summary": "Análise baseada nos registros em memória",
        "total_events_recorded": len(historico_ocupacao),
        "occupancy_by_hour": por_hora,
        "peak_hour": hora_pico,
        "peak_period": f"{hora_pico:02d}:00 - {hora_pico:02d}:59" if hora_pico is not None else None
    }), 200

# Bloco de execução principal da aplicação Flask
if __name__ == '__main__':
    # host='0.0.0.0' permite que dispositivos externos (como o ESP32 na mesma rede Wi-Fi) acessem o servidor.
    # debug=False evita reiniciar o servidor automaticamente e apagar a memória em testes.
    app.run(host='0.0.0.0', port=5000, debug=False)

# Instruções rápidas para rodar:
# 1. Abra o terminal e instale as dependências: pip install flask flask-cors
# 2. Execute o servidor: python app.py
# 3. O terminal exibirá o IP da rede (ex: http://192.168.1.15:5000); coloque esse IP no código do ESP32.
