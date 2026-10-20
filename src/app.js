const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health.routes');
const downloadRoutes = require('./routes/download.routes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', healthRoutes);
app.use('/', downloadRoutes);
app.use('/', healthRoutes);

module.exports = app;
