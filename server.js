const express = require('express');
const app = express();
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const joi = require('joi');
require('dotenv').config();

app.use(cors());

const storage = multer.diskStorage({

   destination : (req, file, cb) => {
       cb(null, 'uploads/')
   },
   filename : (req, file, cb) => {

      cb(null, Date.now() + '-' + file.originalname);

   },

});

const upload = multer({ storage : storage });

app.listen(process.env.port, () => {
    console.log("Server is running at port 3000");
});

mongoose.connect(process.env.MONGO)
.then(() => {
    console.log("App connected to the database");
})
.catch((err) => {
    console.log("An error occured : " +err.message)
})

const userSchema = mongoose.Schema(
    {
        userName : {
            type : 'string',
            required : true,
        },

        dis : {
            type : 'string',
            required : false,
        },

        name : {
            type : 'string',
            required : true,
        },

        uid : {
             type : 'string',
             required : false, 
        },

        profilePic : {
                type : 'string',
                required : false,
        },
    },
    {
        timestamps : true,
    }
);

const userLog = mongoose.Schema({

    email : {
        type : 'string',
        required : true,
    },
    password : {
        type : 'string',
        required : true,
    },

},
   {
    timestamps : true
   }
);

const posts = mongoose.Schema({
    post : {
        type : 'string',
        required : true,
    },
    caption : {
        type : 'string',
        required : true,
    },
    uid : {
        type : 'string',
        required : true,
    }
},
{
    timestamps : true
}
);

const comment = mongoose.Schema({

      myId : {
        type : 'string',
        required : true,
      },
      userId : {
        type : 'string',
        required : true,
      },
      comments : {
        type : 'string',
        required : true,
      },
      key : {
        type : 'string',
        required : true,
      }

}, {timestamps : true});

const follower = mongoose.Schema({

     myId : {
        type : 'string',
        required : true,
     },
     userId : {
        type : 'string',
        required : true,
     }

}, {timestamps : true});

const like = mongoose.Schema({

    myId : {
        type : 'string',
        required : true,
    },
    userId : {
        type : 'string',
        required : true,
    }

}, {timestamps : true});


const likes = mongoose.model('likes', like);
const followers = mongoose.model('followers', follower);
const comments = mongoose.model('comments', comment);
const pictures = mongoose.model('pictures', posts);
const user = mongoose.model('User', userSchema);
const log = mongoose.model('log', userLog);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}));

const joiSchema = joi.object({

    email : joi.string().email(),
    password : joi.string(),

});

app.post('/login', async (req, res) => {

   try {
      
    if(
        !req.body.email ||
        !req.body.password
    ) {
        return res.status(400).send({message : 'Please enter all the required parameters'})
    }

    const validation = joiSchema.validate({
        email :  req.body.email,
        password : req.body.password
      })

      if(validation.error) {
        console.log(validation.error);
        return res.send(validation.error.details);
      }
      console.log(validation);
      console.log("Hello");

    const newUser = {
        email : req.body.email,
        password : req.body.password
    }

    const use = await log.create(newUser);
    console.log(req.body);
    return res.status(200).send(use);
   }
   catch (err){
          console.log(err);
          res.status(500).send({message : err.message});
   }

})

app.post('/enter', upload.single('profilePic') ,async (req, res) => {

    console.log("Pic : ", req.file.filename);
    const userData = JSON.parse(req.body.userData);
    console.log('Incoming request:', userData.uid);
  
  try {

    if(
        !userData.name ||
        !userData.userName
    ) {
        return res.status(400).send({message : 'Please send all the required parameters...'});
    }

    const newData = {
        name : userData.name,
        userName : userData.userName,
        dis : userData.bio,
        uid : userData.uid,
        profilePic : req.file.filename,
    }

    const sta = await user.create(newData);
    console.log(req.body);
    return res.status(200).send(sta);

  }
  catch (err){
     console.log("An error occured : "+ err.message);
     return res.status(500).send({message : err.message})
  }

})

app.get('/display/:id', async (req, res) => {

    try {
      const result = await user.findById(req.params.id);
      return res.status(200).json(result);
    }
    catch (err) {
        console.log("An error occured : "+ err.message);
        return res.status(500).send({message : err.message});
    }

})

