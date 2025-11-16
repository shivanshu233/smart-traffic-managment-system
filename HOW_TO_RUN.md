# How to Run the Project

To run the project, you need to have Python, Node.js, and npm installed on your system. You will need to run the backend and the frontend in two separate terminals.

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd /home/prinshu/Smart-Traffic-Management-System/smart-traffic-backend
    ```

2.  **Create a virtual environment (if you haven't already):**
    ```bash
    python -m venv venv
    ```

3.  **Activate the virtual environment:**
    *   On Windows:
        ```bash
        venv\Scripts\activate
        ```
    *   On macOS and Linux:
        ```bash
        source venv/bin/activate
        ```

4.  **Install the dependencies (if you haven't already):**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Run the backend server:**
    ```bash
    python main.py
    ```
    The backend server will start on `http://localhost:8000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd /home/prinshu/Smart-Traffic-Management-System/smart-traffic-frontend
    ```

2.  **Install the dependencies (if you haven't already):**
    ```bash
    npm install
    ```

3.  **Start the frontend development server:**
    ```bash
    npm start
    ```
    The frontend application will open in your default web browser at `http://localhost:3000`.
