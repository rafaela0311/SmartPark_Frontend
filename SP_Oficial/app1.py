from collections import Counter
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Memória temporária para armazenar as vagas e o histórico
vagas_db = {
    "vaga-01": {
        "id": "vaga-01",
        "local": "Bloco A - Vaga 01",
        "status": 0,  # 0 = Livre, 1 = Ocupado
        "distancia_cm": None,
        "ultima_atualizacao": datetime.now().isoformat()
    }
}

historico_ocupacao = []


# 1. Verificar disponibilidade da API
@app.route('/api/v1/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()}), 200


# 2. Listar situação atual das vagas
@app.route('/api/v1/spots', methods=['GET'])
def listar_vagas():
    return jsonify(list(vagas_db.values())), 200


# 2.1 Consultar uma vaga específica (previsto no escopo, seção 3.3.2)
@app.route('/api/v1/spots/<spot_id>', methods=['GET'])
def obter_vaga(spot_id):
    vaga = vagas_db.get(spot_id)
    if not vaga:
        return jsonify({"erro": "Vaga não encontrada"}), 404
    return jsonify(vaga), 200


# Endpoint para o ESP32 enviar as leituras.
# - /api/v1/iot/readings  -> rota oficial do escopo (RF04)
# - /api/estacionamento   -> rota que o código atual do ESP32 já usa
@app.route('/api/v1/iot/readings', methods=['POST'])
@app.route('/api/estacionamento', methods=['POST'])
def receber_leitura():
    dados = request.get_json(silent=True)
    if not dados:
        return jsonify({"erro": "Envie um JSON válido"}), 400

    # O ESP32 envia "ocupado" (true/false ou 1/0); também aceitamos "status" (0/1)
    valor = dados.get('ocupado', dados.get('status'))
    if isinstance(valor, bool):
        status = int(valor)
    elif valor in (0, 1):
        status = valor
    else:
        return jsonify({"erro": "Informe 'ocupado' como true/false ou 0/1"}), 400

    # Distância em cm medida pelo HC-SR04 (opcional)
    distancia = dados.get('distancia')
    if distancia is not None:
        try:
            distancia = float(distancia)
        except (TypeError, ValueError):
            return jsonify({"erro": "'distancia' deve ser numérica"}), 400
        # pulseIn() devolve 0 quando o sensor não recebe eco: leitura inconsistente (RNF03)
        if distancia <= 0:
            return jsonify({"erro": "Leitura inconsistente (distância <= 0), ignorada"}), 422

    spot_id = dados.get('spot_id', 'vaga-01')
    local = dados.get('local', 'Bloco A - Vaga 01')
    timestamp_atual = datetime.now().isoformat()

    status_anterior = vagas_db.get(spot_id, {}).get('status')

    # Atualiza o estado atual da vaga (RF06)
    vagas_db[spot_id] = {
        "id": spot_id,
        "local": local,
        "status": status,
        "distancia_cm": distancia,
        "ultima_atualizacao": timestamp_atual
    }

    # Só registra no histórico quando o estado MUDA (RF06/RF09)
    if status != status_anterior:
        historico_ocupacao.append({
            "spot_id": spot_id,
            "status": status,
            "distancia_cm": distancia,
            "timestamp": timestamp_atual
        })

    return jsonify({"mensagem": "Leitura recebida com sucesso!"}), 200


# 3. Obter resumo da ocupação (Dashboard)
@app.route('/api/v1/dashboard/occupancy', methods=['GET'])
def dashboard_occupancy():
    total = len(vagas_db)
    ocupadas = sum(1 for v in vagas_db.values() if v['status'] == 1)
    livres = total - ocupadas
    percentual = (ocupadas / total * 100) if total > 0 else 0

    return jsonify({
        "total_spots": total,
        "occupied_spots": ocupadas,
        "free_spots": livres,
        "occupancy_percentage": round(percentual, 2)
    }), 200


# 4. Dados para totem/painel (RF08: vagas disponíveis E ocupadas)
@app.route('/api/v1/panel/availability', methods=['GET'])
def panel_availability():
    total = len(vagas_db)
    livres = sum(1 for v in vagas_db.values() if v['status'] == 0)
    ocupadas = total - livres

    return jsonify({
        "total_spots": total,
        "total_free": livres,
        "total_occupied": ocupadas,
        "message": "Vagas disponíveis" if livres > 0 else "Estacionamento Lotado",
        "status_code": "GREEN" if livres > 0 else "RED"
    }), 200


# 5. Consultar histórico
@app.route('/api/v1/history/occupancy', methods=['GET'])
def history_occupancy():
    # Retorna os últimos 50 registros do histórico
    return jsonify(historico_ocupacao[-50:]), 200


# 6. Analisar períodos de maior ocupação (RF10)
@app.route('/api/v1/history/analysis', methods=['GET'])
def history_analysis():
    # Conta quantas vezes uma vaga passou a ficar OCUPADA em cada hora do dia
    contagem = Counter(
        datetime.fromisoformat(e['timestamp']).hour
        for e in historico_ocupacao
        if e['status'] == 1
    )

    # Lista com as 24 horas (0 a 23), pronta para virar gráfico no Chart.js
    por_hora = [{"hour": h, "occupancy_events": contagem.get(h, 0)} for h in range(24)]

    pico = contagem.most_common(1)
    hora_pico = pico[0][0] if pico else None

    return jsonify({
        "analysis_summary": "Análise baseada nos registros em memória",
        "total_events_recorded": len(historico_ocupacao),
        "occupancy_by_hour": por_hora,
        "peak_hour": hora_pico,
        "peak_period": f"{hora_pico:02d}:00 - {hora_pico:02d}:59" if hora_pico is not None else None
    }), 200


if __name__ == '__main__':
    # host 0.0.0.0 permite que o ESP32 (na mesma rede Wi-Fi) acesse o servidor.
    # debug=True reinicia o servidor a cada alteração no arquivo e apaga a memória;
    # use debug=False durante os testes de integração.
    app.run(host='0.0.0.0', port=5000, debug=False)


# Abrir terminal e rodar o comando: pip install flask flask-cors
# Depois rodar o comando: python app.py
# O Flask mostra no terminal o IP da rede (ex: http://192.168.1.15:5000):
# coloque esse IP na variável serverUrl do código do ESP32.
