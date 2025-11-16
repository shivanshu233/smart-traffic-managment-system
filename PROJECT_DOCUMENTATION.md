### 1. High-Level Project Overview

This is a full-stack web application designed to simulate a smart traffic control system. It uses computer vision to analyze a video feed of a traffic intersection and provides real-time data and recommendations to a web-based dashboard.

The project is composed of three main parts:

1.  **Backend:** A Python application built with the **FastAPI** framework. It handles the core logic of video processing, vehicle detection, and real-time communication.
2.  **Frontend:** A JavaScript application built with the **React** library. It provides a user-friendly web interface for configuring the system and viewing the live dashboard.
3.  **Computer Vision Model:** A pre-trained **YOLOv8** (You Only Look Once, version 8) model. This is a state-of-the-art neural network that is used to detect objects (in this case, vehicles) in the video frames.

The system works as follows: The backend streams a video, detects vehicles in user-defined "Regions of Interest" (ROIs) for each lane, and calculates traffic density. It then sends this data, along with the video frames, to the frontend via a WebSocket connection. The frontend displays this information in a real-time dashboard, which also includes features for driver guidance.

---

### 2. Project Structure

Here is the structure of the project and the purpose of each key file and directory:

```
/
├── data/
│   └── areas/              # Stores the coordinates for the ROI of each lane.
├── smart-traffic-backend/
│   ├── main.py             # The core backend FastAPI application.
│   └── requirements.txt    # Lists the Python dependencies for the backend.
├── smart-traffic-frontend/
│   ├── src/
│   │   ├── App.js          # The main React component, handles app layout and navigation.
│   │   ├── Dashboard.js    # The component for the main dashboard view.
│   │   ├── ROIMapper.js    # The component for drawing and configuring the ROIs.
│   │   └── index.css       # Global CSS styles for the application.
│   └── package.json        # Lists the JavaScript dependencies for the frontend.
├── videos/
│   └── video.mp4           # The video file used as the source for traffic analysis.
└── yolov8n.pt              # The pre-trained YOLOv8 neural network model file.
```

---

### 3. Backend (`smart-traffic-backend/main.py`)

This file contains all the server-side logic. Let's break it down from top to bottom.

#### Imports

```python
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
```

*   `asyncio`: Used for running asynchronous tasks, which is essential for handling the WebSocket connection and the traffic light timing without blocking the server.
*   `cv2` (OpenCV): The primary library for all computer vision tasks, such as reading the video and drawing on the frames.
*   `numpy`: A fundamental library for numerical operations. It's used to create and manipulate the image data as arrays.
*   `torch`: The PyTorch deep learning framework. YOLOv8 is built on PyTorch.
*   `fastapi`: The web framework used to build the API and WebSocket server.
*   `CORSMiddleware`: A component of FastAPI that allows the frontend (running on a different port) to communicate with the backend, bypassing browser security restrictions.
*   `StreamingResponse`, `JSONResponse`: Used to send different types of HTTP responses (a stream of bytes for an image, or a JSON object for data).
*   `json`: For working with JSON data, used here to save and load the ROI files.
*   `ultralytics.YOLO`: The class from the `ultralytics` library that allows us to load and use the YOLOv8 model.
*   `os`, `io`: Standard Python libraries for interacting with the operating system (like checking if a file exists) and handling input/output streams.

#### Constants and Initialization

```python
TRAFFIC_LIGHT_LOCATIONS = { ... }
LANE_RECOMMENDATIONS = { ... }

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("../yolov8n.pt")
VIDEO_SOURCE = "../videos/video.mp4"
```

*   `TRAFFIC_LIGHT_LOCATIONS`, `LANE_RECOMMENDATIONS`: These dictionaries store hardcoded data for the traffic light locations and the new lane recommendations.
*   `app = FastAPI()`: This line creates an instance of the FastAPI application, which is the central point of the backend.
*   `app.add_middleware(...)`: This configures the CORS policy to be very permissive (`allow_origins=["*"]`), allowing any web page to connect to this backend. This is fine for development but would be made more restrictive in a production environment.
*   `model = YOLO(...)`: This line loads the pre-trained YOLOv8 model from the `.pt` file. The model is loaded into memory once when the server starts.
*   `VIDEO_SOURCE`: This variable holds the path to the video file that will be analyzed.

#### API Endpoints

**1. `@app.get("/get-frame")`**

```python
async def get_frame_for_roi():
    # ...
```

*   **Purpose:** This endpoint provides a single, static frame from the video to the frontend.
*   **Functionality:** It's used by the `ROIMapper` component on the frontend so the user has a background image on which to draw the ROIs. It checks if the video file exists. If not, it returns a 404 "Not Found" error. If the video exists but can't be read, it returns a 500 "Server Error". Otherwise, it reads one frame, encodes it as a JPEG image, and streams it back to the frontend.

**2. `@app.post("/roi/{lane_id}")`**

```python
async def save_roi(lane_id: int, points: list[dict]):
    # ...
```

