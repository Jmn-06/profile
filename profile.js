var express = require('express');
var passport = require('passport');
var multer = require('multer');
var fs = require('fs');
var router = express.Router();
var User = require('../models/User');
var ClassEmail = require('../models/ClassEmail');
var upload = multer({dest: './uploads/'});
var Course = require('../models/CourseDescription');
var ProfCourse = require('../models/CourseProf');
var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);

var nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: '[]@gmail.com',
        pass: '[]'
    }
});

// =====================================
// PROFILE SECTION =====================
// =====================================
// renders profile page when user logs into
// account 
router.get('/', isLoggedIn, function(req, res, next) {

	//If user is verified, provide verification view
	if(req.user.local.verify === 'verified'){
		//render regular page
		res.render('profileView/profileView',{ 
			user: req.user
		});
	} else {
		//render unverified page
		res.render('profileView/unverifiedView',{ 
			user: req.user
		});
	}

	//default to regular view until email verification is done
	// res.render('profileView/unverifiedView',{ 
	// 	user: req.user
	// });

});

// =====================================
// ISLOGGEDIN =============================
// =====================================
// GET displays profile of user passing it 
// user credentials to template 
// route middleware to make sure a user is logged in
// redirects to admin home page if not logged in
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on 
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/start');
}

// =====================================
// LOGOUT ==============================
// =====================================
// logs user out destroying the session
router.get('/logout', function(req, res, next) {
    req.logout();
    res.redirect('/start');
});

// =====================================
// View Courses ========================
// =====================================
// GET displays view courses page to user
// POST checks user input to query database to find Prof courses
// if found courses returns courses data
// else return message 
router.get('/viewCourses', isLoggedIn, function(req, res, next){
	res.render('profileView/profileViewCourses', {
		user: req.user
	});
});

router.post('/viewCourses', isLoggedIn, function(req, res, next){
	var courseInfo = req.body;
	var user = req.user;

	ProfCourse.find({'idAccount': user._id, 'college': courseInfo.college, 'major': courseInfo.major, 'semester': courseInfo.semester, 'year': courseInfo.year}, function(err, content){
		if(err)
			console.log(err);
		if(content[0]){
			res.json(content);
		} else {
			res.json({message: 'No Courses found.'});
		}
	});
});

// =====================================
// Add Course ==========================
// =====================================
// GET displays profile page of aadd course
// POST checks user selected courses and saves selected courses
// if user does not have them in database or if user has no courses prior.
// user needs to get a res.json() to successfuly exit post call  
router.get('/addCourses', isLoggedIn, function(req, res, next){
	res.render('profileView/profileAddCourses', {
		user: req.user
	});
});

router.post('/addCourses', isLoggedIn, function(req, res, next){
	var checkList = req.body.course;  //courses from check boxes client side with value of course id 
	var user = req.user;

	//only for one course selected which is a special case needs to be parsed 
	if(checkList.length  === 24) {
		var temp = '';
		for (x in checkList){
			temp = temp + checkList[x];
		}
		checkList = temp;  //use var to search database 

		ProfCourse.findOne({'idAccount': user._id, 'idCourse': checkList}, function(err, content){
			if(err)
				console.log(err);
			if(content){
				//hey guys i am asynchronous so i got to call a function to use content value and i am special 
				singleDuplicate(content); //send to function return proper message to user 
			} else {
				createProfCourse(user._id, user.local.firstName, user.local.lastName ,checkList); //send course to be entered in database
				res.json({'message': 'Courses(s) successfully added.'});   //successful message return 
			}
		});
	} else {
		ProfCourse.find({'idAccount': user._id}, function(err, content){
			if(err)
				console.log(err);
			if(content[0]){
				dublicate(content, checkList);  //send to dublicate function for further parse 
			}else {
				saveProfCourse(user,checkList); //prof has new account no courses ever
			}
		});

	}

	function singleDuplicate(content) {
		var sample = 'Course not added since ' + content.course + ' is already added to your account.';
		res.json({'message': sample});  //return message of which course is a duplicate
	}

	//saves course(s) into database
	function saveProfCourse(userContent, courseID) {
		var count = 1,
			size = courseID.length;

		//loops through every course user selected and send to createProfCourse() to save in database
		for (x in courseID){
			createProfCourse(userContent._id, userContent.firstName, userContent.lastName, courseID[x]);
			count = count + 1; //oh you are asynchronous, found a workaround 
			if(count === size){
				res.json({'message': 'Courses(s) successfully added.'});
			}
		}
	}

	//check to verify if courses entered are already in ProfCourse database
	function dublicate(data, courseID){
		var sample = 'No Courses added since your query had dublicate(s): '; 
		var checkCourse = 0;  //sentinal value to check if course is already in database

		//for loop will save database course and increment checkCourse to show duplicates exist
		for (x in courseID){
			for (var i = 0; i < data.length; i++) { 
				if(courseID[x] === data[i].idCourse){
					sample = sample + ' ' + data[i].course;
					checkCourse = checkCourse + 1; 
				}
        	}
		}

		//if chekCourse remains at 0 value then no duplicates 
		if(checkCourse === 0){
			saveProfCourse(user, courseID); //send courses to be saved 
		} else {
			sample = sample + ' revise your query and review the classes you have in View Courses.';
			res.json({'message': sample});  //send message to user 
		}

	}
});

