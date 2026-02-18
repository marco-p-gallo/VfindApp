// Importiamo Database e Autenticazione
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, query, orderBy, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnmR_HM0r-K_B0h4MwZGAmVYiY3qyyvgI",
  authDomain: "vfindapp-46cf7.firebaseapp.com",
  projectId: "vfindapp-46cf7",
  storageBucket: "vfindapp-46cf7.firebasestorage.app",
  messagingSenderId: "1097817597800",
  appId: "1:1097817597800:web:b83d6503c22c23a97958dd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentFilter = 'Tutte';
let allPosts = []; 
let currentUser = null; // Memorizza l'utente attualmente loggato

// 1. GESTIONE LOGIN / LOGOUT
window.login = function() {
    signInWithPopup(auth, provider).catch(error => console.error(error));
}

window.logout = function() {
    signOut(auth);
}

// Ascolta i cambiamenti (quando entri o esci)
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        // Utente Loggato
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-pic').src = user.photoURL;
        
        document.getElementById('create-post-box').style.display = 'flex';
        document.getElementById('login-prompt').style.display = 'none';
    } else {
        // Nessun Utente
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        
        document.getElementById('create-post-box').style.display = 'none';
        document.getElementById('login-prompt').style.display = 'block';
    }
    renderPosts(); // Aggiorna i post per nascondere le barre dei commenti se necessario
});


// 2. PUBBLICARE UN POST (Ora include l'autore)
window.addPost = async function() {
    if (!currentUser) return alert('Devi fare il login!');

    const title = document.getElementById('post-title').value;
    const text = document.getElementById('post-text').value;
    const category = document.getElementById('post-category').value;

    if (title.trim() === '') return alert('Inserisci un titolo!');

    await addDoc(collection(db, "reddit_posts"), {
        title: title,
        text: text,
        category: category,
        score: 1,
        comments: [],
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        
        // Nuovi dati utente!
        authorName: currentUser.displayName,
        authorPic: currentUser.photoURL,
        authorId: currentUser.uid
    });

    document.getElementById('post-title').value = '';
    document.getElementById('post-text').value = ''; 
}

// 3. VOTARE
window.vote = async function(postId, change) {
    if (!currentUser) return alert('Fai il login per votare!');
    const postRef = doc(db, "reddit_posts", postId);
    await updateDoc(postRef, { score: increment(change) });
}

// 4. COMMENTARE (Ora il commento è un oggetto con testo, nome e foto)
window.addComment = async function(postId) {
    if (!currentUser) return alert('Devi fare il login per commentare!');

    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value;
    if (commentText.trim() === '') return;

    const postRef = doc(db, "reddit_posts", postId);
    await updateDoc(postRef, {
        comments: arrayUnion({
            text: commentText,
            authorName: currentUser.displayName,
            authorPic: currentUser.photoURL
        })
    });
    
    commentInput.value = ''; 
}

// 5. FILTRARE CATEGORIE
window.filterCategory = function(category) {
    currentFilter = category;
    const items = document.querySelectorAll('#subreddit-list li');
    items.forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderPosts();
}

// ASCOLTA IL DATABASE IN TEMPO REALE
const q = query(collection(db, "reddit_posts"), orderBy("score", "desc"));
onSnapshot(q, (snapshot) => {
    allPosts = [];
    snapshot.forEach((doc) => {
        allPosts.push({ id: doc.id, ...doc.data() });
    });
    renderPosts();
});

// DISEGNA A SCHERMO
function renderPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = '';

    const filteredPosts = currentFilter === 'Tutte' ? allPosts : allPosts.filter(post => post.category === currentFilter);

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        
        const safeComments = post.comments || [];
        
        // Genera HTML dei commenti gestendo i commenti vecchi e quelli nuovi con utente
        const commentsHTML = safeComments.map(c => {
            if (typeof c === 'string') {
                return `<div class="comment">👤 Anonimo: ${c}</div>`; // Vecchi commenti
            } else {
                return `
                <div class="comment">
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom: 4px;">
                        <img src="${c.authorPic}" style="width:16px; height:16px; border-radius:50%">
                        <b style="font-size:0.8rem">${c.authorName}</b>
                    </div>
                    ${c.text}
                </div>`;
            }
        }).join('');

        // Mostra la barra dei commenti solo se loggato
        const commentInputHTML = currentUser ? `
            <div class="comment-input-area">
                <input type="text" id="comment-input-${post.id}" placeholder="Cosa ne pensi?">
                <button onclick="addComment('${post.id}')">Commenta</button>
            </div>
        ` : `<p style="font-size: 0.8rem; color: #787C7E; margin-top: 10px;">Fai il login per commentare.</p>`;

        // Foto e Nome Autore del Post (con fallback se vecchio post)
        const authorHTML = post.authorName ? `
            <div class="post-author">
                <img src="${post.authorPic}" class="author-pic">
                <span class="author-name">${post.authorName}</span>
            </div>
        ` : '';

        postElement.innerHTML = `
            <div class="vote-column">
                <button class="vote-btn" onclick="vote('${post.id}', 1)"><i class="fas fa-arrow-up"></i></button>
                <span class="score">${post.score}</span>
                <button class="vote-btn down" onclick="vote('${post.id}', -1)"><i class="fas fa-arrow-down"></i></button>
            </div>
            <div class="post-content">
                <div class="post-header">
                    <span class="subreddit-tag">r/${post.category}</span> • Postato alle ${post.timestamp || 'poco fa'}
                </div>
                ${authorHTML}
                <h3 class="post-title">${post.title}</h3>
                <p class="post-text">${post.text}</p>
                
                <div class="comments-section">
                    ${commentsHTML}
                    ${commentInputHTML}
                </div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}