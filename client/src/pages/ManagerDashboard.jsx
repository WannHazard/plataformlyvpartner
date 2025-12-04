import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '../index.css';
import LocationPicker from '../components/LocationPicker';

function ManagerDashboard() {
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState('logs');
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'worker' });
    const [editingUser, setEditingUser] = useState(null);
    const [newLocation, setNewLocation] = useState({ name: '', latitude: -33.4489, longitude: -70.6693, radius: 100 });
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [newAssignment, setNewAssignment] = useState({ userId: '', locationId: '' });
    const [selectedWorker, setSelectedWorker] = useState(null);
    const [workerProfile, setWorkerProfile] = useState(null);
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterAssignmentStatus, setFilterAssignmentStatus] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [selectedLocationForLogs, setSelectedLocationForLogs] = useState(null);

    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchLogs();
        fetchUsers();
        fetchLocations();
        fetchAssignments();
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/logs`);
            setLogs(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/users`);
            setUsers(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchLocations = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/locations`);
            setLocations(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAssignments = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/assignments?t=${new Date().getTime()}`);
            setAssignments(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchWorkerProfile = async (workerId) => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/workers/${workerId}/profile`);
            setWorkerProfile(res.data);
            setSelectedWorker(workerId);
        } catch (err) {
            console.error(err);
            alert('Error al cargar perfil');
        }
    };

    const calculateDuration = (start, end) => {
        if (!end) return 'En curso';
        const startTime = new Date(start);
        const endTime = new Date(end);
        const diff = endTime - startTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/users`, newUser);
            setNewUser({ username: '', password: '', role: 'worker' });
            fetchUsers();
            alert('✅ Usuario creado exitosamente');
        } catch (err) {
            alert('Error al crear usuario');
        }
    };

    const handleDeleteUser = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/api/users/${id}`);
            fetchUsers();
        } catch (err) {
            alert('Error al eliminar usuario');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${import.meta.env.VITE_SERVER_URL}/api/users/${editingUser.id}`, editingUser);
            setEditingUser(null);
            fetchUsers();
            alert('✅ Usuario actualizado');
        } catch (err) {
            alert('Error al actualizar usuario');
        }
    };

    const handleCreateLocation = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/locations`, {
                name: newLocation.name,
                lat: parseFloat(newLocation.latitude),
                lon: parseFloat(newLocation.longitude),
                radius: parseFloat(newLocation.radius)
            });
            setNewLocation({ name: '', latitude: -33.4489, longitude: -70.6693, radius: 100 });
            setShowLocationPicker(false);
            fetchLocations();
            alert('✅ Lugar de trabajo creado');
        } catch (err) {
            alert('Error al crear lugar');
        }
    };

    const handleDeleteLocation = async (id) => {
        if (!window.confirm('¿Estás seguro de eliminar este lugar de trabajo? Esto también eliminará todas las asignaciones asociadas.')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/api/locations/${id}`);
            fetchLocations();
            setSelectedLocation(null);
            alert('✅ Lugar eliminado exitosamente');
        } catch (err) {
            alert('Error al eliminar lugar: ' + (err.response?.data?.error || err.message));
        }
        localStorage.removeItem('user');
        navigate('/login');
    };

    const workers = users.filter(u => u.role === 'worker');

    // Filtered data
    const filteredLogs = filterLocation === 'all'
        ? logs
        : logs.filter(log => {
            const userAssignments = assignments.filter(a => a.user_id === log.user_id && a.status === 'active');
            return userAssignments.some(a => a.location_id === parseInt(filterLocation));
        });

    const filteredAssignments = filterAssignmentStatus === 'all'
        ? assignments
        : assignments.filter(a => a.status === filterAssignmentStatus);

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/assignments`, newAssignment);
            setNewAssignment({ userId: '', locationId: '' });
            fetchAssignments();
            alert('✅ Trabajador asignado exitosamente');
        } catch (err) {
            alert('Error al asignar trabajador: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleToggleAssignmentStatus = async (id, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'finished' : 'active';
        const action = newStatus === 'finished' ? 'finalizar' : 'reactivar';

        if (!window.confirm(`¿Deseas ${action} esta asignación?`)) return;

        try {
            await axios.patch(`${import.meta.env.VITE_SERVER_URL}/api/assignments/${id}/status`, { status: newStatus });
            fetchAssignments();
            alert(`✅ Asignación ${newStatus === 'finished' ? 'finalizada' : 'reactivada'} exitosamente`);
        } catch (err) {
            alert('Error al actualizar estado de asignación: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleDeleteAssignment = async (id) => {
        if (!window.confirm('¿Eliminar esta asignación permanentemente?')) return;
        try {
            await axios.delete(`${import.meta.env.VITE_SERVER_URL}/api/assignments/${id}`);
            fetchAssignments();
            alert('✅ Asignación eliminada');
        } catch (err) {
            alert('Error al eliminar asignación: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '20px' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div className="card" style={{
                    marginBottom: '24px',
                    background: 'var(--primary-gradient)',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                            <img src="/logo.png" alt="L&V" style={{ height: '40px', filter: 'brightness(0) invert(1)' }} />
                            <h2 style={{ margin: 0 }}>Panel de Encargado</h2>
                        </div>
                        <p style={{ opacity: 0.9, fontSize: '14px' }}>Bienvenido, {user.username}</p>
                    </div>
                    <button onClick={handleLogout} className="btn btn-secondary">
                        Cerrar Sesión
                    </button>
                </div>

                {/* Tabs */}
                <div className="tabs">
                    <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                        📊 Registros
                    </button>
                    <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                        👥 Trabajadores
                    </button>
                    <button className={`tab ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}>
                        📍 Lugares
                    </button>
                    <button className={`tab ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
                        🔗 Asignaciones
                    </button>
                    <button className={`tab ${activeTab === 'profiles' ? 'active' : ''}`} onClick={() => setActiveTab('profiles')}>
                        📈 Perfiles
                    </button>
                </div>

                {/* Logs Tab */}
                {activeTab === 'logs' && (
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Panel izquierdo: Lugares Activos */}
                        <div className="card">
                            <h3 style={{ marginBottom: '16px' }}>📍 Lugares de Trabajo Activos</h3>
                            {locations.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {locations.map(loc => {
                                        const activeWorkersCount = assignments.filter(a => a.location_id === loc.id && a.status === 'active').length;
                                        const logsCount = logs.filter(log => {
                                            const userAssignments = assignments.filter(a => a.user_id === log.user_id && a.status === 'active');
                                            return userAssignments.some(a => a.location_id === loc.id);
                                        }).length;

                                        return (
                                            <div
                                                key={loc.id}
                                                onClick={() => setSelectedLocationForLogs(loc)}
                                                style={{
                                                    padding: '16px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    cursor: 'pointer',
                                                    background: selectedLocationForLogs?.id === loc.id ? 'var(--primary-gradient)' : 'rgba(0,0,0,0.02)',
                                                    color: selectedLocationForLogs?.id === loc.id ? 'white' : 'var(--text-primary)',
                                                    transition: 'all 0.3s ease',
                                                    border: selectedLocationForLogs?.id === loc.id ? '2px solid #667eea' : '2px solid transparent'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                                                            📍 {loc.name}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '16px', fontSize: '13px', opacity: 0.9 }}>
                                                            <div>
                                                                <span style={{ opacity: 0.7 }}>👥 Trabajadores: </span>
                                                                <strong>{activeWorkersCount}</strong>
                                                            </div>
                                                            <div>
                                                                <span style={{ opacity: 0.7 }}>📋 Registros: </span>
                                                                <strong>{logsCount}</strong>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '14px', opacity: 0.8 }}>▶</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                                    No hay lugares de trabajo creados
                                </p>
                            )}
                        </div>

                        {/* Panel derecho: Registros del lugar seleccionado */}
                        <div className="card">
                            {selectedLocationForLogs ? (
                                <>
                                    <div style={{
                                        background: 'var(--primary-gradient)',
                                        color: 'white',
                                        padding: '16px',
                                        borderRadius: 'var(--radius)',
                                        marginBottom: '16px'
                                    }}>
                                        <h3 style={{ margin: '0 0 4px 0' }}>📋 Registros de {selectedLocationForLogs.name}</h3>
                                        <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                                            Marcaciones de trabajadores asignados
                                        </p>
                                    </div>

                                    <div style={{ overflowX: 'auto' }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Usuario</th>
                                                    <th>Entrada</th>
                                                    <th>Salida</th>
                                                    <th>Horas</th>
                                                    <th>Reporte</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {logs
                                                    .filter(log => {
                                                        const userAssignments = assignments.filter(a => a.user_id === log.user_id && a.status === 'active');
                                                        return userAssignments.some(a => a.location_id === selectedLocationForLogs.id);
                                                    })
                                                    .map(log => (
                                                        <tr key={log.id}>
                                                            <td><strong>{log.username}</strong></td>
                                                            <td>{new Date(log.clock_in_time).toLocaleString()}</td>
                                                            <td>{log.clock_out_time ? new Date(log.clock_out_time).toLocaleString() : '🔴 En turno'}</td>
                                                            <td><strong>{calculateDuration(log.clock_in_time, log.clock_out_time)}</strong></td>
                                                            <td>
                                                                {log.photo_path && <a href={`${import.meta.env.VITE_SERVER_URL}${log.photo_path}`} target="_blank" rel="noopener noreferrer">📷 Ver</a>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                        {logs.filter(log => {
                                            const userAssignments = assignments.filter(a => a.user_id === log.user_id && a.status === 'active');
                                            return userAssignments.some(a => a.location_id === selectedLocationForLogs.id);
                                        }).length === 0 && (
                                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 0', fontStyle: 'italic' }}>
                                                    No hay registros para este lugar de trabajo
                                                </p>
                                            )}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '100px 40px', color: 'var(--text-secondary)' }}>
                                    <p style={{ fontSize: '60px', margin: '0 0 16px 0' }}>👈</p>
                                    <p style={{ fontSize: '18px', marginBottom: '8px' }}>Selecciona un lugar de trabajo</p>
                                    <p style={{ fontSize: '14px', opacity: 0.7, margin: 0 }}>
                                        Haz clic en un lugar para ver sus registros de marcaciones
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="card">
                            <h3 style={{ marginBottom: '16px' }}>🗺️ Mapa de Ubicaciones</h3>
                            <div style={{ height: '500px', borderRadius: 'var(--radius)' }}>
                                <MapContainer center={[-33.4489, -70.6693]} zoom={10} style={{ height: '100%', width: '100%', borderRadius: 'var(--radius)' }}>
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    {logs.map(log => (
                                        log.clock_in_lat && (
                                            <Marker key={log.id} position={[log.clock_in_lat, log.clock_in_lon]}>
                                                <Popup>
                                                    <b>{log.username}</b><br />
                                                    Entrada: {new Date(log.clock_in_time).toLocaleTimeString()}
                                                </Popup>
                                            </Marker>
                                        )
                                    ))}
                                </MapContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="fade-in">
                        {/* Create/Edit User Form */}
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h4>➕ {editingUser ? 'Editar Usuario' : 'Crear Nuevo Trabajador'}</h4>
                            <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', marginTop: '16px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Usuario</label>
                                    <input
                                        type="text"
                                        placeholder="Usuario"
                                        value={editingUser ? editingUser.username : newUser.username}
                                        onChange={e => editingUser ? setEditingUser({ ...editingUser, username: e.target.value }) : setNewUser({ ...newUser, username: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>
                                        {editingUser ? 'Nueva Contraseña' : 'Contraseña'}
                                    </label>
                                    <input
                                        type="password"
                                        placeholder={editingUser ? "Dejar vacío para mantener" : "Contraseña"}
                                        value={editingUser ? (editingUser.password || '') : newUser.password}
                                        onChange={e => editingUser ? setEditingUser({ ...editingUser, password: e.target.value }) : setNewUser({ ...newUser, password: e.target.value })}
                                        required={!editingUser}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Rol</label>
                                    <select
                                        value={editingUser ? editingUser.role : newUser.role}
                                        onChange={e => editingUser ? setEditingUser({ ...editingUser, role: e.target.value }) : setNewUser({ ...newUser, role: e.target.value })}
                                    >
                                        <option value="worker">Trabajador</option>
                                        <option value="admin">Encargado</option>
                                    </select>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button type="submit" className={editingUser ? "btn btn-warning" : "btn btn-success"}>
                                        {editingUser ? '✏️ Actualizar' : '➕ Crear'}
                                    </button>
                                    {editingUser && (
                                        <button type="button" onClick={() => setEditingUser(null)} className="btn btn-secondary">
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        {/* Worker List and Profile */}
                        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                            {/* Left: Worker List */}
                            <div className="card">
                                <h3 style={{ marginBottom: '16px' }}>👥 Trabajadores</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {workers.map(w => (
                                        <div
                                            key={w.id}
                                            onClick={() => fetchWorkerProfile(w.id)}
                                            style={{
                                                padding: '12px',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer',
                                                background: selectedWorker === w.id ? 'var(--primary-gradient)' : 'rgba(0,0,0,0.02)',
                                                color: selectedWorker === w.id ? 'white' : 'var(--text-primary)',
                                                transition: 'all 0.3s ease',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <strong>{w.username}</strong>
                                                <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>#{w.id}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setEditingUser(w); }}
                                                    className="btn btn-warning"
                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteUser(w.id); }}
                                                    className="btn btn-danger"
                                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Admins Section */}
                                <h3 style={{ marginTop: '24px', marginBottom: '16px' }}>👨‍💼 Administradores</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {users.filter(u => u.role === 'admin').map(admin => (
                                        <div
                                            key={admin.id}
                                            style={{
                                                padding: '12px',
                                                borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(102, 126, 234, 0.1)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <strong>{admin.username}</strong>
                                                <p style={{ fontSize: '12px', opacity: 0.7, margin: 0 }}>Admin</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Worker Profile */}
                            <div className="card">
                                {workerProfile ? (
                                    <>
                                        {/* Profile Header */}
                                        <div style={{
                                            background: 'var(--success-gradient)',
                                            color: 'white',
                                            padding: '24px',
                                            borderRadius: 'var(--radius)',
                                            marginBottom: '20px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h2 style={{ marginBottom: '4px' }}>👷 {workerProfile.username}</h2>
                                                    <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>ID: {workerProfile.id} • Trabajador</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: '36px', fontWeight: '700' }}>
                                                        {workerProfile.monthlyHours}
                                                    </div>
                                                    <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>Horas este mes</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Locations and Map */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                            {/* Assigned Locations */}
                                            <div>
                                                <h4 style={{ marginBottom: '12px' }}>📍 Lugares Asignados</h4>
                                                {workerProfile.assignments.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {workerProfile.assignments.map((a, i) => (
                                                            <div key={i} style={{
                                                                padding: '12px',
                                                                background: 'rgba(56, 239, 125, 0.1)',
                                                                borderRadius: 'var(--radius-sm)',
                                                                borderLeft: '4px solid #38ef7d'
                                                            }}>
                                                                <strong style={{ color: '#11998e' }}>{a.location_name}</strong>
                                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                                                                    Asignado: {new Date(a.assigned_date).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin lugares asignados</p>
                                                )}
                                            </div>

                                            {/* Map of Assigned Locations */}
                                            <div>
                                                <h4 style={{ marginBottom: '12px' }}>🗺️ Mapa de Ubicaciones</h4>
                                                {workerProfile.assignments.length > 0 ? (
                                                    <div style={{ height: '250px', borderRadius: 'var(--radius)', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                                                        <MapContainer
                                                            center={
                                                                locations.find(loc => loc.id === workerProfile.assignments[0]?.location_id) ?
                                                                    [locations.find(loc => loc.id === workerProfile.assignments[0].location_id).latitude,
                                                                    locations.find(loc => loc.id === workerProfile.assignments[0].location_id).longitude] :
                                                                    [-33.4489, -70.6693]
                                                            }
                                                            zoom={12}
                                                            style={{ height: '100%', width: '100%' }}
                                                        >
                                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                            {workerProfile.assignments.map((assignment, idx) => {
                                                                const location = locations.find(loc => loc.name === assignment.location_name);
                                                                if (location) {
                                                                    return (
                                                                        <Marker key={idx} position={[location.latitude, location.longitude]}>
                                                                            <Popup>
                                                                                <strong>{location.name}</strong>
                                                                            </Popup>
                                                                        </Marker>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                        </MapContainer>
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        height: '250px',
                                                        borderRadius: 'var(--radius)',
                                                        background: 'rgba(0,0,0,0.02)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'var(--text-secondary)',
                                                        border: '2px dashed var(--border-color)'
                                                    }}>
                                                        <p>Sin ubicaciones para mostrar</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Work History */}
                                        <h4 style={{ marginBottom: '12px' }}>📊 Historial del Mes</h4>
                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th>
                                                        <th>Entrada</th>
                                                        <th>Salida</th>
                                                        <th>Duración</th>
                                                        <th>Reporte</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {workerProfile.logs.map(log => (
                                                        <tr key={log.id}>
                                                            <td>{new Date(log.clock_in_time).toLocaleDateString()}</td>
                                                            <td>{new Date(log.clock_in_time).toLocaleTimeString()}</td>
                                                            <td>{log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString() : '🔴 Activo'}</td>
                                                            <td><strong>{calculateDuration(log.clock_in_time, log.clock_out_time)}</strong></td>
                                                            <td>
                                                                {log.photo_path && (
                                                                    <a href={`${import.meta.env.VITE_SERVER_URL}${log.photo_path}`} target="_blank" rel="noopener noreferrer">📷 Ver</a>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                                        <p style={{ fontSize: '48px', margin: 0 }}>👈</p>
                                        <p style={{ fontSize: '18px', marginTop: '16px' }}>Selecciona un trabajador para ver su perfil completo</p>
                                        <p style={{ fontSize: '14px', opacity: 0.7 }}>
                                            Verás: horas trabajadas, lugares asignados, mapa y registros del mes
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Locations Tab */}
                {activeTab === 'locations' && (
                    <div className="fade-in">
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h4>➕ Crear Nuevo Lugar de Trabajo</h4>
                            <form onSubmit={handleCreateLocation} style={{ marginTop: '16px' }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Nombre del Lugar</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Oficina Central"
                                        value={newLocation.name}
                                        onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600' }}>📍 Ubicación</label>
                                    <LocationPicker
                                        initialPosition={[newLocation.latitude, newLocation.longitude]}
                                        onLocationSelect={(lat, lon) => {
                                            setNewLocation({ ...newLocation, latitude: lat, longitude: lon });
                                        }}
                                    />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Radio de Cobertura (metros)</label>
                                    <input
                                        type="number"
                                        placeholder="100"
                                        value={newLocation.radius}
                                        onChange={e => setNewLocation({ ...newLocation, radius: e.target.value })}
                                        required
                                        style={{ maxWidth: '200px' }}
                                    />
                                </div>

                                <button type="submit" className="btn btn-success">
                                    ➕ Crear Lugar de Trabajo
                                </button>
                            </form>
                        </div>

                        <div className="card">
                            <h3 style={{ marginBottom: '16px' }}>📍 Lugares de Trabajo</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px' }}>
                                {/* Lista de lugares */}
                                <div>
                                    {locations.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {locations.map(loc => (
                                                <div
                                                    key={loc.id}
                                                    onClick={() => setSelectedLocation(loc)}
                                                    style={{
                                                        padding: '14px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        cursor: 'pointer',
                                                        background: selectedLocation?.id === loc.id ? 'var(--primary-gradient)' : 'rgba(0,0,0,0.02)',
                                                        color: selectedLocation?.id === loc.id ? 'white' : 'var(--text-primary)',
                                                        transition: 'all 0.3s ease',
                                                        border: selectedLocation?.id === loc.id ? '2px solid #667eea' : '2px solid transparent'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{loc.name}</div>
                                                            <div style={{ fontSize: '12px', opacity: 0.8 }}>Radio: {loc.radius}m</div>
                                                        </div>
                                                        <div style={{ fontSize: '20px' }}>📍</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                                            No hay lugares de trabajo creados
                                        </p>
                                    )}
                                </div>

                                {/* Panel de detalles */}
                                <div>
                                    {selectedLocation ? (
                                        <>
                                            {/* Header del lugar seleccionado */}
                                            <div style={{
                                                background: 'var(--primary-gradient)',
                                                color: 'white',
                                                padding: '20px',
                                                borderRadius: 'var(--radius)',
                                                marginBottom: '16px'
                                            }}>
                                                <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{selectedLocation.name}</h2>
                                                <p style={{ margin: 0, opacity: 0.9, fontSize: '14px' }}>
                                                    📍 Ubicación de trabajo #{selectedLocation.id}
                                                </p>
                                            </div>

                                            {/* Información detallada */}
                                            <div className="card" style={{ marginBottom: '16px' }}>
                                                <h4 style={{ marginBottom: '12px' }}>ℹ️ Información del Lugar</h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                                    <div style={{
                                                        padding: '12px',
                                                        background: 'rgba(102, 126, 234, 0.08)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        borderLeft: '4px solid #667eea'
                                                    }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            Latitud
                                                        </div>
                                                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                                            {selectedLocation.latitude}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        padding: '12px',
                                                        background: 'rgba(102, 126, 234, 0.08)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        borderLeft: '4px solid #667eea'
                                                    }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            Longitud
                                                        </div>
                                                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                                            {selectedLocation.longitude}
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        padding: '12px',
                                                        background: 'rgba(56, 239, 125, 0.08)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        borderLeft: '4px solid #38ef7d',
                                                        gridColumn: '1 / -1'
                                                    }}>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                            Radio de Cobertura
                                                        </div>
                                                        <div style={{ fontSize: '16px', fontWeight: '600' }}>
                                                            {selectedLocation.radius} metros
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mapa */}
                                            <div className="card" style={{ marginBottom: '16px' }}>
                                                <h4 style={{ marginBottom: '12px' }}>🗺️ Ubicación en Mapa</h4>
                                                <div style={{ height: '400px', borderRadius: 'var(--radius)', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
                                                    <MapContainer
                                                        center={[selectedLocation.latitude, selectedLocation.longitude]}
                                                        zoom={15}
                                                        style={{ height: '100%', width: '100%' }}
                                                    >
                                                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                                        <Marker position={[selectedLocation.latitude, selectedLocation.longitude]}>
                                                            <Popup>
                                                                <strong>{selectedLocation.name}</strong><br />
                                                                Radio: {selectedLocation.radius}m
                                                            </Popup>
                                                        </Marker>
                                                    </MapContainer>
                                                </div>
                                            </div>

                                            {/* Asignaciones en este lugar */}
                                            <div className="card" style={{ marginBottom: '16px' }}>
                                                <h4 style={{ marginBottom: '12px' }}>👥 Trabajadores Asignados</h4>
                                                {assignments.filter(a => a.location_id === selectedLocation.id && a.status === 'active').length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {assignments
                                                            .filter(a => a.location_id === selectedLocation.id && a.status === 'active')
                                                            .map(a => (
                                                                <div key={a.id} style={{
                                                                    padding: '10px',
                                                                    background: 'rgba(56, 239, 125, 0.08)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    borderLeft: '4px solid #38ef7d'
                                                                }}>
                                                                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{a.username}</div>
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                                        Asignado desde: {new Date(a.assigned_date).toLocaleDateString()}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                    </div>
                                                ) : (
                                                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                                                        Sin trabajadores asignados actualmente
                                                    </p>
                                                )}
                                            </div>

                                            {/* Acciones */}
                                            <div className="card">
                                                <h4 style={{ marginBottom: '12px' }}>⚙️ Acciones</h4>
                                                <button
                                                    onClick={() => handleDeleteLocation(selectedLocation.id)}
                                                    className="btn btn-danger"
                                                    style={{ width: '100%', justifyContent: 'center' }}
                                                >
                                                    🗑️ Eliminar Lugar de Trabajo
                                                </button>
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', marginBottom: 0 }}>
                                                    ⚠️ Esto también eliminará todas las asignaciones asociadas a este lugar
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '100px 40px', color: 'var(--text-secondary)' }}>
                                            <p style={{ fontSize: '60px', margin: '0 0 16px 0' }}>👈</p>
                                            <p style={{ fontSize: '18px', marginBottom: '8px' }}>Selecciona un lugar de trabajo</p>
                                            <p style={{ fontSize: '14px', opacity: 0.7, margin: 0 }}>
                                                Haz clic en un lugar de la lista para ver sus detalles, mapa y opciones
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assignments Tab */}
                {activeTab === 'assignments' && (
                    <div className="fade-in">
                        <div className="card" style={{ marginBottom: '20px' }}>
                            <h4>🔗 Asignar Trabajador a Lugar</h4>
                            <form onSubmit={handleCreateAssignment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginTop: '16px', alignItems: 'end' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Trabajador</label>
                                    <select
                                        value={newAssignment.userId}
                                        onChange={e => setNewAssignment({ ...newAssignment, userId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar trabajador</option>
                                        {workers.map(w => (
                                            <option key={w.id} value={w.id}>{w.username}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600' }}>Lugar</label>
                                    <select
                                        value={newAssignment.locationId}
                                        onChange={e => setNewAssignment({ ...newAssignment, locationId: e.target.value })}
                                        required
                                    >
                                        <option value="">Seleccionar lugar</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <button type="submit" className="btn btn-success">
                                    ➕ Asignar
                                </button>
                            </form>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0 }}>🔗 Asignaciones</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ fontSize: '14px', fontWeight: '600' }}>Estado:</label>
                                    <select
                                        value={filterAssignmentStatus}
                                        onChange={(e) => setFilterAssignmentStatus(e.target.value)}
                                        style={{
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--border-color)',
                                            background: 'white'
                                        }}
                                    >
                                        <option value="all">Todas</option>
                                        <option value="active">Activas</option>
                                        <option value="finished">Finalizadas</option>
                                    </select>
                                </div>
                            </div>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Trabajador</th>
                                        <th>Lugar</th>
                                        <th>Fecha Asignación</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssignments.map(a => (
                                        <tr key={a.id}>
                                            <td><strong>{a.username}</strong></td>
                                            <td>{a.location_name}</td>
                                            <td>{new Date(a.assigned_date).toLocaleDateString()}</td>
                                            <td>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '12px',
                                                    fontWeight: '600',
                                                    background: a.status === 'active' ? '#38ef7d22' : '#88888822',
                                                    color: a.status === 'active' ? '#11998e' : '#666666',
                                                    border: `1px solid ${a.status === 'active' ? '#38ef7d' : '#888888'}44`
                                                }}>
                                                    {a.status === 'active' ? '✅ Activo' : '🏁 Finalizado'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleToggleAssignmentStatus(a.id, a.status)}
                                                        className="btn btn-warning"
                                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                                    >
                                                        {a.status === 'active' ? '🏁 Finalizar' : '🔄 Reactivar'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAssignment(a.id)}
                                                        className="btn btn-danger"
                                                        style={{ padding: '6px 12px', fontSize: '12px' }}
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Profiles Tab */}
                {activeTab === 'profiles' && (
                    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '16px' }}>👷 Seleccionar Trabajador</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {workers.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => fetchWorkerProfile(w.id)}
                                        className={`btn ${selectedWorker === w.id ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ justifyContent: 'flex-start' }}
                                    >
                                        {w.username}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="card">
                            {workerProfile ? (
                                <>
                                    <div style={{
                                        background: 'var(--primary-gradient)',
                                        color: 'white',
                                        padding: '24px',
                                        borderRadius: 'var(--radius)',
                                        marginBottom: '20px'
                                    }}>
                                        <h2>{workerProfile.username}</h2>
                                        <p style={{ fontSize: '14px', opacity: 0.9 }}>Trabajador</p>
                                        <div style={{ marginTop: '16px', fontSize: '32px', fontWeight: '700' }}>
                                            {workerProfile.monthlyHours}
                                        </div>
                                        <p style={{ fontSize: '14px', opacity: 0.9 }}>Horas trabajadas este mes</p>
                                    </div>

                                    <h4 style={{ marginBottom: '12px' }}>📍 Lugares Asignados</h4>
                                    {workerProfile.assignments.length > 0 ? (
                                        <div style={{ marginBottom: '20px' }}>
                                            {workerProfile.assignments.map((a, i) => (
                                                <div key={i} style={{
                                                    padding: '12px',
                                                    background: 'rgba(102, 126, 234, 0.1)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    marginBottom: '8px'
                                                }}>
                                                    <strong>{a.location_name}</strong>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                        Asignado: {new Date(a.assigned_date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Sin asignaciones</p>
                                    )}

                                    <h4 style={{ marginBottom: '12px' }}>📊 Registros del Mes</h4>
                                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Entrada</th>
                                                    <th>Salida</th>
                                                    <th>Duración</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {workerProfile.logs.map(log => (
                                                    <tr key={log.id}>
                                                        <td>{new Date(log.clock_in_time).toLocaleDateString()}</td>
                                                        <td>{new Date(log.clock_in_time).toLocaleTimeString()}</td>
                                                        <td>{log.clock_out_time ? new Date(log.clock_out_time).toLocaleTimeString() : '🔴'}</td>
                                                        <td><strong>{calculateDuration(log.clock_in_time, log.clock_out_time)}</strong></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                                    <p style={{ fontSize: '48px' }}>👈</p>
                                    <p>Selecciona un trabajador para ver su perfil</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}

export default ManagerDashboard;
