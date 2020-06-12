require('dotenv').config();
const http= require ("http");
const termSize = require('term-size');
const express = require("express");
const flash = require('connect-flash');
const bodyParser = require("body-parser");
const cookieParser = require('cookie-parser');
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const FacebookStrategy= require("passport-facebook");
const findOrCreate = require('mongoose-findorcreate');
const app = express();
termSize();
app.set('view engine', 'ejs');
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(express.static("public"));
app.set('trust proxy', 1);

const store = new MongoDBStore({
  uri: 'mongodb+srv://yasmine:admin@cluster0-yyfi6.mongodb.net/blogDB?retryWrites=true&w=majority',
  collection: 'mySessions'
});
 
store.on('error', function(error) {
  console.log(error);
});
 
app.use(require('express-session')({
  secret: 'This is a secret',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7
  },
  store: store,
  resave: true,
  saveUninitialized: true
}));

process.on('unhandledRejection', (res, reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);
  return reportToUser(JSON.pasre(res)); 
});


app.use(function(req,res,next){
if(!req.session){
    return next(new Error('Oh no')) //handle error
}
next() //otherwise continue
});

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb+srv://yasmine:admin@cluster0-yyfi6.mongodb.net/blogDB?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);
// Schema modeling 
const userSchema = new mongoose.Schema({
  fName: String,
  lName: String,
  username: String,
  password:  String,
  googleId: String,
  facebookId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose, {
  usernameLowerCase: true
});
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});

app.use(function(req, res, next){
  res.locals.message = req.flash();
  res.locals.isAuthenticated = req.isAuthenticated();
  res.locals.user= req.user;
   next();
 });

 passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "https://agile-oasis-50282.herokuapp.com:5000/auth/facebook/home"
},
function(accessToken, refreshToken, profile, cb) {
  console.log(accessToken);
  
  User.findOrCreate({ facebookId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "https://agile-oasis-50282.herokuapp.com:5000/auth/google/home",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  User.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

const postSchema = ({
 title: String,
 content: String
});
const Post = mongoose.model("post", postSchema);

// GET requests 
app.get("/", function(req, res) {
  console.log(req.session);
  Post.find({}, function(err, posts){
   res.render("home", {
     posts: posts
     });
 })
});
// Facebook
app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/home',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });
// Google
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/home",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/");
  });


app.get("/signup", function(req, res) {
  res.render("signup");
});

app.get("/login", function(req, res) {
  req.flash("error", "")
  res.render("login");
});

app.get("/compose", function(req, res) {
  if (req.isAuthenticated()){
    req.flash("success", "successfuly logged in")
    res.render("compose");
  }else{
    res.redirect("/login");
  }
});

app.get("/post/:postId", function(req, res){
  const requestedPostId = req.params.postId;
    Post.findOne({_id: requestedPostId}, function(err, Post){
      res.render("post", {
        name: req.user.fName,
        title: Post.title,
        content: Post.content
      });
    });
  });
  
app.get("/contact", function(req, res) {
    res.render("contact");
  });
  
app.get("/about", function(req, res) {
    res.render("about");
  });

app.get("/logout", function(req, res){
    req.logout();
    req.session.destroy();
    res.redirect("/");
  });
  
//  POST requests

app.post("/signup", function(req, res) {
  User.register({  fName: req.body.fName,
                   lName: req.body.lName,
                   username: req.body.username, active: false}, req.body.password, function(err, user) {
    if (err) { 
      req.flash("error", err.message );
      console.log(err);
      res.redirect("/signup")
    }else{
      passport.authenticate("local", {failureFlash:true, failureRedirect: '/signup'})(req, res, function(){
        req.flash("success", "successfuly Signed up")
        res.redirect("/")
      });
    }
  });
});

app.post("/login", function(req, res) {
const user = new User({
  username: req.body.username,
  password: req.body.password
});
req.login(user, function(err){
  if (err){
    console.log(err);
    res.redirect("/login")
  }else{
    passport.authenticate("local", {failureFlash:true, failureRedirect: '/login'})(req, res, function(){
      req.flash("success", "")   
      res.redirect("/");
   });
  }
});
});

app.post("/compose", function(req, res) {
  const post = new Post({
    title: req.body.PostTitle,
    content: req.body.postBody
  });
 post.save(function(err){
  if (!err){
    res.redirect("/");
  }
});
});

// app.listen(5000, function(){
//   console.log('listening on *:5000');
// });
