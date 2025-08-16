require('dotenv').config();
const express = require('express');
const app = express();
const authRoutes = require('./routes/auth.routes')

const indexRoutes = require('./routes/index.routes'); // 
const cookieParser = require('cookie-parser')

/* this is the view engine setup */
app.set('view engine', 'ejs');
app.use(express.static('public')); // Serve static files from the 'public' directory

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(cookieParser());

app.use('/',indexRoutes);
app.use('/auth',authRoutes);

module.exports=app;
