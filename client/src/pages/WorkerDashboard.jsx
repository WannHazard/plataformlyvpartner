import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import SlideButton from '../components/SlideButton';
import '../index.css';

function WorkerDashboard() {
    const [activeTab, setActiveTab] = useState('home');
    const [reportText, setReportText] = useState('');
    const [file, setFile] = useState(null);
    const [profile, setProfile] = useState(null);
    const [todayReports, setTodayReports] = useState([]);
    const [hasActiveClockIn, setHasActiveClockIn] = useState(false);
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user'));

    useEffect(() => {
        fetchProfile();
        fetchTodayReports();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/workers/${user.id}/profile`);
            setProfile(res.data);

            // Check if there's an active clock-in
            const activeLog = res.data.logs.find(log => log.clock_in_time && !log.clock_out_time);
            setHasActiveClockIn(!!activeLog);
        } catch (err) {
            console.error('Error loading profile:', err);
        }
    };

    const fetchTodayReports = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_SERVER_URL}/api/logs`);
            const today = new Date().toLocaleDateString();
            const myTodayLogs = res.data.filter(log =>
                log.user_id === user.id &&
                new Date(log.clock_in_time).toLocaleDateString() === today &&
                log.report_text
            );
            setTodayReports(myTodayLogs);
        } catch (err) {
            console.error('Error loading reports:', err);
        }
    };

    const getGeo = () => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) reject('Geolocation not supported');
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
                (err) => reject(err)
            );
        });
    };

    const handleClockIn = async () => {
        try {
            const { lat, lon } = await getGeo();
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/clock-in`, { userId: user.id, lat, lon });
            setHasActiveClockIn(true); // Actualizar estado inmediatamente
            alert('✅ Entrada marcada exitosamente');
            fetchProfile();
            fetchTodayReports();
        } catch (err) {
            console.error('Clock-in error:', err);
            if (err.response?.status === 403) {
                alert('❌ ' + (err.response?.data?.message || 'No tienes asignación de lugar de trabajo'));
            } else if (err.message === 'User denied Geolocation') {
                alert('❌ Error: Debes permitir el acceso a tu ubicación para marcar entrada.');
            } else {
                alert('❌ Error al marcar entrada: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleClockOut = async () => {
        try {
            const { lat, lon } = await getGeo();
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/clock-out`, { userId: user.id, lat, lon });
            setHasActiveClockIn(false); // Actualizar estado inmediatamente
            alert('✅ Salida marcada exitosamente');
            fetchProfile();
        } catch (err) {
            console.error('Clock-out error:', err);
            if (err.response?.status === 403) {
                alert('❌ ' + (err.response?.data?.message || 'No tienes asignación de lugar de trabajo'));
            } else if (err.response?.status === 400) {
                alert('❌ Error: Debes marcar entrada primero antes de marcar salida.');
            } else if (err.message.includes('Geolocation')) {
                alert('❌ Error: Debes permitir el acceso a tu ubicación para marcar salida.');
            } else {
                alert('❌ Error al marcar salida: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('userId', user.id);
        formData.append('text', reportText);
        if (file) formData.append('photo', file);

        try {
            await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/report`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert('✅ Reporte enviado exitosamente');
            setReportText('');
            setFile(null);
            fetchTodayReports();
        } catch (err) {
            alert('Error al enviar reporte: ' + err.message);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-main)',
            padding: '16px'
        }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                {/* Header */}
                <div className="card fade-in" style={{
                    marginBottom: '16px',
                    background: 'var(--primary-gradient)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img src="/logo.png" alt="L&V" style={{ height: '32px', filter: 'brightness(0) invert(1)' }} />
                            <div>
                                <h2 style={{ marginBottom: '2px', fontSize: '18px' }}>Hola, {user.username}!</h2>
                                <p style={{ opacity: 0.9, fontSize: '12px', margin: 0 }}>Panel de Trabajador</p>
                            </div>
                        </div>
                        <button onClick={handleLogout} className="btn btn-secondary" style={{ fontSize: '13px', padding: '8px 16px' }}>
                            Salir
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs" style={{ marginBottom: '16px' }}>
                    <button
                        className={`tab ${activeTab === 'home' ? 'active' : ''}`}
                        onClick={() => setActiveTab('home')}
                        style={{ fontSize: '14px' }}
                    >
                        🏠 Inicio
                    </button>
                    <button
                        className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                        style={{ fontSize: '14px' }}
                    >
                        👤 Mi Perfil
                    </button>
                </div>

                {/* Home Tab */}
                {activeTab === 'home' && (
                    <div className="fade-in">
                        {/* Slide Button for Clock In/Out */}
                        <div style={{ marginBottom: '16px' }}>
                            <SlideButton
                                mode={hasActiveClockIn ? 'out' : 'in'}
                                onSlideComplete={hasActiveClockIn ? handleClockOut : handleClockIn}
                                disabled={false}
                            />
                        </div>

                        {/* Current Location Assignment */}
                        {(() => {
                            const activeAssignment = profile?.assignments?.find(a => a.status === 'active');
                            if (activeAssignment) {
                                return (
                                    <div className="card" style={{
                                        marginBottom: '16px',
                                        background: 'rgba(102, 126, 234, 0.08)',
                                        borderLeft: '4px solid #667eea'
                                    }}>
                                        <h4 style={{ fontSize: '15px', marginBottom: '8px' }}>📍 Lugar de Trabajo Asignado</h4>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#667eea' }}>
                                            {activeAssignment.location_name}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            Desde: {new Date(activeAssignment.assigned_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Report Form */}
                        <div className="card" style={{ marginBottom: '16px' }}>
                            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
                                <span>📝</span> Reporte Diario
                            </h3>
                            <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>
                                        Descripción del trabajo
                                    </label>
                                    <textarea
                                        placeholder="Describe las actividades realizadas hoy..."
                                        value={reportText}
                                        onChange={(e) => setReportText(e.target.value)}
                                        rows="4"
                                        style={{ fontSize: '14px' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600' }}>
                                        Adjuntar foto (opcional)
                                    </label>
                                    <input
                                        type="file"
                                        onChange={(e) => setFile(e.target.files[0])}
                                        accept="image/*"
                                        capture="environment"
                                        style={{ padding: '10px', fontSize: '14px' }}
                                    />
                                </div>

                                <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', fontSize: '15px' }}>
                                    Enviar Reporte
                                </button>
                            </form>
                        </div>

                        {/* Today's Reports */}
                        {todayReports.length > 0 && (
                            <div className="card">
                                <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>📋 Reportes de Hoy</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {todayReports.map(report => (
                                        <div key={report.id} style={{
                                            padding: '12px',
                                            background: 'rgba(56, 239, 125, 0.08)',
                                            borderRadius: 'var(--radius-sm)',
                                            borderLeft: '4px solid #38ef7d'
                                        }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                {new Date(report.clock_in_time).toLocaleTimeString()}
                                            </div>
                                            <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                                                {report.report_text}
                                            </div>
                                            {report.photo_path && (
                                                <a
                                                    href={`${import.meta.env.VITE_SERVER_URL}${report.photo_path}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '13px', color: '#11998e', textDecoration: 'none' }}
                                                >
                                                    📷 Ver foto adjunta
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Profile Tab */}
                {activeTab === 'profile' && profile && (
                    <div className="fade-in">
                        {/* Monthly Stats Card */}
                        <div className="card" style={{
                            marginBottom: '16px',
                            background: 'var(--success-gradient)',
                            color: 'white'
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '13px', opacity: 0.9, margin: '0 0 8px 0' }}>Horas Trabajadas Este Mes</p>
                                <div style={{ fontSize: '42px', fontWeight: '700', margin: '8px 0' }}>
                                    {profile.monthlyHours}
                                </div>
                                <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>
                                    {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                        </div>

                        {/* Assigned Locations */}
                        <div className="card" style={{ marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>📍 Mis Lugares de Trabajo</h4>
                            {profile.assignments && profile.assignments.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {profile.assignments.map((a, i) => (
                                        <div key={i} style={{
                                            background: 'rgba(56, 239, 125, 0.1)',
                                            padding: '12px',
                                            borderRadius: 'var(--radius-sm)',
                                            borderLeft: '4px solid #38ef7d'
                                        }}>
                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#11998e', marginBottom: '4px' }}>
                                                {a.location_name}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                Asignado desde: {new Date(a.assigned_date).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '14px' }}>
                                    Sin lugares asignados
                                </p>
                            )}
                        </div>

                        {/* Recent Activity */}
                        <div className="card">
                            <h4 style={{ fontSize: '16px', marginBottom: '12px' }}>📊 Actividad Reciente</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {profile.logs.slice(0, 10).map(log => {
                                    const duration = log.clock_out_time
                                        ? (() => {
                                            const start = new Date(log.clock_in_time);
                                            const end = new Date(log.clock_out_time);
                                            const diff = end - start;
                                            const hours = Math.floor(diff / 3600000);
                                            const minutes = Math.floor((diff % 3600000) / 60000);
                                            return `${hours}h ${minutes}m`;
                                        })()
                                        : 'En curso';

                                    return (
                                        <div key={log.id} style={{
                                            padding: '10px',
                                            background: log.clock_out_time ? 'rgba(56, 239, 125, 0.08)' : 'rgba(102, 126, 234, 0.08)',
                                            borderRadius: 'var(--radius-sm)',
                                            borderLeft: `4px solid ${log.clock_out_time ? '#38ef7d' : '#667eea'}`
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                                <strong style={{ fontSize: '13px' }}>
                                                    {new Date(log.clock_in_time).toLocaleDateString()}
                                                </strong>
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: log.clock_out_time ? '#11998e' : '#667eea' }}>
                                                    {duration}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                {new Date(log.clock_in_time).toLocaleTimeString()}
                                                {log.clock_out_time && ` - ${new Date(log.clock_out_time).toLocaleTimeString()}`}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WorkerDashboard;
