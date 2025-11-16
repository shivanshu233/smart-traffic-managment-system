import React, { useState, useRef, useEffect } from 'react';

const ROIMapper = ({ onConfigured }) => {
    const [lane, setLane] = useState(1);
    const [points, setPoints] = useState([]);
    const [imageSrc, setImageSrc] = useState(null);
    const [imageSize, setImageSize] = useState({ width: 640, height: 480 });
    const canvasRef = useRef(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Fetch the initial frame from the backend
        fetch('http://localhost:8000/get-frame')
            .then(res => {
                if (!res.ok) {
                    return res.json().then(err => { throw new Error(err.message) });
                }
                return res.blob();
            })
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    setImageSize({ width: img.width, height: img.height });
                    setImageSrc(url);
                };
                img.src = url;
                setError(null);
            })
            .catch(err => {
                setError(err.message);
            });
    }, []);

    useEffect(() => {
        if (!imageSrc) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.strokeStyle = '#61dafb';
        context.lineWidth = 2;

        points.forEach((p, i) => {
            context.beginPath();
            context.arc(p.x, p.y, 5, 0, 2 * Math.PI);
            context.fillStyle = '#ff5722';
            context.fill();
            context.font = '16px Arial';
            context.fillStyle = 'white';
            context.fillText(i + 1, p.x + 10, p.y + 5);
        });

        if (points.length > 1) {
            context.beginPath();
            context.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                context.lineTo(points[i].x, points[i].y);
            }
            if (points.length === 4) {
                context.closePath();
            }
            context.stroke();
        }
    }, [points, imageSrc]);

    const handleImageClick = (e) => {
        if (points.length >= 4) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPoints([...points, { x, y }]);
    };

    const handleReset = () => {
        setPoints([]);
    };

    const handleNextLane = async () => {
        if (points.length !== 4) {
            alert('Please select exactly 4 points for the lane.');
            return;
        }
        
        await fetch(`http://localhost:8000/roi/${lane}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(points),
        });

        if (lane < 4) {
            setLane(lane + 1);
            setPoints([]);
        } else {
            onConfigured();
        }
    };

    if (error) {
        return <p style={{ color: 'red' }}>Error: {error}</p>;
    }

    if (!imageSrc) {
        return <p>Loading frame from server...</p>;
    }

    return (
        <div className="roi-mapper">
            <h2>Configure Detection Zone for Lane {lane}</h2>
            <div className="roi-container" onClick={handleImageClick}>
                <img src={imageSrc} alt="Traffic" width={imageSize.width} height={imageSize.height} />
                <canvas ref={canvasRef} width={imageSize.width} height={imageSize.height} />
            </div>
            <div>
                <button onClick={handleReset}>Reset Points</button>
                {lane < 4 ? (
                    <button onClick={handleNextLane}>Next Lane</button>
                ) : (
                    <button onClick={handleNextLane}>Start Detection</button>
                )}
            </div>
        </div>
    );
};

export default ROIMapper;