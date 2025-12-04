import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

function SlideButton({ mode, onSlideComplete, disabled }) {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState(0);
    const containerRef = useRef(null);
    const thumbRef = useRef(null);
    const startXRef = useRef(0);
    const positionRef = useRef(0); // Mantener referencia del position actual

    const isClockIn = mode === 'in';
    const buttonColor = isClockIn ? '#38ef7d' : '#ef3838';
    const gradientColor = isClockIn
        ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
        : 'linear-gradient(135deg, #eb3349 0%, #f45c43 100%)';
    const label = isClockIn ? 'Desliza para ENTRAR' : 'Desliza para SALIR';
    const icon = isClockIn ? '🕐' : '🏁';

    const handleStart = (clientX) => {
        if (disabled) return;
        setIsDragging(true);
        startXRef.current = clientX;
    };

    const handleMove = (clientX) => {
        if (!isDragging || disabled) return;

        const container = containerRef.current;
        const thumb = thumbRef.current;
        if (!container || !thumb) return;

        const containerRect = container.getBoundingClientRect();
        const maxScroll = containerRect.width - thumb.offsetWidth;
        const delta = clientX - startXRef.current;
        const newPosition = Math.max(0, Math.min(delta, maxScroll));

        positionRef.current = newPosition; // Actualizar ref
        setPosition(newPosition);

        // Trigger vibration on mobile when close to completion
        if (newPosition > maxScroll * 0.85 && navigator.vibrate) {
            navigator.vibrate(10);
        }
    };

    const handleEnd = () => {
        if (!isDragging) return;

        const container = containerRef.current;
        const thumb = thumbRef.current;
        if (!container || !thumb) return;

        const containerRect = container.getBoundingClientRect();
        const maxScroll = containerRect.width - thumb.offsetWidth;
        const threshold = maxScroll * 0.8; // 80% threshold
        const currentPosition = positionRef.current; // Usar ref en lugar de state

        if (currentPosition >= threshold) {
            // Successfully completed
            setPosition(maxScroll);
            positionRef.current = maxScroll;
            if (navigator.vibrate) {
                navigator.vibrate([50, 100, 50]);
            }
            setTimeout(() => {
                onSlideComplete();
                setPosition(0);
                positionRef.current = 0;
                setIsDragging(false);
            }, 300);
        } else {
            // Reset to start
            setPosition(0);
            positionRef.current = 0;
            setIsDragging(false);
        }
    };

    // Mouse events
    const handleMouseDown = (e) => {
        e.preventDefault();
        handleStart(e.clientX);
    };

    const handleMouseMove = (e) => {
        handleMove(e.clientX);
    };

    const handleMouseUp = () => {
        handleEnd();
    };

    // Touch events
    const handleTouchStart = (e) => {
        handleStart(e.touches[0].clientX);
    };

    const handleTouchMove = (e) => {
        handleMove(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        handleEnd();
    };

    // Global event listeners
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove);
            window.addEventListener('touchend', handleTouchEnd);

            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
            };
        }
    }, [isDragging]);

    const progressPercentage = containerRef.current && thumbRef.current
        ? (position / (containerRef.current.offsetWidth - thumbRef.current.offsetWidth)) * 100
        : 0;

    return (
        <div
            ref={containerRef}
            className="slide-button-container"
            style={{
                position: 'relative',
                width: '100%',
                height: '70px',
                background: `linear-gradient(to right, ${buttonColor}22 0%, ${buttonColor}08 100%)`,
                borderRadius: '16px',
                overflow: 'hidden',
                border: `2px solid ${buttonColor}33`,
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none'
            }}
        >
            {/* Progress background */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: `${progressPercentage}%`,
                    background: gradientColor,
                    transition: isDragging ? 'none' : 'width 0.3s ease',
                    borderRadius: '14px',
                    opacity: 0.3
                }}
            />

            {/* Label */}
            <div
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    pointerEvents: 'none',
                    opacity: isDragging ? 0.3 : 0.7,
                    transition: 'opacity 0.2s'
                }}
            >
                {label}
            </div>

            {/* Thumb */}
            <div
                ref={thumbRef}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                style={{
                    position: 'absolute',
                    left: `${position}px`,
                    top: '4px',
                    width: '80px',
                    height: 'calc(100% - 8px)',
                    background: gradientColor,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    cursor: disabled ? 'not-allowed' : 'grab',
                    boxShadow: isDragging
                        ? '0 8px 24px rgba(0,0,0,0.25)'
                        : '0 4px 12px rgba(0,0,0,0.15)',
                    transition: isDragging ? 'none' : 'all 0.3s ease',
                    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                    zIndex: 10
                }}
            >
                <span style={{ filter: 'brightness(0) invert(1)' }}>{icon}</span>
            </div>
        </div>
    );
}

SlideButton.propTypes = {
    mode: PropTypes.oneOf(['in', 'out']).isRequired,
    onSlideComplete: PropTypes.func.isRequired,
    disabled: PropTypes.bool
};

SlideButton.defaultProps = {
    disabled: false
};

export default SlideButton;
