var express = require('express');
var router = express.Router();
const bcrypt = require('bcryptjs')
const User = require('../models/userModel');
const session = require('express-session');


/* GET home page. */
router.get('/',function(req,res){
  const email = req.session.userEmail || null;
  res.render("index", { email: " ",activePage: 'home' ,message:null});
});
router.get('/about-us',function(req,res){
  res.render('about-us',{activePage: 'home' })
})
router.get('/signup', function(req, res) {
  res.render('signup', {message:null,error:null,activePage: 'signup' });
});
router.post('/signup',function(req,res){
  const { email, password, confirmPassword } = req.body;
  const user = new User({email,password})
  const validationError =user.validateSync();
  
  if(password !== confirmPassword){
    return res.render('signup',{message:'Password and Confirm Password is not matching',error:null, activePage:'signup'})
  }

  if(validationError){
    return res.render('signup',{message:null,error:validationError.errors, activePage:'signup'});
  }

  User.findOne({email})
    .then(existingUser=>{
      if(existingUser){
        return res.render('signup',{message:'Email already taken',error : null, activePage:'signup'});
      }
      else{
        return bcrypt.hash(password,10)
      }
    })
    .then(hashedPassword =>{
      const signupUser = new User({email,password:hashedPassword});
      return signupUser.save();
    }).then(() => {
      res.redirect('/login');
    }).catch(error =>{
      console.error(error);
    })
})


//login page
const { validationResult } = require('express-validator');
const {validateEmail,validatePassword} = require('./customValidator')
router.get('/login', (req, res) => {
  res.render('login',{ errors: [],message:null,activePage: 'login' })
});
router.post('/login', [
  // Add custom validation that required/imported
    validateEmail,
    validatePassword
  ], function (req, res) {
    // Access the validation errors from the request object
    const errors = req.validationErrors || [];
 
    // Validate the request
    const validationResultErrors = validationResult(req);
    if (!validationResultErrors.isEmpty()) {
      // Merge the errors from validation result into the existing errors
      errors.push(...validationResultErrors.array());
    }
    console.log( req.session); 
    if (errors.length > 0) {
      // There are validation errors, render the form with errors
     return res.render('login', { errors, message:null,activePage:'login' });
    } else {
      const { email, password } = req.body;
      let foundUser; // Declare foundUser here
 
      User.findOne({ email })
      .then(user => {
        console.log(user);
        if (!user) {
          return res.render('login', { message: 'Incorrect Email Address.',errors: [] ,activePage:'login'});
        }
        foundUser = user; 
        return bcrypt.compare(password, user.password);
      })
      .then(isPasswordValid => {
        if (!isPasswordValid) {
          return res.render('login', { message: 'Incorrect password.',errors: [] ,activePage:'login' });
        }
 
        // Set user's ID and email in the session
        req.session.userId = foundUser._id;
        req.session.userEmail = foundUser.email;
        req.session.isLoggedIn = true;
        console.log(`User logged in: ${req.session.isLoggedIn}`);
        res.redirect('/');
      })
      .catch(error => {
        console.error(error);
        res.status(500).send('Internal Server Error');
      });
    }
  });

  async function getUser(req, res, next) {
    try {
        // Check if there is a session user email
        if (!req.session.userEmail) {
            return res.redirect('/'); // Redirect to index if not logged in
        }

        req.user = await User.findOne({ email: req.session.userEmail });

        if (!req.user) {
            return res.redirect('/'); // Redirect to index if user not found
        }

        next();
    } catch (error) {
        next(error); // Pass error to Express error handler
    }
}

// Add new weight entry for today
router.get('/add-weight', (req, res) => {
  if (!req.session.userEmail) {
    return res.redirect('/'); // Redirect to index if not logged in
}

  res.render('add-weight',{message:null,activePage:'add-weight'});
});


router.post('/add-weight', getUser, async (req, res) => {
  const { weight } = req.body;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

const weightExists = req.user.weights.some(entry=>
  entry.date.toISOString().split('T')[0]===today);

  if (weightExists) {
    return res.render('add-weight', {
      message: "Weight entry for today already exists. Please update or delete it first.",
      activePage:'add-weight'
    });
    
  }

  req.user.weights.push({weight,date: new Date()});
  await req.user.save();
  res.redirect('/');
});

router.get('/dashboard', getUser, async (req, res) => {
    if (!req.session.userEmail) {
      return res.redirect('/'); // Redirect to index if not logged in
  }
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 2; // Number of records per page

  try {
      // Find the user by their ID
      const user = await User.findById(userId);
      
      if (!user) {
          return res.status(404).send("User not found");
      }

      // Paginate the weights array
      const weights = user.weights
          .sort((a, b) => b.date - a.date) // Sort by date in descending order
          .slice((page - 1) * limit, page * limit); // Apply pagination
      
      // Calculate the total number of pages
      const totalPages = Math.ceil(user.weights.length / limit);

      // Render the dashboard with weights and pagination info
      res.render('dashboard', {
          weights,
          currentPage: page,
          totalPages,
          activePage: 'dashboard'
      });
  } catch (err) {
      console.error(err);
      res.status(500).send("Server Error");
  }

  // Update Weight
router.put('/dashboard/weights/:weightId', getUser, async (req, res) => {
  const userId = req.user._id;
  const weightId = req.params.weightId;
  const { newWeight } = req.body; // Expecting `newWeight` from the request body

  try {
      const user = await User.findOneAndUpdate(
          { _id: userId, "weights._id": weightId },
          { $set: { "weights.$.weight": newWeight } },
          { new: true }
      );

      if (!user) {
          return res.status(404).json({ message: "Weight not found" });
      }

      res.status(200).json({ message: "Weight updated successfully", weights: user.weights });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error" });
  }
});

// Delete Weight
router.delete('/dashboard/weights/:weightId', getUser, async (req, res) => {
  const userId = req.user._id;
  const weightId = req.params.weightId;

  try {
      const user = await User.findByIdAndUpdate(
          userId,
          { $pull: { weights: { _id: weightId } } },
          { new: true }
      );

      if (!user) {
          return res.status(404).json({ message: "Weight not found" });
      }

      res.status(200).json({ message: "Weight deleted successfully", weights: user.weights });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server Error" });
  }
});

});
router.post('/calculate-weight-difference',getUser, async (req, res) => {
  const { startDate, endDate } = req.body;
  const userId = req.user._id; // Assuming you're using authentication and have access to the user's ID

  try {
    // Find the user and retrieve weights for the specified dates
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Convert startDate and endDate to Date objects for comparison
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Find weights on the specified dates
    const startWeightEntry = user.weights.find(entry => entry.date.toISOString().slice(0, 10) === start.toISOString().slice(0, 10));
    const endWeightEntry = user.weights.find(entry => entry.date.toISOString().slice(0, 10) === end.toISOString().slice(0, 10));

    // Check if weights exist for both dates
    if (!startWeightEntry || !endWeightEntry) {
      return res.json({ message: 'Weight data not found for selected dates' });
    }

    // Calculate the difference
    const difference = endWeightEntry.weight - startWeightEntry.weight;
    res.json({ difference });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while calculating weight difference' });
  }
});
router.get('/logout' ,(req,res)=>{
  req.session.destroy((err) =>{
    if (err){
      console.log(err);
      res.send('Error')
    }else{
      res.redirect('/login')
    }
  });
  });
  

module.exports = router;
