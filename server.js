const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
require('dotenv').config();
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Connect to the database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/auth', authRoutes);
app.use(express.static('public'));

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/chat', (req, res) => {
  res.render('chat');
});


io.use(async (socket, next) => {
  try {
    const token = socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = await User.findById(decoded.user.id);
    next();
  } catch (err) {
    return next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log('New client connected');

  // Retrieve and emit previous messages to the connected client
  const messages = await Message.find().sort({ timestamp: 1 }).exec();
  socket.emit('previous messages', messages);
 // Emit list of users to all clients
 const users = await User.find().select('username').exec();
 io.emit('users', users);
  socket.emit('username', socket.user.username);

  socket.on('chat message', async (msg) => {
    const message = new Message({
      user: socket.user.username,
      msg: msg,
    });
    await message.save();
    io.emit('chat message', { user: socket.user.username, msg });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});
 

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
