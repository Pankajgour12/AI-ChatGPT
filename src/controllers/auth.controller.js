const userModel= require('../models/user.model');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');

async function getRegisterController(req, res) {
    res.render('register'); // register.ejs / register.pug / register.html
}



async function postRegisterController(req, res) {

    const { email, username, password } = req.body;
    
    const isUserExists = await userModel.findOne({
        $or:[
            {email: email },
            {username: username }
        ]

    })
    if (isUserExists) {
        return res.status(400).json({
            message: 'User already exists with this email or username'
        });
    }

  const hashedPassword = await bcrypt.hash(password, 10);
    

    const newUser = await userModel.create({
        email,
        username,
        password: hashedPassword
    });

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET );

    res.cookie('token', token);

    return res.status(201).json({
        message: 'User registered successfully',
        user: {
            id: newUser._id,
            email: newUser.email,
            username: newUser.username
        }
    });

}

async function getLoginController(req, res) {
    res.render('login'); // login.ejs / login.pug / login.html
}

async function postLoginController(req,res){
    const { email, password } = req.body;
const user = await userModel.findOne({
    email: email
})

if(!user){
    return res.redirect('/login?error=user_not_found');
}
const isPasswordValid = await bcrypt.compare(password, user.password);

if (!isPasswordValid) {
    return res.redirect('/login?error=invalid_password');
}

const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

res.cookie('token', token);

return res.status(200).json({
    message: 'User Login successfully',
    user: {
        id: user._id,
        email: user.email,
        username: user.username
    }
});


}











module.exports = {
    getRegisterController,
    postRegisterController,
    getLoginController,
    postLoginController
};
