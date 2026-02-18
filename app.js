// Importiamo Database e Autenticazione (Aggiunto deleteDoc)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// Aggiunti getDoc e setDoc nelle importazioni per evitare crash!
import { getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, arrayUnion, query, orderBy, increment, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
let currentUser = null; 
let isCurrentUserMerchant = false; 
let currentUserShopName = "";

window.login = function() {
    signInWithPopup(auth, provider).catch(error => console.error(error));
}

window.logout = function() {
    signOut(auth);
}

// Quando l'utente entra, Firebase controlla se è un Negoziante
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-pic').src = user.photoURL;
        document.getElementById('create-post-box').style.display = 'flex';
        document.getElementById('login-prompt').style.display = 'none';

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists() && userSnap.data().isMerchant) {
            isCurrentUserMerchant = true;
            currentUserShopName = userSnap.data().shopName;
            document.getElementById('merchant-btn').style.display = 'none';
            document.getElementById('merchant-badge-header').style.display = 'inline-flex';
            document.getElementById('shop-name-display').innerText = currentUserShopName;
        } else {
            isCurrentUserMerchant = false;
            document.getElementById('merchant-btn').style.display = 'block';
            document.getElementById('merchant-badge-header').style.display = 'none';
        }
    } else {
        document.getElementById('login-btn').style.display = 'block';
        document.getElementById('user-info').style.display = 'none';
        document.getElementById('create-post-box').style.display = 'none';
        document.getElementById('login-prompt').style.display = 'block';
        isCurrentUserMerchant = false;
    }
    renderPosts(); 
});

window.registerMerchant = async function() {
    if (!currentUser) return;
    const shopName = prompt("Come si chiama il tuo negozio? (es. Antica Bottega Torrielli)");
    if (shopName && shopName.trim() !== "") {
        try {
            await setDoc(doc(db, "users", currentUser.uid), {
                isMerchant: true,
                shopName: shopName
            }, { merge: true });

            alert("Congratulazioni! Ora sei un Negoziante Verificato 🏪");
            isCurrentUserMerchant = true;
            currentUserShopName = shopName;
            document.getElementById('merchant-btn').style.display = 'none';
            document.getElementById('merchant-badge-header').style.display = 'inline-flex';
            document.getElementById('shop-name-display').innerText = shopName;
            renderPosts();
        } catch (error) { console.error(error); }
    }
}

// PUBBLICARE POST: Ora inizia in automatico con il tuo voto
window.addPost = async function() {
    if (!currentUser) return alert('Devi fare il login!');

    const title = document.getElementById('post-title').value;
    const text = document.getElementById('post-text').value;
    const category = document.getElementById('post-category').value;

    if (title.trim() === '') return alert('Inserisci un titolo!');

    await addDoc(collection(db, "VfindApp_posts"), {
        title: title,
        text: text,
        category: category,
        score: 1, // Parti con un punto...
        upvotedBy: [currentUser.uid], // ...perché ti sei auto-votato!
        downvotedBy: [],
        comments: [],
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName,
        authorPic: currentUser.photoURL,
        authorId: currentUser.uid,
        isMerchant: isCurrentUserMerchant 
    });

    document.getElementById('post-title').value = '';
    document.getElementById('post-text').value = ''; 
}

window.deletePost = async function(postId) {
    if (confirm("Sei sicuro di voler cancellare questo post? L'azione è irreversibile.")) {
        try { await deleteDoc(doc(db, "VfindApp_posts", postId)); } catch (error) { console.error(error); }
    }
}

