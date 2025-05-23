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
        id: 1, name: "Dinosaurios de la Patagonia", brand: "Caixa", date: "2025-03-10", influencer_ids: ["1","2"], // IDs como strings
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

    // Elementos del DOM (asegúrate que los IDs en tu HTML coincidan)
    const tabsNodeList = document.querySelectorAll('.tab');
    const exploreViewDiv = document.getElementById('explore-view');
    const campaignViewDiv = document.getElementById('campaign-view');
    const resultsContainerDiv = document.getElementById('results-container');
    const loaderDiv = document.getElementById('loader');
    const noResultsMessageP = document.getElementById('no-results-message');
    
    const platformFilterSelect = document.getElementById('platform-filter');
    const followersFilterSelect = document.getElementById('followers-filter');
    const tag1FilterSelect = document.getElementById('tag1-filter');
    const tag2FilterSelect = document.getElementById('tag2-filter');
    const searchInputEl = document.getElementById('search-input');
    const searchBtnEl = document.getElementById('search-btn');

    const campaignFormEl = document.getElementById('campaign-form');
    const formCampaignStatsTextareaEl = document.getElementById('form-campaign-stats');


    function initializeCampaignForm() {
        document.getElementById('form-campaign-name').value = currentCampaignData.name;
        document.getElementById('form-campaign-brand').value = currentCampaignData.brand;
        let campaignDate = currentCampaignData.date;
        if (campaignDate && campaignDate.includes('T')) {
            campaignDate = campaignDate.split('T')[0];
        } else if (campaignDate && campaignDate.includes('/')) {
            const parts = campaignDate.split('/');
            if (parts.length === 3) campaignDate = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
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
        if (!csvLoaded && currentData.length === 0) {
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
        console.log("Poblando filtros de tags con currentData de longitud:", currentData.length);
        
        const allNiches = currentData.flatMap(item => {
            const individualNiches = [];
            if (!item) return [];

            if (item.niche1 && typeof item.niche1 === 'string' && item.niche1.trim() !== '') individualNiches.push(item.niche1.trim());
            if (item.niche2 && typeof item.niche2 === 'string' && item.niche2.trim() !== '') individualNiches.push(item.niche2.trim());
            if (item.niche3 && typeof item.niche3 === 'string' && item.niche3.trim() !== '') individualNiches.push(item.niche3.trim());
            if (item.niche4 && typeof item.niche4 === 'string' && item.niche4.trim() !== '') individualNiches.push(item.niche4.trim());
            if (item.niche5 && typeof item.niche5 === 'string' && item.niche5.trim() !== '') individualNiches.push(item.niche5.trim());
            
            return individualNiches;
        });
        // console.log("Todos los nichos recolectados (antes de Set):", allNiches.length, allNiches.slice(0,20));

        const uniqueTags = [...new Set(allNiches)].sort();
        console.log("Tags únicos para filtros:", uniqueTags.length, uniqueTags); // Log todos los tags únicos
        
        uniqueTags.forEach(tag => {
            if (tag) { 
                const option1 = new Option(tag, tag);
                const option2 = new Option(tag, tag);
                tag1FilterSelect.appendChild(option1);
                tag2FilterSelect.appendChild(option2);
            }
        });
        console.log("Filtros de tags poblados.");
    }
    
    function showLoader(show) {
        loaderDiv.classList.toggle('hidden', !show);
    }

    async function loadInfluencersCsv() {
        showLoader(true);
        console.log("Iniciando loadInfluencersCsv...");
        try {
            const response = await fetch('data/influencers.csv');
            console.log("Respuesta de fetch para influencers.csv:", response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, ${response.statusText} al intentar cargar data/influencers.csv`);
            }
            const csvText = await response.text();
            // console.log("CSV texto obtenido (primeros 500 chars):", csvText.substring(0, 500));
            
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: false, // Controlar tipos manualmente
                    skipEmptyLines: true,
                    // delimiter: ";", // <--- ELIMINADO: PapaParse usa coma por defecto
                    transformHeader: function(header) {
                        return header.trim(); 
                    },
                    complete: ({ data, errors, meta }) => {
                        console.log("Papa.parse completado para influencers.csv.");
                        console.log("Campos detectados por PapaParse (meta.fields):", meta.fields);

                        if (errors.length > 0) {
                            console.warn("ERRORES de parseo en influencers.csv:");
                            errors.forEach(err => console.warn(`- Tipo: ${err.type}, Código: ${err.code}, Mensaje: ${err.message}, Fila original CSV: ${err.row + 2}`));
                        }
                        
                        const rawDataCount = data.length;
                        console.log("Número de filas parseadas por PapaParse (antes de filtrar):", rawDataCount);

                        currentData = data.filter(r => {
                            const hasId = r && (r.id !== null && r.id !== undefined && String(r.id).trim() !== "");
                            const hasName = r && (r.name !== null && r.name !== undefined && String(r.name).trim() !== "");
                            return hasId && hasName;
                        });
                        console.log(`Número de filas en currentData (después de filtrar por ID/Nombre): ${currentData.length}`);

                        if (currentData.length > 0) {
                            // console.log("Propiedades del primer item ANTES de procesar tipos (keys):", Object.keys(currentData[0]));
                        }

                        currentData.forEach(item => {
                            item.id = String(item.id || '').trim();
                            item.name = String(item.name || '').trim();
                            item.platform = String(item.platform || 'N/A').trim();
                            // Eliminar cualquier carácter no numérico antes de convertir a número
                            item.followers = parseInt(String(item.followers || '0').replace(/\D/g,''), 10) || 0;
                            item.likesAvg = parseInt(String(item.likesAvg || '0').replace(/\D/g,''), 10) || 0;
                            item.commentsAvg = parseInt(String(item.commentsAvg || '0').replace(/\D/g,''), 10) || 0;
                            
                            item.niche1 = String(item.niche1 || '').trim();
                            item.niche2 = String(item.niche2 || '').trim();
                            item.niche3 = String(item.niche3 || '').trim();
                            item.niche4 = String(item.niche4 || '').trim();
                            item.niche5 = String(item.niche5 || '').trim();
                        });
                        
                        if (currentData.length > 0) {
                            // console.log("Primer item en currentData DESPUÉS de procesar tipos:", currentData[0]);
                        } else {
                            console.warn("currentData está vacío después del procesamiento. Revisa el CSV y los logs de errores de parseo.");
                        }

                        csvLoaded = true;
                        filteredData = [...currentData];
                        populateTagFilters();
                        searchBtnEl.disabled = false;
                        showLoader(false);
                        applyFiltersAndSearch(); 
                        console.log("loadInfluencersCsv completado exitosamente.");
                        resolve();
                    },
                    error: (error) => {
                        console.error("ERROR CRÍTICO en PapaParse:", error);
                        showLoader(false);
                        resultsContainerDiv.innerHTML = `<p style="color:var(--error); text-align:center;">Error parseando influencers.csv: ${error.message}.</p>`;
                        reject(error.message);
                    }
                });
            });
        } catch (error) {
            console.error('ERROR CRÍTICO en fetch o previo a PapaParse:', error.message);
            showLoader(false);
            resultsContainerDiv.innerHTML = `<p style="color:var(--error); text-align:center;">Error cargando influencers.csv: ${error.message}.</p>`;
            searchBtnEl.disabled = true;
        }
    }
    
    function applyFiltersAndSearch() {
        if (!csvLoaded) {
            // console.log("applyFiltersAndSearch: CSV no cargado aún.");
            return;
        }
        // console.log("Aplicando filtros...");

        showLoader(true);
        resultsContainerDiv.classList.add('hidden');
        noResultsMessageP.classList.add('hidden');

        setTimeout(() => { // Simular delay para UX, aunque puede ser muy corto
            const platform = platformFilterSelect.value;
            const followersRange = followersFilterSelect.value;
            const tag1 = tag1FilterSelect.value;
            const tag2 = tag2FilterSelect.value;
            const searchTerm = searchInputEl.value.toLowerCase().trim();

            filteredData = currentData.filter(item => {
                if (!item || !item.id) return false; 

                if (platform !== 'Todos' && item.platform !== platform) return false;

                const followers = item.followers; // Ya es número
                if (followersRange === '<100K' && followers >= 100000) return false;
                if (followersRange === '100K-500K' && (followers < 100000 || followers > 500000)) return false;
                if (followersRange === '>500K' && followers <= 500000) return false;

                const itemNichesSet = new Set();
                if (item.niche1) itemNichesSet.add(item.niche1);
                if (item.niche2) itemNichesSet.add(item.niche2);
                if (item.niche3) itemNichesSet.add(item.niche3);
                if (item.niche4) itemNichesSet.add(item.niche4);
                if (item.niche5) itemNichesSet.add(item.niche5);
                // Eliminar entradas vacías que podrían haberse colado si un nicho era ""
                itemNichesSet.delete("");


                if (tag1 !== 'Todos' && !itemNichesSet.has(tag1)) return false;
                if (tag2 !== 'Todos' && tag2 !== tag1 && !itemNichesSet.has(tag2)) return false;
                
                if (searchTerm) {
                    const nameMatch = item.name && item.name.toLowerCase().includes(searchTerm);
                    const nicheSearchMatch = Array.from(itemNichesSet).some(n => n.toLowerCase().includes(searchTerm));
                    if (!nameMatch && !nicheSearchMatch) return false;
                }
                return true;
            });
            
            // console.log("Número de resultados después de filtrar:", filteredData.length);
            displayResults();
            showLoader(false);
            resultsContainerDiv.classList.remove('hidden');
            noResultsMessageP.classList.toggle('hidden', filteredData.length === 0);
        }, 50); // Reducido el timeout
    }
    
    function displayResults() {
        resultsContainerDiv.innerHTML = '';
        // console.log("displayResults llamado con filteredData de longitud:", filteredData.length);

        if (filteredData.length === 0) {
            noResultsMessageP.classList.remove('hidden');
            return;
        }
        noResultsMessageP.classList.add('hidden');

        filteredData.forEach(item => {
            if (!item || typeof item.id === 'undefined' || item.id === '') { // Chequeo más estricto del ID
                console.warn("Intentando mostrar item inválido o sin ID válido:", item);
                return; 
            }
            const impact = calculateImpact(item);
            
            const card = document.createElement('a'); 
            card.className = 'result-card';
            card.href = `influencer_metrics.html?id=${encodeURIComponent(item.id)}`;
            
            card.innerHTML = `
                <h3>${item.name || 'Nombre no disponible'}</h3>
                <p class="text-secondary">${item.platform || 'N/A'}</p>
                <p>👥 Seguidores: ${(item.followers || 0).toLocaleString()}</p>
                <p>❤️ Likes (promedio): ${(item.likesAvg || 0).toLocaleString()}</p>
                <p>💬 Comentarios (promedio): ${(item.commentsAvg || 0).toLocaleString()}</p>
                <p class="text-impact">📊 Impacto Estimado: ${impact}%</p>
            `;
            resultsContainerDiv.appendChild(card);
        });
        // console.log("Tarjetas de resultados generadas.");
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
    
    // Inicialización de Listeners
    searchBtnEl.addEventListener('click', applyFiltersAndSearch);
    searchInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') applyFiltersAndSearch();
    });
    [platformFilterSelect, followersFilterSelect, tag1FilterSelect, tag2FilterSelect].forEach(filterElement => {
        filterElement.addEventListener('change', applyFiltersAndSearch);
    });
    tabsNodeList.forEach(t => t.addEventListener('click', handleTabClick));

    // Carga inicial de datos
    loadInfluencersCsv()
        .then(() => {
            console.log("Aplicación Caza Influencers inicializada y CSV cargado.");
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.tab === 'campanas') { // Si la pestaña activa por defecto es campañas
                 initializeCampaignForm();
                 displayCampaignData(currentCampaignData);
            }
            // La vista explorar ya se puebla con applyFiltersAndSearch() llamado desde loadInfluencersCsv()
        })
        .catch(error => {
            console.error("Fallo mayor en la inicialización de la aplicación:", error);
            // Mensajes de error ya deberían estar en la UI desde loadInfluencersCsv
        });
});
