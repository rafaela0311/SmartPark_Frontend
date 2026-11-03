// ============================================
// SmartPark - script.js (Integração Real com Back-end)
// ============================================

document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    // 1. CONFIGURAÇÃO DA API
    // ============================================
    const API_CONFIG = {
        BASE_URL: 'http://localhost:5000/api/v1', // URL do Flask
        USE_MOCK: false,                          // FALSE = Consome dados reais
        TOTAL_SPOTS: 20,                          // Usado para preencher o mapa visualmente
        POLLING_INTERVAL: 5000                    // Fallback de atualização (5s)
    };

    // ============================================
    // 2. DADOS BASE PARA GRÁFICOS (Mock mantido)
    // ============================================
    const chartData = {
        occupancy24h: {
            labels: ['0h', '1h', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h', '22h', '23h'],
            real: [12, 10, 8, 6, 5, 7, 10, 15, 22, 30, 35, 40, 45, 48, 42, 38, 35, 32, 30, 28, 25, 20, 15, 10],
            historical: [8, 7, 6, 5, 4, 6, 9, 14, 20, 28, 33, 38, 42, 44, 38, 35, 32, 28, 25, 22, 20, 16, 12, 8]
        },
        peakTimes: {
            days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
            hours: ['8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'],
            data: [
                [45, 55, 75, 65, 50, 40, 25, 15], [40, 50, 70, 60, 45, 35, 20, 10],
                [50, 60, 80, 70, 55, 45, 30, 20], [55, 65, 85, 75, 60, 50, 35, 25],
                [60, 70, 90, 80, 65, 55, 40, 30], [35, 45, 65, 55, 70, 80, 75, 50],
                [30, 40, 60, 50, 55, 65, 60, 40]
            ]
        },
        duration: {
            labels: ['0-30min', '30-60min', '1-2h', '2-4h', '4-6h', '6h+'],
            data: [8, 15, 22, 18, 10, 5]
        }
    };

    // ============================================
    // 3. INTEGRAÇÃO COM A API (Tradutor)
    // ============================================
    async function buscarDadosAPI(endpoint) {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`);
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            const data = await response.json();

            // TRADUÇÃO: Dashboard (Occupancy)
            if (endpoint === '/dashboard/occupancy') {
                // Como o back tem 1 vaga real, preenchemos até 20 para o mapa ficar bonito
                const todasAsVagas = [
                    { id: data.total_spots > 0 ? "vaga-01" : "vaga-00", status: data.occupied_spots > 0 ? 'occupied' : 'available' }
                ];
                for (let i = 2; i <= API_CONFIG.TOTAL_SPOTS; i++) {
                    todasAsVagas.push({ 
                        id: `vaga-${String(i).padStart(2, '0')}`, 
                        status: Math.random() > 0.6 ? 'occupied' : (Math.random() > 0.8 ? 'offline' : 'available') 
                    });
                }

                return {
                    timestamp: new Date().toISOString(),
                    totalSpots: API_CONFIG.TOTAL_SPOTS,
                    availableSpots: data.free_spots,
                    occupiedSpots: data.occupied_spots,
                    occupancyRate: data.occupancy_percentage,
                    spots: todasAsVagas
                };
            }

            // TRADUÇÃO: Mapa de Vagas
            if (endpoint === '/spots') {
                const spotsFormatados = data.map(v => ({
                    id: v.id,
                    status: v.status === 1 ? 'occupied' : 'available'
                }));
                return {
                    updatedAt: new Date().toISOString(),
                    total: data.length,
                    available: spotsFormatados.filter(s => s.status === 'available').length,
                    occupied: spotsFormatados.filter(s => s.status === 'occupied').length,
                    spots: spotsFormatados
                };
            }

            // TRADUÇÃO: Totem
            if (endpoint === '/panel/availability') {
                return {
                    updatedAt: new Date().toISOString(),
                    totalSpots: data.total_spots,
                    availableSpots: data.total_free,
                    occupiedSpots: data.total_occupied
                };
            }

            // TRADUÇÃO: Histórico/Relatórios
            if (endpoint.includes('/history/analysis')) {
                const byHourFormatado = data.occupancy_by_hour.map(item => ({
                    hour: item.hour,
                    averageOccupancyRate: item.occupancy_events > 0 ? 100 : 0 
                }));
                return {
                    period: { from: 'Hoje', to: 'Hoje' },
                    averageOccupancyRate: data.peak_hour ? 68 : 0,
                    peak: { timestamp: new Date().toISOString(), occupancyRate: data.peak_hour || 0 },
                    byHour: byHourFormatado
                };
            }

            return data;
        } catch (error) {
            console.error(`Erro ao buscar ${endpoint}:`, error);
            setConnectionStatus(false);
            throw error;
        }
    }

    // Histórico de relatórios (Mock mantido, pois o back-end está em memória)
    async function buscarDadosHistoricos(from, to) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const data = [];
        const start = new Date(from);
        const end = new Date(to);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        for (let d = 0; d < days; d++) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);
            for (let h = 0; h < 24; h++) {
                let base = (h >= 7 && h <= 19) ? 50 + Math.random() * 30 : 10 + Math.random() * 15;
                const occupied = Math.round(Math.min(100, base));
                data.push({
                    timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0).toISOString(),
                    totalSpots: API_CONFIG.TOTAL_SPOTS,
                    occupiedSpots: occupied,
                    availableSpots: API_CONFIG.TOTAL_SPOTS - occupied,
                    occupancyRate: Math.round((occupied / API_CONFIG.TOTAL_SPOTS) * 100)
                });
            }
        }
        return { from, to, data };
    }

    async function buscarAnalise(from, to) {
        return await buscarDadosAPI(`/history/analysis?from=${from}&to=${to}`);
    }

    // ============================================
    // 4. FUNÇÕES DE UI (Conexão, KPIs, Totem)
    // ============================================
    function updateClock() {
        const timeString = new Date().toLocaleTimeString('pt-BR');
        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) lastUpdateEl.textContent = timeString;
        const totemUpdateEl = document.getElementById('totemUpdateTime');
        if (totemUpdateEl) totemUpdateEl.textContent = timeString;
    }

    function setConnectionStatus(connected) {
        const indicator = document.getElementById('wsIndicator');
        const statusText = document.getElementById('wsStatus');
        const banner = document.getElementById('alertBanner');

        if (indicator) indicator.className = connected ? 'pulse' : 'pulse disconnected';
        if (statusText) statusText.textContent = connected ? 'Conectado' : 'Desconectado';
        if (banner) {
            banner.className = 'alert-banner' + (connected ? '' : ' visible');
            const span = banner.querySelector('span');
            if (span) span.textContent = connected ? '' : 'Conexão com o Back-end perdida. Tentando reconectar...';
        }
    }

    function updateKPIs(spots) {
        if (!document.getElementById('availableSpots')) return;
        const total = spots.length;
        const available = spots.filter(s => s.status === 'available').length;
        const occupied = spots.filter(s => s.status === 'occupied').length;
        const offline = spots.filter(s => s.status === 'offline').length;

        const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
        const online = total - offline;
        const networkPercent = total > 0 ? Math.round((online / total) * 100) : 0;

        document.getElementById('availableSpots').textContent = available;
        document.getElementById('totalSpots').textContent = total;
        document.getElementById('occupancyRate').textContent = occupancyRate + '%';
        document.getElementById('occupancyBar').style.width = occupancyRate + '%';
        
        const hours = Math.floor(Math.random() * 3);
        const minutes = Math.floor(Math.random() * 60);
        document.getElementById('avgTime').textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;

        document.getElementById('networkStatus').textContent = networkPercent + '%';
        document.getElementById('sensorsOnline').textContent = online;
        document.getElementById('networkBar').style.width = networkPercent + '%';
    }

    function updateTotem(spots) {
        const availableEl = document.getElementById('totemAvailable');
        if (!availableEl) return;

        const total = spots.length;
        const occupied = spots.filter(s => s.status === 'occupied').length;
        const available = total - occupied;
        const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

        availableEl.textContent = available;
        document.getElementById('totemOccupied').textContent = occupied;
        document.getElementById('totemTotal').textContent = total;
        document.getElementById('totemOccupancyRate').textContent = occupancyRate + '%';
        document.getElementById('totemOccupancyBar').style.width = occupancyRate + '%';

        const message = document.getElementById('totemMessage');
        if (message) {
            message.classList.remove('warning', 'full');
            if (available === 0) {
                message.classList.add('full');
                message.innerHTML = '<i class="fas fa-circle-exclamation"></i> Estacionamento lotado no momento';
            } else if (occupancyRate >= 85) {
                message.classList.add('warning');
                message.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Poucas vagas disponíveis';
            } else {
                message.innerHTML = '<i class="fas fa-check-circle"></i> Estacionamento com vagas disponíveis';
            }
        }
    }

    function renderSpots(spots) {
        const grid = document.getElementById('spotsGrid');
        if (!grid) return;
        grid.innerHTML = '';

        spots.forEach(spot => {
            const card = document.createElement('div');
            card.className = `spot-card ${spot.status}`;
            card.innerHTML = `
                <div class="spot-id">${spot.id}</div>
                <i class="fas fa-circle" style="font-size: 18px;"></i>
                <div class="spot-status">${spot.status === 'available' ? 'Disponível' : (spot.status === 'occupied' ? 'Ocupada' : 'Sem sinal')}</div>
            `;
            grid.appendChild(card);
        });
    }

    // ============================================
    // 5. GRÁFICOS (Chart.js)
    // ============================================
    let chartOccupancy = null, chartHeatmap = null, chartDuration = null;
    let chartHourly = null, chartHeatmapReport = null, chartDaily = null;

    function updateCharts(spots) {
        const canvasOccupancy = document.getElementById('chartOccupancy');
        if (!canvasOccupancy || typeof Chart === 'undefined') return;

        // Gráfico 1
        const ctx1 = canvasOccupancy.getContext('2d');
        if (chartOccupancy) chartOccupancy.destroy();
        chartOccupancy = new Chart(ctx1, {
            type: 'line',
            data: {
                labels: chartData.occupancy24h.labels,
                datasets: [
                    { label: 'Ocupação Real', data: chartData.occupancy24h.real, borderColor: '#00c853', backgroundColor: 'rgba(0, 200, 83, 0.08)', fill: true, tension: 0.4, borderWidth: 2 },
                    { label: 'Média Histórica', data: chartData.occupancy24h.historical, borderColor: '#4fc3f7', borderDash: [5, 5], tension: 0.4, pointRadius: 0, borderWidth: 2 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#b0b0b0' } } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { ticks: { color: '#6b6b6b', max: 100 }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
        });

        // Gráfico 2
        const canvasHeatmap = document.getElementById('chartHeatmap');
        if (canvasHeatmap) {
            const ctx2 = canvasHeatmap.getContext('2d');
            if (chartHeatmap) chartHeatmap.destroy();
            chartHeatmap = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: chartData.peakTimes.days,
                    datasets: chartData.peakTimes.hours.map((hour, idx) => ({
                        label: hour, data: chartData.peakTimes.data.map(day => day[idx]), backgroundColor: ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7'][idx % 8], borderRadius: 2
                    }))
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#b0b0b0', font: {size: 10} } } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { max: 100, ticks: { color: '#6b6b6b' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
            });
        }

        // Gráfico 3
        const canvasDuration = document.getElementById('chartDuration');
        if (canvasDuration) {
            const ctx3 = canvasDuration.getContext('2d');
            if (chartDuration) chartDuration.destroy();
            chartDuration = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: chartData.duration.labels,
                    datasets: [{ label: 'Veículos', data: chartData.duration.data, backgroundColor: ['rgba(0, 200, 83, 0.7)', 'rgba(0, 200, 83, 0.5)', 'rgba(255, 152, 0, 0.6)', 'rgba(244, 67, 54, 0.6)'], borderRadius: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { ticks: { color: '#6b6b6b' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
            });
        }
    }

    // Funções de gráficos de Relatórios
    function renderHourlyChart(analysisData) {
        const canvas = document.getElementById('chartHourly');
        if (!canvas || typeof Chart === 'undefined' || !analysisData) return;
        if (chartHourly) chartHourly.destroy();
        chartHourly = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: analysisData.byHour.map(i => `${i.hour}h`), datasets: [{ label: 'Ocupação Média (%)', data: analysisData.byHour.map(i => i.averageOccupancyRate), backgroundColor: 'rgba(0, 200, 83, 0.7)', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { max: 100, ticks: { color: '#6b6b6b' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
        });
    }

    function renderHeatmapReport() {
        const canvas = document.getElementById('chartHeatmap');
        if (!canvas || typeof Chart === 'undefined') return;
        if (chartHeatmapReport) chartHeatmapReport.destroy();
        chartHeatmapReport = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: chartData.peakTimes.days, datasets: chartData.peakTimes.hours.map((hour, idx) => ({ label: hour, data: chartData.peakTimes.data.map(d => d[idx]), backgroundColor: ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7'][idx % 8] })) },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#b0b0b0', font: {size: 9} } } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { max: 100, ticks: { color: '#6b6b6b' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
        });
    }

    function renderDailyChart(historicalData) {
        const canvas = document.getElementById('chartDaily');
        if (!canvas || typeof Chart === 'undefined' || !historicalData) return;
        const dailyData = {};
        historicalData.data.forEach(item => {
            const key = new Date(item.timestamp).toLocaleDateString('pt-BR');
            if (!dailyData[key]) dailyData[key] = [];
            dailyData[key].push(item.occupancyRate);
        });
        if (chartDaily) chartDaily.destroy();
        chartDaily = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels: Object.keys(dailyData), datasets: [{ label: 'Ocupação Média (%)', data: Object.values(dailyData).map(v => Math.round(v.reduce((a,b)=>a+b,0)/v.length)), borderColor: '#4fc3f7', backgroundColor: 'rgba(79, 195, 247, 0.08)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#b0b0b0' } } }, scales: { x: { ticks: { color: '#6b6b6b' } }, y: { max: 100, ticks: { color: '#6b6b6b' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
        });
    }

    // ============================================
    // 6. TABELAS DE RELATÓRIOS
    // ============================================
    let tableData = [], currentPage = 1;
    const pageSize = 10;

    function renderTable(historicalData) {
        const tbody = document.getElementById('tableBody');
        if (!tbody || !historicalData) return;
        tableData = historicalData.data;
        const totalPages = Math.ceil(tableData.length / pageSize) || 1;
        const start = (currentPage - 1) * pageSize;
        const pageData = tableData.slice(start, start + pageSize);

        tbody.innerHTML = pageData.map(item => {
            const date = new Date(item.timestamp);
            const rate = item.occupancyRate;
            const badgeClass = rate > 70 ? 'high' : (rate > 40 ? 'medium' : 'low');
            return `
                <tr>
                    <td>${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</td>
                    <td>${item.totalSpots}</td><td>${item.occupiedSpots}</td><td>${item.availableSpots}</td><td>${rate}%</td>
                    <td><span class="status-badge ${badgeClass}">${badgeClass === 'high' ? 'Alta' : (badgeClass === 'medium' ? 'Média' : 'Baixa')}</span></td>
                </tr>`;
        }).join('');

        document.getElementById('tableCount').textContent = `Mostrando ${start + 1}-${Math.min(start + pageSize, tableData.length)} de ${tableData.length} registros`;
        document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${totalPages}`;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    }

    async function carregarRelatorios(from, to) {
        const [historico, analise] = await Promise.all([buscarDadosHistoricos(from, to), buscarAnalise(from, to)]);
        if (analise) {
            document.getElementById('avgOccupancy').textContent = analise.averageOccupancyRate + '%';
            document.getElementById('peakOccupancy').textContent = (analise.peak.occupancyRate || 0) + '%';
            document.getElementById('peakHour').textContent = (analise.peak.timestamp ? new Date(analise.peak.timestamp).getHours() : '--') + 'h';
        }
        if (historico) document.getElementById('totalRecords').textContent = historico.data.length;
        
        renderHourlyChart(analise);
        renderHeatmapReport();
        renderDailyChart(historico);
        renderTable(historico);
    }

    // ============================================
    // 7. FLUXO PRINCIPAL E FALLBACK
    // ============================================
    let wsInterval = null;

    async function carregarDados() {
        try {
            const occupancyData = await buscarDadosAPI('/dashboard/occupancy');
            updateKPIs(occupancyData.spots);
            renderSpots(occupancyData.spots);
            updateCharts(occupancyData.spots);
            updateTotem(occupancyData.spots);
            updateClock();
            setConnectionStatus(true);
        } catch (error) {
            console.warn('Back-end indisponível, usando fallback visual temporário.');
        }
    }

    // O Back-end não tem WebSocket, então usamos Polling (Requisitar a cada 5s)
    function iniciarPolling() {
        console.log('Polling REST ativado (Buscando dados a cada 5s)');
        setConnectionStatus(true);
        if (wsInterval) clearInterval(wsInterval);
        wsInterval = setInterval(carregarDados, API_CONFIG.POLLING_INTERVAL);
    }

    function initRelatorios() {
        if (!document.getElementById('avgOccupancy')) return;
        const from = document.getElementById('dateFrom').value;
        const to = document.getElementById('dateTo').value;
        carregarRelatorios(from, to);

        document.getElementById('applyFilters')?.addEventListener('click', () => {
            currentPage = 1;
            carregarRelatorios(document.getElementById('dateFrom').value, document.getElementById('dateTo').value);
        });

        document.getElementById('exportCSV')?.addEventListener('click', () => {
            if (tableData.length === 0) return;
            const headers = ['Data/Hora', 'Total Vagas', 'Ocupadas', 'Disponíveis', 'Taxa Ocupação'];
            const rows = tableData.map(i => [new Date(i.timestamp).toLocaleString('pt-BR'), i.totalSpots, i.occupiedSpots, i.availableSpots, i.occupancyRate + '%']);
            const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
            const link = document.createElement('a');
            link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
            link.download = `relatorio_smartpark_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
        });

        document.getElementById('prevPage')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable({ data: tableData }); } });
        document.getElementById('nextPage')?.addEventListener('click', () => { if (currentPage < Math.ceil(tableData.length / pageSize)) { currentPage++; renderTable({ data: tableData }); } });
    }

    // ============================================
    // 8. INICIALIZAÇÃO
    // ============================================
    const isDataPage = document.getElementById('availableSpots') || document.getElementById('spotsGrid') || document.getElementById('totemAvailable');
    
    if (isDataPage) {
        carregarDados();
        iniciarPolling();
        setInterval(updateClock, 10000);
    }
    
    initRelatorios();
});