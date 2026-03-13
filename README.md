# 🚀 QuickMsg

QuickMsg is a premium, real-time messaging platform designed to provide a seamless communication experience. Inspired by modern apps like WhatsApp and Telegram, it features instant messaging, status updates (stories), and high-quality audio/video calls—all built on a robust and lightweight architecture.

![License](https://img.shields.io/github/license/sayan-a11y/QuickMsg)
![Version](https://img.shields.io/badge/version-1.0.0-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)

---

## ✨ Key Features

- **💬 Real-time Chat**: Instant message delivery with status indicators (typing, seen, delivered).
- **📸 Status Updates**: Share photos and updates with your contacts that expire after 24 hours.
- **📞 HD Audio/Video Calls**: Peer-to-peer calling powered by WebRTC for crystal-clear communication.
- **👤 Rich Profiles**: Customizable user profiles with avatars, bios, and social links.
- **🖼️ Media Sharing**: Share images and files effortlessly within your conversations.
- **📱 Responsive Design**: Fully optimized for mobile, tablet, and desktop browsers.
- **🌙 Dark Mode Support**: Sleek, modern interface that's easy on the eyes.

---

## 🛠️ Tech Stack

- **Backend**: [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/)
- **Real-time**: [Socket.io](https://socket.io/)
- **Database**: [SQLite](https://www.sqlite.org/) (for lightweight and fast data management)
- **WebRTC**: Peer-to-peer signaling for voice and video calls.
- **Frontend**: Vanilla JS, HTML5, and CSS3 (Maximized performance and flexibility)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/sayan-a11y/QuickMsg.git
cd QuickMsg
npm install
```

### 3. Environment Setup
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=3000
JWT_SECRET=your_super_secret_key
```

### 4. Running the App
For development with auto-reload:
```bash
npm run dev
```

For production:
```bash
npm start
```

Your app will be running at `http://localhost:3000`.

---

## 📂 Project Structure

```text
QuickMsg/
├── backend/            # Server-side logic
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Auth and security
│   ├── models/         # Database schema and logic
│   └── routes/         # API endpoints
├── public/             # Frontend assets (HTML, CSS, JS)
├── uploads/            # User-uploaded files (avatars, status, etc.)
├── database/           # SQLite database files
├── server.js           # Main entry point
└── package.json        # Dependencies and metadata
```

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## ✉️ Contact

Sayan - [@sayan-a11y](https://github.com/sayan-a11y)

Project Link: [https://github.com/sayan-a11y/QuickMsg](https://github.com/sayan-a11y/QuickMsg)
