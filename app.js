// Importiamo gli strumenti di Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, query, orderBy, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Le tue chiavi segrete di Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAnmR_HM0r-K_B0h4MwZGAMVYiY3qyyvgI",
  authDomain: "vfindapp-46cf7.firebaseapp.com",
  projectId: "vfindapp-46cf7",
  storageBucket: "vfindapp-46cf7.firebasestorage.app",
  messagingSenderId: "1097817597800",
  appId: "1:1097817597800:web:b83d6503c22c23a97958dd"
};

// Inizializziamo il Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentFilter = 'Tutte';
let allPosts = []; // Qui salviamo i post scaricati dal cloud

// Funzione per PUBBLICARE un post su Firebase
window.addPost = async function() {
    const title = document.getElementById('post-title').value;
    const text = document.getElementById('post-text').value;
    const category = document.getElementById('post-category').value;

    if (title.trim() === '') {
        alert('Inserisci almeno un titolo per pubblicare!');
        return;
    }

    // Invia i dati al cloud di Google (nella collezione reddit_posts)
    await addDoc(collection(db, "reddit_posts"), {
        title: title,
        text: text,
        category: category,
        score: 1, // Tutti i post partono con 1 punto
        comments: [],
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    });

    // Svuota i campi
    document.getElementById('post-title').value = '';
    document.getElementById('post-text').value = ''; 
}

// Funzione per VOTARE (Upvote/Downvote)
window.vote = async function(postId, change) {
    const postRef = doc(db, "reddit_posts", postId);
    await updateDoc(postRef, {
        score: increment(change) // Firebase fa la matematica in automatico!
    });
}

// Funzione per RISPONDERE (aggiungere commenti)
window.addComment = async function(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    if (!commentInput) return;

    const commentText = commentInput.value;
    if (commentText.trim() === '') return;

    const postRef = doc(db, "reddit_posts", postId);
    await updateDoc(postRef, {
        comments: arrayUnion(commentText)
    });
    
    commentInput.value = ''; // Svuota la barra di risposta
}

// Funzione per filtrare i Subreddits
window.filterCategory = function(category) {
    currentFilter = category;
    
    // Cambia il colore del menu laterale in Fucsia
    const items = document.querySelectorAll('#subreddit-list li');
    items.forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');

    renderPosts();
}

// ASCOLTA IL DATABASE IN TEMPO REALE
// Ordina i post dal più votato (score desc) al meno votato
const q = query(collection(db, "reddit_posts"), orderBy("score", "desc"));
onSnapshot(q, (snapshot) => {
    allPosts = [];
    snapshot.forEach((doc) => {
        allPosts.push({ id: doc.id, ...doc.data() });
    });
    renderPosts();
});

// Disegna a schermo i post
function renderPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = '';

    const filteredPosts = currentFilter === 'Tutte' 
        ? allPosts 
        : allPosts.filter(post => post.category === currentFilter);

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        
        const safeComments = post.comments || [];
        const commentsHTML = safeComments.map(c => `<div class="comment">👤 Utente: ${c}</div>`).join('');

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
                <h3 class="post-title">${post.title}</h3>
                <p class="post-text">${post.text}</p>
                
                <div class="comments-section">
                    ${commentsHTML}
                    <div class="comment-input-area">
                        <input type="text" id="comment-input-${post.id}" placeholder="Cosa ne pensi?">
                        <button onclick="addComment('${post.id}')">Commenta</button>
                    </div>
                </div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}