//creats Prof Course in database based on the courses user selected. 
function createProfCourse(id_account, firstName, lastName, id_course) {
	console.log('createProfCourse id_course:' + id_course);
	Course.findOne({'_id': id_course}, function(err, content){
		if(err)
			console.log(err)
		if(content){
			var newProfCourse = new ProfCourse();

			newProfCourse.idAccount = id_account;
			newProfCourse.idCourse = id_course;
			newProfCourse.firstName = firstName;
			newProfCourse.lastName = lastName;
			newProfCourse.college = content.college;
			newProfCourse.major = content.major;
			newProfCourse.course = content.course;
			newProfCourse.semester = content.semester;
			newProfCourse.year = content.year;

			newProfCourse.save(function(err){
				if(err)
					console.log(err);

				console.log('Prof class created ' + content.course);
			});
		} else {
			console.log(content);
			console.log('class should exist');
		}

	});
}

// =====================================
// THE REST ============================
// =====================================
// most of this just display pages not fully
// implemented yet into the project will be soon
router.post('/update', isLoggedIn,function(req, res, next){
	console.log('Update');
});

router.get('/messagesView', isLoggedIn, function(req, res, next){
	res.render('profileView/messagesView',{ 
		user: req.user
	});
});

router.get('/archiveView', isLoggedIn ,function(req, res, next){
	res.render('profileView/archiveView',{ 
		user: req.user
	});
});

router.get('/editAccountView', isLoggedIn,function(req, res, next){
	res.render('profileView/editAccountView',{ 
		user: req.user
	});
});

//user can upload a csv file of their student's email
//They can send mass message through this
router.post('/csvUpload', upload.single('file'), function(req, res, next){
	var userInfo = req.user;
	//Reads the csv file.
	fs.readFile(req.file.path, 'utf-8', function (err, content){
		//If any errors, log error
		if(err) console.log(err);
		//Split the data by '\n' into an list 
		var data = content.split('\n');

		//Iterate through array leaving off the ','
		for(var elem in data){
		    data[elem] = data[elem].replace(/\,$/, '');
		    //Test to ensure data holds
		    console.log(data[elem]);
		}

		//Adds Class Email into Database
		new ClassEmail({
			classEmail : data,
			profesorEmail : userInfo.local.email
		}).save(function(err){
			//If error occurs. Else Success
			if(err){
				console.log("Insertion into Database: Fail");
			}else{
				console.log("Insertion into Database: Success");
			}
		})

	});
	//classemails.
	
});

//@route GET /emailVerified/:URL renders the profile as verified
router.get('/emailVerified/:URL', function(req, res, next){

	console.log("Verification Successful. Redirecting to profile view with full access");
	var userInfo = req.user;

	//Find user and update their verification status to 'verified'
	User.update({'local.email': userInfo.local.email}, {'local.verify': 'verified'}, function(err, results){
		if(err){
			console.log(err);
		}

		//If updating is a success
		if(results){
			console.log('success');	
		}else{ //Else
			console.log('bad results');
		}
	});

	//Redirect to the profile page to render profile 
	res.redirect('/profile');
});
///////////////////////////////////////////////////////////////////////////////////////////////////

router.get('/Reply', function(req, res, next) {
	res.render('reply');
});

router.post('/ReplyAll', function(req, res, next) {
	var user = req.user;
	var usersubject = req.body.subject;
	var bodyEmail = req.body.message;
	ClassEmail.findOne({'profesorEmail' : userInfo.local.email}, function(err, content){
		if(err){
			console.log(err);
		}
		userEmail = "";
		for(var i = 0; i < content.length; i++){
			if (i == 0){
				userEmail = content[i]
			}
			else
			{userEmail = userEmail + ", " + console.log(content[i]);}
		}
		transporter.sendMail({
			from: 'professoranonymousfeedback@gmail.com',
			to: userEmail,
			subject: usersubject,
			text: bodyEmail
		})
	});
	res.redirect("/messagesView");
});
////////////////////////////////////////////////////////////////////////////////////////////////////


module.exports = router;
