'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Autenticación
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('username-display').textContent = `Hola, ${username}`;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = 'login.html';
    });

    // Variables globales de la app
    let currentData = [];
    let filteredData = [];
    let campaignChartInstance = null;
    let csvLoaded = false;

    let currentCampaignData = { // Datos de campaña por defecto / iniciales
        id: 1, name: "Dinosaurios de la Patagonia", brand: "Caixa", date: "2025-03-10", influencer_ids: ["1","2"], // IDs como strings para coincidir con CSV
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
    const tabsNodeList = document.querySelectorAll('.tab'); // Renombrado para evitar conflicto
    const exploreViewDiv = document.getElementById('explore-view'); // Renombrado
    const campaignViewDiv = document.getElementById('campaign-view'); // Renombrado
    const resultsContainerDiv = document.getElementById('results-container'); // Renombrado
    const loaderDiv = document.getElementById('loader'); // Renombrado
    const noResultsMessageP = document.getElementById('no-results-message'); // Renombrado
    
    const platformFilterSelect = document.getElementById('platform-filter'); // Renombrado
    const followersFilterSelect = document.getElementById('followers-filter'); // Renombrado
    const tag1FilterSelect = document.getElementById('tag1-filter'); // Renombrado
    const tag2FilterSelect = document.getElementById('tag2-filter'); // Renombrado
    const searchInputEl = document.getElementById('search-input'); // Renombrado
    const searchBtnEl = document.getElementById('search-btn'); // Renombrado

    const campaignFormEl = document.getElementById('campaign-form'); // Renombrado
    const formCampaignStatsTextareaEl = document.getElementById('form-campaign-stats'); // Renombrado


    function initializeCampaignForm() {
        document.getElementById('form-campaign-name').value = currentCampaignData.name;
        document.getElementById('form-campaign-brand').value = currentCampaignData.brand;
        
        // Formatear la fecha para el input type="date" que espera YYYY-MM-DD
        let campaignDate = currentCampaignData.date;
        if (campaignDate && campaignDate.includes('T')) { // Si es un ISO string completo
            campaignDate = campaignDate.split('T')[0];
        } else if (campaignDate && campaignDate.includes('/')) { // Si es DD/MM/YYYY o similar
            const parts = campaignDate.split('/');
            if (parts.length === 3) {
                campaignDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
            }
        } // Asumir que si no, ya está en YYYY-MM-DD
        document.getElementById('form-campaign-date').value = campaignDate;

        document.getElementById('form-campaign-influencers-ids').value = currentCampaignData.influencer_ids.join(',');
        document.getElementById('form-campaign-roi').value = currentCampaignData.roi;
        formCampaignStatsTextareaEl.value = JSON.stringify(currentCampaignData.stats, null, 2);
    }

    campaignFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
            const name = document.getElementById('form-campaign-name').value;
            const brand = document.getElementById('form-campaign-brand').value;
            const date = document.getElementById('form-campaign-date').value;
            const influencer_ids_str = document.getElementById('form-campaign-influencers-ids').value;
            const roi = parseFloat(document.getElementById('form-campaign-roi').value);
            const stats_json = formCampaignStatsTextareaEl.value;

            if (!name || !brand || !date || !influencer_ids_str || isNaN(roi) || !stats_json) {
                alert("Por favor, completa todos los campos del formulario de campaña.");
                return;
            }

            const influencer_ids = influencer_ids_str.split(',').map(id => id.trim()).filter(id => id !== "");
            
            let stats;
            try {
                stats = JSON.parse(stats_json);
                if (!Array.isArray(stats) || !stats.every(s => s.month && typeof s.engagement === 'number' && typeof s.views === 'number')) {
                    throw new Error("El formato de Datos Mensuales JSON es incorrecto.");
                }
            } catch (jsonError) {
                alert(`Error en el formato JSON de Datos Mensuales: ${jsonError.message}`);
                return;
            }

            currentCampaignData = { name, brand, date, influencer_ids, roi, stats };
            displayCampaignData(currentCampaignData);
            alert("Datos de campaña actualizados y gráfica regenerada.");

        } catch (error) {
            alert(`Error procesando el formulario: ${error.message}`);
            console.error("Error en formulario de campaña:", error);
        }
    });

    function displayCampaignData(campaignToDisplay = currentCampaignData) {
        if (!csvLoaded && currentData.length === 0) { // Solo reintentar si currentData está vacío, no solo si csvLoaded es false (podría estar en proceso)
            document.getElementById('no-campaign-message').textContent = 'Cargando datos de influencers para la campaña...';
            setTimeout(() => displayCampaignData(campaignToDisplay), 1000);
            return;
        }
        
        if (!campaignToDisplay || !campaignToDisplay.stats || campaignToDisplay.stats.length === 0) {
            document.getElementById('no-campaign-message').textContent = 'No hay datos de campaña para mostrar. Por favor, usa el formulario.';
            document.getElementById('no-campaign-message').classList.remove('hidden');
            document.getElementById('campaign-data').classList.add('hidden');
            return;
        }

        document.getElementById('no-campaign-message').classList.add('hidden');
        document.getElementById('campaign-data').classList.remove('hidden');

        document.getElementById('campaign-name').textContent = campaignToDisplay.name;
        document.getElementById('campaign-brand').textContent = campaignToDisplay.brand;
        try {
            // Asegurar que la fecha se parsee correctamente, asumiendo YYYY-MM-DD del input
            const [year, month, day] = campaignToDisplay.date.split('-');
            document.getElementById('campaign-date').textContent = new Date(year, month - 1, day).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
            document.getElementById('campaign-date').textContent = campaignToDisplay.date;
        }

        const influencerNames = campaignToDisplay.influencer_ids
            .map(id => {
                const influencer = currentData.find(i => String(i.id) === String(id));
                return influencer ? influencer.name : `ID:${id} (Desconocido)`;
            })
            .join(', ');
        document.getElementById('campaign-influencers').textContent = influencerNames || 'Ninguno especificado';

        const totalReach = campaignToDisplay.influencer_ids.reduce((sum, id) => {
            const influencer = currentData.find(i => String(i.id) === String(id));
            return sum + (influencer && typeof influencer.followers === 'number' ? influencer.followers : 0);
        }, 0);
        document.getElementById('campaign-reach').textContent = totalReach.toLocaleString();
        document.getElementById('campaign-roi').textContent = `${campaignToDisplay.roi}x`;

        const ctx = document.getElementById('campaign-chart').getContext('2d');
        if (campaignChartInstance) {
            campaignChartInstance.destroy();
        }
        campaignChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: campaignToDisplay.stats.map(s => s.month),
                datasets: [{
                    label: 'Engagement',
                    data: campaignToDisplay.stats.map(s => s.engagement),
                    borderColor: 'var(--primary)', backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: 'var(--primary)'
                }, {
                    label: 'Visualizaciones',
                    data: campaignToDisplay.stats.map(s => s.views),
                    borderColor: 'var(--success)', backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    tension: 0.3, fill: true, pointRadius: 3, pointBackgroundColor: 'var(--success)'
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } },
                    x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } }
                },
                plugins: { legend: { position: 'top', labels: { color: 'var(--text)' } }, tooltip: { mode: 'index', intersect: false } },
                animation: { duration: 800, easing: 'easeInOutQuart' }
            }
        });
    }
    
    const calculateImpact = influencer => {
        if (!influencer || typeof influencer.followers !== 'number' || influencer.followers === 0) return '0.00';
        const likes = Number(influencer.likesAvg) || 0;
        const comments = Number(influencer.commentsAvg) || 0;
        return ((likes / influencer.followers + comments / influencer.followers) * 100 * 1.2).toFixed(2);
    };

    function populateTagFilters() {
        tag1FilterSelect.length = 1; 
        tag2FilterSelect.length = 1;
        
        // Combinar nichos de todas las columnas de nicho y asegurarse de que sean strings antes de split
        const allNiches = currentData.flatMap(item => {
            let niches = [];
            if (item.niche && typeof item.niche === 'string') niches = niches.concat(item.niche.split('|').map(s => s.trim()).filter(s => s));
            if (item['niche 2'] && typeof item['niche 2'] === 'string') niches = niches.concat(item['niche 2'].split('|').map(s => s.trim()).filter(s => s));
            if (item['niche 3'] && typeof item['niche 3'] === 'string') niches = niches.concat(item['niche 3'].split('|').map(s => s.trim()).filter(s => s));
            // Si tus columnas de nicho ya son arrays después del parseo, ajusta esto.
            // Por ahora, asumimos que son strings o PapaParse podría haberlos convertido a arrays si no hay delimitador interno.
            // Pero si el CSV tiene 'Minecraft;Videojuegos;Familiar' y el delimitador principal es ';', 'niche' será 'Minecraft', 'niche 2' será 'Videojuegos', etc.
            // Así que vamos a asumir que las columnas son individuales.
            const individualNiches = [];
            if (item.niche && typeof item.niche === 'string') individualNiches.push(item.niche.trim());
            if (item['niche 2'] && typeof item['niche 2'] === 'string') individualNiches.push(item['niche 2'].trim());
            if (item['niche 3'] && typeof item['niche 3'] === 'string') individualNiches.push(item['niche 3'].trim());
            return individualNiches.filter(n => n); // Solo nichos no vacíos
        });

        const uniqueTags = [...new Set(allNiches)].sort();
        
        uniqueTags.forEach(tag => {
            if (tag) { 
                const option1 = new Option(tag, tag);
                const option2 = new Option(tag, tag);
                tag1FilterSelect.appendChild(option1);
                tag2FilterSelect.appendChild(option2);
            }
        });
    }
    
    function showLoader(show) {
        loaderDiv.classList.toggle('hidden', !show);
    }

    async function loadInfluencersCsv() {
        showLoader(true);
        try {
            const response = await fetch('data/influencers.csv');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    skipEmptyLines: true,
                    delimiter: ";", // <--- IMPORTANTE: Especificar el delimitador
                    complete: ({ data, errors, meta }) => {
                        if (errors.length > 0) {
                            console.warn("Errores de parseo en influencers.csv detectados:");
                            errors.forEach(err => console.warn(`- Tipo: ${err.type}, Código: ${err.code}, Mensaje: ${err.message}, Fila: ${err.row}`));
                        }
                        console.log("Campos detectados por PapaParse:", meta.fields);

                        const rawDataCount = data.length;
                        currentData = data.filter(r => {
                            const hasId = r && (r.id !== null && r.id !== undefined && String(r.id).trim() !== "");
                            const hasName = r && (r.name !== null && r.name !== undefined && String(r.name).trim() !== "");
                            return hasId && hasName;
                        });
                        console.log(`Datos CSV: ${rawDataCount} filas crudas, ${currentData.length} filas válidas cargadas.`);

                        currentData.forEach(item => {
                            item.id = String(item.id); // ID como string consistentemente
                            item.followers = Number(item.followers) || 0;
                            item.likesAvg = Number(item.likesAvg) || 0;
                            item.commentsAvg = Number(item.commentsAvg) || 0;
                            // Para los nichos, como ahora son columnas separadas, los dejamos como están.
                            // La función populateTagFilters y applyFiltersAndSearch se encargarán de leerlos.
                        });

                        csvLoaded = true;
                        filteredData = [...currentData]; // Inicializar filteredData
                        populateTagFilters();
                        searchBtnEl.disabled = false;
                        showLoader(false);
                        applyFiltersAndSearch();
                        resolve();
                    },
                    error: (error) => {
                        console.error("Error de PapaParse:", error);
                        reject(error.message);
                    }
                });
            });
        } catch (error) {
            showLoader(false);
            resultsContainerDiv.innerHTML = `<p style="color:var(--error); text-align:center;">Error cargando influencers.csv: ${error.message}. Por favor, revisa la consola y el archivo.</p>`;
            console.error('Error crítico cargando influencers.csv:', error);
            searchBtnEl.disabled = true;
            throw error;
        }
    }
    
    function applyFiltersAndSearch() {
        if (!csvLoaded) return;

        showLoader(true);
        resultsContainerDiv.classList.add('hidden');
        noResultsMessageP.classList.add('hidden');

        setTimeout(() => {
            const platform = platformFilterSelect.value;
            const followersRange = followersFilterSelect.value;
            const tag1 = tag1FilterSelect.value;
            const tag2 = tag2FilterSelect.value;
            const searchTerm = searchInputEl.value.toLowerCase().trim();

            filteredData = currentData.filter(item => {
                if (platform !== 'Todos' && item.platform !== platform) return false;

                const followers = Number(item.followers) || 0;
                if (followersRange === '<100K' && followers >= 100000) return false;
                if (followersRange === '100K-500K' && (followers < 100000 || followers > 500000)) return false;
                if (followersRange === '>500K' && followers <= 500000) return false;

                // Lógica de filtrado para nichos individuales
                const itemNichesSet = new Set();
                if (item.niche && typeof item.niche === 'string') itemNichesSet.add(item.niche.trim());
                if (item['niche 2'] && typeof item['niche 2'] === 'string') itemNichesSet.add(item['niche 2'].trim());
                if (item['niche 3'] && typeof item['niche 3'] === 'string') itemNichesSet.add(item['niche 3'].trim());

                if (tag1 !== 'Todos' && !itemNichesSet.has(tag1)) return false;
                if (tag2 !== 'Todos' && !itemNichesSet.has(tag2)) return false; // Si tag2 es el mismo que tag1, el filtro es más restrictivo. Considerar si esto es deseado.
                
                if (searchTerm) {
                    const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
                    const nicheSearchMatch = Array.from(itemNichesSet).some(n => n.toLowerCase().includes(searchTerm));
                    if (!nameMatch && !nicheSearchMatch) return false;
                }
                return true;
            });
            
            displayResults();
            showLoader(false);
            resultsContainerDiv.classList.remove('hidden');
            noResultsMessageP.classList.toggle('hidden', filteredData.length === 0);
        }, 300);
    }
    
    function displayResults() {
        resultsContainerDiv.innerHTML = '';
        if (filteredData.length === 0) {
            noResultsMessageP.classList.remove('hidden');
            return;
        }
        noResultsMessageP.classList.add('hidden');

        filteredData.forEach(item => {
            const impact = calculateImpact(item);
            
            const card = document.createElement('a'); 
            card.className = 'result-card';
            // Asegurarse que item.id es un string o número válido para la URL
            card.href = `influencer_metrics.html?id=${encodeURIComponent(String(item.id))}`; 
            
            card.innerHTML = `
                <h3>${item.name || 'Nombre no disponible'}</h3>
                <p class="text-secondary">${item.platform || 'N/A'}</p>
                <p>👥 Seguidores: ${(Number(item.followers) || 0).toLocaleString()}</p>
                <p>❤️ Likes (promedio): ${(Number(item.likesAvg) || 0).toLocaleString()}</p>
                <p>💬 Comentarios (promedio): ${(Number(item.commentsAvg) || 0).toLocaleString()}</p>
                <p class="text-impact">📊 Impacto Estimado: ${impact}%</p>
            `;
            resultsContainerDiv.appendChild(card);
        });
    }

    function handleTabClick(e) {
        tabsNodeList.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        const selectedTab = e.target.dataset.tab;

        exploreViewDiv.classList.add('hidden');
        campaignViewDiv.classList.add('hidden');

        if (selectedTab === 'explorar') {
            exploreViewDiv.classList.remove('hidden');
        } else if (selectedTab === 'campanas') {
            campaignViewDiv.classList.remove('hidden');
            initializeCampaignForm(); 
            displayCampaignData(currentCampaignData); 
        }
    }
    
    // Inicialización
    searchBtnEl.addEventListener('click', applyFiltersAndSearch);
    searchInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFiltersAndSearch();
    });
    [platformFilterSelect, followersFilterSelect, tag1FilterSelect, tag2FilterSelect].forEach(filterElement => {
        filterElement.addEventListener('change', applyFiltersAndSearch);
    });
    
    tabsNodeList.forEach(t => t.addEventListener('click', handleTabClick));

    loadInfluencersCsv()
        .then(() => {
            console.log("Aplicación Caza Influencers inicializada.");
            // Si la pestaña por defecto es campañas, o para la primera carga:
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.tab === 'campanas') {
                 initializeCampaignForm();
                 displayCampaignData(currentCampaignData);
            } else {
                // La vista de explorar ya se puebla a través de applyFiltersAndSearch llamado en loadInfluencersCsv
            }
        })
        .catch(error => {
            console.error("Fallo en la inicialización de la aplicación:", error);
        });
});
