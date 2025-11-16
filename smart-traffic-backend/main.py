
import asyncio
import cv2
import numpy as np
import torch
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import json
from ultralytics import YOLO
import os
import io

# Hardcoded traffic light locations (latitude, longitude) for each lane_id
TRAFFIC_LIGHT_LOCATIONS = {
    1: {"lat": 28.7041, "lon": 77.1025},  # Example: Lane 1
    2: {"lat": 28.7050, "lon": 77.1030},  # Example: Lane 2
    3: {"lat": 28.7060, "lon": 77.1040},  # Example: Lane 3
    4: {"lat": 28.7070, "lon": 77.1050}   # Example: Lane 4
}

# Create data/areas directory if it doesn't exist
if not os.path.exists("data/areas"):
    os.makedirs("data/areas")

app = FastAPI()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLOv8 model
model = YOLO("yolov8n.pt") 

# Video source
VIDEO_SOURCE = "../videos/video.mp4"

# Lane areas will be stored here
lane_areas = []

LANE_RECOMMENDATIONS = {
    1: "All Vehicles",
    2: "Fast Lane - Cars Only",
    3: "Local Traffic",
    4: "Heavy Vehicles & Buses"
}

def get_placeholder_frame():
    return np.zeros((480, 640, 3), dtype=np.uint8)

@app.get("/get-frame")
async def get_frame_for_roi():
    """
    Returns a single frame from the video source for ROI selection.
    If video is not available, returns a 404 error.
    """
    if not os.path.exists(VIDEO_SOURCE):
        return JSONResponse(status_code=404, content={"message": "Video file not found. Please add a video file named 'video.mp4' to the 'videos' directory."})

    cap = cv2.VideoCapture(VIDEO_SOURCE)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return JSONResponse(status_code=500, content={"message": "Could not read a frame from the video. The video file might be corrupted."})
    
    _, buffer = cv2.imencode('.jpg', frame)
    return StreamingResponse(io.BytesIO(buffer.tobytes()), media_type="image/jpeg")


@app.post("/roi/{lane_id}")
async def save_roi(lane_id: int, points: list[dict]):
    """
    Saves the region of interest (ROI) points for a specific lane.
    """
    file_path = f"data/areas/{lane_id}.txt"
    with open(file_path, "w") as f:
        json.dump(points, f)
    return {"message": f"ROI for lane {lane_id} saved successfully."}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for streaming traffic analysis.
    """
    await websocket.accept()
    
    global lane_areas
    lane_areas = []
    for i in range(1, 5):
        file_path = f"data/areas/{i}.txt"
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                points = json.load(f)
                lane_areas.append(np.array([[p['x'], p['y']] for p in points], np.int32))

    if not lane_areas:
        await websocket.close(code=1008, reason="ROI not configured")
        return

    use_placeholder = not os.path.exists(VIDEO_SOURCE)
    cap = None
    if not use_placeholder:
        cap = cv2.VideoCapture(VIDEO_SOURCE)
        if not cap.isOpened():
            await websocket.close(code=1008, reason=f"Could not open video source: {VIDEO_SOURCE}")
            return

    active_lane = 0
    frame_count = 0
    
    try:
        while True:
            if use_placeholder:
                frame = get_placeholder_frame()
                ret = True
            else:
                ret, frame = cap.read()
                if not ret:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue

            if frame_count % 5 == 0:
                if active_lane < len(lane_areas):
                    roi = lane_areas[active_lane]
                    
                    mask = np.zeros(frame.shape[:2], dtype=np.uint8)
                    cv2.drawContours(mask, [roi], -1, (255), -1, cv2.LINE_AA)
                    
                    results = model(frame, verbose=False)
                    
                    vehicle_counts = {'car': 0, 'motorcycle': 0, 'bus': 0, 'truck': 0, 'bicycle': 0}
                    detections = []
                    for box in results[0].boxes:
                        cls = int(box.cls[0])
                        if cls in [1, 2, 3, 5, 7]:
                            if cls == 1:
                                vehicle_counts['bicycle'] += 1
                            elif cls == 2:
                                vehicle_counts['car'] += 1
                            elif cls == 3:
                                vehicle_counts['motorcycle'] += 1
                            elif cls == 5:
                                vehicle_counts['bus'] += 1
                            elif cls == 7:
                                vehicle_counts['truck'] += 1

                            x1, y1, x2, y2 = map(int, box.xyxy[0])
                            detections.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2})

                    total_vehicles = sum(vehicle_counts.values())
                    green_time = min(35, max(5, int(total_vehicles * 1.5)))

                    _, buffer = cv2.imencode('.jpg', frame)
                    frame_base64 = buffer.tobytes()

                    # Get traffic light location for the active lane
                    current_lane_id = active_lane + 1
                    light_location = TRAFFIC_LIGHT_LOCATIONS.get(current_lane_id, {"lat": None, "lon": None})
                    recommendation = LANE_RECOMMENDATIONS.get(current_lane_id, "General")

                    data = {
                        "lane_id": current_lane_id,
                        "vehicle_counts": vehicle_counts,
                        "green_time": green_time,
                        "detections": detections,
                        "roi": roi.tolist(),
                        "latitude": light_location["lat"],
                        "longitude": light_location["lon"],
                        "recommendation": recommendation
                    }
                    
                    await websocket.send_json(data)
                    await websocket.send_bytes(frame_base64)
                    
                    await asyncio.sleep(green_time)
                    
                    active_lane = (active_lane + 1) % len(lane_areas)

            frame_count += 1
            await asyncio.sleep(0.01)

    except WebSocketDisconnect:
        print("Client disconnected")
    finally:
        if cap:
            cap.release()
        print("Connection closed and resources released.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
