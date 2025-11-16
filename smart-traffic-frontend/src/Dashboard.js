import React, { useState, useEffect, useRef } from 'react';

const Lane = ({ laneData, isActive, isRecommended }) => {
    const { lane_id, vehicle_counts, green_time, roi, detections, recommendation } = laneData;
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!laneData.frame) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        const img = new Image();
        img.src = `data:image/jpeg;base64,${laneData.frame}`;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            context.drawImage(img, 0, 0);

            // Draw ROI
            if (roi && roi.length > 1) {
                context.strokeStyle = 'blue';
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(roi[0][0], roi[0][1]);
                for (let i = 1; i < roi.length; i++) {
                    context.lineTo(roi[i][0], roi[i][1]);
                }
                context.closePath();
                context.stroke();
            }

            // Draw detections
            if (detections) {
                context.strokeStyle = 'red';
                context.lineWidth = 2;
                detections.forEach(det => {
                    context.strokeRect(det.x1, det.y1, det.x2 - det.x1, det.y2 - det.y1);
                });
            }
        };
    }, [laneData, roi, detections]);

    return (
        <div className={`lane-container ${isActive ? 'active' : ''} ${isRecommended ? 'recommended' : ''}`}>
            <h3>Lane {lane_id}</h3>
            <p><strong>Recommendation:</strong> {recommendation}</p>
            <canvas ref={canvasRef} className="lane-image"></canvas>
            <div>
                <strong>Vehicle Counts:</strong>
                <ul>
                    {Object.entries(vehicle_counts).map(([type, count]) => (
                        <li key={type}>{type}: {count}</li>
                    ))}
                </ul>
            </div>
            {isActive && <p>Green Time: {green_time}s</p>}
        </div>
    );
};

const ACTION_LANE_MAP = {
    'Turn Left': [1],
    'Go Straight': [2, 3],
    'Turn Right': [4],
};

const Dashboard = ({ useSavedLanes }) => {
    const [lanes, setLanes] = useState({ 1: null, 2: null, 3: null, 4: null });
    const [activeLaneId, setActiveLaneId] = useState(null);
    const [selectedAction, setSelectedAction] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        socketRef.current = new WebSocket('ws://localhost:8000/ws');
        const socket = socketRef.current;

        socket.onopen = () => console.log('WebSocket connection established');
        socket.onclose = () => console.log('WebSocket connection closed');
        socket.onerror = (error) => console.error('WebSocket error:', error);

        let currentLaneData = {};

        socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                // This is the JSON metadata
                currentLaneData = JSON.parse(event.data);
                setActiveLaneId(currentLaneData.lane_id);
            } else if (event.data instanceof Blob) {
                // This is the image data
                const frameBase64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(event.data);
                });

                setLanes(prevLanes => ({
                    ...prevLanes,
                    [currentLaneData.lane_id]: { ...currentLaneData, frame: frameBase64 }
                }));
            }
        };

        return () => {
            if (socket) {
                socket.close();
            }
        };
    }, [useSavedLanes]);

    const recommendedLanes = selectedAction ? ACTION_LANE_MAP[selectedAction] : [];

    return (
        <div className="dashboard">
            <div className="action-panel">
                <h3>Select Your Action:</h3>
                {Object.keys(ACTION_LANE_MAP).map(action => (
                    <button key={action} onClick={() => setSelectedAction(action)}>{action}</button>
                ))}
                <button onClick={() => setSelectedAction(null)}>Clear</button>
            </div>
            {Object.entries(lanes).map(([id, data]) => 
                data ? (
                    <Lane 
                        key={id} 
                        laneData={data} 
                        isActive={parseInt(id) === activeLaneId} 
                        isRecommended={recommendedLanes.includes(parseInt(id))}
                    />
                ) : (
                    <div key={id} className="lane-container"><h3>Lane {id}</h3><p>Waiting for data...</p></div>
                )
            )}
        </div>
    );
};

export default Dashboard;