app.get('/sign/:email/:password', async (req, res) => {

    try {

    const result = await log.findOne({
        email : req.params.email,
        password : req.params.password
    });

    if(!result) {
        return res.status(404).send({message : "An error occured"});
    }


    return res.status(200).json(result);

    }
    catch (err) {
        console.log("An error occured : " + err.message);
        return res.status(500).send({message : err.message});
    }

});

app.get('/find/:id', async (req, res) => {

    try {

    const result = await user.findOne({
        uid : req.params.id
    });

    if(!result) {
        return res.status(404).send({message : "Not found"});
    }

    return res.status(200).json(result);


    }
    catch (err) {
        console.log("An error occured : "+ err.message);
        return res.status(500).send({message : err.message});
    }

});

app.get('/userName/:userName', async(req, res) => {
      
       try {

        const result = await user.findOne({
            userName : req.params.userName,
        })

        if(!result) {
            return res.status(200).send({message : "Good to go..."});
        }
        else {
            return res.status(404).send({message : "Username already in use..."});
        }

       }
       catch (err) {
         console.log("Error: "+  err);
         return res.status(500).send({message : err.message});

       }

});


app.get('/profile-pic/:filename', (req, res) => {

     const fileName = req.params.filename;
     res.sendFile(`${__dirname}/uploads/${fileName}`);

});

app.get('/getFive/:id', async (req, res) => {
    const userId = req.params.id;
    console.log(userId);

    try {
        const result = await user.aggregate([
            { $sample: { size: 5 } }
        ]);

        // Use Array.filter to exclude the user with the specified id
        const filteredResult = result.filter(user => String(user._id) !== userId);

        if (!filteredResult || filteredResult.length === 0) {
            console.log("Not found");
            return res.status(404).send({ message: "404 not found" });
        }

        return res.status(200).json(filteredResult);
    } catch (err) {
        console.log("Error from catch" + err.message);
        return res.status(500).send({ message: err.message });
    }
});



app.post('/post', upload.single('postPic'),async (req, res) => {

    
    console.log("Pic : ", req.file);
    const userData = JSON.parse(req.body.userData);
    console.log('Incoming request:', userData.uid);

    try {

        if(
            !userData.caption
        ) {
            return res.status(400).send({message : 'Please send all the required parameters...'});
        }

        const postInfo = {
            caption : userData.caption,
            uid : userData.uid,
            post : req.file.filename,
        }

        const sta = await pictures.create(postInfo);
        return res.status(200).json(sta);
    

    }
    catch (err) {
        console.log("Error from catch of the server : "+ err.message);
        return res.status(500).send({message : err.message});
    }

});

app.get('/getPosts/:id', async (req, res) => {

    try {

     const result = await pictures.find({uid : req.params.id});

     if(!result) {
        return res.status(404).send({message : "No posts yet..."});
     }

     return res.status(200).json(result);

    }
    catch (err) {
        console.log(err.message);
        return res.status(500).send({message : "error from the catch of the server..."})
    }

});

app.get('/allposts', async (req, res) => {

     try {

        const result = await pictures.find({});

        if(!result) {
            return res.status(404).send({message : "No posts till now..."});
        }
  
        return res.status(200).json(result);

     }
     catch (err) {

     console.log("Error from allposts: "+ err.message);
     return res.status(500).send({message: err.message});

     }
 
})

app.post('/comment/:myId/:userId/:comment/:key', async(req, res) => {

       try {

         const result = await comments.create({
            
            myId : req.params.myId,
            userId : req.params.userId,
            comments : req.params.comment,
            key : req.params.key

         });
         if(!result) {
            return result.status(400).send({message : "An error occurred"})
         }
         return res.status(200).json(result);

       }
       catch (err) {

     console.log("An error accured : " +err.message);
     return res.status(500).send(({message : err.message}));

       }

})

app.get('/comment/:myId/:userId/:key', async(req, res) => {

     try {

      const result = await comments.find({
        userId: req.params.userId,
        myId : req.params.myId,
        key : req.params.key
          });

          if(!result) {
            return res.status(400).send({message : "Not found any comment... "})
          }

          return res.status(200).json(result);

     }
     catch (err) {
        console.log("An error occured : " +err.message);
        return res.status(500).send(({message : err.message}));
     }

})

