'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessageElement = document.getElementById('error-message');
    const loadingMessageElement = document.getElementById('loading-message');
    const loginButton = document.getElementById('login-button');

    let users = [];

    function showLoading(isLoading) {
        if (isLoading) {
            loadingMessageElement.classList.remove('hidden');
            loginButton.disabled = true;
            loginButton.textContent = 'Cargando...';
        } else {
            loadingMessageElement.classList.add('hidden');
            loginButton.disabled = false;
            loginButton.textContent = 'Iniciar sesión';
        }
    }

    function showError(message) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
    }

    function hideError() {
        errorMessageElement.style.display = 'none';
    }

    async function loadUsers() {
        showLoading(true);
        hideError();
        try {
            const response = await fetch('data/users.csv');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvText = await response.text();
            return new Promise((resolve, reject) => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.data && results.data.length > 0) {
                            users = results.data;
                            console.log('Usuarios cargados:', users.length);
                            showLoading(false);
                            resolve();
                        } else {
                            reject('No se encontraron usuarios o el CSV está vacío.');
                        }
                    },
                    error: (error) => {
                        reject(error.message);
                    }
                });
            });
        } catch (error) {
            console.error('Error crítico cargando usuarios:', error);
            showError(`Error al cargar datos de usuario: ${error}. Intenta recargar.`);
            showLoading(false);
            throw error; // Re-throw para detener la ejecución si es crítico
        }
    }

    function validateLogin(username, password) {
        return users.some(user => user.username === username && user.password === password);
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (users.length === 0) {
            showError("Los datos de usuario aún no están listos. Por favor espera.");
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (validateLogin(username, password)) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('username', username);
            // Opcional: guardar rol si se usa después
            // const user = users.find(u => u.username === username);
            // localStorage.setItem('userRole', user.role);
            
            window.location.href = 'index.html';
        } else {
            showError('Usuario o contraseña incorrectos.');
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Cargar usuarios al iniciar
    loadUsers().then(() => {
        console.log("Sistema de login listo.");
        // Enfocar el campo de usuario una vez cargados los datos
        usernameInput.focus();
    }).catch(error => {
        console.error("Fallo en la inicialización del login:", error);
        // El mensaje de error ya se muestra en loadUsers
    });

    // Si el usuario ya está logueado y de alguna manera llega a login.html, redirigirlo.
    if (localStorage.getItem('isLoggedIn') === 'true') {
        window.location.href = 'index.html';
    }
});