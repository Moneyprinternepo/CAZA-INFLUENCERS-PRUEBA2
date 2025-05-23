'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // Autenticación (básica)
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('username-display-metrics').textContent = `Viendo métricas como: ${username}`;
    }

    const loader = document.getElementById('loader-metrics');
    const metricsContent = document.getElementById('metrics-content');
    const errorMessageElement = document.getElementById('error-message-metrics');

    let allInfluencersData = []; // Para almacenar todos los influencers del CSV

    // --- UTILIDADES ESPECÍFICAS O COMUNES ---
    const calculateImpact = influencer => {
        if (!influencer || typeof influencer.followers !== 'number' || influencer.followers === 0) return 'N/A';
        return ((influencer.likesAvg / influencer.followers + influencer.commentsAvg / influencer.followers) * 100 * 1.2).toFixed(2) + '%';
    }

    // --- FUNCIONES DE GRÁFICOS (similares a las de main.js, podrían modularizarse) ---
    function createBarChart(canvasId, labels, data, label, backgroundColor, borderColor) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) {
            console.error(`Canvas con ID ${canvasId} no encontrado.`);
            return null;
        }
        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: borderColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } },
                    x: { ticks: { color: 'var(--text-secondary)' }, grid: { color: 'var(--border)' } }
                },
                plugins: { legend: { display: true, labels: { color: 'var(--text)'} } }
            }
        });
    }

    function createPieChart(canvasId, labels, data, backgroundColors, borderColors) {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
         if (!ctx) {
            console.error(`Canvas con ID ${canvasId} no encontrado.`);
            return null;
        }
        return new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { color: 'var(--text)' } },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += context.parsed + '%';
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function showLoader(show) {
        loader.classList.toggle('hidden', !show);
        metricsContent.classList.toggle('hidden', show);
    }

    function showError(message) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
        loader.classList.add('hidden');
        metricsContent.classList.add('hidden');
    }

    // --- CARGA Y VISUALIZACIÓN DE DATOS DEL INFLUENCER ---
    async function loadAndDisplayInfluencerData() {
        showLoader(true);
        const params = new URLSearchParams(window.location.search);
        const influencerId = params.get('id');

        if (!influencerId) {
            showError("No se especificó un ID de influencer.");
            return;
        }

        try {
            // Cargar todos los influencers si aún no se han cargado
            if (allInfluencersData.length === 0) {
                const response = await fetch('data/influencers.csv');
                if (!response.ok) throw new Error(`Error cargando influencers.csv: ${response.statusText}`);
                const csvText = await response.text();
                
                await new Promise((resolve, reject) => {
                     Papa.parse(csvText, {
                        header: true,
                        dynamicTyping: true,
                        skipEmptyLines: true,
                        complete: (results) => {
                            if (results.errors.length > 0) console.warn("Errores de parseo:", results.errors);
                            allInfluencersData = results.data.filter(r => r.id && r.name);
                            resolve();
                        },
                        error: (err) => reject(err.message)
                    });
                });
            }

            // Encontrar el influencer específico (usar '==' para flexibilidad de tipo si ID es string/num)
            const influencer = allInfluencersData.find(inf => inf.id == influencerId);

            if (!influencer) {
                showError(`Influencer con ID ${influencerId} no encontrado.`);
                return;
            }

            // Poblar la página con los datos del influencer
            document.getElementById('influencer-name').textContent = influencer.name;
            const avatarInitial = influencer.name ? encodeURIComponent(influencer.name.charAt(0).toUpperCase()) : 'N';
            document.getElementById('influencer-avatar').src = `https://placehold.co/150x150/ef4444/ffffff?text=${avatarInitial}`;
            document.getElementById('influencer-avatar').alt = `Avatar de ${influencer.name}`;
            
            document.getElementById('influencer-platform-followers').textContent = `${influencer.platform} • ${influencer.followers.toLocaleString()} seguidores`;
            document.getElementById('influencer-likes-comments').textContent = ❤️ ${influencer.likesAvg.toLocaleString()} Likes (prom.) • 💬 ${influencer.commentsAvg.toLocaleString()} Comentarios (prom.)`;
            document.getElementById('influencer-impact').textContent = `📊 Impacto Estimado: ${calculateImpact(influencer)}`;

            const tagsContainer = document.getElementById('influencer-tags');
            tagsContainer.innerHTML = ''; // Limpiar tags anteriores
            let niches = [];
            if (typeof influencer.niche === 'string') {
                niches = influencer.niche.split('|').map(s => s.trim());
            } else if (Array.isArray(influencer.niche)) {
                niches = influencer.niche;
            }
            niches.forEach(tagText => {
                if (tagText) {
                    const tagElement = document.createElement('span');
                    tagElement.className = 'tag';
                    tagElement.textContent = tagText;
                    tagsContainer.appendChild(tagElement);
                }
            });
            if (niches.length === 0) {
                tagsContainer.textContent = 'No especificados.';
            }


            // Datos de ejemplo para los gráficos (estos deberían venir del influencer si los tuvieras)
            const demoPlatforms = [{ name: 'Instagram', value: 40 }, { name: 'YouTube', value: 30 }, { name: 'TikTok', value: 20 }, { name: 'Facebook', value: 10 }];
            const demoAges = [{ range: '<12', value: 3 }, { range: '13-17', value: 12 }, { range: '18-24', value: 25 }, { range: '25-34', value: 30 }, { range: '35-44', value: 15 }, { range: '45-54', value: 10 }, { range: '55-64', value: 3 }, { range: '>65', value: 2 }];
            const demoGender = [{ name: 'Hombres', value: 55 }, { name: 'Mujeres', value: 45 }];

            createBarChart('platform-chart', demoPlatforms.map(d => d.name), demoPlatforms.map(d => d.value), 'Distribución', 'rgba(239, 68, 68, 0.7)', 'rgba(239, 68, 68, 1)');
            createBarChart('age-chart', demoAges.map(d => d.range), demoAges.map(d => d.value), 'Distribución', 'rgba(59, 130, 246, 0.7)', 'rgba(59, 130, 246, 1)');
            createPieChart('gender-chart', demoGender.map(d => d.name), demoGender.map(d => d.value), ['rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)'], ['rgba(239, 68, 68, 1)', 'rgba(59, 130, 246, 1)']);
            
            showLoader(false);

        } catch (error) {
            console.error("Error al cargar datos del influencer:", error);
            showError(`Error: ${error.message}. No se pudo cargar la información.`);
        }
    }

    // Iniciar la carga
    loadAndDisplayInfluencerData();
});