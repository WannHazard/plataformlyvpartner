import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../index.css';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await axios.post(`${import.meta.env.VITE_SERVER_URL}/api/login`, { username, password });
            localStorage.setItem('user', JSON.stringify(res.data));
            if (res.data.role === 'admin') {
                navigate('/manager');
            } else {
                navigate('/worker');
            }
        } catch (err) {
            console.error('Login error:', err);
            const errorMessage = err.response?.data?.error || err.message;
            if (err.message === 'Network Error') {
                alert(`❌ Error de conexión con el servidor.\n\nPosibles causas:\n1. El servidor en Render se está despertando (espera 1 minuto).\n2. Bloqueo de CORS.\n3. URL incorrecta: ${import.meta.env.VITE_SERVER_URL}\n\nAbre la consola del navegador (F12) para más detalles.`);
            } else {
                alert('Login failed: ' + errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-main)',
            padding: '20px'
        }}>
            <div className="card fade-in" style={{
                maxWidth: '420px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <img src="/logo.png" alt="L&V Partner AB" style={{ maxWidth: '200px', marginBottom: '16px' }} />
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: 'var(--text-primary)',
                        marginBottom: '8px'
                    }}>
                        L&V Partner AB
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Inicia sesión para continuar
                    </p>
                </div>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Usuario
                        </label>
                        <input
                            type="text"
                            placeholder="Ingresa tu usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Contraseña
                        </label>
                        <input
                            type="password"
                            placeholder="Ingresa tu contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
                    >
                        {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div style={{
                    marginTop: '24px',
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)'
                }}>
                    <p style={{ marginBottom: '8px', fontWeight: '600' }}>Usuarios de prueba:</p>
                    <p>👤 Admin: <strong>admin</strong> / <strong>admin123</strong></p>
                    <p>👷 Worker: <strong>worker</strong> / <strong>worker123</strong></p>
                </div>
            </div>
        </div>
    );
}

export default Login;
