const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const FieldValue = admin.firestore.FieldValue;
const { firebaseConfig } = require('firebase-functions');

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


// edit post, takes in userID, old postTitle, new postTitle.
// if old postTitle is not in db, return false,
// if new postTitle is already in db, return false,
// if old postTitle does not exist in user's posts, return false.
// else replace old postTitle with new postTitle, return true.
exports.editPost = functions.https.onCall( async (data, context) => {
    const userID = data.userID;
    const oldPostTitle = data.oldPostTitle;
    const newPostTitle = data.newPostTitle;
    const currentTime = new Date();

    // query post document with the same title as oldPostTitle, if there isn't, return false.
    let oldPostSnapShot = await admin.firestore().collection('posts').where('title', '==', oldPostTitle).get();
    if(oldPostSnapShot._size === 0) return `false`;

    // get postID 
    let postID = '';
    oldPostSnapShot.forEach( doc => {
        postID = doc.id;
    });

    // query post document with the same title as newPostTitle, if there is, return false.
    let newPostSnapShot = await admin.firestore().collection('posts').where('title', '==', newPostTitle).get();
    if(newPostSnapShot._size !== 0) return `false`;

    let userDoc = await admin.firestore().collection('users').doc(userID).get();

    // if user's posts doesn't have current post, retruen false
    if(!(userDoc.data().posts.includes(postID))) return `false`;

    // at this point, we have verified that we can edit the post title.
    
    // replace old post title with new post title
    // we don't have to change anything in the user's posts since we are storing post ID instead of post title in the array.
    // even if we change the post title, the document id for the post will not be changed.
    await admin.firestore().collection('posts').doc(postID).update({
        title: newPostTitle,
        date: currentTime
    })

    return `true`;
});




// delete story post, takes in userID, postTitle, 
// if post title is not in db, return false,
// if post title is not in user's posts, return false,
// else delete postID from user's posts, and delete postID from posts collection.
exports.deletePost = functions.https.onCall( async (data, context) => {
    const userID = data.userID;
    const postTitle = data.postTitle;

    // query post document with the same title as postTitle, if there isn't, return false.
    let querySnapShot = await admin.firestore().collection('posts').where('title', '==', postTitle).get();
    if(querySnapShot._size === 0) return `false`;

    let userDoc = await admin.firestore().collection('users').doc(userID).get();

    // get postID 
    let postID = '';
    querySnapShot.forEach( doc => {
        postID = doc.id;
    });

    // if user's posts doesn't have current post, retruen false
    if(!(userDoc.data().posts.includes(postID))) return `false`;

    // at this point, we have verified that post title is in db and post title is in user's posts.

    // find post index in user's posts
    let postIndex = 0;
    let userPosts = userDoc.data().posts;
    for(let i = 0; i < userPosts.length; i++){
        if(userPosts[i] === postID){
            postIndex = i;
            break;
        }
    }
    userPosts.splice(postIndex, 1);
    

    // update user's posts
    await admin.firestore().collection('users').doc(userID).update({
        posts: userPosts
    })

    // delete post document from posts collection
    await admin.firestore().collection('posts').doc(postID).delete();

    // EXTRA, find all users that liked the post and delete it from likedPosts
    let likedPostUsers = await admin.firestore().collection('users').where('likedPosts', "array-contains", postID).get();
    
    // for each user, delete postID in likedPosts array.
    likedPostUsers.forEach( async (doc) => {
        console.log(doc);
        let userLikedPosts = doc.data().likedPosts;
        for(let i = 0; i < userLikedPosts.length; i++){
            if(postID === userLikedPosts[i]) {
                userLikedPosts.splice(i, 1);
                break;
            }
        }
        
        await admin.firestore().collection('users').doc(doc.id).update({
            likedPosts : userLikedPosts
        });
    });

    return `true`;

});



