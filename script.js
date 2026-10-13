

document.addEventListener('DOMContentLoaded', function () {

    // ============================================
    // 1. CONFIGURAÇÃO DA API
    // ============================================

    const API_CONFIG = {
        BASE_URL: 'http://localhost:3000/api/v1',
        USE_MOCK: true,
        TIMEOUT: 5000,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 2000,
    };

    // ============================================
    // 2. DADOS MOCKADOS PARA DEMONSTRAÇÃO
    // ============================================

    const spotsData = [
        { id: 'A-01', status: 'available' },
        { id: 'A-02', status: 'occupied' },
        { id: 'A-03', status: 'available' },
        { id: 'A-04', status: 'occupied' },
        { id: 'A-05', status: 'offline' },
        { id: 'B-01', status: 'available' },
        { id: 'B-02', status: 'occupied' },
        { id: 'B-03', status: 'available' },
        { id: 'B-04', status: 'occupied' },
        { id: 'B-05', status: 'available' },
        { id: 'C-01', status: 'occupied' },
        { id: 'C-02', status: 'occupied' },
        { id: 'C-03', status: 'available' },
        { id: 'C-04', status: 'available' },
        { id: 'C-05', status: 'occupied' },
        { id: 'D-01', status: 'available' },
        { id: 'D-02', status: 'occupied' },
        { id: 'D-03', status: 'available' },
        { id: 'D-04', status: 'occupied' },
        { id: 'D-05', status: 'available' }
    ];

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
                [45, 55, 75, 65, 50, 40, 25, 15],
                [40, 50, 70, 60, 45, 35, 20, 10],
                [50, 60, 80, 70, 55, 45, 30, 20],
                [55, 65, 85, 75, 60, 50, 35, 25],
                [60, 70, 90, 80, 65, 55, 40, 30],
                [35, 45, 65, 55, 70, 80, 75, 50],
                [30, 40, 60, 50, 55, 65, 60, 40]
            ]
        },
        duration: {
            labels: ['0-30min', '30-60min', '1-2h', '2-4h', '4-6h', '6h+'],
            data: [8, 15, 22, 18, 10, 5]
        }
    };

    // ============================================
    // 3. FUNÇÃO DE FETCH COM RETRY E TIMEOUT
    // ============================================

    async function apiFetch(endpoint, options = {}) {
        const url = `${API_CONFIG.BASE_URL}${endpoint}`;

        if (API_CONFIG.USE_MOCK) {
            return buscarDadosMock(endpoint);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw {
                    status: response.status,
                    statusText: response.statusText,
                    data: errorData,
                };
            }

            return await response.json();

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw { status: 408, statusText: 'Timeout', message: 'Tempo limite excedido' };
            }

            throw error;
        }
    }

    async function apiFetchWithRetry(endpoint, options = {}, attempts = 0) {
        try {
            return await apiFetch(endpoint, options);
        } catch (error) {
            if (attempts < API_CONFIG.RETRY_ATTEMPTS) {
                console.warn(`Tentativa ${attempts + 1} falhou. Tentando novamente...`);
                await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY));
                return apiFetchWithRetry(endpoint, options, attempts + 1);
            }
            throw error;
        }
    }

    async function buscarDadosMock(endpoint) {
        await new Promise(resolve => setTimeout(resolve, 300));

        const total = spotsData.length;
        const occupied = spotsData.filter(s => s.status === 'occupied').length;
        const available = total - occupied;

        if (endpoint === '/dashboard/occupancy') {
            return {
                timestamp: new Date().toISOString(),
                totalSpots: total,
                availableSpots: available,
                occupiedSpots: occupied,
                occupancyRate: Math.round((occupied / total) * 100),
                spots: spotsData,
            };
        }

        if (endpoint === '/spots') {
            return {
                updatedAt: new Date().toISOString(),
                total: total,
                available: available,
                occupied: occupied,
                spots: spotsData,
            };
        }

        if (endpoint === '/panel/availability') {
            return {
                updatedAt: new Date().toISOString(),
                totalSpots: total,
                availableSpots: available,
                occupiedSpots: occupied,
            };
        }

        if (endpoint === '/history/analysis') {
            return {
                period: { from: '2026-08-01', to: '2026-08-25' },
                averageOccupancyRate: 68.4,
                peak: {
                    timestamp: '2026-08-15T13:00:00Z',
                    occupancyRate: 94.0,
                    occupiedSpots: 19,
                },
                byHour: chartData.occupancy24h.labels.map((hour, index) => ({
                    hour: parseInt(hour),
                    averageOccupancyRate: chartData.occupancy24h.real[index],
                })),
            };
        }

        throw new Error(`Endpoint não reconhecido: ${endpoint}`);
    }

    // ============================================
    // 4. FUNÇÃO PARA GERAR DADOS HISTÓRICOS
    // ============================================

    function generateHistoricalData(from, to) {
        const data = [];
        const start = new Date(from);
        const end = new Date(to);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

        for (let d = 0; d < days; d++) {
            const date = new Date(start);
            date.setDate(date.getDate() + d);

            for (let h = 0; h < 24; h++) {
                let base = 20;
                if (h >= 7 && h <= 9) base = 50 + Math.random() * 30;
                else if (h >= 11 && h <= 14) base = 60 + Math.random() * 30;
                else if (h >= 17 && h <= 19) base = 55 + Math.random() * 30;
                else if (h >= 22 || h <= 5) base = 5 + Math.random() * 15;
                else base = 20 + Math.random() * 30;

                const occupied = Math.round(Math.min(100, Math.max(0, base)));
                const total = 20;
                const available = total - occupied;

                data.push({
                    timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0).toISOString(),
                    totalSpots: total,
                    occupiedSpots: occupied,
                    availableSpots: available,
                    occupancyRate: Math.round((occupied / total) * 100)
                });
            }
        }
        return data;
    }

    async function buscarDadosHistoricos(from, to) {
        try {
            if (API_CONFIG.USE_MOCK) {
                await new Promise(resolve => setTimeout(resolve, 500));
                const data = generateHistoricalData(from, to);
                return { from, to, data };
            }
            const data = await apiFetchWithRetry(`/history/occupancy?from=${from}&to=${to}`);
            return data;
        } catch (error) {
            console.error('Erro ao buscar dados históricos:', error);
            showToast({
                title: 'Erro',
                message: 'Não foi possível carregar o histórico de ocupação.',
                type: 'error',
                duration: 4000
            });
            return null;
        }
    }

    async function buscarAnalise(from, to) {
        try {
            if (API_CONFIG.USE_MOCK) {
                await new Promise(resolve => setTimeout(resolve, 300));

                const byHour = [];
                for (let h = 0; h < 24; h++) {
                    let avg = 20;
                    if (h >= 7 && h <= 9) avg = 60 + Math.random() * 20;
                    else if (h >= 11 && h <= 14) avg = 70 + Math.random() * 20;
                    else if (h >= 17 && h <= 19) avg = 65 + Math.random() * 20;
                    else if (h >= 22 || h <= 5) avg = 8 + Math.random() * 10;
                    else avg = 25 + Math.random() * 20;
                    byHour.push({ hour: h, averageOccupancyRate: Math.round(avg) });
                }

                const peak = byHour.reduce((max, item) =>
                    item.averageOccupancyRate > max.averageOccupancyRate ? item : max
                );

                const daysOfWeek = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
                const heatmapData = daysOfWeek.map((_, idx) => {
                    const hours = [];
                    for (let h = 0; h < 24; h++) {
                        let base = 20;
                        const isWeekend = idx >= 5;
                        if (h >= 7 && h <= 9) base = isWeekend ? 40 + Math.random() * 20 : 60 + Math.random() * 25;
                        else if (h >= 11 && h <= 14) base = isWeekend ? 50 + Math.random() * 20 : 70 + Math.random() * 20;
                        else if (h >= 17 && h <= 19) base = isWeekend ? 55 + Math.random() * 20 : 65 + Math.random() * 20;
                        else if (h >= 22 || h <= 5) base = 5 + Math.random() * 15;
                        else base = 20 + Math.random() * 25;
                        hours.push(Math.round(Math.min(100, base)));
                    }
                    return hours;
                });

                return {
                    period: { from, to },
                    averageOccupancyRate: Math.round(byHour.reduce((sum, h) => sum + h.averageOccupancyRate, 0) / 24),
                    peak: {
                        timestamp: `${from}T${String(peak.hour).padStart(2, '0')}:00:00Z`,
                        occupancyRate: peak.averageOccupancyRate
                    },
                    byHour: byHour,
                    heatmap: {
                        days: daysOfWeek,
                        hours: Array.from({ length: 24 }, (_, i) => `${i}h`),
                        data: heatmapData
                    }
                };
            }

            const data = await apiFetchWithRetry(`/history/analysis?from=${from}&to=${to}`);
            return data;
        } catch (error) {
            console.error('Erro ao buscar análise:', error);
            showToast({
                title: 'Erro',
                message: 'Não foi possível carregar a análise de dados.',
                type: 'error',
                duration: 4000
            });
            return null;
        }
    }

    // ============================================
    // 5. RELÓGIO
    // ============================================

    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const lastUpdateEl = document.getElementById('lastUpdate');
        if (lastUpdateEl) lastUpdateEl.textContent = timeString;

        const totemUpdateEl = document.getElementById('totemUpdateTime');
        if (totemUpdateEl) totemUpdateEl.textContent = timeString;
    }

    // ============================================
    // 6. BANNER DE ALERTA / STATUS DE CONEXÃO
    // ============================================

    function setConnectionStatus(connected) {
        const indicator = document.getElementById('wsIndicator');
        const statusText = document.getElementById('wsStatus');
        const banner = document.getElementById('alertBanner');

        if (indicator) indicator.className = connected ? 'pulse' : 'pulse disconnected';
        if (statusText) statusText.textContent = connected ? 'Conectado' : 'Desconectado';
        if (banner) {
            banner.className = 'alert-banner' + (connected ? '' : ' visible');
            const span = banner.querySelector('span');
            if (span) {
                span.textContent = connected
                    ? ''
                    : 'Conexão WebSocket perdida. Tentando reconectar...';
            }
        }
    }

    // ============================================
    // 7. KPIs
    // ============================================

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

    // ============================================
    // 8. MAPA DE VAGAS
    // ============================================

    function renderSpots(spots) {
        const grid = document.getElementById('spotsGrid');
        if (!grid) return;

        grid.innerHTML = '';

        spots.forEach(spot => {
            const card = document.createElement('div');
            card.className = `spot-card ${spot.status}`;
            card.dataset.id = spot.id;
            card.dataset.status = spot.status;

            let iconColor = '';
            let statusText = '';

            switch (spot.status) {
                case 'available':
                    statusText = 'Disponível';
                    iconColor = 'var(--color-green)';
                    break;
                case 'occupied':
                    statusText = 'Ocupada';
                    iconColor = 'var(--color-red)';
                    break;
                case 'offline':
                default:
                    statusText = 'Sem sinal';
                    iconColor = 'var(--color-gray)';
                    break;
            }

            card.innerHTML = `
                <div class="spot-id">${spot.id}</div>
                <i class="fas fa-circle" style="color: ${iconColor}; font-size: 18px;"></i>
                <div class="spot-status">${statusText}</div>
            `;

            card.addEventListener('click', function () {
                const currentStatus = this.dataset.status;
                const statusCycle = ['available', 'occupied', 'offline'];
                const nextStatus = statusCycle[(statusCycle.indexOf(currentStatus) + 1) % statusCycle.length];

                const spotIndex = spots.findIndex(s => s.id === spot.id);
                if (spotIndex !== -1) {
                    spots[spotIndex].status = nextStatus;
                    renderSpots(spots);
                    updateKPIs(spots);
                    updateCharts(spots);
                    updateTotem(spots);
                }
            });

            grid.appendChild(card);
        });
    }

    // ============================================
    // 9. GRÁFICOS 
    // ============================================

    let chartOccupancy = null;
    let chartHeatmap = null;
    let chartDuration = null;

    function updateCharts(spots) {
        const canvasOccupancy = document.getElementById('chartOccupancy');
        if (!canvasOccupancy) return;

        if (typeof Chart === 'undefined') {
            console.warn('Chart.js não carregado');
            return;
        }

        try {
            // GRÁFICO 1: OCUPAÇÃO 24H
            const ctx1 = canvasOccupancy.getContext('2d');
            const realData = chartData.occupancy24h.real.map(val => {
                const variation = (Math.random() - 0.5) * 10;
                return Math.max(0, Math.min(100, val + variation));
            });

            if (chartOccupancy) chartOccupancy.destroy();
            chartOccupancy = new Chart(ctx1, {
                type: 'line',
                data: {
                    labels: chartData.occupancy24h.labels,
                    datasets: [
                        {
                            label: 'Ocupação Real',
                            data: realData,
                            borderColor: '#00c853',
                            backgroundColor: 'rgba(0, 200, 83, 0.08)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 2,
                            borderWidth: 2,
                        },
                        {
                            label: 'Média Histórica',
                            data: chartData.occupancy24h.historical,
                            borderColor: '#4fc3f7',
                            backgroundColor: 'rgba(79, 195, 247, 0.05)',
                            fill: false,
                            tension: 0.4,
                            borderDash: [5, 5],
                            pointRadius: 0,
                            borderWidth: 2,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#b0b0b0', font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 15 } },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#b0b0b0',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: 'rgba(255,255,255,0.04)', display: true },
                            ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, maxTicksLimit: 12 }
                        },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)', display: true },
                            ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, max: 100 },
                            title: { display: true, text: 'Ocupação (%)', color: '#6b6b6b', font: { size: 11, family: 'Inter' } }
                        }
                    },
                    interaction: { intersect: false, mode: 'index' },
                }
            });

            // GRÁFICO 2: HEATMAP
            const ctx2 = document.getElementById('chartHeatmap').getContext('2d');
            const colors = ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7'];

            if (chartHeatmap) chartHeatmap.destroy();
            chartHeatmap = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: chartData.peakTimes.days,
                    datasets: chartData.peakTimes.hours.map((hour, idx) => ({
                        label: hour,
                        data: chartData.peakTimes.data.map(day => day[idx]),
                        backgroundColor: colors[idx % colors.length],
                        borderRadius: 2,
                        borderSkipped: false,
                    })),
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#b0b0b0', font: { size: 10, family: 'Inter' }, boxWidth: 10, padding: 10 } },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#b0b0b0',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: { label: (context) => context.dataset.label + ': ' + context.parsed.y + '%' }
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' } } },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, max: 100 },
                            title: { display: true, text: 'Ocupação (%)', color: '#6b6b6b', font: { size: 11, family: 'Inter' } }
                        }
                    },
                    barPercentage: 0.8,
                    categoryPercentage: 0.9,
                }
            });

            // GRÁFICO 3: DISTRIBUIÇÃO POR PERMANÊNCIA
            const ctx3 = document.getElementById('chartDuration').getContext('2d');

            if (chartDuration) chartDuration.destroy();
            chartDuration = new Chart(ctx3, {
                type: 'bar',
                data: {
                    labels: chartData.duration.labels,
                    datasets: [{
                        label: 'Veículos',
                        data: chartData.duration.data.map(val => Math.max(1, val + Math.floor((Math.random() - 0.5) * 8))),
                        backgroundColor: [
                            'rgba(0, 200, 83, 0.7)', 'rgba(0, 200, 83, 0.6)', 'rgba(0, 200, 83, 0.5)',
                            'rgba(255, 152, 0, 0.6)', 'rgba(255, 152, 0, 0.5)', 'rgba(244, 67, 54, 0.6)'
                        ],
                        borderRadius: 4,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#b0b0b0', font: { size: 11, family: 'Inter' }, display: false } },
                        tooltip: {
                            backgroundColor: 'rgba(0,0,0,0.8)',
                            titleColor: '#fff',
                            bodyColor: '#b0b0b0',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                        }
                    },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#6b6b6b', font: { size: 11, family: 'Inter' } } },
                        y: {
                            grid: { color: 'rgba(255,255,255,0.04)' },
                            ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' } },
                            title: { display: true, text: 'Quantidade de Veículos', color: '#6b6b6b', font: { size: 11, family: 'Inter' } },
                            beginAtZero: true,
                        }
                    },
                    barPercentage: 0.7,
                    categoryPercentage: 0.8,
                }
            });
        } catch (error) {
            console.error('Erro ao desenhar os gráficos:', error);
        }
    }

    // ============================================
    // 10. TOTEM
    // ============================================

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

    // ============================================
    // 11. GRÁFICOS DOS RELATÓRIOS
    // ============================================

    let chartHourly = null;
    let chartHeatmapReport = null;
    let chartDaily = null;
    let tableData = [];
    let currentPage = 1;
    const pageSize = 10;

    function renderHourlyChart(analysisData) {
        const canvas = document.getElementById('chartHourly');
        if (!canvas) return;
        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (chartHourly) chartHourly.destroy();

        if (!analysisData || !analysisData.byHour) {
            chartHourly = new Chart(ctx, {
                type: 'bar',
                data: { labels: ['Sem dados'], datasets: [{ label: 'Ocupação', data: [0], backgroundColor: '#555' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        const hours = analysisData.byHour.map(item => `${item.hour}h`);
        const values = analysisData.byHour.map(item => item.averageOccupancyRate);
        const colors = values.map(v =>
            v > 70 ? 'rgba(244, 67, 54, 0.7)' :
            v > 40 ? 'rgba(255, 152, 0, 0.7)' :
            'rgba(0, 200, 83, 0.7)'
        );

        chartHourly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: 'Ocupação Média (%)',
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#b0b0b0',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: { label: (context) => `Ocupação: ${context.parsed.y}%` }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: '#6b6b6b', font: { size: 9, family: 'Inter' }, maxTicksLimit: 12 }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, max: 100 },
                        title: { display: true, text: 'Ocupação (%)', color: '#6b6b6b', font: { size: 11, family: 'Inter' } }
                    }
                }
            }
        });
    }

    function renderHeatmapReport(analysisData) {
        const canvas = document.getElementById('chartHeatmap');
        if (!canvas) return;
        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (chartHeatmapReport) chartHeatmapReport.destroy();

        if (!analysisData || !analysisData.heatmap) {
            chartHeatmapReport = new Chart(ctx, {
                type: 'bar',
                data: { labels: ['Sem dados'], datasets: [{ label: 'Ocupação', data: [0], backgroundColor: '#555' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        const { days, hours, data } = analysisData.heatmap;
        const colorPalette = ['#1b5e20', '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7'];

        const groupedData = data.map(day => {
            const grouped = [];
            for (let i = 0; i < hours.length; i += 2) {
                const avg = (day[i] || 0) + (day[i + 1] || 0) / 2;
                grouped.push(Math.round(avg));
            }
            return grouped;
        });

        const hourLabels = [];
        for (let i = 0; i < hours.length; i += 2) {
            hourLabels.push(`${i}h-${i + 2}h`);
        }

        chartHeatmapReport = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: hourLabels.map((label, idx) => ({
                    label: label,
                    data: groupedData.map(day => day[idx] || 0),
                    backgroundColor: colorPalette[idx % colorPalette.length],
                    borderRadius: 2,
                    borderSkipped: false,
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#b0b0b0',
                            font: { size: 9, family: 'Inter' },
                            boxWidth: 10,
                            padding: 8,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#b0b0b0',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: { label: (context) => context.dataset.label + ': ' + context.parsed.y + '%' }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' } } },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, max: 100 },
                        title: { display: true, text: 'Ocupação (%)', color: '#6b6b6b', font: { size: 11, family: 'Inter' } }
                    }
                },
                barPercentage: 0.8,
                categoryPercentage: 0.9,
            }
        });
    }

    function renderDailyChart(historicalData) {
        const canvas = document.getElementById('chartDaily');
        if (!canvas) return;
        if (typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');
        if (chartDaily) chartDaily.destroy();

        if (!historicalData || !historicalData.data || historicalData.data.length === 0) {
            chartDaily = new Chart(ctx, {
                type: 'line',
                data: { labels: ['Sem dados'], datasets: [{ label: 'Ocupação', data: [0], borderColor: '#555' }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        const dailyData = {};
        historicalData.data.forEach(item => {
            const date = new Date(item.timestamp);
            const key = date.toLocaleDateString('pt-BR');
            if (!dailyData[key]) dailyData[key] = [];
            dailyData[key].push(item.occupancyRate);
        });

        const labels = Object.keys(dailyData);
        const averages = labels.map(key => {
            const values = dailyData[key];
            return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        });

        chartDaily = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ocupação Média Diária (%)',
                    data: averages,
                    borderColor: '#4fc3f7',
                    backgroundColor: 'rgba(79, 195, 247, 0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#4fc3f7',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#b0b0b0',
                            font: { size: 11, family: 'Inter' },
                            boxWidth: 12,
                            padding: 15,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#b0b0b0',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b6b6b', font: { size: 9, family: 'Inter' }, maxTicksLimit: 10 }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b6b6b', font: { size: 10, family: 'Inter' }, max: 100 },
                        title: { display: true, text: 'Ocupação (%)', color: '#6b6b6b', font: { size: 11, family: 'Inter' } }
                    }
                }
            }
        });
    }

    function renderTable(historicalData) {
        const tbody = document.getElementById('tableBody');
        if (!tbody) return;

        if (!historicalData || !historicalData.data || historicalData.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        <i class="fas fa-inbox" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
                        Nenhum dado encontrado para o período selecionado.
                    </td>
                </tr>
            `;
            document.getElementById('tableCount').textContent = 'Mostrando 0 registros';
            return;
        }

        tableData = historicalData.data;
        const totalPages = Math.ceil(tableData.length / pageSize);
        const start = (currentPage - 1) * pageSize;
        const end = Math.min(start + pageSize, tableData.length);
        const pageData = tableData.slice(start, end);

        tbody.innerHTML = pageData.map(item => {
            const date = new Date(item.timestamp);
            const rate = item.occupancyRate;
            let badgeClass = 'low';
            let badgeText = 'Baixa';
            if (rate > 70) { badgeClass = 'high';
                badgeText = 'Alta'; } else if (rate > 40) { badgeClass = 'medium';
                badgeText = 'Média'; }

            return `
                <tr>
                    <td>${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</td>
                    <td>${item.totalSpots}</td>
                    <td>${item.occupiedSpots}</td>
                    <td>${item.availableSpots}</td>
                    <td>${rate}%</td>
                    <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
                </tr>
            `;
        }).join('');

        document.getElementById('tableCount').textContent = `Mostrando ${start + 1}-${end} de ${tableData.length} registros`;
        document.getElementById('pageInfo').textContent = `Página ${currentPage} de ${Math.max(1, totalPages)}`;

        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    }

    function renderReports(historicalData, analysisData) {
        if (!document.getElementById('avgOccupancy')) return;

        if (analysisData) {
            document.getElementById('avgOccupancy').textContent = analysisData.averageOccupancyRate + '%';
            document.getElementById('peakOccupancy').textContent = analysisData.peak.occupancyRate + '%';

            const peakDate = new Date(analysisData.peak.timestamp);
            document.getElementById('peakTime').textContent = peakDate.toLocaleDateString('pt-BR');
            document.getElementById('peakHour').textContent = peakDate.getHours() + 'h';
        }

        if (historicalData && historicalData.data) {
            document.getElementById('totalRecords').textContent = historicalData.data.length;
        }

        renderHourlyChart(analysisData);
        renderHeatmapReport(analysisData);
        renderDailyChart(historicalData);
        renderTable(historicalData);
    }

    async function carregarRelatorios(from, to) {
        try {
            const summary = document.getElementById('reportSummary');
            if (summary) {
                summary.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted);">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <span style="display: block; margin-top: 8px;">Carregando dados...</span>
                    </div>
                `;
            }

            const [historicalData, analysisData] = await Promise.all([
                buscarDadosHistoricos(from, to),
                buscarAnalise(from, to)
            ]);

            renderReports(historicalData, analysisData);

        } catch (error) {
            console.error('Erro ao carregar relatórios:', error);
            const summary = document.getElementById('reportSummary');
            if (summary) {
                summary.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--color-red);">
                        <i class="fas fa-triangle-exclamation" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
                        Erro ao carregar dados. Tente novamente.
                    </div>
                `;
            }
        }
    }

    // ============================================
    // 12. CARREGAMENTO INICIAL VIA API
    // ============================================

    async function carregarDados() {
        try {
            const occupancyData = await buscarDadosMock('/dashboard/occupancy');

            updateKPIs(occupancyData.spots);
            renderSpots(occupancyData.spots);
            updateCharts(occupancyData.spots);
            updateTotem(occupancyData.spots);
            updateClock();

        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            setConnectionStatus(false);
            showToast({
                title: 'Erro',
                message: 'Não foi possível carregar os dados.',
                type: 'error',
                duration: 4000
            });
        }
    }

    // ============================================
    // 13. WEBSOCKET (simulado)
    // ============================================

    let wsInterval = null;
    let fallbackInterval = null;
    let useFallback = false;

    function connectWebSocket() {
        try {
            console.log('WebSocket conectado (simulado)');
            setConnectionStatus(true);

            wsInterval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * spotsData.length);
                const spot = spotsData[randomIndex];
                const statuses = ['available', 'occupied'];
                const nextStatus = statuses[(statuses.indexOf(spot.status) + 1) % statuses.length];
                spot.status = nextStatus;

                renderSpots(spotsData);
                updateKPIs(spotsData);
                updateCharts(spotsData);
                updateTotem(spotsData);
                updateClock();
            }, 8000);

            setTimeout(() => {
                if (Math.random() > 0.7) handleWebSocketDisconnect();
            }, 30000);

        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
            handleWebSocketDisconnect();
        }
    }

    function handleWebSocketDisconnect() {
        console.warn('WebSocket desconectado!');
        setConnectionStatus(false);

        if (wsInterval) {
            clearInterval(wsInterval);
            wsInterval = null;
        }
        startFallbackPolling();
    }

    function startFallbackPolling() {
        useFallback = true;
        console.log('Iniciando fallback via REST (polling a cada 15s)');

        if (fallbackInterval) clearInterval(fallbackInterval);

        carregarDados();
        fallbackInterval = setInterval(carregarDados, 15000);

        setTimeout(() => {
            if (useFallback && Math.random() > 0.3) {
                useFallback = false;
                if (fallbackInterval) {
                    clearInterval(fallbackInterval);
                    fallbackInterval = null;
                }
                connectWebSocket();
            }
        }, 30000);
    }

    function refreshData() {
        console.log('Atualizando dados manualmente...');
        if (useFallback) {
            carregarDados();
            return;
        }
        const randomIndex = Math.floor(Math.random() * spotsData.length);
        const spot = spotsData[randomIndex];
        const statuses = ['available', 'occupied'];
        spot.status = statuses[(statuses.indexOf(spot.status) + 1) % statuses.length];

        renderSpots(spotsData);
        updateKPIs(spotsData);
        updateCharts(spotsData);
        updateTotem(spotsData);
        updateClock();
    }

    // ============================================
    // 14. RELATÓRIOS
    // ============================================

    function initRelatorios() {
        if (!document.getElementById('avgOccupancy')) return;

        const fromInput = document.getElementById('dateFrom');
        const toInput = document.getElementById('dateTo');
        const applyBtn = document.getElementById('applyFilters');
        const exportBtn = document.getElementById('exportCSV');

        const from = fromInput ? fromInput.value : '2026-08-01';
        const to = toInput ? toInput.value : '2026-08-25';
        carregarRelatorios(from, to);

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const newFrom = fromInput ? fromInput.value : '2026-08-01';
                const newTo = toInput ? toInput.value : '2026-08-25';
                currentPage = 1;
                carregarRelatorios(newFrom, newTo);
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (tableData.length === 0) {
                    showToast({
                        title: 'Aviso',
                        message: 'Nenhum dado para exportar.',
                        type: 'warning',
                        duration: 3000
                    });
                    return;
                }

                const headers = ['Data/Hora', 'Total Vagas', 'Ocupadas', 'Disponíveis', 'Taxa Ocupação'];
                const rows = tableData.map(item => {
                    const date = new Date(item.timestamp);
                    return [
                        date.toLocaleString('pt-BR'),
                        item.totalSpots,
                        item.occupiedSpots,
                        item.availableSpots,
                        item.occupancyRate + '%'
                    ];
                });

                const csvContent = [headers, ...rows]
                    .map(row => row.join(','))
                    .join('\n');

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `relatorio_smartpark_${new Date().toISOString().slice(0, 10)}.csv`;
                link.click();
                URL.revokeObjectURL(link.href);

                showToast({
                    title: 'Sucesso',
                    message: 'Arquivo CSV exportado com sucesso!',
                    type: 'success',
                    duration: 3000
                });
            });
        }

        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable({ data: tableData });
            }
        });

        document.getElementById('nextPage')?.addEventListener('click', () => {
            const totalPages = Math.ceil(tableData.length / pageSize);
            if (currentPage < totalPages) {
                currentPage++;
                renderTable({ data: tableData });
            }
        });
    }

    // ============================================
    // 15. TOAST / NOTIFICAÇÕES
    // ============================================

    function showToast(options) {
        const {
            title = '',
            message = '',
            type = 'info',
            duration = 4000
        } = options;

        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;

        const icons = {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info} toast-icon"></i>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close"><i class="fas fa-xmark"></i></button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => removeToast(toast), duration);
        }

        return toast;
    }

    function removeToast(toast) {
        if (toast.classList.contains('toast--removing')) return;
        toast.classList.add('toast--removing');
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 300);
    }

    // ============================================
    // 16. SKELETON LOADING
    // ============================================

    function showSkeleton(container, type = 'kpi', count = 4) {
        if (!container) return;

        let html = '';

        if (type === 'kpi') {
            html = Array(count).fill(`
                <div class="skeleton-card">
                    <div class="skeleton-text" style="width: 40%;"></div>
                    <div class="skeleton-text skeleton-text--lg" style="margin-top: 8px;"></div>
                    <div class="skeleton-text skeleton-text--sm"></div>
                    <div style="margin-top: 12px; height: 6px; background: rgba(255,255,255,0.05); border-radius: 4px;"></div>
                </div>
            `).join('');
            container.innerHTML = `<div class="skeleton-grid">${html}</div>`;
        }

        if (type === 'spots') {
            html = Array(count).fill(`
                <div class="skeleton-spot"></div>
            `).join('');
            container.innerHTML = html;
        }

        if (type === 'chart') {
            html = `
                <div style="height: 220px; background: var(--bg-card); border-radius: var(--border-radius-sm);">
                    <div style="padding: 20px;">
                        <div class="skeleton-text" style="width: 30%;"></div>
                        <div style="height: 160px; margin-top: 12px; background: rgba(255,255,255,0.03); border-radius: 4px;"></div>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        }

        if (type === 'table') {
            const rows = Array(count).fill(`
                <tr>
                    <td><div class="skeleton-text"></div></td>
                    <td><div class="skeleton-text"></div></td>
                    <td><div class="skeleton-text"></div></td>
                    <td><div class="skeleton-text"></div></td>
                    <td><div class="skeleton-text" style="width: 40%;"></div></td>
                    <td><div class="skeleton-text" style="width: 30%;"></div></td>
                </tr>
            `).join('');
            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Data/Hora</th>
                            <th>Total</th>
                            <th>Ocupadas</th>
                            <th>Disponíveis</th>
                            <th>Taxa</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        }
    }

    function hideSkeleton(container) {
        if (!container) return;
        container.innerHTML = '';
    }

    // ============================================
    // 17. INICIALIZAÇÃO GERAL
    // ============================================

    const isDataPage = document.getElementById('availableSpots') ||
        document.getElementById('spotsGrid') ||
        document.getElementById('totemAvailable');

    if (isDataPage) {
        carregarDados();
        connectWebSocket();
        setInterval(updateClock, 10000);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
                e.preventDefault();
                refreshData();
            }
        });

        console.log('✅ SmartPark inicializado com sucesso!');
    }

    initRelatorios();

    // ============================================
    // 18. EXPORTA FUNÇÕES PARA DEBUG
    // ============================================

    window.__smartpark = {
        spotsData,
        renderSpots,
        updateKPIs,
        updateCharts,
        updateTotem,
        carregarDados,
        refreshData,
        buscarDadosMock,
        connectWebSocket,
        carregarRelatorios,
        showToast,
        showSkeleton,
        hideSkeleton,
        API_CONFIG,
    };

    console.log('✅ SmartPark - Todos os módulos carregados!');
});