app.put('/updateUser/:id', upload.single('profilePic'), async (req, res) => {

    const userData = JSON.parse(req.body.userData);
    console.log('Incoming request:', userData.uid);

    try {

       const existingUser = await user.findById(req.params.id);

       if(!existingUser) {
        return res.status(400).send({message : "No user exists..."});
       }

       existingUser.name = userData.name || existingUser.name;
       existingUser.userName = userData.userName || existingUser.userName;
       existingUser.dis = userData.dis || existingUser.dis;

       if(req.file) {
        existingUser.profilePic = req.file.filename;
       }

    const updatedUser = await existingUser.save();

    return res.status(200).json(updatedUser);

    }
    catch (err) {
        console.log("An error occured...");
        return res.status(500).send(({message : err.message}));
    }

})

app.post('/follow/:myId/:userId', async (req, res) => {

try {

    const result = await followers.create({
        myId : req.params.myId,
        userId : req.params.userId,
    })

    return res.status(200).json(result);

}

catch (err) {
  
    console.log("An error occurred : "+ err.message);
    return res.status(500).send(({message : err.message}));

}
})

app.get('/follower/:myId/:userId', async (req, res) => {

   try {

       const result = await followers.findOne({
        myId : req.params.myId,
        userId : req.params.userId,
       })

       if(!result) {
        return res.status(400).send({message : " Not found the user"})
       }
      
       return res.status(200).json(result);

   }
   catch (err) {

    console.log("An error occured!");
    return res.status(500).send(({message : err}));

   }

})

app.get('/following/:myId', async (req, res) => {

    try {
 
        const result = await followers.find({
         myId : req.params.myId,
        })
 
        if(!result) {
         return res.status(400).send({message : " Not found the user"})
        }
       
        return res.status(200).json(result);
 
    }
    catch (err) {
 
     console.log("An error occured!");
     return res.status(500).send(({message : err}));
 
    }
 
 })

 app.get('/noOfFollowers/:myId', async (req, res) => {

    try {
 
        const result = await followers.find({
         userId : req.params.myId,
        }).sort({createdAt: -1});
 
        if(!result) {
         return res.status(400).send({message : " Not found the user"})
        }
       
        return res.status(200).json(result);
 
    }
    catch (err) {
 
     console.log("An error occured!");
     return res.status(500).send(({message : err}));
 
    }
 
 })

 app.delete('/unFollow/:myId/:userId', async (req, res) => {

    try {

     const result = await followers.deleteOne({
        myId : req.params.myId,
        userId : req.params.userId,
     })

     return res.status(200).json(result);

    }
    catch (err){
  
    console.log(err);
    return res.status(500).send({message : err.message});
    }

 })


 app.get('/getNoComment/:myId', async(req, res) => {

    try {

     const result = await comments.find({
       userId: req.params.myId,
         });

         if(!result) {
           return res.status(400).send({message : "Not found any comment... "})
         }

         return res.status(200).json(result);

    }
    catch (err) {
       console.log("An error occured : " +err.message);
       return res.status(500).send(({message : err.message}));
    }

})

app.post('/like/:myId/:userId', async (req, res) => {

    try {

        const result = await likes.create({
            myId : req.params.myId,
            userId : req.params.userId,
        })

        return res.status(200).json(result);

    }

    catch (err) {
        console.log("An error occured!");
        return res.status(500).send({message : "An error occured!"});
    }

})

app.get('/likes/:myId', async (req, res) => {

    try {

        const result = await likes.find({
            userId : req.params.myId,
        }).sort({createdAt: -1})

       if(!result) {
        return res.status(400).send({ message : "No likes yet..."})
       }

        return res.status(200).json(result);

    }

    catch (err) {
        console.log("An error occured!");
        return res.status(500).send({message : "An error occured!"});
    }

})

app.delete('/unLike/:myId/:userId', async (req, res) => {

    try {

     const result = await followers.deleteOne({
        myId : req.params.myId,
        userId : req.params.userId,
     })

     return res.status(200).json(result);

    }
    catch (err){
  
    console.log(err);
    return res.status(500).send({message : err.message});
    }

 })