// NUOVO SISTEMA DI VOTI (Un voto a persona)
window.vote = async function(postId, change) {
    if (!currentUser) return alert('Fai il login per votare!');
    
    // 1. Scarica i dati attuali del post dal database
    const postRef = doc(db, "VfindApp_posts", postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return;
    
    const postData = postSnap.data();
    const upvotedBy = postData.upvotedBy || [];
    const downvotedBy = postData.downvotedBy || [];
    const userId = currentUser.uid;
    
    let newScore = postData.score;
    let newUpvotedBy = [...upvotedBy];
    let newDownvotedBy = [...downvotedBy];

    // Se l'utente clicca freccia in SU
    if (change === 1) {
        if (upvotedBy.includes(userId)) {
            // Se aveva già votato su, togliamo il voto (Azione Annulla)
            newUpvotedBy = newUpvotedBy.filter(id => id !== userId);
            newScore -= 1;
        } else {
            // Aggiungiamo il voto su
            newUpvotedBy.push(userId);
            newScore += 1;
            // E se prima aveva votato giù, togliamolo dalla lista del giù
            if (downvotedBy.includes(userId)) {
                newDownvotedBy = newDownvotedBy.filter(id => id !== userId);
                newScore += 1; // Recupera il punto perso dal downvote
            }
        }
    } 
    // Se l'utente clicca freccia in GIÙ
    else if (change === -1) {
        if (downvotedBy.includes(userId)) {
            // Se aveva già votato giù, togliamo il voto (Azione Annulla)
            newDownvotedBy = newDownvotedBy.filter(id => id !== userId);
            newScore += 1;
        } else {
            // Aggiungiamo il voto giù
            newDownvotedBy.push(userId);
            newScore -= 1;
            // E se prima aveva votato su, togliamolo dalla lista del su
            if (upvotedBy.includes(userId)) {
                newUpvotedBy = newUpvotedBy.filter(id => id !== userId);
                newScore -= 1; // Togli il punto guadagnato prima
            }
        }
    }

    // 2. Aggiorna il post con i nuovi conteggi
    await updateDoc(postRef, {
        score: newScore,
        upvotedBy: newUpvotedBy,
        downvotedBy: newDownvotedBy
    });
}

window.addComment = async function(postId) {
    if (!currentUser) return alert('Devi fare il login per commentare!');
    const commentInput = document.getElementById(`comment-input-${postId}`);
    const commentText = commentInput.value;
    if (commentText.trim() === '') return;

    await updateDoc(doc(db, "VfindApp_posts", postId), {
        comments: arrayUnion({
            text: commentText,
            authorName: isCurrentUserMerchant ? currentUserShopName : currentUser.displayName,
            authorPic: currentUser.photoURL,
            isMerchant: isCurrentUserMerchant 
        })
    });
    commentInput.value = ''; 
}

// Corretto l'errore del filtro mancante nell'HTML
window.filterCategory = function(category) {
    currentFilter = category;
    const items = document.querySelectorAll('#subVfindApp-list li');
    items.forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active'); // Il browser pesca l'evento globale
    renderPosts();
}

const q = query(collection(db, "VfindApp_posts"), orderBy("score", "desc"));
onSnapshot(q, (snapshot) => {
    allPosts = [];
    snapshot.forEach((doc) => {
        allPosts.push({ id: doc.id, ...doc.data() });
    });
    renderPosts();
});

function renderPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = '';

    const filteredPosts = currentFilter === 'Tutte' ? allPosts : allPosts.filter(post => post.category === currentFilter);

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = post.isMerchant ? 'post merchant-post' : 'post';
        
        const safeComments = post.comments || [];
        const commentsHTML = safeComments.map(c => {
            if (typeof c === 'string') return `<div class="comment">👤 Anonimo: ${c}</div>`; 
            const badgeHTML = c.isMerchant ? `<span class="merchant-badge">🏪 Negozio</span>` : '';
            const commentClass = c.isMerchant ? 'comment merchant-comment' : 'comment';
            return `
            <div class="${commentClass}">
                <div style="display:flex; align-items:center; gap:5px; margin-bottom: 4px;">
                    <img src="${c.authorPic}" style="width:16px; height:16px; border-radius:50%">
                    <b style="font-size:0.8rem">${c.authorName}</b> ${badgeHTML}
                </div>
                ${c.text}
            </div>`;
        }).join('');

        const commentInputHTML = currentUser ? `
            <div class="comment-input-area">
                <input type="text" id="comment-input-${post.id}" placeholder="Rispondi a questa richiesta...">
                <button onclick="addComment('${post.id}')">Commenta</button>
            </div>
        ` : `<p style="font-size: 0.8rem; color: #787C7E; margin-top: 10px;">Fai il login per commentare.</p>`;

        const deleteBtnHTML = (currentUser && post.authorId === currentUser.uid) 
            ? `<button onclick="deletePost('${post.id}')" class="delete-btn" title="Cancella il tuo post"><i class="fas fa-trash"></i></button>` : '';

        const postBadgeHTML = post.isMerchant ? `<span class="merchant-badge">🏪 Negoziante Verificato</span>` : '';

        const authorHTML = post.authorName ? `
            <div class="post-author" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${post.authorPic}" class="author-pic">
                    <span class="author-name">${post.authorName}</span>
                    ${postBadgeHTML}
                </div>
                ${deleteBtnHTML}
            </div>
        ` : deleteBtnHTML;

        // CONTROLLO COLORI DELLE FRECCE
        let upClass = "vote-btn";
        let downClass = "vote-btn down";
        
        if (currentUser) {
            const upvotedBy = post.upvotedBy || [];
            const downvotedBy = post.downvotedBy || [];
            if (upvotedBy.includes(currentUser.uid)) upClass += " voted-up"; // Colora di Fucsia
            if (downvotedBy.includes(currentUser.uid)) downClass += " voted-down"; // Colora di Azzurro
        }

        postElement.innerHTML = `
            <div class="vote-column">
                <button class="${upClass}" onclick="vote('${post.id}', 1)"><i class="fas fa-arrow-up"></i></button>
                <span class="score">${post.score}</span>
                <button class="${downClass}" onclick="vote('${post.id}', -1)"><i class="fas fa-arrow-down"></i></button>
            </div>
            <div class="post-content">
                <div class="post-header">
                    <span class="subVfindApp-tag">v/${post.category}</span> • Postato alle ${post.timestamp || 'poco fa'}
                </div>
                ${authorHTML}
                <h3 class="post-title" style="margin-top: 10px;">${post.title}</h3>
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