class ServiceTracker {
    constructor() {
        // Firebase configuration
        this.firebaseConfig = {
            apiKey: "AIzaSyDUh6Cv8K1CrqS8HNPN5pW7zPuFhaD1Qzo",
            authDomain: "service-hours-tracker.firebaseapp.com",
            databaseURL: "https://service-hours-tracker-default-rtdb.firebaseio.com",
            projectId: "service-hours-tracker",
            storageBucket: "service-hours-tracker.appspot.com",
            messagingSenderId: "359123774743",
            appId: "1:359123774743:web:9f1234567890abcdef"
        };

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(this.firebaseConfig);
        }
        this.database = firebase.database();
        this.servicesRef = this.database.ref('services');

        this.services = [];
        this.serviceForm = document.getElementById('serviceForm');
        this.notificationDiv = document.getElementById('notification');
        this.serviceTableBody = document.getElementById('serviceTableBody');
        this.weeklySummaryTableBody = document.getElementById('weeklySummaryTableBody');
        this.searchInput = document.getElementById('searchInput');
        this.serviceTableSection = document.getElementById('serviceTableSection');
        this.toggleServiceTableBtn = document.getElementById('toggleServiceTableBtn');
        this.exportExcelBtn = document.getElementById('exportExcelBtn');

        this.initEventListeners();
        this.loadServicesFromDatabase();
    }

    initEventListeners() {
        this.serviceForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startService();
        });

        this.searchInput.addEventListener('input', () => this.renderTables());
        this.toggleServiceTableBtn.addEventListener('click', () => this.toggleServiceTable());
        this.exportExcelBtn.addEventListener('click', () => this.exportToExcel());
    }

    loadServicesFromDatabase() {
        this.servicesRef.on('value', (snapshot) => {
            const data = snapshot.val();
            this.services = data ? Object.values(data) : [];
            this.renderTables();
        });
    }

    startService() {
        const nameInput = document.getElementById('nameInput');
        const rangeInput = document.getElementById('rangeInput');
        const dateInput = document.getElementById('dateInput');
        
        const service = {
            id: Date.now(), // Unique identifier
            name: nameInput.value,
            range: rangeInput.value,
            date: dateInput.value,
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null
        };

        // Save to Firebase
        this.servicesRef.push(service);
        this.showNotification(`Registro de horas iniciado para ${service.name}`);

        nameInput.value = '';
        rangeInput.value = '';
        dateInput.value = '';
    }

    endService(id) {
        // Find the service with the matching ID
        const serviceIndex = this.services.findIndex(s => s.id === id);
        if (serviceIndex === -1) return;

        const service = this.services[serviceIndex];
        service.endTime = new Date().toISOString();
        service.duration = this.calculateDuration(service.startTime, service.endTime);
        
        // Update in Firebase
        this.servicesRef.orderByChild('id').equalTo(id).once('child_added', (snapshot) => {
            snapshot.ref.update(service);
        });

        this.showNotification(`Registro de horas finalizado para ${service.name}`);
    }

    calculateDuration(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diff = endDate - startDate;
        
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        return `${hours}h ${minutes}m ${seconds}s`;
    }

    renderTables() {
        this.renderServiceTable();
        this.renderWeeklySummary();
    }

    renderServiceTable() {
        const searchTerm = this.searchInput.value.toLowerCase();
        this.serviceTableBody.innerHTML = '';

        this.services
            .filter(service => service.name.toLowerCase().includes(searchTerm))
            .forEach((service) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${service.name}</td>
                    <td>${service.range}</td>
                    <td>${service.date}</td>
                    <td>${new Date(service.startTime).toLocaleString()}</td>
                    <td>${service.endTime ? new Date(service.endTime).toLocaleString() : 'En curso'}</td>
                    <td>${service.duration || 'N/A'}</td>
                    <td>
                        ${!service.endTime ? 
                            `<button onclick="serviceTracker.endService(${service.id})">Finalizar</button>` : 
                            'Completado'}
                    </td>
                `;
                this.serviceTableBody.appendChild(row);
            });
    }

    renderWeeklySummary() {
        this.weeklySummaryTableBody.innerHTML = '';
        const weeklyHours = this.calculateWeeklyHours();

        Object.entries(weeklyHours).forEach(([name, hours]) => {
            const row = document.createElement('tr');
            row.className = hours >= 28 ? 'completed' : 'not-completed';
            row.innerHTML = `
                <td>${name}</td>
                <td>${hours.toFixed(2)}</td>
                <td>${hours >= 28 ? 'Meta Cumplida' : 'Meta Pendiente'}</td>
            `;
            this.weeklySummaryTableBody.appendChild(row);
        });
    }

    calculateWeeklyHours() {
        const weeklyHours = {};
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        this.services
            .filter(service => service.endTime && new Date(service.endTime) > oneWeekAgo)
            .forEach(service => {
                const hours = this.parseHoursDuration(service.duration);
                weeklyHours[service.name] = (weeklyHours[service.name] || 0) + hours;
            });

        return weeklyHours;
    }

    parseHoursDuration(duration) {
        if (!duration) return 0;
        const match = duration.match(/(\d+)h/);
        return match ? parseFloat(match[1]) : 0;
    }

    toggleServiceTable() {
        if (this.serviceTableSection.style.display === 'none') {
            this.serviceTableSection.style.display = 'block';
            this.toggleServiceTableBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar Registros de Horas';
        } else {
            this.serviceTableSection.style.display = 'none';
            this.toggleServiceTableBtn.innerHTML = '<i class="fas fa-eye"></i> Mostrar Registros de Horas';
        }
    }

    exportToExcel() {
        // Prepare data for Excel export
        const exportData = this.services.map(service => ({
            'Nombre': service.name,
            'Rango': service.range,
            'Fecha': service.date,
            'Hora de Inicio': new Date(service.startTime).toLocaleString(),
            'Hora de Fin': service.endTime ? new Date(service.endTime).toLocaleString() : 'En curso',
            'Duración': service.duration || 'N/A'
        }));

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        
        // Create workbook and add worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros de Servicio');

        // Generate Excel file
        XLSX.writeFile(workbook, `Registros_Servicio_${new Date().toISOString().split('T')[0]}.xlsx`);

        this.showNotification('Exportación a Excel completada');
    }

    showNotification(message) {
        this.notificationDiv.textContent = message;
        this.notificationDiv.style.display = 'block';
        setTimeout(() => {
            this.notificationDiv.style.display = 'none';
        }, 3000);
    }
}

const serviceTracker = new ServiceTracker();
window.serviceTracker = serviceTracker;