// verify if post title is unique, and haven't been created
// if have, return false,
// else insert post and return true.
exports.verifyPost = functions.https.onCall( async (data, context) => {
    const userID = data.userID;
    const postTitle = data.postTitle;
    const url = data.url;
    const currentTime = new Date();

    // query post document with the same title as postTitle, if there is, return false.
    let querySnapShot = await admin.firestore().collection('posts').where('title', '==', postTitle).get();
    if(querySnapShot._size !== 0) return `false`;

    // at this point, we have verified that postTitle is unique and haven't been created.
    // we need to add append postTitle to firebase.
    let postID = '';
    const userRef = await admin.firestore().collection('users').doc(userID);
    const docRef = await admin.firestore().collection('posts').add({
        comments: [],
        numComments: 0,
        owner: userRef,
        time: currentTime,
        title: postTitle,
        upvotes: 0,
        url: url
    });

    // get autogenreated post ID
    postID = docRef.id;
    
    const userDoc = await admin.firestore().collection('users').doc(userID).get();
    
    // append postID to user's posts and update. return true at last.
    let userPosts = userDoc.data().posts;
    userPosts.push(postID);
    await admin.firestore().collection('users').doc(userID).update({
        posts: userPosts
    });

    return `true`;

});




// verify upvote
exports.verifyUpVote = functions.https.onCall( async (data, context) => {
    const userID = data.userID;
    const postTitle = data.postTitle;

    // query post document with the same title as postTitle.
    let querySnapShot = await admin.firestore().collection('posts').where('title', '==', postTitle).get();
    let storyDocID = '';
    querySnapShot.forEach( doc => {
        storyDocID = doc.id;
        console.log(storyDocID);
    });

    // get the user using userID
    const doc = await admin.firestore().collection('users').doc(userID).get();

    // if likedPost contains postID return true, else false.
    if(doc.data().likedPosts.includes(storyDocID)){
        return `true`;
    } else {
        return `false`;
    }
})

// update upvote based on method passed in
exports.updateUpVote = functions.https.onCall( async (data, context) => {
    const userID = data.userID;
    const postTitle = data.postTitle;
    const method = data.method;

    // get document for user, get all the fields from the document.
    const userDocument = await admin.firestore().collection('users').doc(userID).get();
    const userDoc = await admin.firestore().collection('users').doc(userID);

    // get likedPosts array.
    let userLikedPosts = userDocument.data().likedPosts;
    if(method === 'increment'){

        // query Posts collection to gather all documents that have field title equal to postTitle.
        let storyDocID = '';
        let querySnapShot = await admin.firestore().collection('posts').where('title', '==', postTitle).get();

        // should only loop once and so we push the post ID onto likedPost
        querySnapShot.forEach( doc => {
            storyDocID = doc.id;
            userLikedPosts.push(storyDocID);
        });

        // get post document using postID, 
        const storyDoc = await admin.firestore().collection('posts').doc(storyDocID);

        // update upvote count and likedPosts.
        await storyDoc.update({
            upvotes: FieldValue.increment(1)
        })
        await userDoc.update({
            likedPosts: userLikedPosts
        });
        
    } else if(method === 'decrement'){
        // query the Posts collection to gather all documents that have field title equal to postTitle.
        let querySnapShot = await admin.firestore().collection('posts').where('title', '==', postTitle).get();
        let storyDocID = '';

        // should only get one document back so we just loop this once.
        querySnapShot.forEach( doc => {
            storyDocID = doc.id;
            
        });

        // find the index using the ID we just got
        let postIndex = 0;
        for(let i = 0; i < userLikedPosts.length; i++){
            if(storyDocID === userLikedPosts[i]) {
                postIndex = i;
                break;
            }
        }

        // get the document using the ID for updating.
        const storyDoc = await admin.firestore().collection('posts').doc(storyDocID);

        // remove post from the array.
        userLikedPosts.splice(postIndex, 1);

        // update in firebase.
        await userDoc.update({
            likedPosts: userLikedPosts
        });
        await storyDoc.update({
            upvotes: FieldValue.increment(-1)
        });
    }
    return `true`;
});


//signup
exports.register = functions.https.onCall(async (data, context) => {
    const email = data.email;
    const password = data.password;
    const username = data.username;
    var status = "";

    //check if username exists before creating a new user
    const snapshot = await admin.firestore().collection('users').doc(username).get();
    if (snapshot.exists) {
        functions.logger.log("User exists");
        status = "User exists";
    } else {
        functions.logger.log("Creating user now");

        //creates user
        const cred = await admin.auth().createUser({
            email: email,
            password: password,
            displayName: username
        });

        const user = await admin.firestore().collection('users').doc(username).set({
            likedPosts: [],
            posts: [],
        });

        status = "User added successfully";

        return {
            status: status,
            user: cred
        };
    }

    return {status: status};
})