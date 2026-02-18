// Inizializza i post dal localStorage
let posts = JSON.parse(localStorage.getItem('vfind_posts')) || [];
let currentFilter = 'Tutte';

// Funzione per pubblicare
function addPost() {
    const category = document.getElementById('post-category').value;
    const text = document.getElementById('post-text').value;

    if (text.trim() === '') {
        alert('Scrivi qualcosa prima di pubblicare!');
        return;
    }

    const newPost = {
        id: Date.now(),
        category: category,
        text: text,
        comments: [] // Array per i commenti
    };

    posts.unshift(newPost);
    saveAndRender();
    document.getElementById('post-text').value = ''; 
}

// Funzione per i commenti
function addComment(postId) {
    const commentInput = document.getElementById(`comment-input-${postId}`);
    if (!commentInput) return;
    
    const commentText = commentInput.value;
    if (commentText.trim() === '') return;

    const postIndex = posts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
        // Fallback di sicurezza se l'array comments non esiste
        if (!posts[postIndex].comments) {
            posts[postIndex].comments = [];
        }
        posts[postIndex].comments.push(commentText);
        saveAndRender();
    }
}

// Funzione per filtrare
function filterCategory(category) {
    currentFilter = category;
    renderPosts();
}

// Salva e aggiorna
function saveAndRender() {
    localStorage.setItem('vfind_posts', JSON.stringify(posts));
    renderPosts();
}

// Disegna a schermo
function renderPosts() {
    const feed = document.getElementById('feed');
    if (!feed) return; // Sicurezza
    
    feed.innerHTML = ''; 

    const filteredPosts = currentFilter === 'Tutte' 
        ? posts 
        : posts.filter(post => post.category === currentFilter);

    filteredPosts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        
        // Fallback di sicurezza: se post.comments non esiste, usa un array vuoto
        const safeComments = post.comments || [];
        const commentsHTML = safeComments.map(c => `<div class="comment">${c}</div>`).join('');

        postElement.innerHTML = `
            <span class="post-category">${post.category}</span>
            <p class="post-text">${post.text}</p>
            
            <div class="comments-section">
                ${commentsHTML}
                <div class="comment-input-area">
                    <input type="text" id="comment-input-${post.id}" placeholder="Scrivi una risposta...">
                    <button onclick="addComment(${post.id})">Rispondi</button>
                </div>
            </div>
        `;
        feed.appendChild(postElement);
    });
}

// Avvio con blocco di sicurezza (Try/Catch)
try {
    renderPosts();
} catch (error) {
    console.error("Errore di caricamento dati vecchi, resetto la memoria:", error);
    localStorage.removeItem('vfind_posts'); // Pulisce i dati corrotti
    posts = [];
    renderPosts();
}