*   **Purpose:** To save the ROI coordinates for a specific lane.
*   **Functionality:** When the user finishes drawing the four points for a lane's ROI in the `ROIMapper`, the frontend sends those points to this endpoint. The backend then saves the points as a JSON array in a text file (e.g., `data/areas/1.txt`).

**3. `@app.websocket("/ws")`**

```python
async def websocket_endpoint(websocket: WebSocket):
    # ...
```

This is the most complex and important part of the backend. It handles the real-time analysis and communication.

*   **Purpose:** To provide a continuous stream of traffic analysis data to the dashboard.
*   **Functionality:**
    1.  **Connection:** It waits for a frontend client to connect to it.
    2.  **Load ROIs:** It loads the ROI coordinates for all lanes from the `data/areas/` text files into memory.
    3.  **Main Loop (`while True`):** It enters an infinite loop to continuously process the video.
    4.  **Frame Processing:** Inside the loop, it focuses on one lane at a time (`active_lane`). It reads a frame from the video.
    5.  **Detection:** It uses the `model()` to run vehicle detection on the current frame.
    6.  **Vehicle Counting:** It loops through the detected objects. If an object's class is one of the vehicle types (`[1, 2, 3, 5, 7]`), it increments the count for that specific vehicle type in the `vehicle_counts` dictionary.
    7.  **Green Time Calculation:** It calculates a simple green light time based on the total number of vehicles detected.
    8.  **Data Payload:** It constructs a `data` dictionary containing all the relevant information: the lane ID, the detailed `vehicle_counts`, the calculated `green_time`, the `recommendation` for that lane, the coordinates of the detected vehicles (`detections`), the ROI points, and the traffic light's location.
    9.  **Sending Data:** It sends the `data` dictionary as a JSON message and the raw video frame as a bytes message over the WebSocket to the frontend.
    10. **Simulate Traffic Light:** It then `await asyncio.sleep(green_time)`, which pauses the processing for that lane for the duration of the calculated green time, simulating a traffic light cycle before moving to the next lane.

#### Server Execution

```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

*   This standard Python block allows the script to be run directly. When you execute `python main.py`, it starts a `uvicorn` server, which is an ASGI server designed to run modern Python web applications like FastAPI.

---

### 4. Frontend (`smart-traffic-frontend/`)

The frontend is a single-page application (SPA) built with React.

#### `App.js`

*   **Purpose:** The main container for the entire application.
*   **Functionality:** It acts as a router. It uses a state variable `mode` to control which component is currently visible to the user:
    *   `'home'`: The initial view with buttons to start the configuration or go live.
    *   `'roi'`: The view for configuring the lanes, which renders the `ROIMapper` component.
    *   `'dashboard'`: The main dashboard view, which renders the `Dashboard` component.

#### `ROIMapper.js`

*   **Purpose:** To provide an interface for users to draw the detection zones (ROIs) for each lane.
*   **Functionality:**
    1.  **Fetch Frame:** When it first loads, it calls the backend's `/get-frame` endpoint to get a background image.
    2.  **Canvas Drawing:** It overlays an HTML `<canvas>` element on top of the image. As the user clicks on the canvas, it records the coordinates of the clicks. It also draws the points and connecting lines on the canvas to provide visual feedback.
    3.  **Save ROI:** Once four points are selected, the "Next Lane" or "Start Detection" button becomes active. Clicking it sends the points to the backend's `/roi/{lane_id}` endpoint to be saved. It then resets the points and moves to the next lane until all four are configured.

#### `Dashboard.js`

This component is responsible for the main real-time dashboard. It contains a sub-component, `Lane`.

**`Lane` Component**

*   **Purpose:** To render the information for a single traffic lane.
*   **Functionality:**
    *   It receives all the data for one lane as props (`laneData`).
    *   It uses a `<canvas>` element to display the live video frame for that lane.
    *   It uses a `useEffect` hook to draw the ROI and the bounding boxes for the detected vehicles on top of the canvas whenever new data arrives.
    *   It displays the lane ID, the lane `recommendation`, and the detailed `vehicle_counts` in a list.
    *   It has special styling (`active`, `recommended`) that is applied based on props passed down from the `Dashboard`.

**`Dashboard` Component**

*   **Purpose:** To manage the state of all lanes and the WebSocket connection.
*   **Functionality:**
    1.  **WebSocket Connection:** It uses a `useEffect` hook to establish a WebSocket connection to the backend's `/ws` endpoint when the component mounts.
    2.  **Data Handling:** It sets up an `onmessage` event listener for the WebSocket. When a message arrives, it checks if it's the JSON data or the image data and updates the component's `lanes` state accordingly. This automatically triggers a re-render of the `Lane` components with the new data.
    3.  **Interactive Lane Suggester:**
        *   It has an `ACTION_LANE_MAP` that defines which lanes are recommended for which driving actions.
        *   It displays a panel of buttons for the user to select an action ("Turn Left," etc.).
        *   When an action is selected, it determines the recommended lanes and passes a prop (`isRecommended`) to the `Lane` components, causing them to be highlighted.

This detailed breakdown covers all the essential parts of your Smart Traffic Management System. It has evolved from a simple detection system into a more advanced and interactive application with guidance features.
