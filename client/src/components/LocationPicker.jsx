import { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function DraggableMarker({ position, setPosition }) {
    const markerRef = useRef(null);

    const eventHandlers = {
        dragend() {
            const marker = markerRef.current;
            if (marker != null) {
                const newPos = marker.getLatLng();
                setPosition([newPos.lat, newPos.lng]);
            }
        },
    };

    return (
        <Marker
            draggable={true}
            eventHandlers={eventHandlers}
            position={position}
            ref={markerRef}
        />
    );
}

function MapClickHandler({ setPosition }) {
    useMapEvents({
        click(e) {
            setPosition([e.latlng.lat, e.latlng.lng]);
        },
    });
    return null;
}

function LocationPicker({ onLocationSelect, initialPosition = [-33.4489, -70.6693] }) {
    const [position, setPosition] = useState(initialPosition);
    const [address, setAddress] = useState('');
    const [searching, setSearching] = useState(false);
    const mapRef = useRef(null);

    useEffect(() => {
        onLocationSelect(position[0], position[1]);
    }, [position]);

    const searchAddress = async () => {
        if (!address.trim()) {
            alert('Por favor ingresa una dirección');
            return;
        }

        setSearching(true);
        try {
            // Using OpenStreetMap Nominatim API (free geocoding)
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
            );
            const data = await response.json();

            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                const newPos = [parseFloat(lat), parseFloat(lon)];
                setPosition(newPos);

                // Center map on new position
                if (mapRef.current) {
                    mapRef.current.setView(newPos, 15);
                }
            } else {
                alert('No se encontró la dirección. Intenta con otra búsqueda.');
            }
        } catch (error) {
            console.error('Error searching address:', error);
            alert('Error al buscar la dirección');
        } finally {
            setSearching(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Address Search */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text"
                    placeholder="Ej: Av. Libertador 1234, Santiago"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchAddress()}
                    style={{ flex: 1 }}
                />
                <button
                    type="button"
                    onClick={searchAddress}
                    disabled={searching}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px' }}
                >
                    {searching ? '🔍 Buscando...' : '🔍 Buscar'}
                </button>
            </div>

            {/* Coordinates Display */}
            <div style={{
                padding: '12px',
                background: 'rgba(102, 126, 234, 0.1)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '14px'
            }}>
                <span><strong>Latitud:</strong> {position[0].toFixed(6)}</span>
                <span><strong>Longitud:</strong> {position[1].toFixed(6)}</span>
            </div>

            {/* Interactive Map */}
            <div style={{
                height: '400px',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                border: '2px solid var(--border-color)'
            }}>
                <MapContainer
                    center={position}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    ref={mapRef}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <DraggableMarker position={position} setPosition={setPosition} />
                    <MapClickHandler setPosition={setPosition} />
                </MapContainer>
            </div>

            {/* Instructions */}
            <div style={{
                padding: '12px',
                background: 'rgba(102, 126, 234, 0.05)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                color: 'var(--text-secondary)'
            }}>
                💡 <strong>Instrucciones:</strong> Busca una dirección, haz clic en el mapa o arrastra el marcador para ajustar la ubicación exacta.
            </div>
        </div>
    );
}

export default LocationPicker;
