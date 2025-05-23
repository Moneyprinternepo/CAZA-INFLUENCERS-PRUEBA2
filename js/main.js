'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Autenticación
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return; // Detener ejecución si no está logueado
    }

    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('username-display').textContent = `Hola, ${username}`;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        // localStorage.removeItem('userRole'); // Si lo guardaste
        window.location.href = 'login.html';
    });

    // Variables globales de la app
    let currentData = [];
    let filteredData = [];
    let campaignChartInstance = null; // Renombrado para evitar conflicto con la variable global Chart
    let csvLoaded = false;

    // Datos de campaña de ejemplo (podría venir de un CSV/API en el futuro)
    const sampleCampaign = {
        id: 1, name: "Dinosaurios de la Patagonia", brand: "Caixa", date: "2025-03-10", influencer_ids: [1, 2, 5], // Usar IDs de influencers.csv
        roi: 2.3,
        stats: [
            { month: 'Ene', engagement: 20000, views: 30000 }, { month: 'Feb', engagement: 10000, views: 12000 },
            { month: 'Mar', engagement: 14800, views: 16000 }, { month: 'Abr', engagement: 11000, views: 8000 },
            { month: 'May', engagement: 15000, views: 17000 }, { month: 'Jun', engagement: 10000, views: 18000 },
            { month: 'Jul', engagement: 4000, views: 9000 }, { month: 'Ago', engagement: 2000, views: 6000 },
            { month: 'Sep', engagement: 1000, views: 3000 }, { month: 'Oct', engagement: 1500, views: 4000 },
            { month: 'Nov', engagement: 2200, views: 5000 }, { month: 'Dic', engagement: 1800, views: 4500 }
        ]
    };

    // Elementos del DOM
    const tabs = document.querySelectorAll('.tab');
    const exploreView = document.getElementById('explore-view');
    const campaignView = document.getElementById('campaign-view');
    const resultsContainer = document.getElementById('results-container');
    const loader = document.getElementById('loader');
    const noResultsMessage = document.getElementById('no-results-message');
    
    const platformFilter = document.getElementById('platform-filter');
    const followersFilter = document.getElementById('followers-filter');
    const tag1Filter = document.getElementById('tag1-filter');
    const tag2Filter = document.getElementById('tag2-filter');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    // --- UTILIDADES ---
    const calculateImpact = influencer => {
        if (influencer.followers === 0) return 0; // Evitar división por cero
        return ((influencer.likesAvg / influencer.followers + influencer.commentsAvg / influencer.followers) * 100 * 1.2).toFixed(2);
    }

    function populateTagFilters() {
        tag1Filter.length = 1; // Limpia opciones previas excepto "Todos"
        tag2Filter.length = 1;
        
        const allNiches = currentData.flatMap(item => {
            if (Array.isArray(item.niche)) return item.niche;
            if (typeof item.niche === 'string') return item.niche.split('|').map(s => s.trim());
            return [];
        });
        const uniqueTags = [...new Set(allNiches)].sort();
        
        uniqueTags.forEach(tag => {
            if (tag) { // Asegurarse de no añadir tags vacíos
                const option1 = new Option(tag, tag);
                const option2 = new Option(tag, tag);
                tag1Filter.appendChild(option1);
                tag2Filter.appendChild(option2);
            }
        });
    }
    
    function showLoader(show) {
        loader.classList.toggle('hidden', !show);
    }

    function applyFiltersAndSearch() {
        if (!csvLoaded) return;

        showLoader(true);
        resultsContainer.classList.add('hidden');
        noResultsMessage.classList.add('hidden');

        // Simular delay para UX
        setTimeout(() => {
            const platform = platformFilter.value;
            const followersRange = followersFilter.value;
            const tag1 = tag1Filter.value;
            const tag2 = tag2Filter.value;
            const searchTerm = searchInput.value.toLowerCase().trim();

            filteredData = currentData.filter(item => {
                if (platform !== 'Todos' && item.platform !== platform) return false;

                if (followersRange === '<100K' && item.followers >= 100000) return false;
                if (followersRange === '100K-500K' && (item.followers < 100000 || item.followers > 500000)) return false;
                if (followersRange === '>500K' && item.followers <= 500000) return false;

                const itemNiches = Array.isArray(item.niche) ? item.niche : (typeof item.niche === 'string' ? item.niche.split('|').map(s => s.trim()) : []);
                if (tag1 !== 'Todos' && !itemNiches.includes(tag1)) return false;
                if (tag2 !== 'Todos' && !itemNiches.includes(tag2)) return false;
                
                if (searchTerm) {
                    const nameMatch = item.name.toLowerCase().includes(searchTerm);
                    const nicheMatch = itemNiches.some(n => n.toLowerCase().includes(searchTerm));
                    if (!nameMatch && !nicheMatch) return false;
                }
                return true;
            });
            
            displayResults();
            showLoader(false);
            resultsContainer.classList.remove('hidden');
            noResultsMessage.classList.toggle('hidden', filteredData.length > 0);
        }, 300);
    }

    function displayResults() {
        resultsContainer.innerHTML = '';
        if (filteredData.length === 0) {
            noResultsMessage.classList.remove('hidden');
            return;
        }
        noResultsMessage.classList.add('hidden');

        filteredData.forEach(item => {
            const impact = calculateImpact(item);
            // item.impact = impact; // Guardar para posible uso futuro, aunque ahora se pasa a métricas

            const card = document.createElement('a'); // Cambiado a 'a' para navegación
            card.className = 'result-card';
            card.href = `influencer_metrics.html?id=${item.id}`; // Enlace a la página de métricas
            
            card.innerHTML = `
                <h3>${item.name}</h3>
                <p class="text-secondary">${item.platform}</p>
                <p>👥 Seguidores: ${item.followers.toLocaleString()}</p>
                <p>❤️ Likes (promedio): ${item.likesAvg.toLocaleString()}</p>
                <p>💬 Comentarios (promedio): ${item.commentsAvg.toLocaleString()}</p>
                <p class="text-impact">📊 Impacto Estimado: ${impact}%</p>
            `;
            // El evento de click ya no es necesario aquí, el 'a' se encarga.
            resultsContainer.appendChild(card);
        });
    }

    // --- VISTA CAMPAÑAS ---
    function displayCampaignData() {
        if (!csvLoaded) {
            // Podrías poner un pequeño loader o mensaje aquí también
            document.getElementById('no-campaign-message').textContent = 'Cargando datos de influencers para la campaña...';
            // Reintentar después de un momento si los datos de influencers no están listos
            setTimeout(displayCampaignData, 1000); 
            return;
        }
        
        document.getElementById('no-campaign-message').classList.add('hidden');
        document.getElementById('campaign-data').classList.remove('hidden');

        document.getElementById('campaign-name').textContent = sampleCampaign.name;
        document.getElementById('campaign-brand').textContent = sampleCampaign.brand;
        document.getElementById('campaign-date').textContent = new Date(sampleCampaign.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

        const influencerNames = sampleCampaign.influencer_ids
            .map(id => {
                const influencer = currentData.find(i => i.id == id); // Usar '==' para comparación flexible de tipos si ID es número y CSV es string
                return influencer ? influencer.name : 'Desconocido';
            })
            .join(', ');
        document.getElementById('campaign-influencers').textContent = influencerNames;

        const totalReach = sampleCampaign.influencer_ids.reduce((sum, id) => {
            const influencer = currentData.find(i => i.id == id);
            return sum + (influencer ? influencer.followers : 0);
        }, 0);
        document.getElementById('campaign-reach').textContent = totalReach.toLocaleString();
        document.getElementById('campaign-roi').textContent = `${sampleCampaign.roi}x`;

        const ctx = document.getElementById('campaign-chart').getContext('2d');
        if (campaignChartInstance) {
            campaignChartInstance.destroy();
        }
        campaignChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sampleCampaign.stats.map(s => s.month),
                datasets: [{
                    label: 'Engagement',
                    data: sampleCampaign.stats.map(s => s.engagement),
                    borderColor: 'var(--primary)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.3,
                    fill: true
                }, {
                    label: 'Visualizaciones',
                    data: sampleCampaign.stats.map(s => s.views),
                    borderColor: 'var(--success)',
                    backgroundColor: 'rgba(34, 197, 94, 0.1)',
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } },
                    x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } }
                },
                plugins: {
                    legend: { position: 'top', labels: { color: 'var(--text)' } }
                }
            }
        });
    }

    // --- CARGA INICIAL DE DATOS (Influencers) ---
    async function loadInfluencersCsv() {
        showLoader(true);
        try {
            const response = await fetch('data/influencers.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    download: false, // Ya hemos descargado con fetch
                    header: true,
                    dynamicTyping: true, // Importante para que números sean números
                    skipEmptyLines: true,
                    complete: ({ data, errors }) => {
                        if (errors.length > 0) {
                            console.warn("Errores de parseo en influencers.csv:", errors);
                            // Decide si continuar o rechazar basado en la severidad
                        }
                        currentData = data.filter(r => r.id && r.name); // Asegurar que tengan ID y nombre
                        
                        // Convertir 'niche' de string a array si es necesario
                        currentData.forEach(item => {
                            if (item.niche && typeof item.niche === 'string') {
                                item.niche = item.niche.split('|').map(s => s.trim());
                            } else if (!item.niche) {
                                item.niche = []; // Asegurar que sea un array
                            }
                        });

                        csvLoaded = true;
                        filteredData = [...currentData];
                        populateTagFilters();
                        searchBtn.disabled = false;
                        showLoader(false);
                        applyFiltersAndSearch(); // Carga inicial de resultados
                        resolve();
                    },
                    error: (error) => {
                        reject(error.message);
                    }
                });
            });
        } catch (error) {
            showLoader(false);
            resultsContainer.innerHTML = `<p style="color:var(--error); text-align:center;">Error cargando influencers.csv: ${error.message}. Por favor, revisa la consola y el archivo.</p>`;
            console.error('Error crítico cargando influencers.csv:', error);
            searchBtn.disabled = true;
            throw error;
        }
    }

    // --- MANEJO DE PESTAÑAS (Tabs) ---
    function handleTabClick(e) {
        tabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const selectedTab = e.target.dataset.tab;

        if (selectedTab === 'explorar') {
            campaignView.classList.add('hidden');
            exploreView.classList.remove('hidden');
            // No es necesario recargar datos aquí a menos que la lógica cambie
        } else if (selectedTab === 'campanas') {
            exploreView.classList.add('hidden');
            campaignView.classList.remove('hidden');
            displayCampaignData(); // Actualizar o mostrar datos de campaña
        }
    }
    
    // --- TESTS BÁSICOS (Opcional, para desarrollo) ---
    function runBasicTests() {
        console.assert(typeof Chart !== 'undefined', 'Chart.js no cargado');
        console.assert(csvLoaded, 'CSV influencers no cargado');
        if (currentData.length > 0) {
            console.assert(currentData.length > 0, 'CSV vacío o no parseado correctamente');
            const uniqueIds = new Set(currentData.map(i => i.id));
            console.assert(uniqueIds.size === currentData.length, 'IDs duplicados en influencers.csv');
        } else {
            console.warn("currentData está vacío, no se pueden ejecutar tests de datos.");
        }
        console.log('%c✔︎ Tests básicos de main.js OK (si no hay errores arriba)', 'color:lime');
    }

    // --- INICIALIZACIÓN ---
    searchBtn.addEventListener('click', applyFiltersAndSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            applyFiltersAndSearch();
        }
    });
    [platformFilter, followersFilter, tag1Filter, tag2Filter].forEach(filterElement => {
        filterElement.addEventListener('change', applyFiltersAndSearch);
    });
    
    tabs.forEach(t => t.addEventListener('click', handleTabClick));

    // Cargar datos y luego ejecutar tests y UI
    loadInfluencersCsv()
        .then(() => {
            runBasicTests();
            // La UI ya se actualiza en applyFiltersAndSearch llamado desde loadInfluencersCsv
            console.log("Aplicación Caza Influencers inicializada.");
        })
        .catch(error => {
            console.error("Fallo en la inicialización de la aplicación:", error);
            // El error ya se muestra en la UI desde loadInfluencersCsv
        });
});