# Smart Traffic Management System

## Project Overview

This project is a Smart Traffic Management System that uses computer vision to analyze traffic flow and dynamically adjust traffic light timings. It consists of a Python backend that uses a YOLOv8 model for vehicle detection and a React frontend for displaying the traffic data and configuring the system.

The system works by capturing a video stream of a traffic intersection, detecting vehicles in predefined lanes (Regions of Interest - ROIs), and calculating the optimal green light duration for each lane based on the vehicle count. The frontend provides a user interface to map the ROIs for each lane and to visualize the real-time traffic data, including the live video feed, vehicle count, and green light timings for each lane.

## Technologies Used

### Backend

*   **Python**: The core language for the backend.
*   **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python.
*   **Uvicorn**: An ASGI server for running the FastAPI application.
*   **OpenCV**: A library for computer vision tasks, used here for video capture and image processing.
*   **PyTorch**: A deep learning framework.
*   **Ultralytics YOLOv8**: A state-of-the-art object detection model used for detecting vehicles.
*   **WebSockets**: For real-time communication between the backend and the frontend.

### Frontend

*   **React**: A JavaScript library for building user interfaces.
*   **JavaScript (ES6+)**: The language used for the frontend logic.
*   **HTML5 & CSS3**: For structuring and styling the web application.
*   **WebSockets**: For real-time communication with the backend.

## Project Structure

```
/
├── data/
│   └── areas/
│       ├── 1.txt
│       └── 2.txt
├── smart-traffic-backend/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── smart-traffic-frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js
│   │   ├── Dashboard.js
│   │   └── ROIMapper.js
│   ├── package.json
│   └── ...
├── videos/
│   └── video.mp4
├── yolov8n.pt
└── README.md
```

*   `data/areas/`: Stores the configured Region of Interest (ROI) for each lane.
*   `smart-traffic-backend/`: Contains the Python backend code.
    *   `main.py`: The main FastAPI application file.
    *   `requirements.txt`: The list of Python dependencies.
*   `smart-traffic-frontend/`: Contains the React frontend code.
    *   `src/App.js`: The main application component.
    *   `src/Dashboard.js`: The component for displaying the traffic data.
    *   `src/ROIMapper.js`: The component for configuring the ROIs.
    *   `package.json`: The list of frontend dependencies and scripts.
*   `videos/`: Contains the video file used for traffic analysis.
*   `yolov8n.pt`: The pre-trained YOLOv8 model file.
*   `README.md`: This file.

## How to Run

### Backend

1.  **Navigate to the backend directory:**
    ```bash
    cd smart-traffic-backend
    ```

2.  **Create a virtual environment and activate it:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```

3.  **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Run the backend server:**
    ```bash
    uvicorn main:app --reload
    ```
    The backend will be running at `http://localhost:8000`.

### Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd smart-traffic-frontend
    ```

2.  **Install the dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend application:**
    ```bash
    npm start
    ```
    The frontend will be running at `http://localhost:3000`.

## Code Details

### Backend (`main.py`)

The backend is a FastAPI application that performs the following tasks:

*   **`@app.get("/get-frame")`**: An endpoint to provide a single frame from the video source (`videos/video.mp4`) to the frontend. This is used by the `ROIMapper` component to display an image for ROI configuration.
*   **`@app.post("/roi/{lane_id}")`**: An endpoint to save the ROI points for a specific lane to a text file in the `data/areas/` directory.
*   **`@app.websocket("/ws")`**: A WebSocket endpoint for real-time traffic analysis.
    *   It reads the configured ROIs from the `data/areas/` directory.
    *   It captures frames from the video source.
    *   For each lane, it uses the YOLOv8 model to detect vehicles within the ROI.
    *   It calculates the vehicle count and determines the optimal green light duration.
    *   It sends the analysis data (lane ID, vehicle count, green time, detections, ROI, and frame) to the frontend via the WebSocket connection.
    *   It includes the latitude and longitude of the traffic light for each lane.

### Frontend

#### `App.js`

This is the main component that manages the application's state and navigation. It has three modes:

*   `home`: The initial mode, where the user can choose to map new lanes or use saved lanes.
*   `roi`: The mode for configuring the ROIs for each lane using the `ROIMapper` component.
*   `dashboard`: The mode for displaying the real-time traffic data using the `Dashboard` component.

#### `ROIMapper.js`

This component allows the user to define the ROIs for each of the four lanes.

*   It fetches a frame from the backend to display as a background for mapping.
*   The user clicks on the image to define four points for the ROI of each lane.
*   The points are sent to the backend to be saved.
*   After configuring all four lanes, the application switches to the `dashboard` mode.

#### `Dashboard.js`

This component displays the real-time traffic analysis data received from the backend via a WebSocket connection.

*   It establishes a WebSocket connection to the backend's `/ws` endpoint.
*   It receives the analysis data for each lane and updates the state.
*   It displays the following information for each lane:
    *   The live video feed with the ROI and detected vehicles drawn on it.
    *   The lane ID.
    *   The number of vehicles detected.
    *   The calculated green light duration.
*   The currently active lane is highlighted.
