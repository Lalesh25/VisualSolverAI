# 🧠 Visual Solver AI – Generative AI-Based Mathematical Problem Solver

Visual Solver AI is a full-stack AI-powered web application that solves mathematical problems from handwritten input or uploaded images. It leverages **Google Gemini API** and **Large Language Models (LLMs)** to generate step-by-step solutions for various mathematical concepts through an intuitive digital canvas.

---

## 🚀 Features

- ✍️ Interactive drawing canvas for handwritten mathematical expressions
- 📤 Upload images containing mathematical problems
- 🤖 AI-powered step-by-step solution generation using Google Gemini
- 📄 Export solutions as PDF
- 🌙 Light & Dark mode support
- 🔐 Secure user authentication
- 💳 Subscription management with Razorpay integration
- 📱 Responsive and user-friendly interface
- ☁️ MongoDB database integration

---

## 🛠️ Tech Stack

### Frontend
- React.js
- Tailwind CSS
- JavaScript
- HTML5
- CSS3

### Backend
- Python
- FastAPI
- Uvicorn

### AI & Database
- Google Gemini API
- Generative AI
- Large Language Models (LLMs)
- MongoDB
- PyMongo

### Other Tools
- Razorpay
- Git & GitHub

---

## 📂 Project Structure

```
VisualSolverAI/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── app/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── main.py
│   ├── requirements.txt
│   └── ...
│
├── .env
├── README.md
└── LICENSE
```

---

## ⚙️ Installation

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/VisualSolverAI.git
cd VisualSolverAI
```

---

## Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

---

## Backend Setup

Create Virtual Environment

### Windows

```bash
python -m venv venv

venv\Scripts\activate
```

### Linux / macOS

```bash
python3 -m venv venv

source venv/bin/activate
```

Install Dependencies

```bash
pip install -r requirements.txt
```

Run Backend

```bash
uvicorn main:app --reload
```

---

## 🔑 Environment Variables

Create a `.env` file inside the backend directory.

```env
GEMINI_API_KEY=YOUR_API_KEY

MONGODB_URI=YOUR_MONGODB_URI

RAZORPAY_KEY_ID=YOUR_KEY

RAZORPAY_SECRET=YOUR_SECRET
```

---

## 📖 Workflow

```
User Draws / Uploads Problem
            │
            ▼
Image Processing
            │
            ▼
Google Gemini API
            │
            ▼
AI Analysis & Reasoning
            │
            ▼
Step-by-Step Solution
            │
            ▼
Display Result
            │
            ▼
Download PDF
```

---

## 📌 Core Modules

- User Authentication
- Drawing Canvas
- Image Upload
- AI Problem Solver
- PDF Export
- Subscription Management
- MongoDB Database
- User Dashboard

---

## 🔥 Future Enhancements

- OCR-based equation extraction
- LaTeX equation rendering
- Voice input support
- Multi-language support
- AI tutoring mode
- Solution history
- Mobile application
- Advanced mathematical graph visualization

---

## 👨‍💻 Author

**Lalesh Pawar**

Computer Science Engineer | AI & Data Science Enthusiast

---

## 📄 License

This project is developed for educational and research purposes.

MIT License

---

## ⭐ Support

If you found this project useful, don't forget to ⭐ the repository!
